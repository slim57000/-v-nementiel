// API /api/events : espace organisateur (créer, modifier, supprimer ses événements, statistiques, replay, cagnotte).
import { Router } from "express";
import { requireOrganizer } from "./auth.js";
import { parseEventInput, ownerView } from "../lib/events.js";
import { randomCode, slugify } from "../lib/codes.js";
import { saveDataUrl, removeUpload, isOwnUpload } from "../lib/uploads.js";
import { sendInvites } from "../lib/invites.js";
import { isPremium, getStats } from "../lib/premium.js";
import { getSetting, setSetting, setUnlisted, listUnlistedIds, withVisibility, setShowcase, listShowcaseIds } from "../lib/store.js";

// Programme de la journée (12 étapes max) et infos pratiques, stockés à part de l'événement.
const cleanProgram = (body) => ({
  steps: (Array.isArray(body?.program) ? body.program : [])
    .map((st) => ({ time: /^\d{2}:\d{2}$/.test(st?.time) ? st.time : "", label: String(st?.label || "").trim().slice(0, 80) }))
    .filter((st) => st.label).slice(0, 12).sort((a, b) => a.time.localeCompare(b.time)),
  practical: String(body?.practical || "").trim().slice(0, 1500),
});
// Montant de la cagnotte (saisi par l'organisateur) : { raised, goal } en euros.
const euros = (v) => Math.max(0, Math.min(1e7, Math.round(Number(String(v ?? "").replace(",", ".")) || 0)));
const savePot = (id, body) => (body && ("potRaised" in body || "potGoal" in body) ? setSetting(`pot:${id}`, { raised: euros(body.potRaised), goal: euros(body.potGoal) }) : null);
const saveProgram = (id, body) => (body && ("program" in body || "practical" in body) ? setSetting(`program:${id}`, cleanProgram(body)) : null);
import { EMAIL_ENABLED, reqLang } from "../lib/email.js";
import { tooFast } from "../lib/limits.js";
import { listMessages, listInvites, listEvents, findEvent, createEvent, saveEvent, deleteEvent, listPhotos, listGuestbook, countReports } from "../lib/store.js";

const router = Router();
router.use(requireOrganizer);

async function findOwned(req) {
  const event = await findEvent(Number(req.params.id));
  return event?.organizerId === req.organizer.id ? event : null;
}

// Gère les images envoyées : nouvelle couverture et photo propre au faire-part.
// invite.photo vaut "cover" (réutilise la couverture), "none", une URL déjà stockée ou une data URL.
async function applyImages(input, body, existing) {
  let cover = existing?.cover ?? null;
  if (body.coverData) {
    cover = await saveDataUrl(body.coverData);
    await removeUpload(existing?.cover);
  } else if (body.removeCover) {
    await removeUpload(existing?.cover);
    cover = null;
  }

  const oldPhoto = existing?.invite?.photo;
  let photo = input.invite.photo;
  if (typeof photo === "string" && photo.startsWith("data:")) photo = await saveDataUrl(photo);
  else if (!["cover", "none"].includes(photo) && !(isOwnUpload(photo) && photo === oldPhoto)) photo = "cover";
  if (oldPhoto !== photo) await removeUpload(oldPhoto);

  return { cover, invite: { ...input.invite, photo } };
}

// Les erreurs de validation (messages en français) remontent en 400.
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

router.get("/", handle(async (req, res) => {
  const events = await listEvents(req.organizer.id);
  // Événements créés avant l'espace caméraman : on leur attribue un code.
  for (const event of events.filter((e) => !e.cameramanCode)) {
    Object.assign(event, await saveEvent({ ...event, cameramanCode: randomCode() }));
  }
  const hidden = await listUnlistedIds();
  res.json(await Promise.all(events.map(async (e) => ({ ...ownerView(withVisibility(e, hidden)), reports: await countReports(e.id) }))));
}));

router.get("/:id", handle(async (req, res) => {
  const event = await findOwned(req);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  res.json({ ...ownerView(withVisibility(event, await listUnlistedIds())), showcase: (await listShowcaseIds()).has(event.id), replayOnline: !(await getSetting(`replayhide:${event.id}`).catch(() => null)), premium: await isPremium(req.organizer.id), program: (await getSetting(`program:${event.id}`).catch(() => null)) || { steps: [], practical: "" }, pot: (await getSetting(`pot:${event.id}`).catch(() => null)) || { raised: 0, goal: 0 } });
}));

// Statistiques pour l'organisateur : vues, pic de spectateurs, messages, réactions, photos, livre d'or, invitations.
router.get("/:id/stats", handle(async (req, res) => {
  const event = await findOwned(req);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  const [stats, messages, photos, entries, invites] = await Promise.all([
    getStats(event.id), listMessages(event.id, 0, 5000).catch(() => []), listPhotos(event.id, 1000), listGuestbook(event.id), listInvites(event.id).catch(() => []),
  ]);
  res.json({
    views: stats.views || 0, peak: stats.peak || 0,
    chat: messages.filter((m) => m.kind === "chat").length, reactions: messages.filter((m) => m.kind === "reaction").length,
    photos: photos.length, guestbook: entries.length, likes: entries.reduce((n, e) => n + (e.likes || 0), 0),
    invites: invites.length, invitesSeen: invites.filter((i) => i.seenAt).length, invitesJoined: invites.filter((i) => i.joinedAt).length,
  });
}));

router.post("/", handle(async (req, res) => {
  const { unlisted, ...input } = parseEventInput(req.body);
  const images = await applyImages(input, req.body, null);
  const event = await createEvent({
    ...input,
    ...images,
    organizerId: req.organizer.id,
    slug: slugify(input.name),
    accessCode: randomCode(),
    cameramanCode: randomCode(),
  });
  await saveProgram(event.id, req.body);
  await savePot(event.id, req.body);
  await setSetting(`evlang:${event.id}`, reqLang(req)).catch(() => {}); // langue des emails de l'événement
  await setUnlisted(event.id, unlisted);
  await setShowcase(event.id, req.body.showcase !== false && (unlisted || event.visibility === "private"));
  res.status(201).json(ownerView(withVisibility(event, new Set(unlisted ? [event.id] : []))));
}));

router.put("/:id", handle(async (req, res) => {
  const existing = await findOwned(req);
  if (!existing) return res.status(404).json({ error: "Événement introuvable." });
  const { unlisted, ...input } = parseEventInput(req.body);
  input.invite.liveText ||= existing.invite?.liveText || "";
  const images = await applyImages(input, req.body, existing);
  const event = await saveEvent({
    ...existing,
    ...input,
    ...images,
    accessCode: req.body.regenerateCode ? randomCode() : existing.accessCode,
    cameramanCode: req.body.regenerateCameramanCode || !existing.cameramanCode ? randomCode() : existing.cameramanCode,
  });
  await saveProgram(event.id, req.body);
  await savePot(event.id, req.body);
  await setSetting(`evlang:${event.id}`, reqLang(req)).catch(() => {}); // langue des emails de l'événement
  await setUnlisted(event.id, unlisted);
  await setShowcase(event.id, req.body.showcase !== false && (unlisted || event.visibility === "private"));
  res.json(ownerView(withVisibility(event, new Set(unlisted ? [event.id] : []))));
}));

// Textes des faire-part modifiés depuis « Mes faire-part » (faire-part et invitation au live).
router.patch("/:id/invite-text", handle(async (req, res) => {
  const existing = await findOwned(req);
  if (!existing) return res.status(404).json({ error: "Événement introuvable." });
  const cut = (v, max) => String(v ?? "").trim().slice(0, max);
  const invite = { ...existing.invite };
  if ("kicker" in req.body) invite.kicker = cut(req.body.kicker, 60);
  if ("title" in req.body) invite.title = cut(req.body.title, 150);
  if ("text" in req.body) invite.text = cut(req.body.text, 1500);
  if ("liveText" in req.body) invite.liveText = cut(req.body.liveText, 1500);
  const event = await saveEvent({ ...existing, invite });
  res.json(ownerView(event));
}));

// Invitations par email avec suivi (envoyée / vue / a rejoint).
router.get("/:id/invites", handle(async (req, res) => {
  const event = await findOwned(req);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  res.json((await listInvites(event.id)).map(({ email, sentAt, seenAt, joinedAt }) => ({ email, sentAt, seenAt, joinedAt })));
}));
router.post("/:id/invites", handle(async (req, res) => {
  const event = await findOwned(req);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  if (!EMAIL_ENABLED) return res.status(503).json({ error: "L'envoi d'emails n'est pas encore activé." });
  const emails = [...new Set(String(req.body?.emails || "").toLowerCase().split(/[\s,;]+/).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
  if (!emails.length) return res.status(400).json({ error: "Aucune adresse email valide." });
  if (emails.length > 100) return res.status(400).json({ error: "100 invitations maximum à la fois." });
  if (await tooFast(`invites:${req.organizer.id}`, 300, 86_400_000)) return res.status(429).json({ error: "Limite d'invitations du jour atteinte." });
  const sent = await sendInvites(event, emails, `${req.protocol}://${req.get("host")}`);
  res.status(201).json({ sent: sent.length });
}));

// Segments du replay (organisateur) : pour les inclure dans le zip des souvenirs.
router.get("/:id/replay", handle(async (req, res) => {
  const event = await findOwned(req);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  const names = Object.fromEntries((event.cameras || []).map((c) => [c.url.replace(/^lk:/, ""), c.name]));
  const parts = (await getSetting(`replay:${event.id}`).catch(() => null)) || [];
  res.json(parts.map((p) => ({ url: p.url, at: p.at, camera: names[p.room] || "Caméra" })));
}));

// Replay en ligne (par défaut) ou retiré temporairement par l'organisateur (réversible).
router.patch("/:id/replay", handle(async (req, res) => {
  const event = await findOwned(req);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  const online = Boolean(req.body?.online);
  await setSetting(`replayhide:${event.id}`, online ? null : true);
  res.json({ online });
}));

// Supprimer le replay (organisateur) : vidéos enregistrées effacées et lecteur fermé aux invités.
router.delete("/:id/replay", handle(async (req, res) => {
  const event = await findOwned(req);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  const parts = (await getSetting(`replay:${event.id}`).catch(() => null)) || [];
  await Promise.all(parts.map((p) => removeUpload(p.url)));
  await Promise.all([setSetting(`replay:${event.id}`, null), setSetting(`replayoff:${event.id}`, true), setSetting(`replayhide:${event.id}`, null)]);
  res.json({ ok: true });
}));

router.delete("/:id", handle(async (req, res) => {
  const event = await findOwned(req);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  await destroyEvent(event);
  res.json({ ok: true });
}));

// Supprime un événement et tous ses fichiers (couverture, faire-part, photos, livre d'or).
export async function destroyEvent(event) {
  const photos = await listPhotos(event.id, 1000);
  const entries = await listGuestbook(event.id);
  await deleteEvent(event);
  await Promise.all([
    ...photos.map((p) => removeUpload(p.url)),
    ...entries.flatMap((e) => [removeUpload(e.photoUrl), removeUpload(e.audioUrl)]),
    removeUpload(event.cover),
    removeUpload(event.invite?.photo),
  ]);
}

export default router;
