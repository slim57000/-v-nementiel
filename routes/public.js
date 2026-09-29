import { Router } from "express";
import { publicView } from "../lib/events.js";
import { findEventBySlug, findEventByAccessCode, listPublicUpcoming } from "../lib/store.js";
import { setSigned, getSigned, codeFingerprint } from "../lib/session.js";
import { currentOrganizer } from "./auth.js";

const router = Router();

export const hasAccess = async (req, event) =>
  event.visibility === "public" ||
  getSigned(req, `ev${event.id}`) === codeFingerprint(event.accessCode) ||
  (await currentOrganizer(req))?.id === event.organizerId;

// Événements publics à venir : cartes de la page d'accueil et de « Découvrir ».
router.get("/", async (req, res) => {
  const events = await listPublicUpcoming(Math.min(Number(req.query.limit) || 12, 50));
  res.json(events.map((e) => {
    const { invite, inviteStyle, description, ...card } = publicView(e);
    return card;
  }));
});

// Événement privé non déverrouillé : on ne renvoie que le strict minimum pour l'écran cadenas.
router.get("/:slug", async (req, res) => {
  const event = await findEventBySlug(req.params.slug);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  if (!(await hasAccess(req, event))) {
    return res.json({ locked: true, name: event.name, type: event.type, visibility: "private" });
  }
  const isOwner = (await currentOrganizer(req))?.id === event.organizerId;
  res.json({ locked: false, isOwner, ...publicView(event) });
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
