// Stockage Supabase (Postgres). Schéma : supabase/schema.sql.
import { supabase, unwrap } from "./supabase.js";

// Conversion ligne SQL (snake_case) ↔ objet applicatif (camelCase).
const toOrganizer = (r) => r && { id: r.id, email: r.email, loginCode: r.login_code, createdAt: r.created_at };

const toEvent = (r) => r && {
  id: r.id,
  organizerId: r.organizer_id,
  slug: r.slug,
  name: r.name,
  type: r.type,
  date: r.date,
  time: r.time,
  location: r.location,
  description: r.description,
  cover: r.cover,
  visibility: r.visibility,
  accessCode: r.access_code,
  inviteStyle: r.invite_style,
  invite: r.invite,
  cameras: r.cameras || [],
  cagnotteUrl: r.cagnotte_url || "",
  createdAt: r.created_at,
  updatedAt: r.updated_at,
};

const eventRow = (e) => ({
  organizer_id: e.organizerId,
  slug: e.slug,
  name: e.name,
  type: e.type,
  date: e.date,
  time: e.time,
  location: e.location,
  description: e.description,
  cover: e.cover,
  visibility: e.visibility,
  access_code: e.accessCode,
  invite_style: e.inviteStyle,
  invite: e.invite,
  cameras: e.cameras || [],
  cagnotte_url: e.cagnotteUrl || null,
});

const organizers = () => supabase.from("organizers");
const events = () => supabase.from("events");

export const findOrganizerByEmail = async (email) =>
  toOrganizer(unwrap(await organizers().select().eq("email", email).maybeSingle()));

export const findOrganizer = async (id) =>
  toOrganizer(unwrap(await organizers().select().eq("id", id).maybeSingle()));

export const createOrganizer = async (email, loginCode) =>
  toOrganizer(unwrap(await organizers().insert({ email, login_code: loginCode }).select().single()));

// Les événements et leurs contenus sont supprimés en cascade par la base.
export const deleteOrganizer = async (organizer) => void unwrap(await organizers().delete().eq("id", organizer.id));

export const listEvents = async (organizerId) =>
  unwrap(await events().select().eq("organizer_id", organizerId).order("date").order("time")).map(toEvent);

export const findEvent = async (id) =>
  toEvent(unwrap(await events().select().eq("id", id).maybeSingle()));

export const findEventBySlug = async (slug) =>
  toEvent(unwrap(await events().select().eq("slug", slug).maybeSingle()));

export const findEventByAccessCode = async (code) =>
  toEvent(unwrap(await events().select().eq("access_code", code).limit(1).maybeSingle()));

// Événements publics à venir (page d'accueil / Découvrir).
export const listPublicUpcoming = async (limit = 12) =>
  unwrap(await events().select().eq("visibility", "public")
    .gte("date", new Date().toISOString().slice(0, 10))
    .order("date").order("time").limit(limit)).map(toEvent);

export const createEvent = async (fields) =>
  toEvent(unwrap(await events().insert(eventRow(fields)).select().single()));

export const saveEvent = async (event) =>
  toEvent(unwrap(await events()
    .update({ ...eventRow(event), updated_at: new Date().toISOString() })
    .eq("id", event.id).select().single()));

export const deleteEvent = async (event) => void unwrap(await events().delete().eq("id", event.id));

// --- Chat, réactions et photos des invités ---
const toMessage = (r) => ({ id: r.id, eventId: r.event_id, kind: r.kind, name: r.name, text: r.text, createdAt: r.created_at });
const toPhoto = (r) => r && ({ id: r.id, eventId: r.event_id, name: r.name, url: r.url, createdAt: r.created_at });

export const addMessage = async (eventId, { kind, name, text }) =>
  toMessage(unwrap(await supabase.from("messages").insert({ event_id: eventId, kind, name, text }).select().single()));

export async function listMessages(eventId, after = 0, limit = 50) {
  const rows = unwrap(await supabase.from("messages").select().eq("event_id", eventId)
    .gt("id", after).order("id", { ascending: false }).limit(limit));
  return rows.reverse().map(toMessage);
}

export const addPhoto = async (eventId, { name, url }) =>
  toPhoto(unwrap(await supabase.from("photos").insert({ event_id: eventId, name, url }).select().single()));

export const listPhotos = async (eventId, limit = 60) =>
  unwrap(await supabase.from("photos").select().eq("event_id", eventId)
    .order("id", { ascending: false }).limit(limit)).map(toPhoto);

export const findPhoto = async (id) =>
  toPhoto(unwrap(await supabase.from("photos").select().eq("id", id).maybeSingle()));

export const deletePhoto = async (photo) => void unwrap(await supabase.from("photos").delete().eq("id", photo.id));

// --- Livre d'or ---
const toEntry = (r) => r && ({
  id: r.id, eventId: r.event_id, name: r.name, text: r.text, photoUrl: r.photo_url,
  audioUrl: r.audio_url, likes: r.likes, pinned: r.pinned, createdAt: r.created_at,
});
const guestbook = () => supabase.from("guestbook");

export const addGuestbookEntry = async (eventId, { name, text, photoUrl, audioUrl }) =>
  toEntry(unwrap(await guestbook().insert({ event_id: eventId, name, text, photo_url: photoUrl, audio_url: audioUrl }).select().single()));

export const listGuestbook = async (eventId) =>
  unwrap(await guestbook().select().eq("event_id", eventId).order("id", { ascending: false }).limit(500)).map(toEntry);

export const findGuestbookEntry = async (id) =>
  toEntry(unwrap(await guestbook().select().eq("id", id).maybeSingle()));

export const updateGuestbookEntry = async (entry, { pinned }) =>
  toEntry(unwrap(await guestbook().update({ pinned }).eq("id", entry.id).select().single()));

// Incrément atomique côté base (fonction SQL guestbook_like).
export const likeGuestbookEntry = async (entry) =>
  toEntry(unwrap(await supabase.rpc("guestbook_like", { entry_id: entry.id })));

export const deleteGuestbookEntry = async (entry) => void unwrap(await guestbook().delete().eq("id", entry.id));
