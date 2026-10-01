// Espace personnel d'un utilisateur connecté : profil, favoris, historique, amis, messages privés, blocages.
import { Router } from "express";
import { randomCode } from "../lib/codes.js";
import { tooFast } from "../lib/limits.js";
import { notify, orgOwner } from "../lib/push.js";
import { ping, dmTopic } from "../lib/realtime.js";
import { requireOrganizer } from "./auth.js";
import { publicView } from "../lib/events.js";
import { saveDataUrl, removeUpload, isVideoUrl } from "../lib/uploads.js";
import {
  saveOrganizer, listEvents, findEvent, findEventBySlug, findEventsByIds, findOrganizersByIds,
  addFavorite, removeFavorite, listFavoriteIds, listHistoryIds,
  listFriendIds, removeFriends, addBlock, removeBlock, listBlockIds, addFriends,
  addDirectMessage, listDirectMessages, lastDirectMessage, deleteDirectMessage, listPhotos, listGuestbook, listPublicUpcoming, listRecentPhotos, listRecentGuestbook,
  getSetting, setSetting, listUnlistedIds, withVisibility,
} from "../lib/store.js";

const router = Router();
router.use(requireOrganizer);

export const displayName = (u) => u.displayName || u.email.split("@")[0];
const person = (u) => ({ id: u.id, name: displayName(u), avatar: u.avatar || null });
const card = (e) => {
  const { invite, inviteStyle, ...rest } = publicView(e);
  return { ...rest, id: e.id };
};


// --- Profil ---
router.get("/", async (req, res) => {
  const me = req.organizer;
  // Une table manquante (schéma pas encore à jour) ne doit pas bloquer tout le profil.
  const safe = (p) => p.catch((err) => { console.error("Profil :", err.message); return []; });
  const [events, history, friends] = await Promise.all([safe(listEvents(me.id)), safe(invitedEvents(me.id)), safe(listFriendIds(me.id))]);
  res.json({ ...person(me), email: me.email, displayName: me.displayName || "", stats: { events: events.length, participations: history.length, friends: friends.length } });
});

router.put("/profile", async (req, res) => {
  const me = req.organizer;
  const displayName = String(req.body?.displayName ?? me.displayName ?? "").trim().slice(0, 40);
  let avatar = me.avatar || null;
  try {
    if (typeof req.body?.avatar === "string" && req.body.avatar.startsWith("data:")) {
      avatar = await saveDataUrl(req.body.avatar);
      await removeUpload(me.avatar);
    } else if (req.body?.avatar === null) {
      await removeUpload(me.avatar);
      avatar = null;
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  res.json(person(await saveOrganizer({ ...me, displayName, avatar })));
});

// --- Mes vidéos : vidéos partagées dans mes événements et ceux auxquels j'ai participé ---
router.get("/videos", async (req, res) => {
  const me = req.organizer;
  const history = await findEventsByIds(await listHistoryIds(me.id)).catch(() => []);
  const events = visibleEvents([...await listEvents(me.id), ...history])
    .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i).slice(0, 30);
  const videos = [];
  await Promise.all(events.map(async (e) => {
    const [photos, entries] = await Promise.all([listPhotos(e.id, 200), listGuestbook(e.id)]);
    for (const p of photos) if (!p.story && isVideoUrl(p.url)) videos.push({ url: p.url, name: p.name, event: e.name, slug: e.slug, at: p.createdAt });
    for (const g of entries) if (g.photoUrl && isVideoUrl(g.photoUrl)) videos.push({ url: g.photoUrl, name: g.name, event: e.name, slug: e.slug, at: g.createdAt });
  }));
  res.json(videos.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 100));
});

// --- Fil d'actualité : publications récentes (photos, vidéos, livre d'or) et nouveaux événements
// de mes événements, participations, favoris, amis, complétés par les événements publics à venir.
router.get("/feed", async (req, res) => {
  const me = req.organizer;
  const [mine, historyIds, favIds, friendIds] = await Promise.all([
    listEvents(me.id), listHistoryIds(me.id), listFavoriteIds(me.id).catch(() => []), listFriendIds(me.id).catch(() => []),
  ]);
  const joined = await findEventsByIds([...historyIds, ...favIds]).catch(() => []);
  const friends = (await Promise.all(friendIds.slice(0, 20).map((id) => listEvents(id).catch(() => [])))).flat()
    .filter((e) => e.visibility === "public");
  const pub = await listPublicUpcoming(20).catch(() => []);
  const events = visibleEvents([...mine, ...joined, ...friends, ...pub])
    .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i).slice(0, 40);
  const items = [];
  const head = (e) => ({ slug: e.slug, name: e.name, type: e.type, cover: e.cover, date: e.date, cameras: e.cameras || [], cagnotteUrl: e.cagnotteUrl || "" });
  const byId = new Map(events.map((e) => [e.id, e]));
  for (const e of events) items.push({ kind: "event", at: e.createdAt || e.date, event: head(e), text: e.description || "" });
  // 2 requêtes groupées pour tous les événements (au lieu de 2 par événement).
  const ids = [...byId.keys()];
  const [photos, entries] = await Promise.all([listRecentPhotos(ids).catch(() => []), listRecentGuestbook(ids).catch(() => [])]);
  for (const p of photos.filter((x) => !x.story)) items.push({ kind: "photo", at: p.createdAt, event: head(byId.get(p.eventId)), name: p.name, url: p.url, author: p.author });
  for (const g of entries) {
    items.push({ kind: "message", at: g.createdAt, event: head(byId.get(g.eventId)), id: g.id, name: g.name, text: g.text, url: g.photoUrl || null, audio: g.audioUrl || null, likes: g.likes || 0, replies: (g.replies || []).length, author: g.author });
  }
  res.json(items.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 80));
});

// --- Stories des dernières 24 h de mes événements, participations, favoris et amis (rangée du tableau de bord) ---
// Cloche : notifications du compte et date de dernière lecture.
router.get("/notifications", async (req, res) => {
  const [list, seen] = await Promise.all([getSetting(`notifs:${req.organizer.id}`), getSetting(`notifs-seen:${req.organizer.id}`)]);
  res.json({ items: list || [], seen: seen || 0 });
});
router.post("/notifications/read", async (req, res) => {
  await setSetting(`notifs-seen:${req.organizer.id}`, Date.now());
  res.json({ ok: true });
});

router.get("/stories", async (req, res) => {
  const me = req.organizer;
  const [mine, historyIds, favIds, friendIds] = await Promise.all([
    listEvents(me.id), listHistoryIds(me.id), listFavoriteIds(me.id).catch(() => []), listFriendIds(me.id).catch(() => []),
  ]);
  const joined = await findEventsByIds([...historyIds, ...favIds]).catch(() => []);
  const friends = (await Promise.all(friendIds.slice(0, 20).map((id) => listEvents(id).catch(() => [])))).flat().filter((e) => e.visibility === "public");
  const events = visibleEvents([...mine, ...joined, ...friends]).filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i).slice(0, 40);
  const byId = new Map(events.map((e) => [e.id, e]));
  const day = Date.now() - 24 * 3600 * 1000;
  const photos = (await listRecentPhotos([...byId.keys()], 300).catch(() => [])).filter((p) => p.story && new Date(p.createdAt) > day);
  const groups = new Map();
  for (const p of photos.reverse()) {
    const e = byId.get(p.eventId);
    if (!groups.has(e.id)) groups.set(e.id, { slug: e.slug, name: e.name, cover: e.cover, type: e.type, date: e.date, cameras: e.cameras || [], isOwner: e.organizerId === me.id, items: [] });
    groups.get(e.id).items.push({ id: p.id, name: p.name, url: p.url, caption: p.caption, createdAt: p.createdAt, author: p.author });
  }
  res.json([...groups.values()]);
});

// --- Favoris et historique des participations ---
const visibleEvents = (list) => list.filter((e) => e && !e.suspended);
// Participations : seulement les événements où l'on a été invité (privés ou non répertoriés),
// pas les événements publics simplement consultés.
async function invitedEvents(meId) {
  const [list, hidden] = await Promise.all([findEventsByIds(await listHistoryIds(meId)), listUnlistedIds()]);
  return visibleEvents(list).filter((e) => withVisibility(e, hidden).visibility !== "public");
}

router.get("/favorites", async (req, res) => {
  res.json(visibleEvents(await findEventsByIds(await listFavoriteIds(req.organizer.id))).map(card));
});
// Favori par identifiant ou par adresse (slug) de l'événement.
const eventByRef = (ref) => (/^\d+$/.test(ref) ? findEvent(Number(ref)) : findEventBySlug(ref));
router.post("/favorites/:eventId", async (req, res) => {
  const event = await eventByRef(req.params.eventId);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  await addFavorite(req.organizer.id, event.id);
  res.json({ favorite: true });
});
router.delete("/favorites/:eventId", async (req, res) => {
  const event = await eventByRef(req.params.eventId);
  if (event) await removeFavorite(req.organizer.id, event.id);
  res.json({ favorite: false });
});

// Accueil : événements où je suis invité + événements à venir de mes amis (privés et non répertoriés compris).
router.get("/circle", async (req, res) => {
  const me = req.organizer;
  const [invited, friendIds, hidden] = await Promise.all([invitedEvents(me.id).catch(() => []), listFriendIds(me.id).catch(() => []), listUnlistedIds()]);
  const today = new Date().toISOString().slice(0, 10);
  const friends = (await Promise.all(friendIds.slice(0, 50).map((id) => listEvents(id).catch(() => [])))).flat()
    .filter((e) => e.date >= today).map((e) => withVisibility(e, hidden));
  const all = visibleEvents([...invited, ...friends]).filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i);
  res.json(all.map(card));
});

router.get("/history", async (req, res) => {
  res.json((await invitedEvents(req.organizer.id)).map(card));
});

// --- Amis et blocages ---
// Code ami personnel (6 caractères) : le partager suffit pour devenir amis.
async function friendCode(id) {
  let code = await getSetting(`friendcode:${id}`);
  if (!code) {
    code = randomCode();
    await Promise.all([setSetting(`friendcode:${id}`, code), setSetting(`friendby:${code}`, id)]);
  }
  return code;
}
router.get("/friend-code", async (req, res) => res.json({ code: await friendCode(req.organizer.id) }));
router.post("/friends/add", async (req, res) => {
  if (await tooFast(`friendadd:${req.organizer.id}`, 30, 3_600_000)) return res.status(429).json({ error: "Trop d'essais, réessayez plus tard." });
  const code = String(req.body?.code || "").trim().toUpperCase();
  const other = /^[A-Z0-9]{6}$/.test(code) ? await getSetting(`friendby:${code}`) : null;
  if (!other) return res.status(404).json({ error: "Code ami inconnu." });
  if (other === req.organizer.id) return res.status(400).json({ error: "C'est votre propre code 🙂" });
  const [mine, theirs] = await Promise.all([listBlockIds(req.organizer.id), listBlockIds(other)]);
  if (mine.includes(other) || theirs.includes(req.organizer.id)) return res.status(403).json({ error: "Ajout impossible." });
  await addFriends(req.organizer.id, other);
  notify([orgOwner(other)], { title: `👋 ${displayName(req.organizer)} vous a ajouté en ami`, body: "Vous pouvez maintenant vous écrire.", url: `/messages?u=${req.organizer.id}` }).catch(() => {});
  res.json({ ok: true, id: other });
});

router.get("/friends", async (req, res) => {
  const me = req.organizer.id;
  const blocked = new Set(await listBlockIds(me));
  const friends = (await findOrganizersByIds(await listFriendIds(me))).filter((u) => !u.blocked && !blocked.has(u.id));
  const rows = await Promise.all(friends.map(async (u) => {
    const [last, cleared] = await Promise.all([lastDirectMessage(me, u.id), getSetting(`dmclear:${me}:${u.id}`)]);
    return { ...person(u), last: last && last.id > (cleared || 0) ? last : null };
  }));
  rows.sort((a, b) => (b.last?.id || 0) - (a.last?.id || 0) || a.name.localeCompare(b.name));
  res.json(rows);
});

router.delete("/friends/:userId", async (req, res) => {
  await removeFriends(req.organizer.id, Number(req.params.userId));
  res.json({ ok: true });
});

router.get("/blocks", async (req, res) => {
  res.json((await findOrganizersByIds(await listBlockIds(req.organizer.id))).map(person));
});
router.post("/blocks/:userId", async (req, res) => {
  const other = Number(req.params.userId);
  await addBlock(req.organizer.id, other);
  await removeFriends(req.organizer.id, other);
  res.json({ ok: true });
});
router.delete("/blocks/:userId", async (req, res) => {
  await removeBlock(req.organizer.id, Number(req.params.userId));
  res.json({ ok: true });
});

// --- Messages privés : uniquement entre amis, et jamais si l'un a bloqué l'autre ---
async function canTalk(me, other) {
  if (!(await listFriendIds(me)).includes(other)) return false;
  const [mine, theirs] = await Promise.all([listBlockIds(me), listBlockIds(other)]);
  return !mine.includes(other) && !theirs.includes(me);
}

router.get("/dm/:userId", async (req, res) => {
  const other = Number(req.params.userId);
  if (!(await canTalk(req.organizer.id, other))) return res.status(403).json({ error: "Conversation indisponible." });
  const [u] = await findOrganizersByIds([other]);
  const cleared = (await getSetting(`dmclear:${req.organizer.id}:${other}`)) || 0;
  const messages = await listDirectMessages(req.organizer.id, other, Math.max(cleared, Number(req.query.after) || 0));
  res.json({ with: u ? person(u) : null, messages });
});

// Supprimer un de ses messages (pour tout le monde).
router.delete("/dm/:userId/:msgId", async (req, res) => {
  const ok = await deleteDirectMessage(req.organizer.id, Number(req.params.userId), req.params.msgId);
  if (!ok) return res.status(404).json({ error: "Message introuvable." });
  res.json({ ok: true });
});
// Supprimer la conversation (de son côté seulement : l'autre personne garde ses messages).
router.delete("/dm/:userId", async (req, res) => {
  const other = Number(req.params.userId);
  const last = await lastDirectMessage(req.organizer.id, other);
  await setSetting(`dmclear:${req.organizer.id}:${other}`, last?.id || 0);
  res.json({ ok: true });
});

router.post("/dm/:userId", async (req, res) => {
  const other = Number(req.params.userId);
  const text = String(req.body?.text || "").trim().slice(0, 1000);
  if (!text) return res.status(400).json({ error: "Message vide." });
  if (!(await canTalk(req.organizer.id, other))) return res.status(403).json({ error: "Conversation indisponible." });
  if (await tooFast(`dm:${req.organizer.id}`, 20, 60_000) || await tooFast(`dm1:${req.organizer.id}`, 1, 1000)) {
    return res.status(429).json({ error: "Doucement ! Attendez une seconde entre deux messages." });
  }
  const last = await lastDirectMessage(req.organizer.id, other).catch(() => null);
  if (last && last.from === req.organizer.id && last.text === text && Date.now() - new Date(last.createdAt) < 10_000) {
    return res.status(409).json({ error: "Message déjà envoyé." });
  }
  const msg = await addDirectMessage(req.organizer.id, other, text);
  await ping(dmTopic(req.organizer.id, other));
  notify([orgOwner(other)], { title: `💬 ${displayName(req.organizer)}`, body: text.slice(0, 140), url: `/messages?u=${req.organizer.id}` }).catch(() => {});
  res.status(201).json(msg);
});

export default router;
