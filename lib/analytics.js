// Statistiques de fréquentation intégrées, sans cookie ni identifiant stocké : par jour, nombre de pages vues,
// visiteurs uniques (empreinte anonyme du jour, jamais conservée en clair), pages, sources et appareils.
import crypto from "node:crypto";
import { getSetting, setSetting } from "./store.js";

const day = () => new Date().toISOString().slice(0, 10);
const SALT = crypto.randomBytes(16).toString("hex"); // change à chaque redémarrage : empreintes non réutilisables
const bump = (obj, key, max = 60) => {
  if (!key) return;
  if (obj[key] != null || Object.keys(obj).length < max) obj[key] = (obj[key] || 0) + 1;
};
// Écritures groupées toutes les 15 s pour ne pas solliciter la base à chaque page vue.
const pending = new Map();
let timer = null;

// Présence en direct (mémoire seulement) : empreinte anonyme → dernier signe de vie, compte connecté ou non.
const online = new Map();
export function ping(req, userId, path) {
  const ua = String(req.get("user-agent") || "");
  if (/bot|crawl|spider|preview|curl|wget|headless/i.test(ua)) return;
  const key = userId ? `u:${userId}` : crypto.createHash("sha256").update(`${SALT}${req.ip}${ua}`).digest("hex").slice(0, 16);
  const prev = online.get(key);
  online.set(key, { at: Date.now(), since: prev?.since || Date.now(), userId: userId || null, path: String(path || prev?.path || "/").slice(0, 80),
    device: /iphone|ipad/i.test(ua) ? "📱" : /android/i.test(ua) ? "📱" : "💻" });
  if (online.size > 5000) onlineNow();
}
// Personnes actives sur la page d'un événement ou sur son live.
export function onlineOn(slug) {
  const cut = Date.now() - 90_000, page = `/e/${slug}`, live = `/live?e=${encodeURIComponent(slug)}`;
  let n = 0;
  for (const v of online.values()) if (v.at >= cut && (v.path === page || v.path.startsWith(live))) n++;
  return n;
}
// Actifs sur les 2 dernières minutes.
export function onlineNow(full = false) {
  const cut = Date.now() - 120_000;
  const list = [];
  for (const [k, v] of online) {
    if (v.at < cut) online.delete(k); else list.push(v);
  }
  const logged = list.filter((v) => v.userId).length;
  return full ? { total: list.length, logged, list } : { total: list.length, logged };
}

// Langue choisie sur le site (15 langues), affichée en français dans l'onglet Audience.
const LANG_NAMES = { fr: "Français", en: "Anglais", de: "Allemand", es: "Espagnol", it: "Italien", pt: "Portugais", nl: "Néerlandais", tr: "Turc",
  ar: "Arabe", pl: "Polonais", ro: "Roumain", ru: "Russe", uk: "Ukrainien", zh: "Chinois", hi: "Hindi" };
// Pays déduit du fuseau horaire du navigateur (aucune adresse IP enregistrée ni envoyée à un service extérieur).
const TZ_COUNTRY = {"Europe/Paris":"France","Europe/London":"Royaume-Uni","Europe/Brussels":"Belgique","Europe/Zurich":"Suisse","Europe/Luxembourg":"Luxembourg","Europe/Berlin":"Allemagne","Europe/Busingen":"Allemagne","Europe/Amsterdam":"Pays-Bas","Europe/Madrid":"Espagne","Atlantic/Canary":"Espagne","Africa/Ceuta":"Espagne","Europe/Lisbon":"Portugal","Atlantic/Madeira":"Portugal","Atlantic/Azores":"Portugal","Europe/Rome":"Italie","Europe/Vienna":"Autriche","Europe/Dublin":"Irlande","Europe/Warsaw":"Pologne","Europe/Bucharest":"Roumanie","Europe/Sofia":"Bulgarie","Europe/Athens":"Grèce","Europe/Istanbul":"Turquie","Europe/Kyiv":"Ukraine","Europe/Kiev":"Ukraine","Europe/Moscow":"Russie","Asia/Yekaterinburg":"Russie","Asia/Novosibirsk":"Russie","Asia/Vladivostok":"Russie","Europe/Stockholm":"Suède","Europe/Oslo":"Norvège","Europe/Copenhagen":"Danemark","Europe/Helsinki":"Finlande","Europe/Prague":"Tchéquie","Europe/Budapest":"Hongrie","Europe/Zagreb":"Croatie","Europe/Belgrade":"Serbie","Europe/Sarajevo":"Bosnie","Europe/Tirane":"Albanie","Europe/Monaco":"Monaco","Europe/Chisinau":"Moldavie","Europe/Bratislava":"Slovaquie","Europe/Ljubljana":"Slovénie","Europe/Skopje":"Macédoine du Nord","Asia/Nicosia":"Chypre","Europe/Nicosia":"Chypre","Africa/Casablanca":"Maroc","Africa/Algiers":"Algérie","Africa/Tunis":"Tunisie","Africa/Tripoli":"Libye","Africa/Cairo":"Égypte","Africa/Dakar":"Sénégal","Africa/Abidjan":"Côte d'Ivoire","Africa/Bamako":"Mali","Africa/Douala":"Cameroun","Africa/Kinshasa":"Congo (RDC)","Africa/Lubumbashi":"Congo (RDC)","Africa/Brazzaville":"Congo","Africa/Libreville":"Gabon","Africa/Conakry":"Guinée","Africa/Ouagadougou":"Burkina Faso","Africa/Porto-Novo":"Bénin","Africa/Lome":"Togo","Africa/Niamey":"Niger","Africa/Lagos":"Nigeria","Africa/Accra":"Ghana","Africa/Nairobi":"Kenya","Africa/Addis_Ababa":"Éthiopie","Africa/Johannesburg":"Afrique du Sud","Indian/Antananarivo":"Madagascar","Indian/Mauritius":"Maurice","Indian/Reunion":"La Réunion","Indian/Mayotte":"Mayotte","Indian/Comoro":"Comores","Africa/Nouakchott":"Mauritanie","Africa/Djibouti":"Djibouti","Africa/Ndjamena":"Tchad","Africa/Kigali":"Rwanda","Asia/Jerusalem":"Israël","Asia/Tel_Aviv":"Israël","Asia/Gaza":"Palestine","Asia/Hebron":"Palestine","Asia/Beirut":"Liban","Asia/Damascus":"Syrie","Asia/Amman":"Jordanie","Asia/Baghdad":"Irak","Asia/Tehran":"Iran","Asia/Riyadh":"Arabie saoudite","Asia/Dubai":"Émirats arabes unis","Asia/Qatar":"Qatar","Asia/Kuwait":"Koweït","Asia/Yerevan":"Arménie","Asia/Tbilisi":"Géorgie","Asia/Baku":"Azerbaïdjan","Asia/Almaty":"Kazakhstan","Asia/Qyzylorda":"Kazakhstan","Asia/Tashkent":"Ouzbékistan","Asia/Kabul":"Afghanistan","Asia/Karachi":"Pakistan","Asia/Kolkata":"Inde","Asia/Calcutta":"Inde","Asia/Dhaka":"Bangladesh","Asia/Colombo":"Sri Lanka","Asia/Kathmandu":"Népal","Asia/Shanghai":"Chine","Asia/Urumqi":"Chine","Asia/Hong_Kong":"Hong Kong","Asia/Taipei":"Taïwan","Asia/Tokyo":"Japon","Asia/Seoul":"Corée du Sud","Asia/Ho_Chi_Minh":"Vietnam","Asia/Saigon":"Vietnam","Asia/Bangkok":"Thaïlande","Asia/Phnom_Penh":"Cambodge","Asia/Kuala_Lumpur":"Malaisie","Asia/Singapore":"Singapour","Asia/Jakarta":"Indonésie","Asia/Makassar":"Indonésie","Asia/Manila":"Philippines","Australia/Sydney":"Australie","Australia/Melbourne":"Australie","Australia/Brisbane":"Australie","Australia/Perth":"Australie","Australia/Adelaide":"Australie","Pacific/Auckland":"Nouvelle-Zélande","Pacific/Noumea":"Nouvelle-Calédonie","Pacific/Tahiti":"Polynésie française","America/New_York":"États-Unis","America/Chicago":"États-Unis","America/Denver":"États-Unis","America/Los_Angeles":"États-Unis","America/Phoenix":"États-Unis","America/Anchorage":"États-Unis","Pacific/Honolulu":"États-Unis","America/Detroit":"États-Unis","America/Toronto":"Canada","America/Montreal":"Canada","America/Vancouver":"Canada","America/Edmonton":"Canada","America/Winnipeg":"Canada","America/Halifax":"Canada","America/Mexico_City":"Mexique","America/Cancun":"Mexique","America/Tijuana":"Mexique","America/Sao_Paulo":"Brésil","America/Manaus":"Brésil","America/Fortaleza":"Brésil","America/Argentina/Buenos_Aires":"Argentine","America/Buenos_Aires":"Argentine","America/Santiago":"Chili","America/Bogota":"Colombie","America/Lima":"Pérou","America/Caracas":"Venezuela","America/Port-au-Prince":"Haïti","America/Guadeloupe":"Guadeloupe","America/Martinique":"Martinique","America/Cayenne":"Guyane","America/Miquelon":"Saint-Pierre-et-Miquelon","America/Havana":"Cuba","America/Santo_Domingo":"Rép. dominicaine"};
const countryOf = (tz) => TZ_COUNTRY[String(tz || "")] || (tz ? `Autre (${String(tz).split("/")[0]})` : "Inconnu");
export function recordHit(req, { path, ref, lang, tz }) {
  const d = day();
  const ua = String(req.get("user-agent") || "");
  if (/bot|crawl|spider|preview|curl|wget|headless/i.test(ua)) return;
  const entry = pending.get(d) || { views: 0, visitors: new Set(), paths: {}, refs: {}, devices: {}, langs: {}, countries: {} };
  entry.views++;
  entry.visitors.add(crypto.createHash("sha256").update(`${SALT}${d}${req.ip}${ua}`).digest("hex").slice(0, 16));
  bump(entry.paths, String(path || "/").replace(/\/e\/[^/?#]+/, "/e/…").slice(0, 60));
  let host = "";
  try { host = ref ? new URL(ref).hostname.replace(/^www\./, "") : ""; } catch { /* source illisible */ }
  if (host && !/mafeliza\.com$|localhost/.test(host)) bump(entry.refs, host);
  bump(entry.devices, /iphone|ipad/i.test(ua) ? "iPhone / iPad" : /android/i.test(ua) ? "Android" : /mobile/i.test(ua) ? "Autre mobile" : "Ordinateur");
  bump(entry.langs, LANG_NAMES[String(lang || "").slice(0, 2)] || "Autre");
  bump(entry.countries, countryOf(tz), 120);
  pending.set(d, entry);
  timer ||= setTimeout(flush, 15_000);
}

async function flush() {
  timer = null;
  for (const [d, e] of pending) {
    pending.delete(d);
    const cur = (await getSetting(`analytics:${d}`).catch(() => null)) || { views: 0, visitors: [], paths: {}, refs: {}, devices: {}, langs: {} };
    cur.countries ||= {};
    cur.views += e.views;
    const seen = new Set(cur.visitors);
    for (const v of e.visitors) if (seen.size < 20000) seen.add(v);
    cur.visitors = [...seen];
    for (const k of ["paths", "refs", "devices", "langs", "countries"]) for (const [key, n] of Object.entries(e[k])) cur[k][key] = (cur[k][key] || 0) + n;
    await setSetting(`analytics:${d}`, cur).catch(() => {});
  }
}

// Résumé des N derniers jours pour l'administration.
export async function analyticsSummary(days = 30) {
  await flush();
  const out = [];
  const tot = { paths: {}, refs: {}, devices: {}, langs: {}, countries: {} };
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const e = (await getSetting(`analytics:${d}`).catch(() => null)) || null;
    out.push({ date: d, views: e?.views || 0, visitors: e?.visitors?.length || 0 });
    if (e) for (const k of Object.keys(tot)) for (const [key, n] of Object.entries(e[k] || {})) tot[k][key] = (tot[k][key] || 0) + n;
  }
  const top = (o, n = 10) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
  return { online: onlineNow(), days: out, pages: top(tot.paths), sources: top(tot.refs), devices: top(tot.devices), langs: top(tot.langs), countries: top(tot.countries, 30) };
}
