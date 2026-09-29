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
