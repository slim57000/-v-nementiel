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
import { getSetting, setSetting } from "../lib/store.js";
import { saveDataUrl, removeUpload, isOwnUpload, isVideoUrl, videoUploadTarget, MAX_VIDEO_BYTES } from "../lib/uploads.js";
import { hasAccess } from "./public.js";
import { currentOrganizer } from "./auth.js";
import { LIVEKIT_ENABLED, LIVEKIT_URL, lkToken, isLkRoom, isLive } from "../lib/livekit.js";

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

// Lecteur du live « téléphone » : jeton de lecture seule pour une caméra de cet événement.
// Lecteur : jeton si le direct est en cours, et les segments du replay déjà enregistrés.
router.get("/lk", async (req, res) => {
  const room = String(req.query.room || "");
  if (!isLkRoom(req.event, room)) return res.status(404).json({ error: "Direct introuvable." });
  const [live, all] = await Promise.all([isLive(room), getSetting(`replay:${req.event.id}`)]);
  // (replay supprimé par l'organisateur : la liste a été vidée)
  // Replay retiré par l'organisateur : invisible pour les invités (l'organisateur le voit toujours).
  const past = req.event.date < new Date().toISOString().slice(0, 10);
  const hidden = past && (await getSetting(`replayhide:${req.event.id}`)) && !(await isOwner(req));
  const replay = hidden ? [] : (all || []).filter((s) => s.room === room).map((s) => s.url);
  res.json({
    live: live && LIVEKIT_ENABLED, replay,
    ...(live && LIVEKIT_ENABLED && { url: LIVEKIT_URL, token: lkToken({ room, identity: `v-${req.author}-${Date.now().toString(36)}`, name: "Invité" }) }),
  });
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

// --- Réponse à l'invitation (RSVP) : une réponse par invité (identité anonyme), modifiable ---
const RSVP = ["yes", "maybe", "no"];
router.get("/rsvp", async (req, res) => {
  const all = (await getSetting(`rsvp:${req.event.id}`).catch(() => null)) || {};
  const list = Object.values(all);
  const people = (st) => list.filter((r) => r.status === st).reduce((n, r) => n + (r.count || 1), 0);
  res.json({
    yes: people("yes"), maybe: people("maybe"), no: list.filter((r) => r.status === "no").length,
    mine: all[req.author] || null,
    list: (await isOwner(req)) ? list.sort((a, b) => RSVP.indexOf(a.status) - RSVP.indexOf(b.status)) : undefined,
  });
});
router.post("/rsvp", notBlocked, async (req, res) => {
  const status = String(req.body?.status || "");
  const name = clean(req.body?.name, 30);
  if (!RSVP.includes(status) || !name) return res.status(400).json({ error: "Réponse invalide." });
  if (await tooFast(`${req.ip}:rsvp`, 10, 60_000)) return res.status(429).json({ error: "Doucement !" });
  const count = status === "no" ? 0 : Math.min(Math.max(Number(req.body?.count) || 1, 1), 10);
  const key = `rsvp:${req.event.id}`;
  const all = (await getSetting(key).catch(() => null)) || {};
  const isNew = !all[req.author];
  all[req.author] = { name, status, count, at: new Date().toISOString() };
  await setSetting(key, all);
  if (isNew && status !== "no") {
    notify([orgOwner(req.event.organizerId)], { title: `✅ ${name} ${status === "yes" ? "vient" : "viendra peut-être"}`, body: `${req.event.name}${count > 1 ? ` · ${count} personnes` : ""}`, url: `/e/${req.event.slug}` }).catch(() => {});
  }
  res.json({ ok: true });
});

// --- Ajouter au calendrier (.ics : iPhone, Android, Outlook) ---
router.get("/calendar.ics", (req, res) => {
  const e = req.event;
  const start = `${e.date.replace(/-/g, "")}T${(e.time || "12:00").replace(":", "")}00`;
  const end = new Date(`${e.date}T${e.time || "12:00"}:00Z`); end.setUTCHours(end.getUTCHours() + 5);
  const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, "");
  const txt = (v) => String(v || "").replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const url = `${req.protocol}://${req.get("host")}/e/${e.slug}`;
  res.type("text/calendar").set("Content-Disposition", `attachment; filename="${e.slug}.ics"`).send([
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MaFeliza//FR", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${e.slug}@mafeliza.com`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, `DTEND:${end.toISOString().slice(0, 19).replace(/[-:]/g, "")}`,
    `SUMMARY:${txt(e.name)}`, `LOCATION:${txt(e.location)}`, `DESCRIPTION:${txt(`${e.description || ""}\n${url}`)}`, `URL:${url}`,
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", `DESCRIPTION:${txt(e.name)} demain`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n"));
});

router.get("/photos", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 60, 200);
  res.json(visible(req, (await listPhotos(req.event.id, limit + 50)).filter((p) => !p.story).slice(0, limit)));
});

// Stories des dernières 24 h (les plus anciennes d'abord, comme sur Instagram).
const DAY = 24 * 3600 * 1000;
export const activeStories = (photos) => photos.filter((p) => p.story && Date.now() - new Date(p.createdAt) < DAY).reverse();
router.get("/stories", async (req, res) => {
  res.json(await withReactions(visible(req, activeStories(await listPhotos(req.event.id, 200)))));
});

// Réactions aux stories : compteur par emoji (réglage « storyreact:{id} »), l'organisateur est prévenu.
export const STORY_EMOJIS = ["❤️", "😂", "😍", "👏", "🔥", "😮"];
export const withReactions = (list) => Promise.all(list.map(async (p) => ({
  ...p,
  reactions: (await getSetting(`storyreact:${p.id}`).catch(() => null)) || {},
  comments: (await getSetting(`storycomments:${p.id}`).catch(() => null)) || [],
})));
router.post("/stories/:id/react", async (req, res) => {
  const emoji = String(req.body?.emoji || "");
  if (!STORY_EMOJIS.includes(emoji)) return res.status(400).json({ error: "Réaction inconnue." });
  if (await tooFast(`${req.ip}:storyreact`, 60, 600_000)) return res.status(429).json({ error: "Doucement 🙂 réessayez dans un instant." });
  const photo = await findPhoto(Number(req.params.id) || req.params.id);
  if (!photo?.story || photo.eventId !== req.event.id) return res.status(404).json({ error: "Story introuvable." });
  const key = `storyreact:${photo.id}`;
  const counts = (await getSetting(key).catch(() => null)) || {};
  counts[emoji] = (counts[emoji] || 0) + 1;
  await setSetting(key, counts);
  // Une seule notification par personne et par story et par heure (pas de rafale).
  if (!(await tooFast(`${req.ip}:storynotif:${photo.id}`, 1, 3_600_000))) {
    const who = String(req.body?.name || "").trim().slice(0, 30) || "Un invité";
    notify([orgOwner(req.event.organizerId)], { title: `${emoji} Réaction à votre story`, body: `${who} a réagi à votre story de « ${req.event.name} »`, url: `/e/${req.event.slug}` }).catch(() => {});
  }
  res.json(counts);
});

// Commentaires des stories : visibles par tous ceux qui voient la story ; l'organisateur peut en retirer.
async function storyOf(req) {
  const photo = await findPhoto(Number(req.params.id) || req.params.id);
  return photo?.story && photo.eventId === req.event.id ? photo : null;
}
router.post("/stories/:id/comments", notBlocked, async (req, res) => {
  const me = await currentOrganizer(req).catch(() => null);
  const name = clean(me?.displayName || me?.email?.split("@")[0] || req.body?.name, 30);
  const text = clean(req.body?.text, 300);
  if (!name || !text) return res.status(400).json({ error: "Écrivez votre commentaire." });
  if (await tooFast(`${req.ip}:storycomment`, 10, 60_000)) return res.status(429).json({ error: "Doucement 🙂 réessayez dans un instant." });
  const photo = await storyOf(req);
  if (!photo) return res.status(404).json({ error: "Story introuvable." });
  const key = `storycomments:${photo.id}`;
  const list = (await getSetting(key).catch(() => null)) || [];
  list.push({ id: Date.now().toString(36), name, text, at: Date.now() });
  await setSetting(key, list.slice(-100));
  if (me?.id !== req.event.organizerId) {
    notify([orgOwner(req.event.organizerId)], { title: `💬 ${name} a commenté votre story`, body: text.slice(0, 140), url: `/e/${req.event.slug}` }).catch(() => {});
  }
  res.status(201).json(list.slice(-100));
});
router.delete("/stories/:id/comments/:cid", async (req, res) => {
  if (!(await isOwner(req))) return res.status(403).json({ error: "Réservé à l'organisateur." });
  const photo = await storyOf(req);
  if (!photo) return res.status(404).json({ error: "Story introuvable." });
  const key = `storycomments:${photo.id}`;
  const list = ((await getSetting(key).catch(() => null)) || []).filter((c) => c.id !== req.params.cid);
  await setSetting(key, list);
  res.json(list);
});

// Réactions à l'événement lui-même (page de l'événement) : compteur par emoji, organisateur prévenu.
router.post("/event-react", async (req, res) => {
  const emoji = String(req.body?.emoji || "");
  if (!STORY_EMOJIS.includes(emoji)) return res.status(400).json({ error: "Réaction inconnue." });
  if (await tooFast(`${req.ip}:evreact`, 60, 600_000)) return res.status(429).json({ error: "Doucement 🙂 réessayez dans un instant." });
  const key = `evreact:${req.event.id}`;
  const counts = (await getSetting(key).catch(() => null)) || {};
  counts[emoji] = (counts[emoji] || 0) + 1;
  await setSetting(key, counts);
  if (!(await tooFast(`${req.ip}:evreactnotif:${req.event.id}`, 1, 3_600_000))) {
    notify([orgOwner(req.event.organizerId)], { title: `${emoji} Réaction à votre événement`, body: `Quelqu'un a réagi à « ${req.event.name} »`, url: `/e/${req.event.slug}` }).catch(() => {});
  }
  res.json(counts);
});

router.post("/photos", notBlocked, async (req, res) => {
  const name = clean(req.body?.name, 30);
  if (!name) return res.status(400).json({ error: "Prénom obligatoire." });
  if (await tooFast(`${req.ip}:photo`, 20, 3_600_000)) return res.status(429).json({ error: "Limite de photos atteinte, réessayez plus tard." });
  // Stories : réservées au créateur de l'événement.
  if (req.body?.story && !(await isOwner(req))) return res.status(403).json({ error: "Seul l'organisateur peut publier des stories." });
  try {
    const url = req.body?.image ? await saveDataUrl(req.body.image) : await videoFrom(req.body);
    if (!url) return res.status(400).json({ error: "Ajoutez une photo ou une vidéo." });
    // Story : visible 24 h dans les stories, jamais dans l'album.
    const story = Boolean(req.body?.story);
    res.status(201).json(await addPhoto(req.event.id, { name, url, author: req.author, ...(story && { story, caption: clean(req.body?.caption, 120) }) }));
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
  if (!["message", "photo", "guestbook", "event"].includes(kind) || !itemId) return res.status(400).json({ error: "Signalement invalide." });
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
