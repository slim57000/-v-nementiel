// Récupération du replay d'un événement : retrouve dans le dossier des fichiers les vidéos envoyées pendant le
// direct mais absentes du replay (et de toute autre donnée du site), puis les rattache au replay.
//
// Sur le VPS, depuis /opt/mafeliza :
//   sudo node --env-file=.env scripts/recover-replay.mjs SLUG          → liste ce qui peut être récupéré
//   sudo node --env-file=.env scripts/recover-replay.mjs SLUG --fix    → rattache ces vidéos au replay
import { readdirSync, statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const [slug, fix] = [process.argv[2], process.argv.includes("--fix")];
if (!slug) { console.error("Usage : node --env-file=.env scripts/recover-replay.mjs SLUG [--fix]"); process.exit(1); }
if (process.env.STORE !== "sqlite") { console.error("Ce script fonctionne avec la base du VPS (STORE=sqlite)."); process.exit(1); }
const { findEventBySlug, getSetting, setSetting } = await import("../lib/store.js");
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const db = new DatabaseSync(`${process.env.DATA_DIR || "./data"}/app.db`, { readOnly: true });

const ev = await findEventBySlug(slug);
if (!ev) { console.error(`Événement introuvable : ${slug}`); process.exit(1); }
const list = (await getSetting(`replay:${ev.id}`)) || [];
// Caméra du dernier morceau enregistré, sinon la première caméra « téléphone » de l'événement.
const room = list.at(-1)?.room || (ev.cameras || []).map((c) => c.url).find((u) => u?.startsWith("lk:"))?.slice(3);
if (!room) { console.error("Aucune caméra « téléphone » sur cet événement."); process.exit(1); }
console.log(`« ${ev.name} » (${ev.date}) : ${list.length} morceau(x) dans le replay, caméra ${room}`);

// Vidéos déposées entre la veille et le surlendemain de l'événement, référencées nulle part.
const from = new Date(`${ev.date}T00:00:00`).getTime() - 864e5, to = from + 3 * 864e5;
const used = (name) => db.prepare("SELECT 1 FROM kv WHERE value LIKE ? LIMIT 1").get(`%${name}%`);
const found = readdirSync(UPLOAD_DIR)
  .filter((f) => /\.(mp4|webm|mov)$/i.test(f) && !f.startsWith("reel-"))
  .map((f) => ({ f, st: statSync(`${UPLOAD_DIR}/${f}`) }))
  .filter(({ st }) => st.mtimeMs >= from && st.mtimeMs <= to && st.size > 200_000)
  .filter(({ f }) => !used(f))
  .sort((a, b) => a.st.mtimeMs - b.st.mtimeMs);

if (!found.length) { console.log("Aucune vidéo orpheline trouvée pour cette date : les morceaux n'ont pas atteint le serveur."); process.exit(0); }
for (const { f, st } of found) console.log(`  ${new Date(st.mtimeMs).toLocaleString("fr-FR")}  ${(st.size / 1e6).toFixed(1)} Mo  ${f}`);
if (!fix) { console.log(`\n${found.length} vidéo(s) récupérable(s). Relancez avec --fix pour les ajouter au replay.`); process.exit(0); }
const all = [...list, ...found.map(({ f, st }) => ({ room, url: `/uploads/${f}`, at: Math.round(st.mtimeMs) }))].sort((a, b) => a.at - b.at);
await setSetting(`replay:${ev.id}`, all);
console.log(`\n✅ ${found.length} vidéo(s) ajoutée(s) : le replay compte maintenant ${all.length} morceau(x).`);
