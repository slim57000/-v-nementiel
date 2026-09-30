// Stockage SQLite (serveur classique / développement), fichier DATA_DIR/app.db.
// Modèle clé/valeur minimal :
//   org:{id}            organisateur (JSON)      org:email:{email}  → id
//   event:{id}          événement (JSON)         event:slug:{slug}  → id
//   org:{id}:events     ensemble des ids d'événements de l'organisateur

async function sqliteKv() {
  const { DatabaseSync } = await import("node:sqlite");
  const { mkdirSync } = await import("node:fs");
  const dir = process.env.DATA_DIR || "./data";
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(`${dir}/app.db`);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sets (key TEXT NOT NULL, member TEXT NOT NULL, PRIMARY KEY (key, member));
  `);
  const q = {
    get: db.prepare("SELECT value FROM kv WHERE key = ?"),
    set: db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
    del: db.prepare("DELETE FROM kv WHERE key = ?"),
    sadd: db.prepare("INSERT OR IGNORE INTO sets (key, member) VALUES (?, ?)"),
    srem: db.prepare("DELETE FROM sets WHERE key = ? AND member = ?"),
    smembers: db.prepare("SELECT member FROM sets WHERE key = ?"),
  };
  const get = (k) => {
    const row = q.get.get(k);
    return row ? JSON.parse(row.value) : null;
  };
  return {
    get: async (k) => get(k),
    set: async (k, v) => void q.set.run(k, JSON.stringify(v)),
    del: async (...keys) => keys.forEach((k) => q.del.run(k)),
    incr: async (k) => {
      const n = (get(k) || 0) + 1;
      q.set.run(k, JSON.stringify(n));
      return n;
    },
    sadd: async (k, v) => void q.sadd.run(k, String(v)),
    srem: async (k, v) => void q.srem.run(k, String(v)),
    smembers: async (k) => q.smembers.all(k).map((r) => r.member),
    mget: async (...keys) => keys.map(get),
  };
}

const kv = await sqliteKv();

export const now = () => new Date().toISOString();

// --- Organisateurs ---

export async function findOrganizerByEmail(email) {
  const id = await kv.get(`org:email:${email}`);
  return id ? kv.get(`org:${id}`) : null;
}

export const findOrganizer = (id) => kv.get(`org:${id}`);

export async function createOrganizer(email, loginCode) {
  const id = await kv.incr("seq:org");
  const organizer = { id, email, loginCode, createdAt: now() };
  await kv.set(`org:${id}`, organizer);
  await kv.set(`org:email:${email}`, id);
  return organizer;
}

export async function deleteOrganizer(organizer) {
  await kv.del(`org:${organizer.id}`, `org:email:${organizer.email}`, `org:${organizer.id}:events`);
}

// --- Événements ---

export async function listEvents(organizerId) {
  const ids = await kv.smembers(`org:${organizerId}:events`);
  if (!ids.length) return [];
  const events = (await kv.mget(...ids.map((id) => `event:${id}`))).filter(Boolean);
  return events.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

export const findEvent = (id) => kv.get(`event:${id}`);

export async function findEventBySlug(slug) {
  const id = await kv.get(`event:slug:${slug}`);
  return id ? kv.get(`event:${id}`) : null;
}

export async function findEventByAccessCode(code) {
  const id = await kv.get(`event:code:${code}`);
  return id ? kv.get(`event:${id}`) : null;
}

export async function findEventByCameramanCode(code) {
  const id = await kv.get(`event:cam:${code}`);
  return id ? kv.get(`event:${id}`) : null;
}

const today = () => new Date().toISOString().slice(0, 10);

// Événements publics à venir (page d'accueil / Découvrir).
export async function listPublicUpcoming(limit = 12) {
  const ids = await kv.smembers("events:public");
  if (!ids.length) return [];
  return (await kv.mget(...ids.map((id) => `event:${id}`)))
    .filter((e) => e && e.visibility === "public" && !e.suspended && e.date >= today())
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, limit);
}

// Index secondaires : code d'accès → id, et ensemble des événements publics.
async function syncIndexes(event, previous) {
  if (previous && previous.accessCode !== event.accessCode) await kv.del(`event:code:${previous.accessCode}`);
  await kv.set(`event:code:${event.accessCode}`, event.id);
  if (previous?.cameramanCode && previous.cameramanCode !== event.cameramanCode) await kv.del(`event:cam:${previous.cameramanCode}`);
  if (event.cameramanCode) await kv.set(`event:cam:${event.cameramanCode}`, event.id);
  if (event.visibility === "public") await kv.sadd("events:public", event.id);
  else await kv.srem("events:public", event.id);
}

export async function createEvent(fields) {
  const id = await kv.incr("seq:event");
  const event = { ...fields, id, createdAt: now(), updatedAt: now() };
  await kv.set(`event:${id}`, event);
  await kv.set(`event:slug:${event.slug}`, id);
  await kv.sadd(`org:${event.organizerId}:events`, id);
  await syncIndexes(event);
  return event;
}

export async function saveEvent(event) {
  const previous = await kv.get(`event:${event.id}`);
  event.updatedAt = now();
  await kv.set(`event:${event.id}`, event);
  await syncIndexes(event, previous);
  return event;
}

export async function deleteEvent(event) {
  await kv.del(`event:${event.id}`, `event:slug:${event.slug}`, `event:code:${event.accessCode}`, `event:cam:${event.cameramanCode}`);
  await kv.srem(`org:${event.organizerId}:events`, event.id);
  await kv.srem("events:public", event.id);
}

// --- Chat, réactions et photos des invités ---
//   ev:{id}:msgseq / ev:{id}:msg:{n}   messages (kind "chat" | "reaction")
//   photo:{id} / ev:{id}:photos        photos des invités

export async function addMessage(eventId, fields) {
  const id = await kv.incr(`ev:${eventId}:msgseq`);
  const message = { ...fields, id, eventId, createdAt: now() };
  await kv.set(`ev:${eventId}:msg:${id}`, message);
  return message;
}

export async function listMessages(eventId, after = 0, limit = 50) {
  const last = (await kv.get(`ev:${eventId}:msgseq`)) || 0;
  const from = Math.max(after + 1, last - limit + 1);
  if (from > last) return [];
  const keys = Array.from({ length: last - from + 1 }, (_, i) => `ev:${eventId}:msg:${from + i}`);
  return (await kv.mget(...keys)).filter(Boolean);
}

export async function addPhoto(eventId, fields) {
  const id = await kv.incr("seq:photo");
  const photo = { ...fields, id, eventId, createdAt: now() };
  await kv.set(`photo:${id}`, photo);
  await kv.sadd(`ev:${eventId}:photos`, id);
  return photo;
}

export async function listPhotos(eventId, limit = 60) {
  const ids = await kv.smembers(`ev:${eventId}:photos`);
  if (!ids.length) return [];
  return (await kv.mget(...ids.map((id) => `photo:${id}`)))
    .filter(Boolean)
    .sort((a, b) => b.id - a.id)
    .slice(0, limit);
}

export const findPhoto = (id) => kv.get(`photo:${id}`);

export async function deletePhoto(photo) {
  await kv.del(`photo:${photo.id}`);
  await kv.srem(`ev:${photo.eventId}:photos`, photo.id);
}

// --- Livre d'or : gb:{id}, ensemble ev:{id}:gb ---
export async function addGuestbookEntry(eventId, fields) {
  const id = await kv.incr("seq:gb");
  const entry = { likes: 0, pinned: false, ...fields, id, eventId, createdAt: now() };
  await kv.set(`gb:${id}`, entry);
  await kv.sadd(`ev:${eventId}:gb`, id);
  return entry;
}

export async function listGuestbook(eventId) {
  const ids = await kv.smembers(`ev:${eventId}:gb`);
  if (!ids.length) return [];
  return (await kv.mget(...ids.map((id) => `gb:${id}`))).filter(Boolean).sort((a, b) => b.id - a.id);
}

export const findGuestbookEntry = (id) => kv.get(`gb:${id}`);

export async function updateGuestbookEntry(entry, changes) {
  const updated = { ...entry, ...changes };
  await kv.set(`gb:${entry.id}`, updated);
  return updated;
}

export async function likeGuestbookEntry(entry) {
  return updateGuestbookEntry(entry, { likes: (entry.likes || 0) + 1 });
}

export async function deleteGuestbookEntry(entry) {
  await kv.del(`gb:${entry.id}`);
  await kv.srem(`ev:${entry.eventId}:gb`, entry.id);
}

export async function findEventMessage(eventId, id) { return kv.get(`ev:${eventId}:msg:${id}`); }
export async function deleteMessage(m) { await kv.del(`ev:${m.eventId}:msg:${m.id}`); }

// --- Signalements : report:{id}, ensemble « reports », ev:{id}:reports ---
export async function addReport(eventId, fields) {
  const id = await kv.incr("seq:report");
  const report = { ...fields, id, eventId, createdAt: now() };
  await kv.set(`report:${id}`, report);
  await kv.sadd("reports", id);
  await kv.sadd(`ev:${eventId}:reports`, id);
  return report;
}

export async function listReports(limit = 200) {
  const ids = await kv.smembers("reports");
  if (!ids.length) return [];
  return (await kv.mget(...ids.map((id) => `report:${id}`))).filter(Boolean).sort((a, b) => b.id - a.id).slice(0, limit);
}

export const countReports = async (eventId) => (await kv.smembers(`ev:${eventId}:reports`)).length;

export async function deleteReport(id) {
  const r = await kv.get(`report:${id}`);
  if (!r) return;
  await kv.del(`report:${id}`);
  await kv.srem("reports", id);
  await kv.srem(`ev:${r.eventId}:reports`, id);
}

// --- Administration ---
export async function saveOrganizer(organizer) {  // profil (nom, avatar) et blocage admin
  await kv.set(`org:${organizer.id}`, organizer);
  return organizer;
}

// Parcourt tous les enregistrements « prefix:1..n » (volumes modestes en SQLite).
async function all(prefix, seqKey) {
  const last = (await kv.get(seqKey)) || 0;
  const out = [];
  for (let i = 1; i <= last; i += 200) {
    const keys = Array.from({ length: Math.min(200, last - i + 1) }, (_, k) => `${prefix}:${i + k}`);
    out.push(...(await kv.mget(...keys)).filter(Boolean));
  }
  return out;
}

export async function searchEvents(q = "", limit = 50) {
  const needle = q.toLowerCase();
  return (await all("event", "seq:event"))
    .filter((e) => !needle || `${e.name} ${e.slug} ${e.location}`.toLowerCase().includes(needle))
    .sort((a, b) => b.id - a.id).slice(0, limit);
}

export async function searchOrganizers(q = "", limit = 50) {
  const needle = q.toLowerCase();
  return (await all("org", "seq:org"))
    .filter((o) => o.email && (!needle || o.email.includes(needle)))
    .sort((a, b) => b.id - a.id).slice(0, limit);
}

export const getSetting = (key) => kv.get(`setting:${key}`);
export const setSetting = (key, value) => kv.set(`setting:${key}`, value);

// --- Présence (spectateurs du live) : presence:{eventId} = { clientId: horodatage } ---
const PRESENCE_MS = 35_000;
export async function touchPresence(eventId, clientId) {
  const now = Date.now();
  const map = (await kv.get(`presence:${eventId}`)) || {};
  map[clientId] = now;
  for (const [k, t] of Object.entries(map)) if (now - t > PRESENCE_MS) delete map[k];
  await kv.set(`presence:${eventId}`, map);
  return Object.keys(map).length;
}
export async function countViewers(eventId) {
  const map = (await kv.get(`presence:${eventId}`)) || {};
  return Object.values(map).filter((t) => Date.now() - t <= PRESENCE_MS).length;
}

// --- Réseau : amis, blocages, messages privés, favoris, historique ---
//   user:{id}:friends / :blocks / :favs / :history (ensembles)
//   dm:{a}_{b}:seq et dm:{a}_{b}:{n} (a < b)
const pair = (a, b) => (Number(a) < Number(b) ? `${a}_${b}` : `${b}_${a}`);

export async function addFriends(a, b) {
  await kv.sadd(`user:${a}:friends`, b);
  await kv.sadd(`user:${b}:friends`, a);
}
export async function removeFriends(a, b) {
  await kv.srem(`user:${a}:friends`, b);
  await kv.srem(`user:${b}:friends`, a);
}
export const listFriendIds = async (id) => (await kv.smembers(`user:${id}:friends`)).map(Number);
export const addBlock = (a, b) => kv.sadd(`user:${a}:blocks`, b);
export const removeBlock = (a, b) => kv.srem(`user:${a}:blocks`, b);
export const listBlockIds = async (id) => (await kv.smembers(`user:${id}:blocks`)).map(Number);

export async function addDirectMessage(from, to, text) {
  const key = `dm:${pair(from, to)}`;
  const id = await kv.incr(`${key}:seq`);
  const m = { id, from: Number(from), to: Number(to), text, createdAt: now() };
  await kv.set(`${key}:${id}`, m);
  return m;
}
export async function listDirectMessages(a, b, after = 0, limit = 100) {
  const key = `dm:${pair(a, b)}`;
  const last = (await kv.get(`${key}:seq`)) || 0;
  const from = Math.max(after + 1, last - limit + 1);
  if (from > last) return [];
  return (await kv.mget(...Array.from({ length: last - from + 1 }, (_, i) => `${key}:${from + i}`))).filter(Boolean);
}
export async function lastDirectMessage(a, b) {
  return (await listDirectMessages(a, b, 0, 1))[0] || null;
}

export const addFavorite = (u, e) => kv.sadd(`user:${u}:favs`, e);
export const removeFavorite = (u, e) => kv.srem(`user:${u}:favs`, e);
export const listFavoriteIds = async (u) => (await kv.smembers(`user:${u}:favs`)).map(Number);
export const addHistory = (u, e) => kv.sadd(`user:${u}:history`, e);
export const listHistoryIds = async (u) => (await kv.smembers(`user:${u}:history`)).map(Number);

export async function findEventsByIds(ids) {
  if (!ids.length) return [];
  return (await kv.mget(...ids.map((id) => `event:${id}`))).filter(Boolean);
}
export async function findOrganizersByIds(ids) {
  if (!ids.length) return [];
  return (await kv.mget(...ids.map((id) => `org:${id}`))).filter(Boolean);
}

export async function listEventsOnDate(date) {
  return (await all("event", "seq:event")).filter((e) => e.date === date);
}

// --- Limites de débit partagées : limit:{clé} = { n, reset } ---
export async function bumpLimit(key, windowMs) {
  const now = Date.now();
  const cur = await kv.get(`limit:${key}`);
  const next = cur && cur.reset > now ? { n: cur.n + 1, reset: cur.reset } : { n: 1, reset: now + windowMs };
  await kv.set(`limit:${key}`, next);
  return next.n;
}
export const clearLimit = (key) => kv.del(`limit:${key}`);
