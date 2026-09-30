// Espace caméraman : accès par un code dédié, gestion des liens du live et consignes.
import { Router } from "express";
import { findEventBySlug, findEventByCameramanCode, saveEvent } from "../lib/store.js";
import { parseCameras } from "../lib/events.js";
import { setSigned, getSigned, codeFingerprint } from "../lib/session.js";
import { STREAM_ENABLED, phoneCamera } from "../lib/stream.js";

const router = Router();
const fingerprint = (event) => codeFingerprint(`cam:${event.cameramanCode}`);

// Anti-bruteforce simple par IP (par instance).
const attempts = new Map();

router.post("/login", async (req, res) => {
  const key = req.ip;
  const a = attempts.get(key);
  if (a && a.count >= 10 && Date.now() - a.since < 15 * 60 * 1000) {
    return res.status(429).json({ error: "Trop d'essais, réessayez dans 15 minutes." });
  }
  const code = String(req.body?.code || "").trim().toUpperCase();
  const event = /^[A-Z0-9]{6}$/.test(code) ? await findEventByCameramanCode(code) : null;
  if (!event) {
    if (!a || Date.now() - a.since > 15 * 60 * 1000) attempts.set(key, { count: 1, since: Date.now() });
    else a.count++;
    return res.status(404).json({ error: "Code caméraman inconnu." });
  }
  attempts.delete(key);
  setSigned(res, `cam${event.id}`, fingerprint(event));
  res.json({ slug: event.slug });
});

// Vérifie le cookie caméraman de l'événement.
router.use("/:slug", async (req, res, next) => {
  const event = await findEventBySlug(req.params.slug);
  if (!event || event.suspended || !event.cameramanCode || getSigned(req, `cam${event.id}`) !== fingerprint(event)) {
    return res.status(401).json({ error: "Saisissez votre code caméraman." });
  }
  req.event = event;
  next();
});

const view = (e) => ({
  slug: e.slug, name: e.name, type: e.type, date: e.date, time: e.time, location: e.location,
  cameras: e.cameras || [], notes: e.cameramanNotes || "", phoneLive: STREAM_ENABLED,
});

// Live en un clic depuis le téléphone : crée (ou reprend) la caméra, l'ajoute au live et renvoie l'adresse d'envoi.
router.post("/:slug/go-live", async (req, res) => {
  if (!STREAM_ENABLED) return res.status(503).json({ error: "Le direct depuis le téléphone n'est pas encore activé." });
  const name = String(req.body?.name || "").trim().slice(0, 40) || "Caméra 1";
  try {
    const cam = await phoneCamera(req.event, name);
    const cameras = req.event.cameras || [];
    if (!cameras.some((c) => c.url === cam.player)) {
      if (cameras.length >= 6) return res.status(400).json({ error: "6 caméras maximum pour ce live." });
      await saveEvent({ ...req.event, cameras: [...cameras, { name, url: cam.player }] });
    }
    res.json({ whip: cam.whip, name });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/:slug", (req, res) => res.json(view(req.event)));

router.put("/:slug/cameras", async (req, res) => {
  try {
    const cameras = parseCameras(req.body?.cameras);
    res.json(view(await saveEvent({ ...req.event, cameras })));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
