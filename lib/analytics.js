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

export function recordHit(req, { path, ref, lang }) {
  const d = day();
  const ua = String(req.get("user-agent") || "");
  if (/bot|crawl|spider|preview|curl|wget|headless/i.test(ua)) return;
  const entry = pending.get(d) || { views: 0, visitors: new Set(), paths: {}, refs: {}, devices: {}, langs: {} };
  entry.views++;
  entry.visitors.add(crypto.createHash("sha256").update(`${SALT}${d}${req.ip}${ua}`).digest("hex").slice(0, 16));
  bump(entry.paths, String(path || "/").replace(/\/e\/[^/?#]+/, "/e/…").slice(0, 60));
  let host = "";
  try { host = ref ? new URL(ref).hostname.replace(/^www\./, "") : ""; } catch { /* source illisible */ }
  if (host && !/mafeliza\.com$|localhost/.test(host)) bump(entry.refs, host);
  bump(entry.devices, /iphone|ipad/i.test(ua) ? "iPhone / iPad" : /android/i.test(ua) ? "Android" : /mobile/i.test(ua) ? "Autre mobile" : "Ordinateur");
  bump(entry.langs, lang === "en" ? "Anglais" : "Français");
  pending.set(d, entry);
  timer ||= setTimeout(flush, 15_000);
}

async function flush() {
  timer = null;
  for (const [d, e] of pending) {
    pending.delete(d);
    const cur = (await getSetting(`analytics:${d}`).catch(() => null)) || { views: 0, visitors: [], paths: {}, refs: {}, devices: {}, langs: {} };
    cur.views += e.views;
    const seen = new Set(cur.visitors);
    for (const v of e.visitors) if (seen.size < 20000) seen.add(v);
    cur.visitors = [...seen];
    for (const k of ["paths", "refs", "devices", "langs"]) for (const [key, n] of Object.entries(e[k])) cur[k][key] = (cur[k][key] || 0) + n;
    await setSetting(`analytics:${d}`, cur).catch(() => {});
  }
}

// Résumé des N derniers jours pour l'administration.
export async function analyticsSummary(days = 30) {
  await flush();
  const out = [];
  const tot = { paths: {}, refs: {}, devices: {}, langs: {} };
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const e = (await getSetting(`analytics:${d}`).catch(() => null)) || null;
    out.push({ date: d, views: e?.views || 0, visitors: e?.visitors?.length || 0 });
    if (e) for (const k of Object.keys(tot)) for (const [key, n] of Object.entries(e[k] || {})) tot[k][key] = (tot[k][key] || 0) + n;
  }
  const top = (o, n = 10) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
  return { online: onlineNow(), days: out, pages: top(tot.paths), sources: top(tot.refs), devices: top(tot.devices), langs: top(tot.langs) };
}
