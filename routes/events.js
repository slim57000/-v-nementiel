import { Router } from "express";
import { requireOrganizer } from "./auth.js";
import { parseEventInput, ownerView } from "../lib/events.js";
import { randomCode, slugify } from "../lib/codes.js";
import { saveDataUrl, removeUpload, isOwnUpload } from "../lib/uploads.js";
import { listEvents, findEvent, createEvent, saveEvent, deleteEvent, listPhotos } from "../lib/store.js";

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
  res.json((await listEvents(req.organizer.id)).map(ownerView));
}));

router.get("/:id", handle(async (req, res) => {
  const event = await findOwned(req);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  res.json(ownerView(event));
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
  });
  res.json(ownerView(event));
}));

router.delete("/:id", handle(async (req, res) => {
  const event = await findOwned(req);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  const photos = await listPhotos(event.id, 1000);
  await deleteEvent(event);
  await Promise.all(photos.map((p) => removeUpload(p.url)));
  await removeUpload(event.cover);
  await removeUpload(event.invite?.photo);
  res.json({ ok: true });
}));

export default router;
