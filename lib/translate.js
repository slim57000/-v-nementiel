import fs from "node:fs";
import path from "node:path";
// Traduction automatique des noms d'événements (« Léa et Olivier » → « Léa and Olivier », « लिया और ओलिवियर »…)
// dans la langue du visiteur. Un texte pas encore traduit est renvoyé tel quel puis traduit en fond.
const cache = new Map(); // `${langue}|${texte}` → traduction
const SKIP = new Set(["Événement privé", "Événement sur invitation", "MaFeliza"]); // déjà traduits par le dictionnaire du site
const GTX = { zh: "zh-CN" };
const FIELDS = ["title", "kicker", "text", "description", "city"]; // city : ville seule des cartes (« Dublin » → « 都柏林 »), jamais l'adresse complète
// Vrai texte (lettres), pas une URL, pas un simple emoji, taille raisonnable.
const worth = (v) => v.length > 1 && v.length < 2000 && /\p{L}{2}/u.test(v) && !/^(https?:|\/|data:)/.test(v) && !SKIP.has(v);

// Cache gardé sur disque (DATA_DIR/translations.json) : une traduction n'est demandée qu'une fois, même après redémarrage.
const FILE = path.join(process.env.DATA_DIR || "./data", "translations.json");
try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(FILE, "utf8")))) cache.set(k, v); } catch { /* premier lancement */ }
let saveTimer = null;
const save = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const done = Object.fromEntries([...cache].filter(([, v]) => typeof v === "string").slice(-30000));
    fs.promises.writeFile(FILE, JSON.stringify(done)).catch(() => {});
  }, 2000);
};

// File d'attente par langue : les textes sont envoyés par lots (une requête pour ~40 textes),
// et tout s'arrête 2 min si Google limite (429) — rien n'est mis en cache en cas d'échec.
const queue = new Map(); // langue → Map(texte → [resolve…])
let pausedUntil = 0, flushing = false;
async function callGtx(texts, lang) {
  const body = new URLSearchParams({ q: texts.join("\n") });
  const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${GTX[lang] || lang}&dt=t`, { method: "POST", body, signal: AbortSignal.timeout(8000) });
  if (r.status === 429 || r.status === 403) { pausedUntil = Date.now() + 120000; throw new Error("limité"); }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const out = ((await r.json())?.[0] || []).map((x) => x[0]).join("").split("\n").map((x) => x.trim());
  if (out.length !== texts.length) throw new Error("découpage");
  return out;
}
async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    while (queue.size && Date.now() >= pausedUntil) {
      const [lang, items] = queue.entries().next().value;
      const batch = [];
      let size = 0;
      for (const t of items.keys()) { if (batch.length >= 40 || size + t.length > 4000) break; batch.push(t); size += t.length + 1; }
      let res;
      try { res = await callGtx(batch, lang); }
      catch {
        if (Date.now() < pausedUntil) break; // limité : on réessaiera plus tard
        res = []; // lot refusé (découpage) : un par un
        for (const t of batch) res.push(await callGtx([t], lang).then((x) => x[0]).catch(() => null));
      }
      batch.forEach((t, i) => {
        const v = res[i];
        const waiters = items.get(t) || [];
        items.delete(t);
        if (v) { cache.set(`${lang}|${t}`, v); waiters.forEach((w) => w(v)); } else { cache.delete(`${lang}|${t}`); waiters.forEach((w) => w(t)); }
      });
      if (!items.size) queue.delete(lang);
      save();
      await new Promise((r) => setTimeout(r, 250));
    }
  } finally {
    flushing = false;
    if (queue.size) setTimeout(flush, Math.max(1000, pausedUntil - Date.now()));
  }
}
function fetchTr(text, lang) {
  const key = `${lang}|${text}`;
  const hit = cache.get(key);
  if (typeof hit === "string") return Promise.resolve(hit);
  return new Promise((resolve) => {
    if (!queue.has(lang)) queue.set(lang, new Map());
    const items = queue.get(lang);
    if (!items.has(text)) items.set(text, []);
    items.get(text).push(resolve);
    setTimeout(flush, 30); // regroupe les demandes arrivées en même temps
  });
}

export const reqLangFull = (req) => /(?:^|;\s*)em-lang=([a-z]{2})/.exec(req?.headers?.cookie || "")?.[1] || "fr";

// Remplace `name` des événements (objets avec date + nom) dans une réponse JSON ; attend au plus `wait` ms.
export async function translateNames(data, lang, wait = 1500) {
  if (!lang || !data || typeof data !== "object") return data; // aussi en français : un faire-part écrit en anglais est traduit
  data = JSON.parse(JSON.stringify(data)); // copie : ne jamais toucher aux objets en cache
  const found = [];
  const walk = (o, depth) => {
    if (!o || typeof o !== "object" || depth > 4) return;
    if (Array.isArray(o)) return o.forEach((x) => walk(x, depth + 1));
    // `name` : seulement pour un événement (un prénom ne se traduit pas). Les autres textes saisis
    // (faire-part, description, programme, livre d'or) sont traduits partout où ils apparaissent.
    if (typeof o.name === "string" && o.date && o.name.trim() && !SKIP.has(o.name) && o.name.length < 200) found.push([o, "name"]);
    for (const k of FIELDS) if (typeof o[k] === "string" && worth(o[k])) found.push([o, k]);
    for (const v of Object.values(o)) if (v && typeof v === "object") walk(v, depth + 1);
  };
  walk(data, 0);
  if (!found.length) return data;
  const timer = new Promise((r) => setTimeout(r, wait));
  await Promise.race([Promise.all(found.map(([o, k]) => fetchTr(o[k], lang))), timer]);
  for (const [o, k] of found) { const v = cache.get(`${lang}|${o[k]}`); if (typeof v === "string") o[k] = v; }
  return data;
}

// Middleware : traduit les noms d'événements dans les réponses JSON des GET.
export function translateMiddleware(req, res, next) {
  const lang = reqLangFull(req);
  // Messages privés et notifications : jamais retouchés (les notifications ont leur propre traduction).
  if (req.method !== "GET" || /\/(dm|notifications|friends|blocks)\b/.test(req.path)) return next();
  const json = res.json.bind(res);
  res.json = (body) => { translateNames(body, lang).then((b) => json(b), () => json(body)); return res; };
  next();
}

// Email (HTML) traduit morceau par morceau : seuls les textes entre les balises sont traduits, liens et codes intacts.
// Au plus `wait` ms : au-delà (Google lent ou limité), l'email part dans sa version anglaise.
export async function translateHtml(html, lang, wait = 8000) {
  const parts = String(html).split(/(<[^>]+>)/);
  const jobs = parts.map((p, i) => (p.startsWith("<") || !worth(p.trim()) ? null : fetchTr(p.trim(), lang).then((v) => { parts[i] = p.replace(p.trim(), v); })));
  const done = Promise.all(jobs.filter(Boolean)).then(() => true);
  return (await Promise.race([done, new Promise((r) => setTimeout(() => r(false), wait))])) ? parts.join("") : null;
}

// Liste de textes traduits (route /api/public/translate) ; au-delà de `wait` ms, les textes non traduits restent tels quels.
export async function translateTexts(texts, lang, wait = 6000) {
  const out = texts.map((t) => (worth(String(t).trim()) ? null : t));
  const jobs = texts.map((t, i) => (out[i] !== null ? null : fetchTr(String(t).trim(), lang).then((v) => { out[i] = v; })));
  await Promise.race([Promise.all(jobs.filter(Boolean)), new Promise((r) => setTimeout(r, wait))]);
  return out.map((v, i) => v ?? texts[i]);
}
