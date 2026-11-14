// Carte de partage (Facebook, WhatsApp, Messenger…) : image 1200×630 générée à partir de l'événement
// (photo, nom, date, lieu, logo MaFeliza). PNG gardé sur disque : régénéré seulement si l'événement change.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { UPLOAD_DIR } from "./uploads.js";
import { localMedia } from "./media-cache.js";

const W = 1200, H = 630;
const DIR = `${process.env.DATA_DIR || "./data"}/og`;
const MEDIA_DIR = `${process.env.DATA_DIR || "./data"}/media-cache`;
const FONTS = ["Inter-ExtraBold.ttf", "Inter-Medium.ttf", "DMSerifDisplay-Regular.ttf"].map((f) => new URL(`../assets/fonts/${f}`, import.meta.url).pathname);
const LOGO = `data:image/png;base64,${readFileSync(new URL("../public/img/logo.png", import.meta.url)).toString("base64")}`;
const LABEL = { mariage: "Mariage", anniversaire: "Anniversaire", bapteme: "Baptême", communion: "Communion", fiancailles: "Fiançailles",
  "baby-shower": "Baby shower", diplome: "Remise de diplôme", retraite: "Départ à la retraite", inauguration: "Inauguration", autre: "Événement" };

// resvg (rendu SVG → PNG) : facultatif, l'aperçu garde la simple photo s'il n'est pas installé.
const Resvg = await import("@resvg/resvg-js").then((m) => m.Resvg).catch(() => null);
export const OG_ENABLED = Boolean(Resvg);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const photoOf = (ev) => (ev.invite?.photo && !["none", "cover"].includes(ev.invite.photo) ? ev.invite.photo : ev.cover) || "";

// Version de la carte : change dès que ce qu'elle affiche change.
export const ogVersion = (ev) => createHash("sha1").update(JSON.stringify([ev.name, ev.date, ev.time, ev.location, ev.type, ev.visibility, photoOf(ev), 9, new Date().toISOString().slice(0, 10)])).digest("hex").slice(0, 10);

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
    // Adresse complète de notre propre site (https://mafeliza.com/uploads/…) : lue sur le disque.
    const path = url.replace(/^https?:\/\/(www\.)?mafeliza\.com/i, "").replace(host, "").split(/[?#]/)[0];
    const disk = (p) => readFileSync(p);
    if (url.startsWith("data:image/")) buf = Buffer.from(url.split(",")[1] || "", "base64");
    else if (path.startsWith("/uploads/")) buf = disk(`${UPLOAD_DIR}/${decodeURIComponent(path.slice(9))}`);
    else if (path.startsWith("/img/")) buf = disk(new URL(`../public${path}`, import.meta.url));
    else if (path.startsWith("/media/") && existsSync(`${MEDIA_DIR}/${path.slice(7).replace(/\//g, "__")}`)) buf = disk(`${MEDIA_DIR}/${path.slice(7).replace(/\//g, "__")}`);
    else {
      url = localMedia(url, `${host}/media/`); // photo Supabase : via le cache du serveur
      const r = await fetch(url.startsWith("/") ? host + url : url, { signal: AbortSignal.timeout(10000), headers: { "User-Agent": "Mozilla/5.0 (MaFeliza share card)", Accept: "image/*" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      buf = Buffer.from(await r.arrayBuffer());
    }
    if (sharp) buf = await sharp(buf).rotate().resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    else if (!(buf[0] === 0xff && buf[1] === 0xd8) && !(buf[0] === 0x89 && buf[1] === 0x50)) throw new Error("format non lisible sans sharp (npm install)");
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch (err) {
    console.error(`Carte de partage : photo illisible (${String(url).slice(0, 120)}) : ${err.message}`);
    return null;
  }
}

// Photo de remplacement par type d'événement (événement sans photo).
const FALLBACK = { mariage: "alliances.jpg", fiancailles: "alliances-2.jpg", anniversaire: "anniversaire.jpg", bapteme: "bebe.jpg", "baby-shower": "baby-shower-f.jpg",
  communion: "communion-f.jpg", diplome: "diplome.jpg", retraite: "anniversaire-2.jpg", inauguration: "inauguration.jpg", autre: "anniversaire-3.jpg" };
export const fallbackPhoto = (type) => `/img/demo/${FALLBACK[type] || FALLBACK.autre}`;

// Événement sans photo : le visuel MaFeliza de son type (dégradé + pictogramme), comme dans l'application —
// jamais une photo d'inconnus.
const TONES = { mariage: ["#f9d9c5", "#e8a0b4", "#b06ab3"], anniversaire: ["#ffd36e", "#fe7320", "#fd1a85"], bapteme: ["#cfe8ff", "#9cc9f5", "#7b8fe0"],
  communion: ["#fff3d6", "#f1c27d", "#c98b5b"], fiancailles: ["#ffd1dc", "#fd5c9a", "#c2185b"], "baby-shower": ["#ffe0ec", "#c9e4ff", "#a5b8ff"],
  diplome: ["#d7e3ff", "#5b7cfa", "#2b2f8a"], retraite: ["#d4f5e9", "#48c9b0", "#1f8a8a"], inauguration: ["#ffe7c2", "#ff9a5a", "#e8137a"] };
// Emoji du type d'événement (le même que dans l'application), en image Twemoji (assets/emoji, licence CC-BY 4.0).
const EMOJI = { mariage: "1f48d", anniversaire: "1f382", bapteme: "1f54a", communion: "1f56f", fiancailles: "1f49e", "baby-shower": "1f37c",
  diplome: "1f393", retraite: "1f334", inauguration: "1f380", autre: "1f389" };
const emojiData = (type) => {
  try { return `data:image/svg+xml;base64,${readFileSync(new URL(`../assets/emoji/${EMOJI[type] || EMOJI.autre}.svg`, import.meta.url)).toString("base64")}`; }
  catch { return null; }
};
// Emoji posé au-dessus du voile sombre (il reste lumineux), dans un halo clair.
function emojiOver(type) {
  const em = emojiData(type);
  return `<circle cx="930" cy="330" r="170" fill="#fff" opacity=".18"/><circle cx="930" cy="330" r="130" fill="#fff" opacity=".2"/>${em ? `<image href="${em}" x="840" y="240" width="180" height="180"/>` : ""}`;
}
function placeholder(type) {
  const [a, b, c] = TONES[type] || ["#fe7320", "#fd1a85", "#8a1de9"];
  const dots = [[120, 110, 70], [1080, 90, 100], [1110, 560, 60], [90, 560, 90], [820, 160, 26], [300, 420, 20], [560, 90, 14]]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".16"/>`).join("");
  return `<defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
    <radialGradient id="ph" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#pg)"/>${dots}`;
}

// Affiche façon invitation : photo plein cadre, dégradé, accroche, noms en grand (police à empattements),
// date, compte à rebours et bouton « Voir l'invitation » ; logo MaFeliza en haut à droite.
function svg(ev, photo) {
  const d = new Date(`${ev.date}T${ev.time || "12:00"}`);
  const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d).replace(/^./, (c) => c.toUpperCase());
  const when = ev.time ? `${date} · ${ev.time.replace(":", "h")}` : date;
  const days = Math.ceil((d - Date.now()) / 864e5);
  const badge = days > 1 ? `J-${days}` : days === 1 ? "Demain" : days === 0 ? "Aujourd'hui" : "Revivez-le";
  const title = (ev.invite?.title || ev.name).replace(/\s*&\s*/g, " & ");
  const kicker = (ev.invite?.kicker || LABEL[ev.type] || "").toUpperCase();
  const size = title.length <= 18 ? 100 : title.length <= 36 ? 84 : 66;
  const name = lines(title, size * 0.86, 1060, size === 66 ? 3 : 2); // police à empattements plus étroite qu'Inter
  const place = ev.visibility === "public" && ev.location ? lines(ev.location.split(",").slice(-2).join(",").trim(), 28, 900, 1)[0] : "";
  const y0 = 330 - (name.length - 1) * size * 0.95;
  const after = y0 + (name.length - 1) * size * 0.98;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14030f" stop-opacity=".15"/><stop offset=".45" stop-color="#14030f" stop-opacity=".45"/><stop offset="1" stop-color="#14030f" stop-opacity=".93"/></linearGradient>
    <linearGradient id="side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#14030f" stop-opacity=".55"/><stop offset=".6" stop-color="#14030f" stop-opacity="0"/></linearGradient>
    <linearGradient id="btn" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fd1a85"/><stop offset="1" stop-color="#c60bd2"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#2a0620"/>
  ${photo ? `<image href="${photo}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` : placeholder(ev.type)}
  <rect width="${W}" height="${H}" fill="url(#fade)"/><rect width="${W}" height="${H}" fill="url(#side)"/>
  ${photo ? "" : emojiOver(ev.type)}
  <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2" rx="0"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.5" rx="18"/>
  <rect x="${W - 286}" y="50" width="226" height="56" rx="28" fill="#000" fill-opacity=".35"/>
  <image href="${LOGO}" x="${W - 276}" y="58" width="40" height="40"/>
  <text x="${W - 228}" y="87" font-family="Inter" font-weight="800" font-size="24" fill="#fff">mafeliza.com</text>
  <rect x="64" y="56" width="${badge.length * 17 + 40}" height="48" rx="24" fill="url(#btn)"/>
  <text x="${64 + (badge.length * 17 + 40) / 2}" y="88" text-anchor="middle" font-family="Inter" font-weight="800" font-size="24" fill="#fff">${esc(badge)}</text>
  ${kicker ? `<text x="64" y="${y0 - size + 8}" font-family="Inter" font-weight="500" font-size="24" fill="#fff" letter-spacing="7" opacity=".92">${esc(kicker)}</text>` : ""}
  ${name.map((l, i) => `<text x="62" y="${y0 + i * size * 0.98}" font-family="DM Serif Display" font-size="${size}" fill="#fff">${esc(l)}</text>`).join("")}
  <text x="64" y="${after + 62}" font-family="Inter" font-weight="500" font-size="30" fill="#fff">${esc(when)}</text>
  ${place ? `<text x="64" y="${after + 104}" font-family="Inter" font-weight="500" font-size="26" fill="#fff" opacity=".8">${esc(place)}</text>` : ""}
  <rect x="64" y="${H - 122}" width="330" height="66" rx="33" fill="url(#btn)"/>
  <text x="229" y="${H - 79}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="27" fill="#fff">Voir l'invitation  →</text>
  <text x="420" y="${H - 80}" font-family="Inter" font-weight="500" font-size="22" fill="#fff" opacity=".85">Live · Photos · Livre d'or</text>
</svg>`;
}

// PNG de la carte (depuis le disque si déjà générée pour cette version de l'événement).
export async function ogCard(ev, host) {
  if (!Resvg) return null;
  const file = `${DIR}/${ev.id}-${ogVersion(ev)}.png`;
  if (existsSync(file)) return readFileSync(file);
  const png = new Resvg(svg(ev, await photoData(photoOf(ev), host)), {
    fitTo: { mode: "width", value: W }, font: { fontFiles: FONTS, loadSystemFonts: true, defaultFontFamily: "Inter", serifFamily: "DM Serif Display" },
  }).render().asPng();
  mkdirSync(DIR, { recursive: true });
  writeFileSync(file, png);
  return png;
}
