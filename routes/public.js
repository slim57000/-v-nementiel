import { Router } from "express";
import { publicView } from "../lib/events.js";
import { findEventBySlug, findEventByAccessCode, listPublicUpcoming, countViewers, addHistory, addFriends, listBlockIds } from "../lib/store.js";
import { setSigned, getSigned, codeFingerprint } from "../lib/session.js";
import { currentOrganizer } from "./auth.js";

const router = Router();

export const hasAccess = async (req, event) =>
  event.visibility === "public" ||
  getSigned(req, `ev${event.id}`) === codeFingerprint(event.accessCode) ||
  (event.cameramanCode && getSigned(req, `cam${event.id}`) === codeFingerprint(`cam:${event.cameramanCode}`)) ||
  (await currentOrganizer(req))?.id === event.organizerId;

// Événements publics à venir : cartes de la page d'accueil et de « Découvrir ».
router.get("/", async (req, res) => {
  let events;
  try {
    events = await listPublicUpcoming(Math.min(Number(req.query.limit) || 12, 50));
  } catch (err) {
    console.error("Événements publics :", err.message);
    return res.status(500).json({ error: `base de données (${err.message}). Relancez supabase/schema.sql.` });
  }
  const today = new Date().toISOString().slice(0, 10);
  res.json(await Promise.all(events.map(async (e) => {
    const { invite, inviteStyle, description, ...card } = publicView(e);
    // Spectateurs en cours pour les directs du jour.
    const viewers = e.date === today && card.cameras.length ? await countViewers(e.id).catch(() => 0) : 0;
    return { ...card, viewers };
  })));
});

// Événement privé non déverrouillé : on ne renvoie que le strict minimum pour l'écran cadenas.
router.get("/:slug", async (req, res) => {
  const event = await findEventBySlug(req.params.slug);
  if (!event || event.suspended) return res.status(404).json({ error: "Événement introuvable." });
  if (!(await hasAccess(req, event))) {
    return res.json({ locked: true, name: event.name, type: event.type, visibility: "private" });
  }
  const me = await currentOrganizer(req);
  const isOwner = me?.id === event.organizerId;
  if (me && !isOwner) {
    // Participation mémorisée ; entrer dans un événement privé (code / QR) rend ami avec l'organisateur.
    await addHistory(me.id, event.id);
    if (event.visibility === "private") {
      const [mine, theirs] = await Promise.all([listBlockIds(me.id), listBlockIds(event.organizerId)]);
      if (!mine.includes(event.organizerId) && !theirs.includes(me.id)) await addFriends(me.id, event.organizerId);
    }
  }
  res.json({ locked: false, isOwner, loggedIn: Boolean(me), ...publicView(event), id: event.id });
});

// Anti-bruteforce simple par IP (+ événement) (par instance).
const attempts = new Map();
const blocked = (key) => {
  const a = attempts.get(key);
  return a && a.count >= 10 && Date.now() - a.since < 15 * 60 * 1000;
};
const fail = (key) => {
  const a = attempts.get(key);
  if (!a || Date.now() - a.since > 15 * 60 * 1000) attempts.set(key, { count: 1, since: Date.now() });
  else a.count++;
};

// « J'ai reçu une invitation » : le code seul suffit à retrouver l'événement.
router.post("/join", async (req, res) => {
  const key = `${req.ip}:join`;
  if (blocked(key)) return res.status(429).json({ error: "Trop d'essais, réessayez dans 15 minutes." });
  const code = String(req.body?.code || "").trim().toUpperCase();
  const event = /^[A-Z0-9]{6}$/.test(code) ? await findEventByAccessCode(code) : null;
  if (!event) {
    fail(key);
    return res.status(404).json({ error: "Aucun événement ne correspond à ce code." });
  }
  attempts.delete(key);
  setSigned(res, `ev${event.id}`, codeFingerprint(event.accessCode));
  res.json({ slug: event.slug });
});

router.post("/:slug/unlock", async (req, res) => {
  const event = await findEventBySlug(req.params.slug);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });

  const key = `${req.ip}:${event.id}`;
  if (blocked(key)) return res.status(429).json({ error: "Trop d'essais, réessayez dans 15 minutes." });

  const code = String(req.body?.code || "").trim().toUpperCase();
  if (code !== event.accessCode) {
    fail(key);
    return res.status(401).json({ error: "Code incorrect." });
  }
  attempts.delete(key);
  setSigned(res, `ev${event.id}`, codeFingerprint(event.accessCode));
  res.json({ ok: true });
});

export default router;
