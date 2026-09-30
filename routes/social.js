// Interactions des invités sur un événement : chat, réactions, photos.
// Monté sur /api/public/:slug — accessible à toute personne ayant accès à l'événement.
import { Router } from "express";
import { tooFast } from "../lib/limits.js";
import { notify, orgOwner } from "../lib/push.js";
import { ping, eventTopic } from "../lib/realtime.js";
import { recordPeak } from "../lib/premium.js";
import {
  findEventBySlug, addMessage, listMessages, addPhoto, listPhotos, findPhoto, deletePhoto,
  addGuestbookEntry, listGuestbook, findGuestbookEntry, updateGuestbookEntry, likeGuestbookEntry, deleteGuestbookEntry,
  findEventMessage, deleteMessage, addReport, saveEvent, touchPresence,
} from "../lib/store.js";
import { guestAuthor } from "../lib/guest.js";
import { saveDataUrl, removeUpload, isOwnUpload, isVideoUrl, videoUploadTarget, MAX_VIDEO_BYTES } from "../lib/uploads.js";
import { hasAccess } from "./public.js";
import { currentOrganizer } from "./auth.js";

const router = Router({ mergeParams: true });

export const REACTIONS = ["❤️", "👏", "😍", "🎆", "🍾"];
const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);


// Charge l'événement et vérifie l'accès (public, code saisi ou organisateur).
router.use(async (req, res, next) => {
  const event = await findEventBySlug(req.params.slug);
  if (!event || event.suspended) return res.status(404).json({ error: "Événement introuvable." });
  if (!(await hasAccess(req, event))) return res.status(403).json({ error: "Accès réservé aux invités." });
  req.event = event;
  req.author = guestAuthor(req, res);
  next();
});

// Contenus des personnes bloquées par l'organisateur : masqués pour tout le monde.
const visible = (req, items) => items.filter((i) => !i.author || !(req.event.blockedAuthors || []).includes(i.author));

// Une personne bloquée ne peut plus rien publier sur l'événement.
function notBlocked(req, res, next) {
  if ((req.event.blockedAuthors || []).includes(req.author)) {
    return res.status(403).json({ error: "Vous ne pouvez plus publier sur cet événement." });
  }
  next();
}

// Nouveaux messages et réactions depuis `after` (interrogé toutes les quelques secondes).
router.get("/feed", async (req, res) => {
  const after = Math.max(0, Number(req.query.after) || 0);
  res.json(visible(req, await listMessages(req.event.id, after)));
});

router.post("/messages", notBlocked, async (req, res) => {
  const name = clean(req.body?.name, 30);
  const text = clean(req.body?.text, 200);
  if (!name || !text) return res.status(400).json({ error: "Prénom et message obligatoires." });
  if (await tooFast(`${req.ip}:msg`, 5, 10_000)) return res.status(429).json({ error: "Doucement ! Attendez quelques secondes." });
  const msg = await addMessage(req.event.id, { kind: "chat", name, text, author: req.author });
  await ping(eventTopic(req.event.slug));
  res.status(201).json(msg);
});

router.post("/reactions", notBlocked, async (req, res) => {
  const emoji = String(req.body?.emoji || "");
  if (!REACTIONS.includes(emoji)) return res.status(400).json({ error: "Réaction inconnue." });
  if (await tooFast(`${req.ip}:reaction`, 10, 10_000)) return res.status(429).json({ error: "Trop de réactions d'un coup." });
  const msg = await addMessage(req.event.id, { kind: "reaction", name: clean(req.body?.name, 30) || "Invité", text: emoji, author: req.author });
  await ping(eventTopic(req.event.slug));
  res.status(201).json(msg);
});

router.get("/photos", async (req, res) => {
  res.json(visible(req, await listPhotos(req.event.id, Math.min(Number(req.query.limit) || 60, 200))));
});

router.post("/photos", notBlocked, async (req, res) => {
  const name = clean(req.body?.name, 30);
  if (!name) return res.status(400).json({ error: "Prénom obligatoire." });
  if (await tooFast(`${req.ip}:photo`, 20, 3_600_000)) return res.status(429).json({ error: "Limite de photos atteinte, réessayez plus tard." });
  try {
    const url = req.body?.image ? await saveDataUrl(req.body.image) : await videoFrom(req.body);
    if (!url) return res.status(400).json({ error: "Ajoutez une photo ou une vidéo." });
    res.status(201).json(await addPhoto(req.event.id, { name, url, author: req.author }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Vidéo courte : envoyée en base64 (`video`, sans Supabase) ou déjà déposée via URL signée (`videoUrl`).
async function videoFrom(body) {
  if (body?.video) return saveDataUrl(body.video, "video");
  if (body?.videoUrl) {
    if (!isOwnUpload(body.videoUrl) || !isVideoUrl(body.videoUrl)) throw new Error("Vidéo invalide.");
    return body.videoUrl;
  }
  return null;
}

// Prépare l'envoi direct d'une vidéo vers le stockage (URL signée Supabase, sinon envoi via l'API).
router.post("/upload-url", notBlocked, async (req, res) => {
  if (await tooFast(`${req.ip}:video`, 10, 3_600_000)) return res.status(429).json({ error: "Limite de vidéos atteinte, réessayez plus tard." });
  if (Number(req.body?.size) > MAX_VIDEO_BYTES) return res.status(400).json({ error: "Vidéo trop lourde (50 Mo max)." });
  try {
    res.json(await videoUploadTarget(String(req.body?.type || "")));
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
  res.json(visible(req, await listGuestbook(req.event.id)));
});

router.post("/guestbook", notBlocked, async (req, res) => {
  const name = clean(req.body?.name, 30);
  const text = String(req.body?.text ?? "").trim().slice(0, 1000);
  if (!name) return res.status(400).json({ error: "Prénom obligatoire." });
  if (!text && !req.body?.image && !req.body?.audio && !req.body?.video && !req.body?.videoUrl) {
    return res.status(400).json({ error: "Écrivez un message, ajoutez une photo, une vidéo ou un vocal." });
  }
  if (await tooFast(`${req.ip}:gb`, 5, 600_000)) return res.status(429).json({ error: "Merci ! Réessayez dans quelques minutes." });
  try {
    // La vidéo courte éventuelle est rangée dans le champ « photo » (détectée par son extension).
    const photoUrl = req.body?.image ? await saveDataUrl(req.body.image) : await videoFrom(req.body);
    const audioUrl = req.body?.audio ? await saveDataUrl(req.body.audio, "audio") : null;
    const entry = await addGuestbookEntry(req.event.id, { name, text, photoUrl, audioUrl, author: req.author });
    notify([orgOwner(req.event.organizerId)], {
      title: `✍️ Livre d'or — ${req.event.name}`, body: `${name} : ${text || "a partagé un souvenir"}`.slice(0, 140), url: `/e/${req.event.slug}#gb-list`,
    }).catch(() => {});
    res.status(201).json(entry);
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
  if (await tooFast(`${req.ip}:like`, 30, 60_000)) return res.status(429).json({ error: "Doucement !" });
  const entry = await entryOf(req, res);
  if (entry) res.json(await likeGuestbookEntry(entry));
});

// Réponse à un message du livre d'or (50 max par message).
router.post("/guestbook/:id/replies", notBlocked, async (req, res) => {
  const name = clean(req.body?.name, 30);
  const text = String(req.body?.text ?? "").trim().slice(0, 500);
  if (!name || !text) return res.status(400).json({ error: "Écrivez votre réponse." });
  if (await tooFast(`${req.ip}:reply`, 5, 60_000)) return res.status(429).json({ error: "Doucement ! Attendez quelques secondes." });
  const entry = await entryOf(req, res);
  if (!entry) return;
  const replies = [...(entry.replies || []), { name, text, author: req.author, at: new Date().toISOString() }].slice(-50);
  const owners = [orgOwner(req.event.organizerId), entry.author && `gid:${entry.author}`].filter((o) => o && o !== `gid:${req.author}`);
  notify(owners, { title: `💬 ${name} a répondu`, body: text.slice(0, 140), url: `/e/${req.event.slug}#gb-list` }).catch(() => {});
  res.status(201).json(await updateGuestbookEntry(entry, { replies }));
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

// Présence d'un spectateur du live (appelé toutes les 15 s) : renvoie le nombre de spectateurs.
router.post("/presence", async (req, res) => {
  const clientId = String(req.body?.clientId || "").replace(/[^\w-]/g, "").slice(0, 40);
  if (!clientId) return res.status(400).json({ error: "Identifiant manquant." });
  const viewers = await touchPresence(req.event.id, clientId);
  await recordPeak(req.event.id, viewers);
  res.json({ viewers });
});

// --- Modération ---
// Signaler un contenu (message, photo, livre d'or) : visible par l'organisateur et l'administration.
router.post("/reports", async (req, res) => {
  const kind = String(req.body?.kind || "");
  const itemId = Number(req.body?.itemId);
  if (!["message", "photo", "guestbook"].includes(kind) || !itemId) return res.status(400).json({ error: "Signalement invalide." });
  if (await tooFast(`${req.ip}:report`, 10, 3_600_000)) return res.status(429).json({ error: "Trop de signalements, réessayez plus tard." });
  await addReport(req.event.id, { kind, itemId, reason: clean(req.body?.reason, 300), author: req.author });
  res.status(201).json({ ok: true });
});

// Organisateur : supprimer un message du chat.
router.delete("/messages/:id", ownerOnly, async (req, res) => {
  const message = await findEventMessage(req.event.id, Number(req.params.id));
  if (!message) return res.status(404).json({ error: "Message introuvable." });
  await deleteMessage(message);
  res.json({ ok: true });
});

// Organisateur : bloquer / débloquer une personne (identifiée par son auteur anonyme).
router.post("/blocks", ownerOnly, async (req, res) => {
  const author = String(req.body?.author || "").slice(0, 20);
  if (!author) return res.status(400).json({ error: "Personne inconnue." });
  const blockedAuthors = [...new Set([...(req.event.blockedAuthors || []), author])];
  await saveEvent({ ...req.event, blockedAuthors });
  res.json({ blocked: blockedAuthors.length });
});

router.delete("/blocks", ownerOnly, async (req, res) => {
  await saveEvent({ ...req.event, blockedAuthors: [] });
  res.json({ blocked: 0 });
});

export default router;
