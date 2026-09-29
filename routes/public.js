import { Router } from "express";
import { publicView } from "../lib/events.js";
import { findEventBySlug } from "../lib/store.js";
import { setSigned, getSigned, codeFingerprint } from "../lib/session.js";
import { currentOrganizer } from "./auth.js";

const router = Router();

const hasAccess = async (req, event) =>
  event.visibility === "public" ||
  getSigned(req, `ev${event.id}`) === codeFingerprint(event.accessCode) ||
  (await currentOrganizer(req))?.id === event.organizerId;

// Événement privé non déverrouillé : on ne renvoie que le strict minimum pour l'écran cadenas.
router.get("/:slug", async (req, res) => {
  const event = await findEventBySlug(req.params.slug);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  if (!(await hasAccess(req, event))) {
    return res.json({ locked: true, name: event.name, type: event.type, visibility: "private" });
  }
  res.json({ locked: false, ...publicView(event) });
});

// Anti-bruteforce simple par IP + événement (par instance).
const attempts = new Map();

router.post("/:slug/unlock", async (req, res) => {
  const event = await findEventBySlug(req.params.slug);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });

  const key = `${req.ip}:${event.id}`;
  const a = attempts.get(key);
  if (a && a.count >= 10 && Date.now() - a.since < 15 * 60 * 1000) {
    return res.status(429).json({ error: "Trop d'essais, réessayez dans 15 minutes." });
  }

  const code = String(req.body.code || "").trim().toUpperCase();
  if (code !== event.accessCode) {
    if (!a || Date.now() - a.since > 15 * 60 * 1000) attempts.set(key, { count: 1, since: Date.now() });
    else a.count++;
    return res.status(401).json({ error: "Code incorrect." });
  }
  attempts.delete(key);
  setSigned(res, `ev${event.id}`, codeFingerprint(event.accessCode));
  res.json({ ok: true });
});

export default router;
