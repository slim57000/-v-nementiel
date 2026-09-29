// Espace personnel d'un utilisateur connecté : profil, favoris, historique, amis, messages privés, blocages.
import { Router } from "express";
import { requireOrganizer } from "./auth.js";
import { publicView } from "../lib/events.js";
import { saveDataUrl, removeUpload } from "../lib/uploads.js";
import {
  saveOrganizer, listEvents, findEvent, findEventsByIds, findOrganizersByIds,
  addFavorite, removeFavorite, listFavoriteIds, listHistoryIds,
  listFriendIds, removeFriends, addBlock, removeBlock, listBlockIds,
  addDirectMessage, listDirectMessages, lastDirectMessage,
} from "../lib/store.js";

const router = Router();
router.use(requireOrganizer);

export const displayName = (u) => u.displayName || u.email.split("@")[0];
const person = (u) => ({ id: u.id, name: displayName(u), avatar: u.avatar || null });
const card = (e) => {
  const { invite, inviteStyle, ...rest } = publicView(e);
  return { ...rest, id: e.id };
};

// Limite de débit simple en mémoire (par instance).
const hits = new Map();
function tooFast(key, max, windowMs) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

// --- Profil ---
router.get("/", async (req, res) => {
  const me = req.organizer;
  // Une table manquante (schéma pas encore à jour) ne doit pas bloquer tout le profil.
  const safe = (p) => p.catch((err) => { console.error("Profil :", err.message); return []; });
  const [events, history, friends] = await Promise.all([safe(listEvents(me.id)), safe(listHistoryIds(me.id)), safe(listFriendIds(me.id))]);
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

// --- Favoris et historique des participations ---
const visibleEvents = (list) => list.filter((e) => e && !e.suspended);

router.get("/favorites", async (req, res) => {
  res.json(visibleEvents(await findEventsByIds(await listFavoriteIds(req.organizer.id))).map(card));
});
router.post("/favorites/:eventId", async (req, res) => {
  const event = await findEvent(Number(req.params.eventId));
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  await addFavorite(req.organizer.id, event.id);
  res.json({ favorite: true });
});
router.delete("/favorites/:eventId", async (req, res) => {
  await removeFavorite(req.organizer.id, Number(req.params.eventId));
  res.json({ favorite: false });
});

router.get("/history", async (req, res) => {
  res.json(visibleEvents(await findEventsByIds(await listHistoryIds(req.organizer.id))).map(card));
});

// --- Amis et blocages ---
router.get("/friends", async (req, res) => {
  const me = req.organizer.id;
  const blocked = new Set(await listBlockIds(me));
  const friends = (await findOrganizersByIds(await listFriendIds(me))).filter((u) => !u.blocked && !blocked.has(u.id));
  const rows = await Promise.all(friends.map(async (u) => ({ ...person(u), last: await lastDirectMessage(me, u.id) })));
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
  const messages = await listDirectMessages(req.organizer.id, other, Math.max(0, Number(req.query.after) || 0));
  res.json({ with: u ? person(u) : null, messages });
});

router.post("/dm/:userId", async (req, res) => {
  const other = Number(req.params.userId);
  const text = String(req.body?.text || "").trim().slice(0, 1000);
  if (!text) return res.status(400).json({ error: "Message vide." });
  if (!(await canTalk(req.organizer.id, other))) return res.status(403).json({ error: "Conversation indisponible." });
  if (tooFast(`dm:${req.organizer.id}`, 20, 60_000)) return res.status(429).json({ error: "Doucement !" });
  res.status(201).json(await addDirectMessage(req.organizer.id, other, text));
});

export default router;
