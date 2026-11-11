// 🎬 Réels des membres : vidéos verticales de 60 s max, stockées sur le disque du serveur (pas sur Supabase).
// La vidéo arrive en morceaux de moins de 1 Mo (aucune limite de taille de requête du serveur web ne bloque),
// puis la publication l'enregistre dans le réglage « ureels » (les plus récents d'abord).
import { Router } from "express";
import express from "express";
import { appendFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { getSetting, setSetting, findEventBySlug } from "../lib/store.js";
import { requireOrganizer, isAdmin } from "./auth.js";
import { tooFast } from "../lib/limits.js";
import { UPLOAD_DIR } from "../lib/uploads.js";
import { notify, orgOwner } from "../lib/push.js";

const router = Router();
const MAX_BYTES = 80 * 1024 * 1024;
const EXT = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
const clean = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const tmpOf = (orgId, u) => `${UPLOAD_DIR}/reel-tmp-${orgId}-${u}`;
mkdirSync(UPLOAD_DIR, { recursive: true });

// Envois commencés puis abandonnés (fichiers reel-tmp-*) : supprimés au bout d'une heure.
setInterval(() => {
  for (const f of readdirSync(UPLOAD_DIR)) {
    if (!f.startsWith("reel-tmp-")) continue;
    try { if (Date.now() - statSync(`${UPLOAD_DIR}/${f}`).mtimeMs > 3600_000) unlinkSync(`${UPLOAD_DIR}/${f}`); } catch { /* déjà supprimé */ }
  }
}, 15 * 60 * 1000).unref();

export const listUserReels = async () => (await getSetting("ureels").catch(() => null)) || [];

// Miniature noire (iPhone : image pas encore décodée) : retirée, l'appli montre alors la 1re image de la vidéo.
const sharp = await import("sharp").then((m) => m.default).catch(() => null);
async function darkThumb(file) {
  if (!sharp) return false;
  try { const { channels } = await sharp(file).stats(); return channels.slice(0, 3).every((c) => c.mean < 12); } catch { return false; }
}
setTimeout(async () => { // une fois au démarrage, pour les réels déjà publiés
  const list = await listUserReels().catch(() => []);
  let changed = false;
  for (const r of list) if (r.thumb?.startsWith("/uploads/") && await darkThumb(`${UPLOAD_DIR}/${r.thumb.slice(9)}`)) { removeFile(r.thumb); r.thumb = ""; changed = true; }
  if (changed) await setSetting("ureels", list).catch(() => {});
}, 5000);
const removeFile = (url) => { try { if (url?.startsWith("/uploads/")) unlinkSync(`${UPLOAD_DIR}/${url.slice(9)}`); } catch { /* déjà absent */ } };

// Suppression d'un réel et de ses fichiers (auteur, modération).
export async function removeReel(id) {
  const list = await listUserReels();
  const k = list.findIndex((r) => r.id === id);
  if (k < 0) return false;
  const [r] = list.splice(k, 1);
  removeFile(r.src); removeFile(r.thumb);
  await setSetting("ureels", list);
  return true;
}

// Morceau de vidéo (dans l'ordre : i = 0, 1, 2…).
router.post("/chunk", requireOrganizer, express.raw({ type: () => true, limit: "1mb" }), async (req, res) => {
  const u = String(req.query.u || ""), i = Number(req.query.i);
  if (await tooFast(`reelchunk:${req.organizer.id}`, 400, 3600_000)) return res.status(429).json({ error: "Trop d'envois, réessayez plus tard." }); // ≈ 350 Mo / h
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
  if (m && m[1].length < 700_000) {
    writeFileSync(`${UPLOAD_DIR}/${id}.jpg`, Buffer.from(m[1], "base64"));
    if (await darkThumb(`${UPLOAD_DIR}/${id}.jpg`)) removeFile(`/uploads/${id}.jpg`); else thumb = `/uploads/${id}.jpg`;
  }
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

// Mes réels (menu du profil).
router.get("/mine", requireOrganizer, async (req, res) => {
  res.json((await listUserReels()).filter((r) => r.by === req.organizer.id));
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

// 💬 Commentaires d'un réel de membre (lecture libre, écriture avec un compte). Réglage « reelc:{id} ».
const reelOf = async (id) => (await listUserReels()).find((r) => r.id === id);
router.get("/:id/comments", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(((await getSetting(`reelc:${String(req.params.id).slice(0, 20)}`).catch(() => null)) || []).slice(-200));
});
router.post("/:id/comments", requireOrganizer, async (req, res) => {
  const reel = await reelOf(req.params.id);
  if (!reel) return res.status(404).json({ error: "Réel introuvable." });
  const text = clean(req.body?.text, 300);
  if (!text) return res.status(400).json({ error: "Écrivez un commentaire." });
  if (await tooFast(`reelcom:${req.organizer.id}`, 30, 3600_000)) return res.status(429).json({ error: "Trop de commentaires, réessayez plus tard." });
  const name = clean(req.organizer.displayName || req.organizer.email?.split("@")[0], 40);
  const c = { id: randomBytes(6).toString("hex"), by: req.organizer.id, name, text, at: new Date().toISOString() };
  const list = ((await getSetting(`reelc:${reel.id}`).catch(() => null)) || []);
  list.push(c);
  await setSetting(`reelc:${reel.id}`, list.slice(-500));
  // Nombre de commentaires gardé sur le réel (affiché sans charger la liste).
  const all = await listUserReels(), r = all.find((x) => x.id === reel.id);
  if (r) { r.nc = list.length; await setSetting("ureels", all); }
  if (reel.by !== req.organizer.id) notify([orgOwner(reel.by)], { title: `💬 ${name} a commenté votre réel`, body: text.slice(0, 140), url: `/dashboard#reels` }).catch(() => {});
  res.status(201).json(c);
});
router.delete("/:id/comments/:cid", requireOrganizer, async (req, res) => {
  const reel = await reelOf(req.params.id);
  const list = (reel && await getSetting(`reelc:${reel.id}`).catch(() => null)) || [];
  const c = list.find((x) => x.id === req.params.cid);
  if (!c) return res.status(404).json({ error: "Commentaire introuvable." });
  if (c.by !== req.organizer.id && reel.by !== req.organizer.id && !(await isAdmin(req.organizer))) return res.status(403).json({ error: "Action non autorisée." });
  const rest = list.filter((x) => x !== c);
  await setSetting(`reelc:${reel.id}`, rest);
  const all = await listUserReels(), r = all.find((x) => x.id === reel.id);
  if (r) { r.nc = rest.length; await setSetting("ureels", all); }
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
