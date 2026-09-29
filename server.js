import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.js";
import eventRoutes from "./routes/events.js";
import publicRoutes from "./routes/public.js";
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

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/public", publicRoutes);

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

// En local uniquement : sur Vercel, public/ est servi par le CDN (cleanUrls dans vercel.json).
if (!ON_VERCEL) {
  app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "30d", immutable: true }));
  app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Plateforme événementielle : http://localhost:${port}`));
}

export default app;
