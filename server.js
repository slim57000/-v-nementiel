import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.js";
import eventRoutes from "./routes/events.js";
import publicRoutes from "./routes/public.js";
import { UPLOAD_DIR } from "./lib/uploads.js";
import { db } from "./db.js";

const PUBLIC_DIR = fileURLToPath(new URL("./public", import.meta.url));

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "12mb" })); // images envoyées en base64

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/public", publicRoutes);

app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "30d", immutable: true }));

// Page publique : on injecte titre + balises Open Graph pour un bel aperçu dans WhatsApp/SMS.
const eventTemplate = readFileSync(`${PUBLIC_DIR}/event.html`, "utf8");
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

app.get("/e/:slug", (req, res) => {
  const event = db.prepare("SELECT name, visibility, cover FROM events WHERE slug = ?").get(req.params.slug);
  const title = event ? event.name : "Événement";
  const image = event?.visibility === "public" && event.cover
    ? `<meta property="og:image" content="${req.protocol}://${req.get("host")}${event.cover}">` : "";
  const meta = `<title>${escapeHtml(title)}</title>
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="Vous êtes invité·e ! Découvrez tous les détails de l'événement.">${image}`;
  res.status(event ? 200 : 404).type("html").send(eventTemplate.replace("<!--META-->", meta));
});

app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Plateforme événementielle : http://localhost:${port}`));
