// Stockage des données, choisi automatiquement :
//   - Upstash Redis (ex-Vercel KV) si ses variables sont présentes (Vercel) ;
//   - sinon SQLite dans DATA_DIR (Render, VPS, local) — prévoir un disque persistant.
// Les deux exposent la même mini-interface clé/valeur ci-dessous.
// Clés :
//   org:{id}            organisateur (JSON)      org:email:{email}  → id
//   event:{id}          événement (JSON)         event:slug:{slug}  → id
//   org:{id}:events     ensemble des ids d'événements de l'organisateur

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function redisKv() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url, token });
}

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

const kv = url && token ? await redisKv() : await sqliteKv();

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

export async function createEvent(fields) {
  const id = await kv.incr("seq:event");
  const event = { ...fields, id, createdAt: now(), updatedAt: now() };
  await kv.set(`event:${id}`, event);
  await kv.set(`event:slug:${event.slug}`, id);
  await kv.sadd(`org:${event.organizerId}:events`, id);
  return event;
}

export async function saveEvent(event) {
  event.updatedAt = now();
  await kv.set(`event:${event.id}`, event);
  return event;
}

export async function deleteEvent(event) {
  await kv.del(`event:${event.id}`, `event:slug:${event.slug}`);
  await kv.srem(`org:${event.organizerId}:events`, event.id);
}
