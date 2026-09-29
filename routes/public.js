import { Router } from "express";
import { db } from "../db.js";
import { publicView } from "../lib/events.js";
import { setSigned, getSigned, codeFingerprint } from "../lib/session.js";
import { currentOrganizer } from "./auth.js";

const router = Router();

const findBySlug = (slug) => db.prepare("SELECT * FROM events WHERE slug = ?").get(slug);

const hasAccess = (req, event) =>
  event.visibility === "public" ||
  currentOrganizer(req)?.id === event.organizer_id ||
  getSigned(req, `ev${event.id}`) === codeFingerprint(event.access_code);

// Événement privé non déverrouillé : on ne renvoie que le strict minimum pour l'écran cadenas.
router.get("/:slug", (req, res) => {
  const event = findBySlug(req.params.slug);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  if (!hasAccess(req, event)) {
    return res.json({ locked: true, name: event.name, type: event.type, visibility: "private" });
  }
  res.json({ locked: false, ...publicView(event) });
});

// Anti-bruteforce simple par IP + événement.
const attempts = new Map();

router.post("/:slug/unlock", (req, res) => {
  const event = findBySlug(req.params.slug);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });

  const key = `${req.ip}:${event.id}`;
  const a = attempts.get(key);
  if (a && a.count >= 10 && Date.now() - a.since < 15 * 60 * 1000) {
    return res.status(429).json({ error: "Trop d'essais, réessayez dans 15 minutes." });
  }

  const code = String(req.body.code || "").trim().toUpperCase();
  if (code !== event.access_code) {
    if (!a || Date.now() - a.since > 15 * 60 * 1000) attempts.set(key, { count: 1, since: Date.now() });
    else a.count++;
    return res.status(401).json({ error: "Code incorrect." });
  }
  attempts.delete(key);
  setSigned(res, `ev${event.id}`, codeFingerprint(event.access_code));
  res.json({ ok: true });
});

export default router;
