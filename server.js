import express from "express";
import QRCode from "qrcode";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.js";
import eventRoutes from "./routes/events.js";
import publicRoutes from "./routes/public.js";
import socialRoutes from "./routes/social.js";
import cameramanRoutes from "./routes/cameraman.js";
import adminRoutes from "./routes/admin.js";
import meRoutes from "./routes/me.js";
import { getSetting, listEventsOnDate, findOrganizer } from "./lib/store.js";
import { EMAIL_ENABLED, sendEmail } from "./lib/email.js";
import { UPLOAD_DIR } from "./lib/uploads.js";
import { findEventBySlug } from "./lib/store.js";
import { ON_VERCEL, missingConfig } from "./lib/config.js";

const PUBLIC_DIR = fileURLToPath(new URL("./public", import.meta.url));

const app = express();
app.set("trust proxy", 1);
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
  defaultLivePlatform: (await getSetting("defaultLivePlatform").catch(() => null)) || "youtube",
}));

// QR code (SVG) d'un lien : faire-part, invitation au live.
app.get("/api/qr", async (req, res) => {
  const data = String(req.query.data || "");
  if (!/^https?:\/\//.test(data) || data.length > 400) return res.status(400).json({ error: "Lien invalide." });
  const svg = await QRCode.toString(data, { type: "svg", margin: 1, color: { dark: "#1d1a20", light: "#ffffff" } });
  res.type("image/svg+xml").set("Cache-Control", "public, max-age=86400").send(svg);
});

// Tâche quotidienne (Vercel Cron) : rappel à l'organisateur 2 jours avant la fin du replay (J+13).
app.get("/api/cron/replay-reminders", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.get("authorization") !== `Bearer ${secret}`) return res.status(401).json({ error: "Non autorisé." });
  const day = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
  let sent = 0;
  for (const event of await listEventsOnDate(day)) {
    if (!event.cameras?.length) continue;
    const organizer = await findOrganizer(event.organizerId);
    if (!organizer) continue;
    const ok = await sendEmail({
      to: organizer.email,
      subject: `Le replay de « ${event.name} » expire dans 2 jours`,
      title: "Pensez à récupérer votre replay",
      body: `<p>Le replay de <b>${event.name.replace(/</g, "&lt;")}</b> ne sera plus proposé aux invités dans 2 jours.</p>
        <p>Vos vidéos restent disponibles sur vos comptes YouTube / Twitch, d'où vous pouvez les télécharger :
        YouTube Studio → Contenu → ⋮ → Télécharger.</p>`,
    });
    if (ok) sent++;
  }
  res.json({ day, sent });
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
  const meta = `<title>${escapeHtml(title)}</title>
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="Vous êtes invité·e ! Découvrez tous les détails de l'événement.">${image}`;
  res.status(event ? 200 : 404).type("html").send(eventTemplate.replace("<!--META-->", meta));
});

// Erreur inattendue (base injoignable…) : réponse propre au lieu d'un plantage.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Service momentanément indisponible, réessayez dans un instant." });
});

// En local uniquement : sur Vercel, public/ est servi par le CDN et api/index.js reçoit le reste (vercel.json).
if (!ON_VERCEL) {
  app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "30d", immutable: true }));
  app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));
  app.use((req, res) => res.status(404).sendFile(`${PUBLIC_DIR}/404.html`));
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Plateforme événementielle : http://localhost:${port}`));
}

export default app;
