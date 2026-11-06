// Migration Supabase → VPS : copie toute la base (comptes, événements, messages, photos, livre d'or, réglages…)
// dans la base SQLite du serveur, et télécharge toutes les photos et vidéos du stockage Supabase sur le disque.
// Les identifiants sont conservés (sessions, réglages liés aux comptes). Rien n'est supprimé chez Supabase.
//
// Sur le VPS, depuis /opt/mafeliza :   sudo node --env-file=.env scripts/migrate-supabase.mjs
// Puis ajouter STORE=sqlite dans .env et redémarrer (voir le message affiché à la fin).
import { existsSync, mkdirSync, renameSync, copyFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createClient } from "@supabase/supabase-js";

const URL_ = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "evenements";
const DATA_DIR = process.env.DATA_DIR || "./data";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
if (!URL_ || !KEY) { console.error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont nécessaires (lancer avec --env-file=.env)."); process.exit(1); }
const ORIGIN = `${URL_}/storage/v1/object/public/${BUCKET}/`;
const sb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// --- Lecture complète d'une table (par pages de 1 000 lignes) ---
async function table(name, order = "id") {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(name).select("*").range(from, from + 999);
    if (order) q = q.order(order, { ascending: true });
    const { data, error } = await q;
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) { console.log(`  (table ${name} absente : ignorée)`); return rows; }
      throw new Error(`${name} : ${error.message}`);
    }
    rows.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`  ${name} : ${rows.length}`);
  return rows;
}

// --- Base SQLite de destination (même format que lib/store-sqlite.js) ---
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(UPLOAD_DIR, { recursive: true });
const dbFile = `${DATA_DIR}/app.db`;
if (existsSync(dbFile)) {
  const bak = `${dbFile}.avant-migration-${Date.now()}`;
  for (const ext of ["", "-wal", "-shm"]) if (existsSync(dbFile + ext)) renameSync(dbFile + ext, bak + ext);
  console.log(`Ancienne base SQLite mise de côté : ${bak}`);
}
const db = new DatabaseSync(dbFile);
db.exec(`PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sets (key TEXT NOT NULL, member TEXT NOT NULL, PRIMARY KEY (key, member));`);
const kv = new Map(); // écrit à la fin, après remplacement des adresses des médias
const sets = [];
const set = (k, v) => kv.set(k, v);
const sadd = (k, m) => sets.push([k, String(m)]);
const maxId = (rows) => rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);

console.log("Lecture de Supabase…");
const T = {};
for (const name of ["organizers", "events", "messages", "photos", "guestbook", "reports", "settings", "friends", "blocks", "dms", "favorites", "history", "push_subscriptions", "invites"]) {
  T[name] = await table(name, ["settings", "friends", "blocks", "favorites", "history", "push_subscriptions", "invites"].includes(name) ? null : "id");
}

// Comptes
for (const r of T.organizers) {
  set(`org:${r.id}`, { id: r.id, email: r.email, loginCode: r.login_code, blocked: Boolean(r.blocked), displayName: r.display_name || "", avatar: r.avatar_url || null, createdAt: r.created_at });
  set(`org:email:${r.email}`, r.id);
}
set("seq:org", maxId(T.organizers));

// Événements et leurs index
for (const r of T.events) {
  const e = { id: r.id, organizerId: r.organizer_id, slug: r.slug, name: r.name, type: r.type, date: r.date, time: r.time, location: r.location,
    description: r.description, cover: r.cover, visibility: r.visibility, accessCode: r.access_code, inviteStyle: r.invite_style, invite: r.invite,
    cameras: r.cameras || [], cagnotteUrl: r.cagnotte_url || "", cameramanCode: r.cameraman_code || "", cameramanNotes: r.cameraman_notes || "",
    blockedAuthors: r.blocked_authors || [], suspended: Boolean(r.suspended), createdAt: r.created_at, updatedAt: r.updated_at };
  set(`event:${e.id}`, e);
  set(`event:slug:${e.slug}`, e.id);
  if (e.accessCode) set(`event:code:${e.accessCode}`, e.id);
  if (e.cameramanCode) set(`event:cam:${e.cameramanCode}`, e.id);
  sadd(`org:${e.organizerId}:events`, e.id);
  if (e.visibility === "public") sadd("events:public", e.id);
  sadd("events:all", e.id);
}
set("seq:event", maxId(T.events));

// Chat et réactions : numérotés 1, 2, 3… par événement (format SQLite) ; correspondance gardée pour les signalements.
const msgMap = new Map();
const perEvent = new Map();
for (const r of T.messages) {
  const n = (perEvent.get(r.event_id) || 0) + 1;
  perEvent.set(r.event_id, n);
  msgMap.set(r.id, n);
  set(`ev:${r.event_id}:msg:${n}`, { id: n, eventId: r.event_id, kind: r.kind, name: r.name, text: r.text, author: r.author, createdAt: r.created_at });
}
for (const [ev, n] of perEvent) set(`ev:${ev}:msgseq`, n);

// Photos et vidéos des invités
for (const r of T.photos) {
  set(`photo:${r.id}`, { id: r.id, eventId: r.event_id, name: r.name, url: r.url, author: r.author, story: Boolean(r.story), caption: r.caption || "", createdAt: r.created_at });
  sadd(`ev:${r.event_id}:photos`, r.id);
}
set("seq:photo", maxId(T.photos));

// Livre d'or
for (const r of T.guestbook) {
  set(`gb:${r.id}`, { id: r.id, eventId: r.event_id, name: r.name, text: r.text, photoUrl: r.photo_url, audioUrl: r.audio_url, likes: r.likes || 0,
    pinned: Boolean(r.pinned), replies: r.replies || [], author: r.author, createdAt: r.created_at });
  sadd(`ev:${r.event_id}:gb`, r.id);
}
set("seq:gb", maxId(T.guestbook));

// Signalements
for (const r of T.reports) {
  const itemId = r.kind === "message" && msgMap.has(Number(r.item_id)) ? msgMap.get(Number(r.item_id)) : r.item_id;
  set(`report:${r.id}`, { id: r.id, eventId: r.event_id, kind: r.kind, itemId, reason: r.reason, author: r.author, createdAt: r.created_at });
  sadd("reports", r.id);
  sadd(`ev:${r.event_id}:reports`, r.id);
}
set("seq:report", maxId(T.reports));

// Réglages (mots de passe, dates de naissance, réels, j'aime, modération, SEO…)
for (const r of T.settings) set(`setting:${r.key}`, r.value);

// Réseau : amis, blocages, favoris, historique
for (const r of T.friends) sadd(`user:${r.user_id}:friends`, r.friend_id);
for (const r of T.blocks) sadd(`user:${r.blocker_id}:blocks`, r.blocked_id);
for (const r of T.favorites) { sadd(`user:${r.user_id}:favs`, r.event_id); sadd(`ev:${r.event_id}:followers`, r.user_id); }
for (const r of T.history) { sadd(`user:${r.user_id}:history`, r.event_id); sadd(`ev:${r.event_id}:followers`, r.user_id); }

// Messages privés : numérotés par conversation
const pair = (a, b) => (Number(a) < Number(b) ? `${a}_${b}` : `${b}_${a}`);
const dmSeq = new Map();
for (const r of T.dms) {
  const key = `dm:${pair(r.sender_id, r.recipient_id)}`;
  const n = (dmSeq.get(key) || 0) + 1;
  dmSeq.set(key, n);
  set(`${key}:${n}`, { id: n, from: Number(r.sender_id), to: Number(r.recipient_id), text: r.text, createdAt: r.created_at });
}
for (const [key, n] of dmSeq) set(`${key}:seq`, n);

// Notifications push et invitations par email
for (const r of T.push_subscriptions) { set(`push:${r.endpoint}`, { owner: r.owner, sub: r.sub }); sadd(`owner:${r.owner}:push`, r.endpoint); }
for (const r of T.invites) {
  set(`inv:${r.token}`, { eventId: r.event_id, email: r.email, token: r.token, sentAt: r.sent_at, seenAt: r.seen_at, joinedAt: r.joined_at });
  sadd(`ev:${r.event_id}:invites`, r.token);
}

// --- Photos et vidéos : téléchargées sur le disque, adresses remplacées par /uploads/… ---
const files = new Map(); // nom Supabase → nom local
const re = new RegExp(`${ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^"\\s?#]+)`, "g");
for (const v of kv.values()) for (const m of JSON.stringify(v).matchAll(re)) files.set(decodeURIComponent(m[1]), decodeURIComponent(m[1]).replace(/\//g, "__"));
console.log(`Photos et vidéos à copier : ${files.size}`);
let done = 0, fromCache = 0;
const failed = [];
const queue = [...files.entries()];
async function worker() {
  for (let item; (item = queue.shift());) {
    const [name, local] = item;
    const target = `${UPLOAD_DIR}/${local}`;
    try {
      if (!existsSync(target)) {
        const cached = `${DATA_DIR}/media-cache/${local}`; // déjà téléchargé par le cache du serveur
        if (existsSync(cached)) { copyFileSync(cached, target); fromCache++; }
        else {
          const r = await fetch(ORIGIN + name.split("/").map(encodeURIComponent).join("/"), { signal: AbortSignal.timeout(120000) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          writeFileSync(target, Buffer.from(await r.arrayBuffer()));
        }
      }
    } catch (err) { failed.push(`${name} (${err.message})`); files.delete(name); }
    if (++done % 50 === 0) console.log(`  ${done} / ${files.size + failed.length}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(`  copiés : ${done - failed.length} (dont ${fromCache} depuis le cache), échecs : ${failed.length}`);
if (failed.length) { writeFileSync(`${DATA_DIR}/migration-echecs.txt`, failed.join("\n")); console.log(`  liste des échecs : ${DATA_DIR}/migration-echecs.txt (adresses Supabase gardées)`); }

// Remplacement des adresses et écriture de la base
const rewrite = (v) => JSON.parse(JSON.stringify(v).replace(re, (all, n) => (files.has(decodeURIComponent(n)) ? `/uploads/${files.get(decodeURIComponent(n))}` : all)));
const insKv = db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
const insSet = db.prepare("INSERT OR IGNORE INTO sets (key, member) VALUES (?, ?)");
db.exec("BEGIN");
for (const [k, v] of kv) insKv.run(k, JSON.stringify(rewrite(v)));
for (const [k, m] of sets) insSet.run(k, m);
db.exec("COMMIT");
db.close();
console.log(`\n✅ Migration terminée : ${kv.size} enregistrements, ${sets.length} liens → ${dbFile}`);
console.log(`Dossiers : base ${DATA_DIR}, fichiers ${UPLOAD_DIR}. Étape suivante : ajouter STORE=sqlite dans .env puis redémarrer.`);
