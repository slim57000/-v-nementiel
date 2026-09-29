// Interactions des invités sur un événement : chat, réactions, photos.
// Monté sur /api/public/:slug — accessible à toute personne ayant accès à l'événement.
import { Router } from "express";
import {
  findEventBySlug, addMessage, listMessages, addPhoto, listPhotos, findPhoto, deletePhoto,
  addGuestbookEntry, listGuestbook, findGuestbookEntry, updateGuestbookEntry, likeGuestbookEntry, deleteGuestbookEntry,
} from "../lib/store.js";
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

const isOwner = async (req) => (await currentOrganizer(req))?.id === req.event.organizerId;
const ownerOnly = async (req, res, next) =>
  (await isOwner(req)) ? next() : res.status(403).json({ error: "Réservé à l'organisateur." });

// Modération : seul l'organisateur peut retirer une photo.
router.delete("/photos/:id", ownerOnly, async (req, res) => {
  const photo = await findPhoto(Number(req.params.id));
  if (!photo || photo.eventId !== req.event.id) return res.status(404).json({ error: "Photo introuvable." });
  await deletePhoto(photo);
  await removeUpload(photo.url);
  res.json({ ok: true });
});

// --- Livre d'or : texte, photo et/ou message vocal ---
router.get("/guestbook", async (req, res) => {
  res.json(await listGuestbook(req.event.id));
});

router.post("/guestbook", async (req, res) => {
  const name = clean(req.body?.name, 30);
  const text = String(req.body?.text ?? "").trim().slice(0, 1000);
  if (!name) return res.status(400).json({ error: "Prénom obligatoire." });
  if (!text && !req.body?.image && !req.body?.audio) {
    return res.status(400).json({ error: "Écrivez un message, ajoutez une photo ou un vocal." });
  }
  if (tooFast(`${req.ip}:gb`, 5, 600_000)) return res.status(429).json({ error: "Merci ! Réessayez dans quelques minutes." });
  try {
    const photoUrl = req.body?.image ? await saveDataUrl(req.body.image) : null;
    const audioUrl = req.body?.audio ? await saveDataUrl(req.body.audio, "audio") : null;
    res.status(201).json(await addGuestbookEntry(req.event.id, { name, text, photoUrl, audioUrl }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Charge une entrée du livre d'or appartenant à l'événement courant.
async function entryOf(req, res) {
  const entry = await findGuestbookEntry(Number(req.params.id));
  if (!entry || entry.eventId !== req.event.id) res.status(404).json({ error: "Message introuvable." });
  return entry?.eventId === req.event.id ? entry : null;
}

router.post("/guestbook/:id/like", async (req, res) => {
  if (tooFast(`${req.ip}:like`, 30, 60_000)) return res.status(429).json({ error: "Doucement !" });
  const entry = await entryOf(req, res);
  if (entry) res.json(await likeGuestbookEntry(entry));
});

// Organisateur : mettre en avant / retirer.
router.patch("/guestbook/:id", ownerOnly, async (req, res) => {
  const entry = await entryOf(req, res);
  if (entry) res.json(await updateGuestbookEntry(entry, { pinned: Boolean(req.body?.pinned) }));
});

router.delete("/guestbook/:id", ownerOnly, async (req, res) => {
  const entry = await entryOf(req, res);
  if (!entry) return;
  await deleteGuestbookEntry(entry);
  await Promise.all([removeUpload(entry.photoUrl), removeUpload(entry.audioUrl)]);
  res.json({ ok: true });
});

export default router;
