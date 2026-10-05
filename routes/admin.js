// Administration de la plateforme : réservée aux emails listés dans ADMIN_EMAILS.
import { Router } from "express";
import { currentOrganizer, isAdmin, isSuperAdmin, listExtraAdmins, adminUntil } from "./auth.js";
import { destroyEvent } from "./events.js";
import { seedDemo, demoEvents, sendDemoMessages, sendDemoInvitation, createDemoAlbum } from "../lib/demo.js";
import { isPremium, setPremium, premiumUntil } from "../lib/premium.js";
import { tooFast } from "../lib/limits.js";
import { notify, orgOwner, forget } from "../lib/push.js";
import { analyticsSummary, onlineNow } from "../lib/analytics.js";
import { sendEmail, EMAIL_ENABLED } from "../lib/email.js";
import {
  searchEvents, searchOrganizers, findEvent, findOrganizer, saveOrganizer, saveEvent, listEvents,
  listReports, deleteReport, countReports, getSetting, setSetting, findOrganizersByIds,
} from "../lib/store.js";

const router = Router();

router.use(async (req, res, next) => {
  const organizer = await currentOrganizer(req);
  if (!organizer || organizer.blocked || !(await isAdmin(organizer))) return res.status(403).json({ error: "Accès réservé à l'administration." });
  req.admin = organizer;
  if (req.method !== "GET") {
    // Limite d'actions (compte compromis, script) et journal de chaque action réussie.
    if (await tooFast(`admin:${organizer.id}`, 60, 60_000)) return res.status(429).json({ error: "Trop d'actions d'un coup, patientez une minute." });
    res.on("finish", () => { if (res.statusCode < 400) audit(organizer, req).catch(() => {}); });
  }
  next();
});

// Journal des actions d'administration (300 dernières), consultable dans Réglages.
async function audit(admin, req) {
  const target = req.params?.id || req.path.split("/")[2] || "";
  const detail = Object.entries(req.body || {}).map(([k, v]) => `${k}=${String(v).slice(0, 40)}`).join(", ");
  const entry = { at: new Date().toISOString(), by: admin.email, action: `${req.method} ${req.baseUrl.replace("/api/admin", "")}${req.path}`, target, detail };
  const log = (await getSetting("audit").catch(() => null)) || [];
  await setSetting("audit", [entry, ...log].slice(0, 300));
}
router.get("/audit", async (req, res) => {
  res.json(((await getSetting("audit").catch(() => null)) || []).slice(0, 100));
});

// Seuls les administrateurs principaux (ADMIN_EMAILS) gèrent les droits d'administration.
const superOnly = (req, res, next) => (isSuperAdmin(req.admin) ? next()
  : res.status(403).json({ error: "Réservé à l'administrateur principal." }));

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
  try {
    res.json({ created: await seedDemo(Math.min(Number(req.body?.count) || 50, 100)) });
  } catch (err) {
    res.status(500).json({ error: `Création impossible : ${err.message}. Relancez supabase/schema.sql dans Supabase.` });
  }
});
router.post("/demo-messages", async (req, res) => {
  try {
    res.json(await sendDemoMessages(await currentOrganizer(req)));
  } catch (err) {
    res.status(500).json({ error: `Envoi impossible : ${err.message}` });
  }
});
router.post("/demo-invitation", async (req, res) => {
  try {
    res.json(await sendDemoInvitation(await currentOrganizer(req), `${req.protocol}://${req.get("host")}`));
  } catch (err) {
    res.status(500).json({ error: `Envoi impossible : ${err.message}` });
  }
});
router.post("/demo-album", async (req, res) => {
  try {
    res.json(await createDemoAlbum(await currentOrganizer(req)));
  } catch (err) {
    res.status(500).json({ error: `Création impossible : ${err.message}` });
  }
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
  const untils = await adminUntil();
  res.json(await Promise.all(organizers.map(async (o) => {
    const admin = await isAdmin(o);
    return {
      id: o.id, email: o.email, blocked: Boolean(o.blocked), createdAt: o.createdAt,
      events: (await listEvents(o.id)).length, admin, superAdmin: isSuperAdmin(o), premium: await isPremium(o.id),
      premiumUntil: await premiumUntil(o.id), adminUntil: admin && !isSuperAdmin(o) ? untils[String(o.email).toLowerCase()] || null : null,
    };
  })));
});

// Offre premium : replay 30 jours, faire-part et page sans marque MaFeliza, badge.
router.post("/organizers/:id/premium", async (req, res) => {
  const organizer = await findOrganizer(Number(req.params.id));
  if (!organizer) return res.status(404).json({ error: "Utilisateur introuvable." });
  // Durée facultative en jours (0 ou vide = sans limite).
  await setPremium(organizer.id, Boolean(req.body?.premium), Math.max(0, Math.min(3650, Number(req.body?.days) || 0)));
  res.json({ ok: true });
});

// Nommer ou retirer un administrateur : ouvert à tous les administrateurs (le principal, de ADMIN_EMAILS, ne peut pas être retiré).
router.post("/organizers/:id/admin", async (req, res) => {
  const organizer = await findOrganizer(Number(req.params.id));
  if (!organizer) return res.status(404).json({ error: "Utilisateur introuvable." });
  const on = Boolean(req.body?.admin);
  if (!on && isSuperAdmin(organizer)) return res.status(400).json({ error: "Administrateur principal : il ne peut pas être retiré." });
  if (!on && organizer.id === (await currentOrganizer(req)).id) return res.status(400).json({ error: "Vous ne pouvez pas retirer vos propres droits." });
  if (on && organizer.blocked) return res.status(400).json({ error: "Débloquez d'abord cet utilisateur." });
  const admins = new Set(await listExtraAdmins());
  on ? admins.add(organizer.email) : admins.delete(organizer.email);
  await setSetting("admins", [...admins]);
  // Durée facultative en jours : au-delà, les droits tombent d'eux-mêmes.
  const days = Math.max(0, Math.min(3650, Number(req.body?.days) || 0));
  const untils = await adminUntil();
  const key = String(organizer.email).toLowerCase();
  if (on && days) untils[key] = Date.now() + days * 86400000; else delete untils[key];
  await setSetting("adminUntil", untils);
  res.json({ ok: true });
});

router.post("/organizers/:id/block", async (req, res) => {
  const organizer = await findOrganizer(Number(req.params.id));
  if (!organizer) return res.status(404).json({ error: "Utilisateur introuvable." });
  if (await isAdmin(organizer)) return res.status(400).json({ error: "Impossible de bloquer un administrateur." });
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

// Compteurs : utilisateurs, événements (par visibilité), à venir, aujourd'hui, premium.
// Audience du site (30 derniers jours) : pages vues, visiteurs, pages, sources, appareils.
// En direct : qui est sur le site maintenant, et sur quelle page (noms des comptes connectés, visiteurs anonymes).
router.get("/online", async (req, res) => {
  const { total, logged, list } = onlineNow(true);
  const users = new Map((await findOrganizersByIds([...new Set(list.filter((v) => v.userId).map((v) => v.userId))]).catch(() => [])).map((u) => [u.id, u]));
  const pages = {};
  for (const v of list) { const p = v.path.split("?")[0].replace(/^\/e\/[^/?#]+.*/, "/e/…"); pages[p] = (pages[p] || 0) + 1; }
  res.json({ total, logged, pages: Object.entries(pages).sort((a, b) => b[1] - a[1]).slice(0, 8),
    people: list.sort((a, b) => b.at - a.at).slice(0, 30).map((v) => ({ name: v.userId ? (users.get(v.userId)?.name || String(users.get(v.userId)?.email || "Utilisateur").split("@")[0]) : null, path: v.path, device: v.device, since: v.since })) });
});
router.get("/analytics", async (req, res) => res.json(await analyticsSummary(Math.min(90, Number(req.query.days) || 30))));

router.get("/stats", async (req, res) => {
  const [orgs, events, hidden] = await Promise.all([searchOrganizers("", 100000), searchEvents("", 100000), getSetting("unlisted").catch(() => null)]);
  const unl = new Set(hidden || []);
  const today = new Date().toISOString().slice(0, 10);
  const premium = (await Promise.all(orgs.map((o) => isPremium(o.id)))).filter(Boolean).length;
  res.json({
    users: orgs.length, premium,
    events: events.length,
    private: events.filter((e) => e.visibility === "private").length,
    unlisted: events.filter((e) => e.visibility === "public" && unl.has(e.id)).length,
    upcoming: events.filter((e) => e.date >= today).length,
    today: events.filter((e) => e.date === today).length,
    contact: ((await getSetting("contact").catch(() => null)) || []).filter((m) => !m.replied).length,
  });
});

// Notification manuelle à tous les utilisateurs (cloche du site + push).
router.post("/notify", async (req, res) => {
  const title = String(req.body?.title || "").trim().slice(0, 80);
  const body = String(req.body?.body || "").trim().slice(0, 200);
  const url = String(req.body?.url || "/dashboard").startsWith("/") ? String(req.body.url || "/dashboard") : "/dashboard";
  if (!title || !body) return res.status(400).json({ error: "Titre et message obligatoires." });
  const orgs = await searchOrganizers("", 100000);
  const nid = Date.now().toString(36);
  const pushed = await notify(orgs.map((o) => orgOwner(o.id)), { title, body, url, nid }).catch(() => 0);
  // Historique des notifications envoyées (pour pouvoir les retirer ensuite).
  const sent = (await getSetting("adminNotifs").catch(() => null)) || [];
  await setSetting("adminNotifs", [{ nid, title, body, url, at: Date.now(), users: orgs.length }, ...sent].slice(0, 50));
  res.json({ users: orgs.length, pushed });
});
router.get("/notify", async (req, res) => res.json((await getSetting("adminNotifs").catch(() => null)) || []));
// Suppression : retirée de l'historique et de la cloche 🔔 de tous les comptes (une notification déjà
// affichée sur un téléphone ne peut pas être rappelée).
router.delete("/notify/:nid", async (req, res) => {
  const nid = String(req.params.nid);
  const orgs = await searchOrganizers("", 100000);
  await forget(orgs.map((o) => o.id), nid);
  const sent = (await getSetting("adminNotifs").catch(() => null)) || [];
  await setSetting("adminNotifs", sent.filter((n) => n.nid !== nid));
  res.json({ ok: true });
});

// Boîte de réception « Contact » (formulaire du site) : lecture, réponse par email, suppression.
router.get("/contact", async (req, res) => res.json((await getSetting("contact").catch(() => null)) || []));
router.post("/contact/:id/reply", async (req, res) => {
  const list = (await getSetting("contact").catch(() => null)) || [];
  const msg = list.find((m) => m.id === req.params.id);
  const text = String(req.body?.text || "").trim().slice(0, 5000);
  if (!msg || !text) return res.status(400).json({ error: "Message introuvable ou réponse vide." });
  if (!EMAIL_ENABLED) return res.status(503).json({ error: "Envoi d'email non configuré (RESEND_API_KEY)." });
  const esc = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const ok = await sendEmail({
    to: msg.email, replyTo: process.env.CONTACT_EMAIL || "contact@mafeliza.com",
    subject: `Re : ${msg.subject || "Votre message à MaFeliza"}`, title: "Réponse de MaFeliza",
    body: `<p>Bonjour ${esc(msg.name || "")},</p><p style="white-space:pre-line">${esc(text)}</p>
      <hr style="border:0;border-top:1px solid #eee;margin:20px 0"><p style="color:#888;font-size:13px;white-space:pre-line">Votre message :\n${esc(msg.message)}</p>`,
  });
  if (!ok) return res.status(502).json({ error: "L'email n'a pas pu être envoyé." });
  msg.replied = { at: new Date().toISOString(), by: req.admin.email, text };
  await setSetting("contact", list);
  res.json({ ok: true });
});
router.delete("/contact/:id", async (req, res) => {
  const list = (await getSetting("contact").catch(() => null)) || [];
  await setSetting("contact", list.filter((m) => m.id !== req.params.id));
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
