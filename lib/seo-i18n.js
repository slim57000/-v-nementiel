// Référencement multilingue : chaque page publique principale (accueil + pages Google) existe aussi à une
// adresse par langue (/en/, /es/mariage-en-direct…), reliée aux autres par des balises hreflang.
// Accueil : les textes sont traduits par l'appli (dictionnaire du site) ; pages Google : traduites côté serveur
// une fois, puis gardées en mémoire. Sans traduction disponible, l'adresse renvoie vers la version française.
import { translateHtml, translateTexts } from "./translate.js";

export const SEO_LANGS = ["en", "de", "es", "it", "pt", "nl", "tr", "ar", "pl", "ro", "ru", "uk", "zh", "hi"];
const HREFLANG = { zh: "zh-Hans" };
const LOCALE = { fr: "fr_FR", en: "en_GB", de: "de_DE", es: "es_ES", it: "it_IT", pt: "pt_PT", nl: "nl_NL", tr: "tr_TR", ar: "ar_AR",
  pl: "pl_PL", ro: "ro_RO", ru: "ru_RU", uk: "uk_UA", zh: "zh_CN", hi: "hi_IN" };
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const urlFor = (base, lang, path) => `${base}${lang === "fr" ? "" : `/${lang}`}${lang !== "fr" && path === "/" ? "/" : path}`;

// <link rel="alternate" hreflang> : toutes les langues + x-default (français).
export function alternates(base, path) {
  return [`<link rel="alternate" hreflang="fr" href="${urlFor(base, "fr", path)}">`,
    ...SEO_LANGS.map((l) => `<link rel="alternate" hreflang="${HREFLANG[l] || l}" href="${urlFor(base, l, path)}">`),
    `<link rel="alternate" hreflang="x-default" href="${urlFor(base, "fr", path)}">`].join("");
}
export const withAlternates = (html, base, path) => (html.includes('hreflang="x-default"') ? html : html.replace(/<\/head>/i, `${alternates(base, path)}\n</head>`));

// Entrées du plan du site avec leurs versions linguistiques.
export const sitemapEntries = (base, path) => ["fr", ...SEO_LANGS].map((l) => `<url><loc>${urlFor(base, l, path)}</loc>${
  ["fr", ...SEO_LANGS].map((x) => `<xhtml:link rel="alternate" hreflang="${HREFLANG[x] || x}" href="${urlFor(base, x, path)}"/>`).join("")
}<xhtml:link rel="alternate" hreflang="x-default" href="${urlFor(base, "fr", path)}"/></url>`).join("");

// Version d'une page dans une langue. full : tout le texte est traduit (pages Google) ; sinon seulement
// titre et description (l'accueil se traduit lui-même dans le navigateur). null : traduction indisponible.
// Données structurées (FAQ, page…) : leurs textes sont traduits aussi, pour correspondre à la page.
async function translateLd(json, lang) {
  let data;
  try { data = JSON.parse(json); } catch { return json; }
  const spots = [];
  const walk = (o) => { if (Array.isArray(o)) return o.forEach(walk); if (!o || typeof o !== "object") return;
    for (const k of ["name", "text", "description"]) if (typeof o[k] === "string" && !/^MaFeliza$/.test(o[k])) spots.push([o, k]);
    Object.values(o).forEach(walk); };
  walk(data);
  if (!spots.length) return json;
  const out = await translateTexts(spots.map(([o, k]) => o[k]), lang, 20000);
  spots.forEach(([o, k], i) => { o[k] = out[i] || o[k]; });
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export async function localize(html, lang, path, base, full, localPaths = []) {
  const get = (re) => html.match(re)?.[1] || "";
  const title = get(/<title>([^<]*)<\/title>/i), desc = get(/<meta name="description" content="([^"]*)"/i);
  const [tTitle, tDesc] = await translateTexts([title, desc].map((s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")), lang, 15000);
  if (!tTitle || tTitle === title) return null; // traduction indisponible : pas de page en double
  let out = html;
  if (full) {
    // Scripts (données structurées, code) et styles mis de côté : seul le texte visible est traduit.
    const kept = [];
    const masked = out.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, (m) => `<!--k${kept.push(m) - 1}-->`);
    const translated = await translateHtml(masked, lang, 30000);
    if (!translated) return null;
    for (let i = 0; i < kept.length; i++) {
      const m = kept[i].match(/^(<script type="application\/ld\+json">)([\s\S]*)(<\/script>)$/);
      if (m) kept[i] = m[1] + await translateLd(m[2], lang) + m[3];
    }
    out = translated.replace(/<!--k(\d+)-->/g, (_, i) => kept[Number(i)]);
    // Liens internes vers les autres pages traduites : restent dans la même langue.
    out = out.replace(/href="\/(\?accueil)?"/g, `href="/${lang}/"`)
      .replace(/href="\/([\w-]+)"/g, (m, slug) => (localPaths.includes(`/${slug}`) ? `href="/${lang}/${slug}"` : m));
  }
  const url = urlFor(base, lang, path);
  out = out
    .replace(/<html[^>]*>/i, `<html lang="${HREFLANG[lang] || lang}" data-lang="${lang}"${lang === "ar" ? ' dir="rtl"' : ""}>`)
    .replace(/<title>[^<]*<\/title>/i, `<title>${attr(tTitle)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*"/i, `$1${attr(tDesc)}"`)
    .replace(/(<meta property="og:title" content=")[^"]*"/i, `$1${attr(tTitle)}"`)
    .replace(/(<meta property="og:description" content=")[^"]*"/i, `$1${attr(tDesc)}"`)
    .replace(/(<link rel="canonical" href=")[^"]*"/i, `$1${url}"`)
    .replace(/(<meta property="og:url" content=")[^"]*"/i, `$1${url}"`);
  out = /og:locale/.test(out) ? out.replace(/(<meta property="og:locale" content=")[^"]*"/, `$1${LOCALE[lang]}"`) : out.replace(/<\/head>/i, `<meta property="og:locale" content="${LOCALE[lang]}">\n</head>`);
  return withAlternates(out, base, path);
}
