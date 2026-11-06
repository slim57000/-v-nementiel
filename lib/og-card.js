// Carte de partage (Facebook, WhatsApp, Messenger…) : image 1200×630 générée à partir de l'événement
// (photo, nom, date, lieu, logo MaFeliza). PNG gardé sur disque : régénéré seulement si l'événement change.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { UPLOAD_DIR } from "./uploads.js";
import { localMedia } from "./media-cache.js";

const W = 1200, H = 630;
const DIR = `${process.env.DATA_DIR || "./data"}/og`;
const FONTS = ["Inter-ExtraBold.ttf", "Inter-Medium.ttf"].map((f) => new URL(`../assets/fonts/${f}`, import.meta.url).pathname);
const LOGO = `data:image/png;base64,${readFileSync(new URL("../public/img/logo.png", import.meta.url)).toString("base64")}`;
const LABEL = { mariage: "Mariage", anniversaire: "Anniversaire", bapteme: "Baptême", communion: "Communion", fiancailles: "Fiançailles",
  "baby-shower": "Baby shower", diplome: "Remise de diplôme", retraite: "Départ à la retraite", inauguration: "Inauguration", autre: "Événement" };

// resvg (rendu SVG → PNG) : facultatif, l'aperçu garde la simple photo s'il n'est pas installé.
const Resvg = await import("@resvg/resvg-js").then((m) => m.Resvg).catch(() => null);
export const OG_ENABLED = Boolean(Resvg);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const photoOf = (ev) => (ev.invite?.photo && !["none", "cover"].includes(ev.invite.photo) ? ev.invite.photo : ev.cover) || "";

// Version de la carte : change dès que ce qu'elle affiche change.
export const ogVersion = (ev) => createHash("sha1").update(JSON.stringify([ev.name, ev.date, ev.time, ev.location, ev.type, ev.visibility, photoOf(ev), 3])).digest("hex").slice(0, 10);

// Découpe un texte en lignes (largeur moyenne d'un caractère ≈ 0,56 × taille de police).
function lines(text, size, maxW, max) {
  const out = [];
  for (const w of String(text).split(/\s+/)) {
    const cur = out.at(-1);
    if (cur !== undefined && (cur.length + 1 + w.length) * size * 0.56 <= maxW) out[out.length - 1] = `${cur} ${w}`;
    else out.push(w);
  }
  if (out.length > max) { out.length = max; out[max - 1] = `${out[max - 1].replace(/\s*\S{0,3}$/, "")}…`; }
  return out;
}

// Photo de l'événement (JPEG, PNG ou WebP) convertie en JPEG 1200 px pour la carte (resvg ne lit pas le WebP).
const sharp = await import("sharp").then((m) => m.default).catch(() => null);
async function photoData(url, host) {
  if (!url) return null;
  try {
    let buf;
    if (url.startsWith("/uploads/")) buf = readFileSync(`${UPLOAD_DIR}/${url.slice(9)}`);
    else {
      url = localMedia(url, `${host}/media/`); // photo Supabase : via le cache du serveur
      const r = await fetch(url.startsWith("/") ? host + url : url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return null;
      buf = Buffer.from(await r.arrayBuffer());
    }
    if (sharp) buf = await sharp(buf).rotate().resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    else if (!(buf[0] === 0xff && buf[1] === 0xd8) && !(buf[0] === 0x89 && buf[1] === 0x50)) return null; // ni JPEG ni PNG
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch { return null; }
}

function svg(ev, photo) {
  const d = new Date(`${ev.date}T${ev.time || "12:00"}`);
  const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d).replace(/^./, (c) => c.toUpperCase());
  const when = ev.time ? `${date} · ${ev.time.replace(":", "h")}` : date;
  const name = lines(ev.name, 72, 640, 3);
  const nameY = 300 - (name.length - 1) * 40;
  const place = ev.visibility === "public" && ev.location ? lines(ev.location, 30, 620, 1)[0] : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fd1a85"/><stop offset="1" stop-color="#7b12c9"/></linearGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#14030f" stop-opacity=".92"/><stop offset=".55" stop-color="#14030f" stop-opacity=".7"/><stop offset="1" stop-color="#14030f" stop-opacity=".05"/></linearGradient>
    <clipPath id="card"><rect x="760" y="60" width="380" height="510" rx="28"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${photo ? `<image href="${photo}" x="-40" y="-40" width="${W + 80}" height="${H + 80}" preserveAspectRatio="xMidYMid slice" opacity=".55"/>` : `<circle cx="1050" cy="120" r="220" fill="#fff" opacity=".08"/><circle cx="880" cy="560" r="160" fill="#fff" opacity=".06"/>`}
  <rect width="${W}" height="${H}" fill="url(#shade)"/>
  ${photo ? `<rect x="754" y="54" width="392" height="522" rx="32" fill="#fff" opacity=".9"/>
  <image href="${photo}" x="760" y="60" width="380" height="510" preserveAspectRatio="xMidYMid slice" clip-path="url(#card)"/>`
    : `<image href="${LOGO}" x="820" y="175" width="260" height="260"/>`}
  <rect x="64" y="${nameY - 128}" width="${(LABEL[ev.type] || "Événement").length * 15 + 48}" height="44" rx="22" fill="#fd1a85"/>
  <text x="88" y="${nameY - 98}" font-family="Inter" font-weight="800" font-size="22" fill="#fff" letter-spacing="1">${esc((LABEL[ev.type] || "Événement").toUpperCase())}</text>
  ${name.map((l, i) => `<text x="64" y="${nameY + i * 80}" font-family="Inter" font-weight="800" font-size="72" fill="#fff">${esc(l)}</text>`).join("")}
  <text x="64" y="${nameY + (name.length - 1) * 80 + 70}" font-family="Inter" font-weight="500" font-size="30" fill="#fff" opacity=".95">${esc(when)}</text>
  ${place ? `<text x="64" y="${nameY + (name.length - 1) * 80 + 115}" font-family="Inter" font-weight="500" font-size="30" fill="#fff" opacity=".8">${esc(place)}</text>` : ""}
  <image href="${LOGO}" x="64" y="528" width="54" height="54"/>
  <text x="130" y="566" font-family="Inter" font-weight="800" font-size="30" fill="#fff">MaFeliza</text>
  <text x="290" y="565" font-family="Inter" font-weight="500" font-size="22" fill="#fff" opacity=".85">Faire-part · Live · Photos · Livre d'or</text>
</svg>`;
}

// PNG de la carte (depuis le disque si déjà générée pour cette version de l'événement).
export async function ogCard(ev, host) {
  if (!Resvg) return null;
  const file = `${DIR}/${ev.id}-${ogVersion(ev)}.png`;
  if (existsSync(file)) return readFileSync(file);
  const png = new Resvg(svg(ev, await photoData(photoOf(ev), host)), {
    fitTo: { mode: "width", value: W }, font: { fontFiles: FONTS, loadSystemFonts: true, defaultFontFamily: "Inter" },
  }).render().asPng();
  mkdirSync(DIR, { recursive: true });
  writeFileSync(file, png);
  return png;
}
