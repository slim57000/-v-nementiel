// Choix du stockage : Supabase si configuré (Vercel, production), sinon SQLite local (Render, dev).
import { USE_SUPABASE, ON_VERCEL } from "./config.js";

// Sur Vercel sans Supabase, aucun stockage : server.js bloque les requêtes et affiche la variable manquante.
const store = USE_SUPABASE
  ? await import("./store-supabase.js")
  : ON_VERCEL ? null : await import("./store-sqlite.js");

export const {
  findOrganizerByEmail, findOrganizer, createOrganizer,
  listEvents, findEvent, findEventBySlug, findEventByAccessCode, listPublicUpcoming,
  createEvent, saveEvent, deleteEvent,
  addMessage, listMessages, addPhoto, listPhotos, findPhoto, deletePhoto,
} = store ?? {};
