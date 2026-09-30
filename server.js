import { vapidKey, notify, orgOwner } from "./lib/push.js";
import { guestAuthor } from "./lib/guest.js";
import { savePushSub, listFollowerIds, deletePushSub } from "./lib/store.js";
import { remindInvites } from "./lib/invites.js";
import { REALTIME } from "./lib/realtime.js";
import { isPremium } from "./lib/premium.js";
import { reportError } from "./lib/monitor.js";
import { tooFast } from "./lib/limits.js";
import { GOOGLE_ENABLED } from "./lib/google.js";
import { FACEBOOK_ENABLED } from "./lib/facebook.js";
import express from "express";
import QRCode from "qrcode";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import authRoutes, { currentOrganizer } from "./routes/auth.js";
import eventRoutes from "./routes/events.js";
import publicRoutes from "./routes/public.js";
import socialRoutes from "./routes/social.js";
import cameramanRoutes from "./routes/cameraman.js";
import adminRoutes from "./routes/admin.js";
import meRoutes from "./routes/me.js";
import { getSetting, listEventsOnDate, findOrganizer, listPublicUpcoming } from "./lib/store.js";
import { EMAIL_ENABLED, sendEmail } from "./lib/email.js";
import { UPLOAD_DIR } from "./lib/uploads.js";
import { findEventBySlug } from "./lib/store.js";
import { ON_VERCEL, missingConfig } from "./lib/config.js";

const PUBLIC_DIR = fileURLToPath(new URL("./public", import.meta.url));

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
// En-têtes de sécurité (aussi appliqués aux fichiers statiques par vercel.json).
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(self), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  });
  if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "4.5mb" })); // images envoyées en base64 (limite Vercel)

// Configuration incomplète : message explicite plutôt qu'un plantage.
if (missingConfig.length) {
  console.error("Configuration incomplète :", missingConfig.join(", "));
  app.use((req, res) => {
    res.status(503).type("html").send(`<meta name="viewport" content="width=device-width">
      <div style="font-family:sans-serif;max-width:560px;margin:10vh auto;padding:16px">
      <h1>Configuration incomplète</h1><p>Variables d'environnement manquantes sur Vercel :</p>
      <ul>${missingConfig.map((v) => `<li><code>${v}</code></li>`).join("")}</ul>
      <p>Ajoutez-les (Settings → Environment Variables / Storage) puis redéployez.</p></div>`);
  });
}

// Réglages publics lus par le navigateur (identifiant Google Analytics, facultatif).
app.get("/api/config", async (req, res) => res.json({
  gaId: process.env.GA_MEASUREMENT_ID || "",
  emailEnabled: EMAIL_ENABLED,
  vapidPublicKey: await vapidKey(),
  realtime: REALTIME,
  social: [GOOGLE_ENABLED && "google", FACEBOOK_ENABLED && "facebook"].filter(Boolean),
  defaultLivePlatform: (await getSetting("defaultLivePlatform").catch(() => null)) || "youtube",
}));

// QR code (SVG) d'un lien : faire-part, invitation au live.
app.get("/api/qr", async (req, res) => {
  const data = String(req.query.data || "");
  if (!/^https?:\/\//.test(data) || data.length > 400) return res.status(400).json({ error: "Lien invalide." });
  const svg = await QRCode.toString(data, { type: "svg", margin: 1, color: { dark: "#1d1a20", light: "#ffffff" } });
  res.type("image/svg+xml").set("Cache-Control", "public, max-age=86400").send(svg);
});

// Abonnement aux notifications push : lié au compte connecté, sinon à l'invité anonyme (réponses à ses messages).
app.post("/api/push/subscribe", async (req, res) => {
  const sub = req.body?.subscription;
  if (!(await vapidKey())) return res.status(503).json({ error: "Notifications non activées." });
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return res.status(400).json({ error: "Abonnement invalide." });
  const organizer = await currentOrganizer(req);
  const owners = [organizer ? orgOwner(organizer.id) : null, `gid:${guestAuthor(req, res)}`].filter(Boolean);
  await savePushSub(owners[0], { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  res.json({ ok: true });
});
app.post("/api/push/unsubscribe", async (req, res) => {
  if (req.body?.endpoint) await deletePushSub(String(req.body.endpoint)).catch(() => {});
  res.json({ ok: true });
});

// Tâche quotidienne (Vercel Cron) : rappel de fin de replay (J+13) à l'organisateur, notifications « aujourd'hui / demain »,
// rappel par email aux invités la veille.
app.get(["/api/cron/daily", "/api/cron/replay-reminders"], async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.get("authorization") !== `Bearer ${secret}`) return res.status(401).json({ error: "Non autorisé." });
  // Rappel 2 jours avant la fin du replay : J+13 (15 jours, gratuit) ou J+28 (30 jours, premium).
  const day = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
  const dayPremium = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
  let sent = 0;
  const ending = [
    ...(await listEventsOnDate(day)).filter((e) => e), ...(await listEventsOnDate(dayPremium)),
  ];
  for (const event of ending) {
    if ((await isPremium(event.organizerId)) !== (event.date === dayPremium)) continue;
    if (!event.cameras?.length) continue;
    const organizer = await findOrganizer(event.organizerId);
    if (!organizer) continue;
    const ok = await sendEmail({
      to: organizer.email,
      subject: `Le replay de « ${event.name} » expire dans 2 jours`,
      title: "Pensez à récupérer votre replay",
      body: `<p>Le replay de <b>${event.name.replace(/</g, "&lt;")}</b> ne sera plus proposé aux invités dans 2 jours.</p>
        <p>Vos vidéos restent disponibles sur vos comptes YouTube / Twitch, d'où vous pouvez les télécharger :
        YouTube Studio → Contenu → ⋮ → Télécharger.</p>
        <p>Les photos, vidéos, vocaux et messages de vos invités se téléchargent en un fichier .zip depuis
        « Mes événements » → 📦 Télécharger les souvenirs.</p>`,
    });
    if (ok) sent++;
  }
  // Notifications du jour : « c'est aujourd'hui » (live) et « c'est demain » aux organisateurs et à ceux qui suivent l'événement.
  const date = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  let pushed = 0;
  for (const [offset, label] of [[0, "aujourd'hui"], [1, "demain"]]) {
    for (const event of await listEventsOnDate(date(offset))) {
      if (event.suspended) continue;
      const followers = await listFollowerIds(event.id).catch(() => []);
      const live = offset === 0 && event.cameras?.length;
      pushed += await notify([event.organizerId, ...followers].map(orgOwner), {
        title: live ? `● Live ${label} : ${event.name}` : `📅 ${event.name}, c'est ${label} !`,
        body: `${label === "demain" ? "Demain" : "Aujourd'hui"} à ${event.time} — ${event.location}`,
        url: live ? `/live?e=${event.slug}` : `/e/${event.slug}`,
      });
      if (offset === 1) sent += await remindInvites(event).catch(() => 0);
    }
  }
  res.json({ day, sent, pushed });
});

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/public/:slug", socialRoutes);
app.use("/api/cameraman", cameramanRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/me", meRoutes);

// Page publique : on injecte titre + balises Open Graph pour un bel aperçu dans WhatsApp/SMS.
const eventTemplate = readFileSync(new URL("./public/event.html", import.meta.url), "utf8");
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

app.get("/e/:slug", async (req, res) => {
  const event = await findEventBySlug(req.params.slug);
  const title = event ? event.name : "Événement";
  let image = "";
  if (event?.visibility === "public" && event.cover) {
    const url = event.cover.startsWith("/") ? `${req.protocol}://${req.get("host")}${event.cover}` : event.cover;
    image = `<meta property="og:image" content="${escapeHtml(url)}">`;
  }
  const isPublic = event?.visibility === "public" && !event.suspended;
  const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  const desc = isPublic
    ? `${event.name} — ${event.date.split("-").reverse().join("/")} à ${event.time}, ${event.location}. Suivez l'événement en direct sur MaFeliza.`
    : "Vous êtes invité·e ! Découvrez tous les détails de l'événement.";
  // Fiche « Événement » pour Google (événements publics) ; les événements privés ne sont pas indexés.
  const jsonLd = isPublic ? `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "Event", name: event.name, startDate: `${event.date}T${event.time || "12:00"}`,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: event.cameras?.length ? "https://schema.org/MixedEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
    location: { "@type": "Place", name: event.location, address: event.location },
    image: event.cover ? [event.cover.startsWith("/") ? base + event.cover : event.cover] : undefined,
    description: event.description || desc, url: `${base}/e/${event.slug}`,
    organizer: { "@type": "Organization", name: "MaFeliza", url: base },
  }).replace(/</g, "\\u003c")}</script>` : "";
  const meta = `<title>${escapeHtml(title)} — MaFeliza</title>
    <meta name="description" content="${escapeHtml(desc)}">
    ${isPublic ? `<link rel="canonical" href="${escapeHtml(`${base}/e/${event.slug}`)}">` : '<meta name="robots" content="noindex">'}
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(desc)}">${image}${jsonLd}`;
  res.status(event ? 200 : 404).type("html").send(eventTemplate.replace("<!--META-->", meta));
});

// Plan du site pour Google : pages publiques et événements publics à venir.
app.get("/sitemap.xml", async (req, res) => {
  const base = (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  const events = await listPublicUpcoming(50).catch(() => []);
  const urls = ["/", "/decouvrir", "/connexion", "/mentions-legales", "/cgu", "/confidentialite"].map((p) => `<url><loc>${base}${p}</loc></url>`)
    .concat(events.map((e) => `<url><loc>${base}/e/${encodeURIComponent(e.slug)}</loc><lastmod>${String(e.updatedAt || e.createdAt || "").slice(0, 10) || e.date}</lastmod></url>`));
  res.type("application/xml").set("Cache-Control", "public, max-age=3600")
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
});

// Erreurs JavaScript des navigateurs (limitées) : transmises au suivi des erreurs.
app.post("/api/client-error", async (req, res) => {
  if (!(await tooFast(`cerr:${req.ip}`, 20, 3_600_000))) {
    const b = req.body || {};
    reportError({ name: "ErreurNavigateur", message: String(b.message || "").slice(0, 300), stack: String(b.stack || "").slice(0, 3000) },
      { source: "navigateur", url: String(b.url || "").slice(0, 300), extra: { ua: String(req.get("user-agent") || "").slice(0, 200) } });
  }
  res.status(204).end();
});

// Route d'API inconnue : réponse JSON (et non une page HTML).
app.use("/api", (req, res) => res.status(404).json({ error: "Ressource introuvable." }));

// Erreur inattendue (base injoignable…) : réponse propre au lieu d'un plantage.
app.use((err, req, res, next) => {
  reportError(err, { url: req.originalUrl });
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Service momentanément indisponible, réessayez dans un instant." });
});

// En local uniquement : sur Vercel, public/ est servi par le CDN et api/index.js reçoit le reste (vercel.json).
if (!ON_VERCEL) {
  app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "30d", immutable: true }));
  app.use(express.static(PUBLIC_DIR, {
    extensions: ["html"],
    // Photos et bibliothèques : gardées en cache ; CSS versionnée (?v=) : cache long.
    setHeaders: (res, file) => { if (/[\\/](img|vendor)[\\/]/.test(file)) res.set("Cache-Control", "public, max-age=604800"); },
  }));
  app.use((req, res) => res.status(404).sendFile(`${PUBLIC_DIR}/404.html`));
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Plateforme événementielle : http://localhost:${port}`));
}

export default app;
