// Stockage Supabase (Postgres). Schéma : supabase/schema.sql.
import { supabase, unwrap } from "./supabase.js";

// Conversion ligne SQL (snake_case) ↔ objet applicatif (camelCase).
const toOrganizer = (r) => r && { id: r.id, email: r.email, loginCode: r.login_code, blocked: Boolean(r.blocked), displayName: r.display_name || "", avatar: r.avatar_url || null, createdAt: r.created_at };

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
  cameramanCode: r.cameraman_code || "",
  cameramanNotes: r.cameraman_notes || "",
  blockedAuthors: r.blocked_authors || [],
  suspended: Boolean(r.suspended),
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
  cameraman_code: e.cameramanCode || null,
  cameraman_notes: e.cameramanNotes || "",
  blocked_authors: e.blockedAuthors || [],
  suspended: Boolean(e.suspended),
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

export const findEventByCameramanCode = async (code) =>
  toEvent(unwrap(await events().select().eq("cameraman_code", code).limit(1).maybeSingle()));

// Événements publics à venir (page d'accueil / Découvrir).
// Événements privés à venir (les événements démo publics, nombreux, ne doivent pas les évincer).
export const listAllUpcoming = async (limit = 12) =>
  unwrap(await events().select().eq("suspended", false).neq("visibility", "public")
    .gte("date", new Date().toISOString().slice(0, 10))
    .order("date").order("time").limit(limit)).map(toEvent);

export const listPublicUpcoming = async (limit = 12) =>
  unwrap(await events().select().eq("visibility", "public").eq("suspended", false)
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
const toMessage = (r) => ({ id: r.id, eventId: r.event_id, kind: r.kind, name: r.name, text: r.text, author: r.author, createdAt: r.created_at });
const toPhoto = (r) => r && ({ id: r.id, eventId: r.event_id, name: r.name, url: r.url, author: r.author, story: Boolean(r.story), caption: r.caption || "", createdAt: r.created_at });

export const addMessage = async (eventId, { kind, name, text, author }) =>
  toMessage(unwrap(await supabase.from("messages").insert({ event_id: eventId, kind, name, text, author }).select().single()));

export const findMessage = async (id) => {
  const r = unwrap(await supabase.from("messages").select().eq("id", id).maybeSingle());
  return r && toMessage(r);
};

export const deleteMessage = async (m) => void unwrap(await supabase.from("messages").delete().eq("id", m.id));

export async function listMessages(eventId, after = 0, limit = 50) {
  const rows = unwrap(await supabase.from("messages").select().eq("event_id", eventId)
    .gt("id", after).order("id", { ascending: false }).limit(limit));
  return rows.reverse().map(toMessage);
}

export const addPhoto = async (eventId, { name, url, author, story = false, caption = "" }) =>
  toPhoto(unwrap(await supabase.from("photos").insert({ event_id: eventId, name, url, author, ...(story && { story, caption }) }).select().single()));

export const listPhotos = async (eventId, limit = 60) =>
  unwrap(await supabase.from("photos").select().eq("event_id", eventId)
    .order("id", { ascending: false }).limit(limit)).map(toPhoto);

export const findPhoto = async (id) =>
  toPhoto(unwrap(await supabase.from("photos").select().eq("id", id).maybeSingle()));

export const deletePhoto = async (photo) => void unwrap(await supabase.from("photos").delete().eq("id", photo.id));

// --- Livre d'or ---
const toEntry = (r) => r && ({
  id: r.id, eventId: r.event_id, name: r.name, text: r.text, photoUrl: r.photo_url,
  audioUrl: r.audio_url, likes: r.likes, pinned: r.pinned, replies: r.replies || [], author: r.author, createdAt: r.created_at,
});
const guestbook = () => supabase.from("guestbook");

export const addGuestbookEntry = async (eventId, { name, text, photoUrl, audioUrl, author }) =>
  toEntry(unwrap(await guestbook().insert({ event_id: eventId, name, text, photo_url: photoUrl, audio_url: audioUrl, author }).select().single()));

export const listGuestbook = async (eventId) =>
  unwrap(await guestbook().select().eq("event_id", eventId).order("id", { ascending: false }).limit(500)).map(toEntry);

export const findGuestbookEntry = async (id) =>
  toEntry(unwrap(await guestbook().select().eq("id", id).maybeSingle()));

export const updateGuestbookEntry = async (entry, { pinned, replies }) =>
  toEntry(unwrap(await guestbook().update({ ...(pinned !== undefined && { pinned }), ...(replies && { replies }) }).eq("id", entry.id).select().single()));

// Incrément atomique côté base (fonction SQL guestbook_like).
export const likeGuestbookEntry = async (entry) =>
  toEntry(unwrap(await supabase.rpc("guestbook_like", { entry_id: entry.id })));

export const deleteGuestbookEntry = async (entry) => void unwrap(await guestbook().delete().eq("id", entry.id));

// --- Signalements ---
const toReport = (r) => ({ id: r.id, eventId: r.event_id, kind: r.kind, itemId: r.item_id, reason: r.reason, author: r.author, createdAt: r.created_at });

export const addReport = async (eventId, { kind, itemId, reason, author }) =>
  toReport(unwrap(await supabase.from("reports").insert({ event_id: eventId, kind, item_id: itemId, reason, author }).select().single()));

export const listReports = async (limit = 200) =>
  unwrap(await supabase.from("reports").select().order("id", { ascending: false }).limit(limit)).map(toReport);

export const countReports = async (eventId) => {
  const { count, error } = await supabase.from("reports").select("id", { count: "exact", head: true }).eq("event_id", eventId);
  if (error) throw new Error(`Base de données : ${error.message}`);
  return count || 0;
};

export const deleteReport = async (id) => void unwrap(await supabase.from("reports").delete().eq("id", id));
export const findEventMessage = async (eventId, id) => {
  const m = await findMessage(id);
  return m?.eventId === eventId ? m : null;
};

// --- Administration ---
export const saveOrganizer = async (o) =>
  toOrganizer(unwrap(await organizers().update({
    blocked: Boolean(o.blocked), display_name: o.displayName || "", avatar_url: o.avatar || null,
  }).eq("id", o.id).select().single()));

// Échappe les caractères spéciaux d'un motif ILIKE / d'un filtre « or ».
const like = (q) => `%${q.replace(/[%_,().\\]/g, " ").trim()}%`;

export async function searchEvents(q = "", limit = 50) {
  let query = events().select().order("id", { ascending: false }).limit(limit);
  if (q.trim()) query = query.or(`name.ilike.${like(q)},slug.ilike.${like(q)},location.ilike.${like(q)}`);
  return unwrap(await query).map(toEvent);
}

export async function searchOrganizers(q = "", limit = 50) {
  let query = organizers().select().order("id", { ascending: false }).limit(limit);
  if (q.trim()) query = query.ilike("email", like(q));
  return unwrap(await query).map(toOrganizer);
}

export const getSetting = async (key) =>
  unwrap(await supabase.from("settings").select("value").eq("key", key).maybeSingle())?.value ?? null;

export const setSetting = async (key, value) =>
  void unwrap(await supabase.from("settings").upsert({ key, value }));

// --- Présence (spectateurs du live) ---
export async function countViewers(eventId) {
  const since = new Date(Date.now() - 35_000).toISOString();
  const { count, error } = await supabase.from("presence").select("client_id", { count: "exact", head: true })
    .eq("event_id", eventId).gte("seen_at", since);
  if (error) throw new Error(`Base de données : ${error.message}`);
  return count || 0;
}
export async function touchPresence(eventId, clientId) {
  unwrap(await supabase.from("presence").upsert({ event_id: eventId, client_id: clientId, seen_at: new Date().toISOString() }));
  return countViewers(eventId);
}

// --- Réseau : amis, blocages, messages privés, favoris, historique ---
export async function addFriends(a, b) {
  unwrap(await supabase.from("friends").upsert([{ user_id: a, friend_id: b }, { user_id: b, friend_id: a }]));
}
export async function removeFriends(a, b) {
  unwrap(await supabase.from("friends").delete().or(`and(user_id.eq.${a},friend_id.eq.${b}),and(user_id.eq.${b},friend_id.eq.${a})`));
}
export const listFriendIds = async (id) =>
  unwrap(await supabase.from("friends").select("friend_id").eq("user_id", id)).map((r) => Number(r.friend_id));
export const addBlock = async (a, b) => void unwrap(await supabase.from("blocks").upsert({ blocker_id: a, blocked_id: b }));
export const removeBlock = async (a, b) => void unwrap(await supabase.from("blocks").delete().eq("blocker_id", a).eq("blocked_id", b));
export const listBlockIds = async (id) =>
  unwrap(await supabase.from("blocks").select("blocked_id").eq("blocker_id", id)).map((r) => Number(r.blocked_id));

const toDm = (r) => ({ id: r.id, from: Number(r.sender_id), to: Number(r.recipient_id), text: r.text, createdAt: r.created_at });
export const addDirectMessage = async (from, to, text) =>
  toDm(unwrap(await supabase.from("dms").insert({ sender_id: from, recipient_id: to, text }).select().single()));
export async function listDirectMessages(a, b, after = 0, limit = 100) {
  const rows = unwrap(await supabase.from("dms").select()
    .or(`and(sender_id.eq.${a},recipient_id.eq.${b}),and(sender_id.eq.${b},recipient_id.eq.${a})`)
    .gt("id", after).order("id", { ascending: false }).limit(limit));
  return rows.reverse().map(toDm);
}
export const deleteDirectMessage = async (from, to, id) =>
  unwrap(await supabase.from("dms").delete().eq("id", Number(id)).eq("sender_id", from).eq("recipient_id", to).select()).length > 0;
export const lastDirectMessage = async (a, b) => (await listDirectMessages(a, b, 0, 1))[0] || null;

export const addFavorite = async (u, e) => void unwrap(await supabase.from("favorites").upsert({ user_id: u, event_id: e }));
export const removeFavorite = async (u, e) => void unwrap(await supabase.from("favorites").delete().eq("user_id", u).eq("event_id", e));
export const listFavoriteIds = async (u) =>
  unwrap(await supabase.from("favorites").select("event_id").eq("user_id", u)).map((r) => Number(r.event_id));
export const addHistory = async (u, e) =>
  void unwrap(await supabase.from("history").upsert({ user_id: u, event_id: e, visited_at: new Date().toISOString() }));
export const listHistoryIds = async (u) =>
  unwrap(await supabase.from("history").select("event_id").eq("user_id", u).order("visited_at", { ascending: false }).limit(100)).map((r) => Number(r.event_id));

export const findEventsByIds = async (ids) =>
  ids.length ? unwrap(await events().select().in("id", ids)).map(toEvent) : [];
export const findOrganizersByIds = async (ids) =>
  ids.length ? unwrap(await organizers().select().in("id", ids)).map(toOrganizer) : [];

export const listEventsOnDate = async (date) => unwrap(await events().select().eq("date", date)).map(toEvent);

// --- Limites de débit partagées entre toutes les instances (fonction SQL bump_limit) ---
export const bumpLimit = async (key, windowMs) =>
  unwrap(await supabase.rpc("bump_limit", { k: key, window_ms: windowMs }));
export const clearLimit = async (key) => void unwrap(await supabase.from("rate_limits").delete().eq("key", key));

// Fil d'actualité : dernières photos et entrées du livre d'or de plusieurs événements en 2 requêtes.
export const listRecentPhotos = async (eventIds, limit = 120) => (eventIds.length
  ? unwrap(await supabase.from("photos").select().in("event_id", eventIds).order("id", { ascending: false }).limit(limit)).map(toPhoto) : []);
export const listRecentGuestbook = async (eventIds, limit = 120) => (eventIds.length
  ? unwrap(await guestbook().select().in("event_id", eventIds).order("id", { ascending: false }).limit(limit)).map(toEntry) : []);

// Personnes qui suivent un événement (favori ou participation) : pour les notifications.
export async function listFollowerIds(eventId) {
  const [f, h] = await Promise.all([
    supabase.from("favorites").select("user_id").eq("event_id", eventId),
    supabase.from("history").select("user_id").eq("event_id", eventId),
  ]);
  return [...new Set([...unwrap(f), ...unwrap(h)].map((r) => r.user_id))];
}

// --- Abonnements aux notifications push ---
export const savePushSub = async (owner, sub) =>
  void unwrap(await supabase.from("push_subscriptions").upsert({ endpoint: sub.endpoint, owner, sub }));
export const listPushSubs = async (owners) => (owners.length
  ? unwrap(await supabase.from("push_subscriptions").select("sub").in("owner", owners)).map((r) => r.sub) : []);
export const deletePushSub = async (endpoint) => void unwrap(await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint));

// --- Invitations par email ---
const toInvite = (r) => r && ({ eventId: r.event_id, email: r.email, token: r.token, sentAt: r.sent_at, seenAt: r.seen_at, joinedAt: r.joined_at });
export const addInvite = async (eventId, email, token) =>
  toInvite(unwrap(await supabase.from("invites").insert({ event_id: eventId, email, token }).select().single()));
export const findInvite = async (token) => toInvite(unwrap(await supabase.from("invites").select().eq("token", token).maybeSingle()));
export const saveInvite = async (i) => void unwrap(await supabase.from("invites").update({ seen_at: i.seenAt, joined_at: i.joinedAt }).eq("token", i.token));
export const listInvites = async (eventId) =>
  unwrap(await supabase.from("invites").select().eq("event_id", eventId).order("sent_at")).map(toInvite);
