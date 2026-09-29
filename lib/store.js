// Stockage des données : Upstash Redis (ex-Vercel KV) en production, mémoire en local.
// Clés :
//   org:{id}            organisateur (JSON)      org:email:{email}  → id
//   event:{id}          événement (JSON)         event:slug:{slug}  → id
//   org:{id}:events     ensemble des ids d'événements de l'organisateur
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

function memoryKv() {
  console.warn("⚠ Aucune base Redis configurée : données en mémoire, perdues au redémarrage.");
  const data = new Map();
  const set = (k) => (data.has(k) ? data.get(k) : data.set(k, new Set()).get(k));
  return {
    get: async (k) => (data.has(k) ? structuredClone(data.get(k)) : null),
    set: async (k, v) => void data.set(k, structuredClone(v)),
    del: async (...keys) => keys.forEach((k) => data.delete(k)),
    incr: async (k) => { data.set(k, (data.get(k) || 0) + 1); return data.get(k); },
    sadd: async (k, v) => void set(k).add(String(v)),
    srem: async (k, v) => void set(k).delete(String(v)),
    smembers: async (k) => [...set(k)],
    mget: async (...keys) => keys.map((k) => (data.has(k) ? structuredClone(data.get(k)) : null)),
  };
}

const kv = url && token ? new Redis({ url, token }) : memoryKv();

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
