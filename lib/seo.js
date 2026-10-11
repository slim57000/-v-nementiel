// Titre et description affichés par Google (et WhatsApp) pour les pages principales, modifiables depuis l'administration.
import { getSetting, setSetting } from "./store.js";
import { LANDINGS } from "./landings.js";

export const SEO_PAGES = { "/": "Accueil", "/connexion": "Connexion", "/decouvrir": "Découvrir",
  ...Object.fromEntries(Object.entries(LANDINGS).map(([slug, p]) => [`/${slug}`, `Page Google : ${p.label}`])) };
let cache = {};
export const loadSeo = async () => { cache = (await getSetting("seo").catch(() => null)) || {}; return cache; };
export const getSeo = () => cache;
export async function saveSeo(data) {
  const clean = {};
  for (const path of Object.keys(SEO_PAGES)) {
    const title = String(data?.[path]?.title || "").trim().slice(0, 70);
    const description = String(data?.[path]?.description || "").trim().slice(0, 170);
    if (title || description) clean[path] = { title, description };
  }
  // Codes de validation Google Search Console / Bing Webmaster (seulement le code, pas la balise entière).
  const code = (v) => String(v || "").replace(/.*content="([^"]*)".*/s, "$1").replace(/[^\w-]/g, "").slice(0, 100);
  if (data?._verify) clean._verify = { google: code(data._verify.google), bing: code(data._verify.bing) };
  await setSetting("seo", clean);
  cache = clean;
  return clean;
}

// Remplace titre / description (et leurs versions Open Graph) dans la page si un texte a été défini.
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
export function applySeo(html, path) {
  const v = path === "/" && cache._verify;
  if (v?.google) html = html.replace(/<\/head>/i, `<meta name="google-site-verification" content="${attr(v.google)}">\n</head>`);
  if (v?.bing) html = html.replace(/<\/head>/i, `<meta name="msvalidate.01" content="${attr(v.bing)}">\n</head>`);
  const s = cache[path];
  if (!s) return html;
  let out = html;
  if (s.title) {
    out = out.replace(/<title>[^<]*<\/title>/i, `<title>${attr(s.title)}</title>`);
    out = /property="og:title"/.test(out) ? out.replace(/(<meta property="og:title" content=")[^"]*"/, `$1${attr(s.title)}"`) : out.replace(/<\/head>/i, `<meta property="og:title" content="${attr(s.title)}">\n</head>`);
  }
  if (s.description) {
    out = /<meta name="description"/.test(out) ? out.replace(/(<meta name="description" content=")[^"]*"/, `$1${attr(s.description)}"`) : out.replace(/<\/head>/i, `<meta name="description" content="${attr(s.description)}">\n</head>`);
    out = /property="og:description"/.test(out) ? out.replace(/(<meta property="og:description" content=")[^"]*"/, `$1${attr(s.description)}"`) : out.replace(/<\/head>/i, `<meta property="og:description" content="${attr(s.description)}">\n</head>`);
  }
  return out;
}
