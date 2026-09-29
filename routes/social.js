// Interactions des invités sur un événement : chat, réactions, photos.
// Monté sur /api/public/:slug — accessible à toute personne ayant accès à l'événement.
import { Router } from "express";
import { findEventBySlug, addMessage, listMessages, addPhoto, listPhotos, findPhoto, deletePhoto } from "../lib/store.js";
import { saveDataUrl, removeUpload } from "../lib/uploads.js";
import { hasAccess } from "./public.js";
import { currentOrganizer } from "./auth.js";

const router = Router({ mergeParams: true });

export const REACTIONS = ["❤️", "👏", "😍", "🎆", "🍾"];
const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// Limite de débit simple en mémoire (par instance) : `max` actions par `windowMs`.
const hits = new Map();
function tooFast(key, max, windowMs) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

// Charge l'événement et vérifie l'accès (public, code saisi ou organisateur).
router.use(async (req, res, next) => {
  const event = await findEventBySlug(req.params.slug);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  if (!(await hasAccess(req, event))) return res.status(403).json({ error: "Accès réservé aux invités." });
  req.event = event;
  next();
});

// Nouveaux messages et réactions depuis `after` (interrogé toutes les quelques secondes).
router.get("/feed", async (req, res) => {
  const after = Math.max(0, Number(req.query.after) || 0);
  res.json(await listMessages(req.event.id, after));
});

router.post("/messages", async (req, res) => {
  const name = clean(req.body?.name, 30);
  const text = clean(req.body?.text, 200);
  if (!name || !text) return res.status(400).json({ error: "Prénom et message obligatoires." });
  if (tooFast(`${req.ip}:msg`, 5, 10_000)) return res.status(429).json({ error: "Doucement ! Attendez quelques secondes." });
  res.status(201).json(await addMessage(req.event.id, { kind: "chat", name, text }));
});

router.post("/reactions", async (req, res) => {
  const emoji = String(req.body?.emoji || "");
  if (!REACTIONS.includes(emoji)) return res.status(400).json({ error: "Réaction inconnue." });
  if (tooFast(`${req.ip}:reaction`, 10, 10_000)) return res.status(429).json({ error: "Trop de réactions d'un coup." });
  res.status(201).json(await addMessage(req.event.id, { kind: "reaction", name: clean(req.body?.name, 30) || "Invité", text: emoji }));
});

router.get("/photos", async (req, res) => {
  res.json(await listPhotos(req.event.id, Math.min(Number(req.query.limit) || 60, 200)));
});

router.post("/photos", async (req, res) => {
  const name = clean(req.body?.name, 30);
  if (!name) return res.status(400).json({ error: "Prénom obligatoire." });
  if (tooFast(`${req.ip}:photo`, 20, 3_600_000)) return res.status(429).json({ error: "Limite de photos atteinte, réessayez plus tard." });
  try {
    const url = await saveDataUrl(req.body?.image);
    res.status(201).json(await addPhoto(req.event.id, { name, url }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Modération : seul l'organisateur peut retirer une photo.
router.delete("/photos/:id", async (req, res) => {
  if ((await currentOrganizer(req))?.id !== req.event.organizerId) {
    return res.status(403).json({ error: "Réservé à l'organisateur." });
  }
  const photo = await findPhoto(Number(req.params.id));
  if (!photo || photo.eventId !== req.event.id) return res.status(404).json({ error: "Photo introuvable." });
  await deletePhoto(photo);
  await removeUpload(photo.url);
  res.json({ ok: true });
});

export default router;
