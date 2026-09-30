import { Router } from "express";
import { requireOrganizer } from "./auth.js";
import { parseEventInput, ownerView } from "../lib/events.js";
import { randomCode, slugify } from "../lib/codes.js";
import { saveDataUrl, removeUpload, isOwnUpload } from "../lib/uploads.js";
import { sendInvites } from "../lib/invites.js";
import { isPremium, getStats } from "../lib/premium.js";
import { EMAIL_ENABLED } from "../lib/email.js";
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
  res.json(await Promise.all(events.map(async (e) => ({ ...ownerView(e), reports: await countReports(e.id) }))));
}));

router.get("/:id", handle(async (req, res) => {
  const event = await findOwned(req);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  res.json({ ...ownerView(event), premium: await isPremium(req.organizer.id) });
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
  const input = parseEventInput(req.body);
  const images = await applyImages(input, req.body, null);
  const event = await createEvent({
    ...input,
    ...images,
    organizerId: req.organizer.id,
    slug: slugify(input.name),
    accessCode: randomCode(),
    cameramanCode: randomCode(),
  });
  res.status(201).json(ownerView(event));
}));

router.put("/:id", handle(async (req, res) => {
  const existing = await findOwned(req);
  if (!existing) return res.status(404).json({ error: "Événement introuvable." });
  const input = parseEventInput(req.body);
  const images = await applyImages(input, req.body, existing);
  const event = await saveEvent({
    ...existing,
    ...input,
    ...images,
    accessCode: req.body.regenerateCode ? randomCode() : existing.accessCode,
    cameramanCode: req.body.regenerateCameramanCode || !existing.cameramanCode ? randomCode() : existing.cameramanCode,
  });
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
