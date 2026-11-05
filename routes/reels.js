// 🎬 Réels des membres : vidéos verticales de 60 s max, stockées sur le disque du serveur (pas sur Supabase).
// La vidéo arrive en morceaux de moins de 1 Mo (aucune limite de taille de requête du serveur web ne bloque),
// puis la publication l'enregistre dans le réglage « ureels » (les plus récents d'abord).
import { Router } from "express";
import express from "express";
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { getSetting, setSetting, findEventBySlug } from "../lib/store.js";
import { requireOrganizer, isAdmin } from "./auth.js";
import { tooFast } from "../lib/limits.js";
import { UPLOAD_DIR } from "../lib/uploads.js";

const router = Router();
const MAX_BYTES = 80 * 1024 * 1024;
const EXT = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
const clean = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const tmpOf = (orgId, u) => `${UPLOAD_DIR}/reel-tmp-${orgId}-${u}`;
mkdirSync(UPLOAD_DIR, { recursive: true });

export const listUserReels = async () => (await getSetting("ureels").catch(() => null)) || [];
const removeFile = (url) => { try { if (url?.startsWith("/uploads/")) unlinkSync(`${UPLOAD_DIR}/${url.slice(9)}`); } catch { /* déjà absent */ } };

// Morceau de vidéo (dans l'ordre : i = 0, 1, 2…).
router.post("/chunk", requireOrganizer, express.raw({ type: () => true, limit: "1mb" }), (req, res) => {
  const u = String(req.query.u || ""), i = Number(req.query.i);
  if (!/^[a-f0-9]{16}$/.test(u) || !Number.isInteger(i) || i < 0) return res.status(400).json({ error: "Envoi invalide." });
  const file = tmpOf(req.organizer.id, u);
  if (i === 0 && existsSync(file)) unlinkSync(file);
  if (i > 0 && !existsSync(file)) return res.status(400).json({ error: "Envoi interrompu, réessayez." });
  if ((i > 0 ? statSync(file).size : 0) + req.body.length > MAX_BYTES) { unlinkSync(file); return res.status(413).json({ error: "Vidéo trop lourde (80 Mo max)." }); }
  appendFileSync(file, req.body);
  res.json({ ok: true });
});

// Publication : vidéo envoyée + légende, miniature et événement facultatif.
router.post("/", requireOrganizer, async (req, res) => {
  const u = String(req.body?.u || ""), type = String(req.body?.type || "").split(";")[0].trim().toLowerCase();
  const file = tmpOf(req.organizer.id, u);
  if (!/^[a-f0-9]{16}$/.test(u) || !existsSync(file)) return res.status(400).json({ error: "Vidéo introuvable, réessayez." });
  if (!EXT[type]) { unlinkSync(file); return res.status(400).json({ error: "Format vidéo non accepté (MP4, MOV ou WebM)." }); }
  if (await tooFast(`reel:${req.organizer.id}`, 10, 24 * 3600 * 1000)) { unlinkSync(file); return res.status(429).json({ error: "10 réels par jour maximum." }); }
  const id = randomBytes(8).toString("hex");
  renameSync(file, `${UPLOAD_DIR}/${id}.${EXT[type]}`);
  let thumb = "";
  const m = /^data:image\/jpeg;base64,(.+)$/.exec(String(req.body?.thumb || ""));
  if (m && m[1].length < 700_000) { writeFileSync(`${UPLOAD_DIR}/${id}.jpg`, Buffer.from(m[1], "base64")); thumb = `/uploads/${id}.jpg`; }
  // Événement lié : seulement un des siens, et public (le réel est visible de tous).
  let event = null;
  const ev = req.body?.slug ? await findEventBySlug(String(req.body.slug)).catch(() => null) : null;
  if (ev && ev.organizerId === req.organizer.id && ev.visibility === "public" && !ev.suspended) event = { slug: ev.slug, name: ev.name, cagnotteUrl: ev.cagnotteUrl || "" };
  const reel = { id, by: req.organizer.id, name: clean(req.organizer.displayName || req.organizer.email?.split("@")[0], 40), caption: clean(req.body?.caption, 150),
    src: `/uploads/${id}.${EXT[type]}`, thumb, event, at: new Date().toISOString(), reports: 0 };
  const list = await listUserReels();
  list.unshift(reel);
  for (const old of list.splice(3000)) { removeFile(old.src); removeFile(old.thumb); } // 3 000 réels gardés au plus
  await setSetting("ureels", list);
  res.status(201).json(reel);
});

// Suppression : l'auteur, ou un administrateur (modération).
router.delete("/:id", requireOrganizer, async (req, res) => {
  const list = await listUserReels();
  const k = list.findIndex((r) => r.id === req.params.id);
  if (k < 0) return res.status(404).json({ error: "Réel introuvable." });
  if (list[k].by !== req.organizer.id && !(await isAdmin(req.organizer))) return res.status(403).json({ error: "Action non autorisée." });
  const [r] = list.splice(k, 1);
  removeFile(r.src); removeFile(r.thumb);
  await setSetting("ureels", list);
  res.json({ ok: true });
});

// Signalement (sans compte possible) : masqué automatiquement après 3 signalements, en attendant la modération.
router.post("/:id/report", async (req, res) => {
  if (await tooFast(`reelrep:${req.ip}:${req.params.id}`, 1, 24 * 3600 * 1000)) return res.json({ ok: true });
  const list = await listUserReels();
  const r = list.find((x) => x.id === req.params.id);
  if (r) { r.reports = (r.reports || 0) + 1; await setSetting("ureels", list); }
  res.json({ ok: true });
});

export default router;
