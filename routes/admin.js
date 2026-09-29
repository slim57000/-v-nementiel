// Administration de la plateforme : réservée aux emails listés dans ADMIN_EMAILS.
import { Router } from "express";
import { currentOrganizer, isAdmin } from "./auth.js";
import { destroyEvent } from "./events.js";
import { seedDemo, demoEvents } from "../lib/demo.js";
import {
  searchEvents, searchOrganizers, findEvent, findOrganizer, saveOrganizer, saveEvent, listEvents,
  listReports, deleteReport, countReports, getSetting, setSetting,
} from "../lib/store.js";

const router = Router();

router.use(async (req, res, next) => {
  const organizer = await currentOrganizer(req);
  if (!isAdmin(organizer)) return res.status(403).json({ error: "Accès réservé à l'administration." });
  next();
});

// Événements : recherche (nom, lien, lieu), avec email de l'organisateur et signalements.
router.get("/events", async (req, res) => {
  const events = await searchEvents(String(req.query.q || ""));
  const emails = new Map();
  res.json(await Promise.all(events.map(async (e) => {
    if (!emails.has(e.organizerId)) emails.set(e.organizerId, (await findOrganizer(e.organizerId))?.email || "?");
    return {
      id: e.id, slug: e.slug, name: e.name, type: e.type, date: e.date, location: e.location,
      visibility: e.visibility, suspended: Boolean(e.suspended), organizer: emails.get(e.organizerId),
      reports: await countReports(e.id),
    };
  })));
});

// Événements de démonstration (compte dédié) : création et suppression en un clic.
router.post("/demo", async (req, res) => {
  res.json({ created: await seedDemo(Math.min(Number(req.body?.count) || 50, 100)) });
});
router.delete("/demo", async (req, res) => {
  const list = await demoEvents();
  for (const e of list) await destroyEvent(e);
  res.json({ deleted: list.length });
});

router.post("/events/:id/suspend", async (req, res) => {
  const event = await findEvent(Number(req.params.id));
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  await saveEvent({ ...event, suspended: Boolean(req.body?.suspended) });
  res.json({ ok: true });
});

router.delete("/events/:id", async (req, res) => {
  const event = await findEvent(Number(req.params.id));
  if (!event) return res.status(404).json({ error: "Événement introuvable." });
  await destroyEvent(event);
  res.json({ ok: true });
});

// Utilisateurs : recherche par email, blocage (suspend aussi tous leurs événements).
router.get("/organizers", async (req, res) => {
  const organizers = await searchOrganizers(String(req.query.q || "").toLowerCase());
  res.json(await Promise.all(organizers.map(async (o) => ({
    id: o.id, email: o.email, blocked: Boolean(o.blocked), createdAt: o.createdAt,
    events: (await listEvents(o.id)).length, admin: isAdmin(o),
  }))));
});

router.post("/organizers/:id/block", async (req, res) => {
  const organizer = await findOrganizer(Number(req.params.id));
  if (!organizer) return res.status(404).json({ error: "Utilisateur introuvable." });
  if (isAdmin(organizer)) return res.status(400).json({ error: "Impossible de bloquer un administrateur." });
  const blocked = Boolean(req.body?.blocked);
  await saveOrganizer({ ...organizer, blocked });
  for (const event of await listEvents(organizer.id)) await saveEvent({ ...event, suspended: blocked });
  res.json({ ok: true });
});

// Signalements : liste avec l'événement concerné.
router.get("/reports", async (req, res) => {
  const reports = await listReports();
  res.json(await Promise.all(reports.map(async (r) => {
    const e = await findEvent(r.eventId);
    return { ...r, eventName: e?.name || "(supprimé)", eventSlug: e?.slug || "" };
  })));
});

router.delete("/reports/:id", async (req, res) => {
  await deleteReport(Number(req.params.id));
  res.json({ ok: true });
});

// Réglages de la plateforme.
router.get("/settings", async (req, res) => {
  res.json({ defaultLivePlatform: (await getSetting("defaultLivePlatform")) || "youtube" });
});

router.put("/settings", async (req, res) => {
  const platform = req.body?.defaultLivePlatform === "twitch" ? "twitch" : "youtube";
  await setSetting("defaultLivePlatform", platform);
  res.json({ defaultLivePlatform: platform });
});

export default router;
