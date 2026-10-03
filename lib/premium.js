// Offre premium (attribuée par l'administration) et statistiques d'événement (stockées dans les réglages).
import { getSetting, setSetting } from "./store.js";

// Premium : true (sans limite) ou { until } (date de fin en ms) ; expiré = plus premium.
const active = (v) => v === true || (v && typeof v === "object" && v.until > Date.now());
export const premiumUntil = async (organizerId) => {
  const v = await getSetting(`premium:${organizerId}`).catch(() => false);
  return active(v) && typeof v === "object" ? v.until : null;
};
export const isPremium = async (organizerId) => active(await getSetting(`premium:${organizerId}`).catch(() => false));
export const setPremium = (organizerId, on, days = 0) =>
  setSetting(`premium:${organizerId}`, on ? (days > 0 ? { until: Date.now() + days * 86400000 } : true) : false);
// Replay : 15 jours (gratuit), 30 jours (premium).
export const replayDays = (premium) => (premium ? 30 : 15);

export const getStats = async (eventId) => (await getSetting(`stats:${eventId}`).catch(() => null)) || { views: 0, peak: 0 };
export async function bumpViews(eventId) {
  const s = await getStats(eventId);
  await setSetting(`stats:${eventId}`, { ...s, views: (s.views || 0) + 1 }).catch(() => {});
}
// Pic de spectateurs du live (écrit seulement quand il est dépassé ; cache par instance).
const peaks = new Map();
export async function recordPeak(eventId, viewers) {
  if (viewers <= (peaks.get(eventId) || 0)) return;
  const s = await getStats(eventId);
  peaks.set(eventId, Math.max(viewers, s.peak || 0));
  if (viewers > (s.peak || 0)) await setSetting(`stats:${eventId}`, { ...s, peak: viewers }).catch(() => {});
}
