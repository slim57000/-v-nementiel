// Choix du stockage : Supabase si configuré (Vercel, production), sinon SQLite local (Render, dev).
import { USE_SUPABASE, ON_VERCEL } from "./config.js";

// Sur Vercel sans Supabase, aucun stockage : server.js bloque les requêtes et affiche la variable manquante.
const store = USE_SUPABASE
  ? await import("./store-supabase.js")
  : ON_VERCEL ? null : await import("./store-sqlite.js");

export const {
  findOrganizerByEmail, findOrganizer: rawFindOrganizer, createOrganizer, deleteOrganizer: rawDeleteOrganizer, saveOrganizer: rawSaveOrganizer,
  searchEvents, searchOrganizers, getSetting: rawGetSetting, setSetting: rawSetSetting, listEventsOnDate, touchPresence, countViewers,
  addFriends, removeFriends, listFriendIds, addBlock, removeBlock, listBlockIds,
  addDirectMessage, listDirectMessages, lastDirectMessage, deleteDirectMessage,
  addFavorite, removeFavorite, listFavoriteIds, addHistory, listHistoryIds, findEventsByIds, findOrganizersByIds,
  listEvents, findEvent: rawFindEvent, findEventBySlug: rawFindEventBySlug, findEventByAccessCode, findEventByCameramanCode, listPublicUpcoming: listAllPublicUpcoming, listAllUpcoming,
  createEvent: rawCreateEvent, saveEvent: rawSaveEvent, deleteEvent: rawDeleteEvent,
  addMessage, listMessages, findEventMessage, deleteMessage, addReport, listReports, countReports, deleteReport, addPhoto, listPhotos, findPhoto, deletePhoto,
  bumpLimit, clearLimit, addInvite, findInvite, saveInvite, listInvites, listFollowerIds, savePushSub, listPushSubs, deletePushSub, listRecentPhotos, listRecentGuestbook,
  addGuestbookEntry, listGuestbook, findGuestbookEntry, updateGuestbookEntry, likeGuestbookEntry, deleteGuestbookEntry,
} = store ?? {};

// Réglages lus à chaque page (listes d'événements masqués, en attente, en vitrine…) : gardés 10 s en mémoire
// pour éviter un aller-retour vers la base à chaque requête. Toute écriture met le cache à jour.
const HOT = new Set(["unlisted", "pending", "showcase", "moderation", "seo", "defaultLivePlatform"]);
const hot = new Map();
export async function getSetting(key) {
  if (!HOT.has(key)) return rawGetSetting(key);
  const c = hot.get(key);
  if (c && Date.now() - c.at < 10_000) return structuredClone(c.value);
  const value = await rawGetSetting(key);
  hot.set(key, { at: Date.now(), value });
  return structuredClone(value);
}
export async function setSetting(key, value) {
  hot.delete(key);
  if (HOT.has(key)) dataVersion++;
  const r = await rawSetSetting(key, value);
  hot.delete(key);
  return r;
}

// Événements consultés : gardés 15 s en mémoire (une page d'événement = plusieurs appels au même événement).
// Toute modification ou suppression vide le cache.
const evCache = new Map();
const cachedIn = async (map, key, load) => {
  const c = map.get(key);
  if (c && Date.now() - c.at < 15_000) return c.value && structuredClone(c.value);
  const value = await load();
  if (map.size > 1000) map.clear();
  map.set(key, { at: Date.now(), value });
  return value && structuredClone(value);
};
const cached = async (key, load) => {
  const c = evCache.get(key);
  if (c && Date.now() - c.at < 15_000) return c.value && structuredClone(c.value);
  const value = await load();
  if (evCache.size > 500) evCache.clear();
  evCache.set(key, { at: Date.now(), value });
  return value && structuredClone(value);
};
export const findEvent = (id) => cached(`id:${id}`, () => rawFindEvent(id));
export const findEventBySlug = (slug) => cached(`slug:${slug}`, () => rawFindEventBySlug(slug));
// Comptes : gardés 15 s (chaque appel du site identifie la personne connectée). Vidé à chaque modification.
const orgCache = new Map();
export const findOrganizer = (id) => cachedIn(orgCache, String(id), () => rawFindOrganizer(id));
export async function saveOrganizer(...args) { orgCache.clear(); const r = await rawSaveOrganizer(...args); orgCache.clear(); return r; }
export async function deleteOrganizer(...args) { orgCache.clear(); const r = await rawDeleteOrganizer(...args); orgCache.clear(); return r; }

// Numéro qui change à chaque création / modification d'événement ou réglage de visibilité : les listes en cache
// (accueil, Découvrir) se recalculent dès qu'il bouge.
export let dataVersion = 0;
export async function createEvent(event) { const r = await rawCreateEvent(event); dataVersion++; return r; }
export async function saveEvent(event) { dataVersion++; evCache.clear(); const r = await rawSaveEvent(event); evCache.clear(); dataVersion++; return r; }
export async function deleteEvent(...args) { dataVersion++; evCache.clear(); const r = await rawDeleteEvent(...args); evCache.clear(); dataVersion++; return r; }

// Événements « non répertoriés » : publics par lien, mais absents de Découvrir, de la recherche et du plan du site.
export const listUnlistedIds = async () => new Set((await getSetting("unlisted").catch(() => null)) || []);
export async function setUnlisted(id, on) {
  const ids = await listUnlistedIds();
  if (on === ids.has(id)) return;
  if (on) ids.add(id); else ids.delete(id);
  await setSetting("unlisted", [...ids]);
}
// Validation des événements (Admin → Réglages) : « auto » (par défaut) ou « manual ».
// En manuel, un nouvel événement reste hors de Découvrir, de la recherche et de Google jusqu'à sa validation ;
// son lien fonctionne normalement pour les invités.
export const moderationMode = async () => ((await getSetting("moderation").catch(() => null)) === "manual" ? "manual" : "auto");
export const listPendingIds = async () => new Set((await getSetting("pending").catch(() => null)) || []);
export async function setPending(id, on) {
  const ids = await listPendingIds();
  if (on === ids.has(id)) return;
  if (on) ids.add(id); else ids.delete(id);
  await setSetting("pending", [...ids]);
}
export async function listPublicUpcoming(limit) {
  const [unlisted, pending] = await Promise.all([listUnlistedIds(), listPendingIds()]);
  const hidden = new Set([...unlisted, ...pending]);
  return (await listAllPublicUpcoming(limit + Math.min(hidden.size, 50))).filter((e) => !hidden.has(e.id)).slice(0, limit);
}
// Événements privés ou non répertoriés que l'organisateur a choisi d'afficher dans Découvrir (cadenas, code requis).
export const listShowcaseIds = async () => new Set((await getSetting("showcase").catch(() => null)) || []);
export async function setShowcase(id, on) {
  const ids = await listShowcaseIds();
  if (on === ids.has(id)) return;
  if (on) ids.add(id); else ids.delete(id);
  await setSetting("showcase", [...ids]);
}
// Visibilité affichée : « unlisted » pour un événement public non répertorié.
export const withVisibility = (event, hidden) => (event && event.visibility === "public" && hidden.has(event.id) ? { ...event, visibility: "unlisted" } : event);
