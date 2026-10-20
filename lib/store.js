// Choix du stockage : Supabase si configuré (Vercel, production), sinon SQLite local (Render, dev).
import { USE_SUPABASE, ON_VERCEL } from "./config.js";

// Sur Vercel sans Supabase, aucun stockage : server.js bloque les requêtes et affiche la variable manquante.
const store = USE_SUPABASE
  ? await import("./store-supabase.js")
  : ON_VERCEL ? null : await import("./store-sqlite.js");

export const {
  findOrganizerByEmail, findOrganizer, createOrganizer, deleteOrganizer, saveOrganizer,
  searchEvents, searchOrganizers, getSetting: rawGetSetting, setSetting: rawSetSetting, listEventsOnDate, touchPresence, countViewers,
  addFriends, removeFriends, listFriendIds, addBlock, removeBlock, listBlockIds,
  addDirectMessage, listDirectMessages, lastDirectMessage, deleteDirectMessage,
  addFavorite, removeFavorite, listFavoriteIds, addHistory, listHistoryIds, findEventsByIds, findOrganizersByIds,
  listEvents, findEvent, findEventBySlug, findEventByAccessCode, findEventByCameramanCode, listPublicUpcoming: listAllPublicUpcoming, listAllUpcoming,
  createEvent, saveEvent, deleteEvent,
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
  const r = await rawSetSetting(key, value);
  hot.delete(key);
  return r;
}

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
