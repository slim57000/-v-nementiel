// Espace caméraman : accès par un code dédié, gestion des liens du live et consignes.
import express, { Router } from "express";
import { findEventBySlug, findEventByCameramanCode, saveEvent, getSetting, setSetting, addFriends, addHistory, listBlockIds } from "../lib/store.js";
import { currentOrganizer } from "./auth.js";
import { videoUploadTarget, saveLocalVideo, isOwnUpload, HAS_STORAGE, MAX_VIDEO_BYTES } from "../lib/uploads.js";
import { parseCameras } from "../lib/events.js";
import { LIVEKIT_ENABLED, LIVEKIT_URL, lkToken, newRoom, LK_PREFIX, isLkRoom, markLive, isLive } from "../lib/livekit.js";
import { setSigned, getSigned, codeFingerprint } from "../lib/session.js";

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
  // Caméraman connecté : devient ami de l'organisateur et l'événement compte dans ses participations.
  const me = await currentOrganizer(req).catch(() => null);
  if (me && me.id !== event.organizerId) {
    const [mine, theirs] = await Promise.all([listBlockIds(me.id), listBlockIds(event.organizerId)]).catch(() => [[], []]);
    if (!mine.includes(event.organizerId) && !theirs.includes(me.id)) await addFriends(me.id, event.organizerId).catch(() => {});
    await addHistory(me.id, event.id).catch(() => {});
  }
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
  cameras: e.cameras || [], notes: e.cameramanNotes || "", phoneLive: LIVEKIT_ENABLED,
  // Pour partager le live aux invités : le code d'accès des événements privés.
  visibility: e.visibility, accessCode: e.visibility === "private" ? e.accessCode : "",
});

// Live en un clic depuis le téléphone : reprend (ou crée) la caméra de ce nom et renvoie un jeton de publication.
router.post("/:slug/go-live", async (req, res) => {
  if (!LIVEKIT_ENABLED) return res.status(503).json({ error: "Le direct depuis le téléphone n'est pas encore activé." });
  const name = String(req.body?.name || "").trim().slice(0, 40) || "Caméra 1";
  const cameras = req.event.cameras || [];
  let cam = cameras.find((c) => c.name === name && c.url.startsWith(LK_PREFIX));
  if (!cam) {
    if (cameras.length >= 6) return res.status(400).json({ error: "6 caméras maximum pour ce live." });
    cam = { name, url: LK_PREFIX + newRoom(req.event) };
    await saveEvent({ ...req.event, cameras: [...cameras, cam] });
  }
  const room = cam.url.slice(LK_PREFIX.length);
  await Promise.all([markLive(room, true), setSetting(`replayoff:${req.event.id}`, null)]); // nouveau direct : nouveau replay
  res.json({ url: LIVEKIT_URL, token: lkToken({ room, identity: `cam-${room}`, name, publish: true }), name, room, record: HAS_STORAGE });
});

// Fin du direct : les invités voient ensuite le replay.
router.post("/:slug/stop-live", async (req, res) => {
  const room = String(req.body?.room || "");
  if (isLkRoom(req.event, room)) await markLive(room, false);
  res.json({ ok: true });
});

// Replay : chaque segment enregistré par le téléphone (≈ 4 min) est envoyé au stockage puis ajouté à la liste.
router.post("/:slug/replay-url", async (req, res) => {
  if (Number(req.body?.size) > MAX_VIDEO_BYTES) return res.status(400).json({ error: "Segment trop lourd." });
  const type = String(req.body?.type || "");
  try {
    const target = await videoUploadTarget(type);
    res.json(target.mode === "inline" ? { mode: "local", uploadUrl: `/api/cameraman/${encodeURIComponent(req.event.slug)}/replay-file?type=${encodeURIComponent(type)}` } : target);
  } catch (err) { res.status(400).json({ error: err.message }); }
});
router.put("/:slug/replay-file", express.raw({ type: () => true, limit: MAX_VIDEO_BYTES }), (req, res) => {
  try { res.json({ publicUrl: saveLocalVideo(req.body, String(req.query.type || "")) }); }
  catch (err) { res.status(400).json({ error: err.message }); }
});
router.post("/:slug/replay", async (req, res) => {
  const { room, url } = req.body || {};
  if (!isLkRoom(req.event, String(room)) || !isOwnUpload(url)) return res.status(400).json({ error: "Segment invalide." });
  const key = `replay:${req.event.id}`;
  const list = (await getSetting(key)) || [];
  if (list.length >= 200) return res.status(400).json({ error: "Replay trop long." });
  list.push({ room, url, at: Date.now() });
  await setSetting(key, list);
  if (await isLive(room)) await markLive(room, true); // signe de vie pendant le direct (jamais après l'arrêt)
  res.json({ ok: true, count: list.length });
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
