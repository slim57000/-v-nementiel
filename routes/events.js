import { Router } from "express";
import { db } from "../db.js";
import { requireOrganizer } from "./auth.js";
import { parseEventInput, ownerView } from "../lib/events.js";
import { randomCode, slugify } from "../lib/codes.js";
import { saveDataUrl, removeUpload } from "../lib/uploads.js";

const router = Router();
router.use(requireOrganizer);

const findOwned = (req) =>
  db.prepare("SELECT * FROM events WHERE id = ? AND organizer_id = ?").get(Number(req.params.id), req.organizer.id);

// Gère les images envoyées : nouvelle couverture et photo propre au faire-part.
// invite.photo vaut "cover" (réutilise la couverture), "none", une URL existante ou une data URL.
function applyImages(input, body, existing) {
  let cover = existing?.cover ?? null;
  if (body.coverData) {
    cover = saveDataUrl(body.coverData);
    removeUpload(existing?.cover);
  } else if (body.removeCover) {
    removeUpload(existing?.cover);
    cover = null;
  }

  const oldInvite = existing ? JSON.parse(existing.invite_json) : {};
  let photo = input.invite.photo;
  if (typeof photo === "string" && photo.startsWith("data:")) photo = saveDataUrl(photo);
  else if (!["cover", "none"].includes(photo) && photo !== oldInvite.photo) photo = "cover";
  if (oldInvite.photo !== photo) removeUpload(oldInvite.photo);

  return { cover, invite_json: JSON.stringify({ ...input.invite, photo }) };
}

router.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM events WHERE organizer_id = ? ORDER BY date ASC")
    .all(req.organizer.id);
  res.json(rows.map(ownerView));
});

router.get("/:id", (req, res) => {
  const row = findOwned(req);
  if (!row) return res.status(404).json({ error: "Événement introuvable." });
  res.json(ownerView(row));
});

router.post("/", (req, res) => {
  try {
    const input = parseEventInput(req.body);
    const { cover, invite_json } = applyImages(input, req.body, null);
    const { lastInsertRowid } = db
      .prepare(`INSERT INTO events
        (organizer_id, slug, name, type, date, time, location, description, cover, visibility, access_code, invite_style, invite_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(req.organizer.id, slugify(input.name), input.name, input.type, input.date, input.time,
        input.location, input.description, cover, input.visibility, randomCode(), input.invite_style, invite_json);
    res.status(201).json(ownerView(db.prepare("SELECT * FROM events WHERE id = ?").get(lastInsertRowid)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", (req, res) => {
  const existing = findOwned(req);
  if (!existing) return res.status(404).json({ error: "Événement introuvable." });
  try {
    const input = parseEventInput(req.body);
    const { cover, invite_json } = applyImages(input, req.body, existing);
    const accessCode = req.body.regenerateCode ? randomCode() : existing.access_code;
    db.prepare(`UPDATE events SET name = ?, type = ?, date = ?, time = ?, location = ?, description = ?,
        cover = ?, visibility = ?, access_code = ?, invite_style = ?, invite_json = ?, updated_at = datetime('now')
        WHERE id = ?`)
      .run(input.name, input.type, input.date, input.time, input.location, input.description,
        cover, input.visibility, accessCode, input.invite_style, invite_json, existing.id);
    res.json(ownerView(db.prepare("SELECT * FROM events WHERE id = ?").get(existing.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", (req, res) => {
  const existing = findOwned(req);
  if (!existing) return res.status(404).json({ error: "Événement introuvable." });
  db.prepare("DELETE FROM events WHERE id = ?").run(existing.id);
  removeUpload(existing.cover);
  removeUpload(JSON.parse(existing.invite_json).photo);
  res.json({ ok: true });
});

export default router;
