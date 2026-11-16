// Diagnostic (lecture seule) : photos d'un événement et limites anti-abus atteintes.
// Sur le VPS, depuis /opt/mafeliza :  sudo node --env-file=.env scripts/photo-stats.mjs SLUG
import { DatabaseSync } from "node:sqlite";
const slug = process.argv[2];
if (!slug) { console.error("Usage : node --env-file=.env scripts/photo-stats.mjs SLUG"); process.exit(1); }
const db = new DatabaseSync(`${process.env.DATA_DIR || "./data"}/app.db`, { readOnly: true });
const get = (k) => { const r = db.prepare("SELECT value FROM kv WHERE key = ?").get(k); return r ? JSON.parse(r.value) : null; };
const id = get(`event:slug:${slug}`);
const ev = id && get(`event:${id}`);
if (!ev) { console.error("Événement introuvable :", slug); process.exit(1); }
const photos = db.prepare("SELECT value FROM kv WHERE key LIKE 'photo:%'").all().map((r) => JSON.parse(r.value)).filter((p) => p.eventId === Number(id));
const by = {};
for (const p of photos) { const k = p.story ? "(stories)" : p.author?.startsWith("cam-") ? "📸 caméraman" : "invités"; by[k] = (by[k] || 0) + 1; }
console.log(`« ${ev.name} » : ${photos.length} photo(s) enregistrée(s)`, by);
const hours = {};
for (const p of photos) { const h = String(p.createdAt || "").slice(0, 13); hours[h] = (hours[h] || 0) + 1; }
console.log("Par heure :", hours);
const now = Date.now();
const lim = db.prepare("SELECT key, value FROM kv WHERE key LIKE 'limit:%photo%'").all().map((r) => ({ key: r.key, ...JSON.parse(r.value) }));
// Limites atteintes ou presque (ancienne version : 20 photos/h par connexion pour les invités, 120/h pour le caméraman).
const big = lim.filter((l) => l.key.includes(`camphoto:${id}`) || l.n >= 15);
console.log(big.length ? "Compteurs anti-abus élevés (dernière heure enregistrée) :" : "Aucun compteur anti-abus élevé.");
for (const l of big) console.log(`  ${l.key.replace(/^limit:/, "").replace(/^[\d.:a-f]+:photo$/, "invités d'une même connexion (Wi-Fi) : photo")} → ${l.n}${l.reset > now ? "" : " (expiré)"}`);
