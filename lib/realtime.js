// Temps réel (Supabase Realtime, canaux « broadcast ») : le serveur envoie un simple signal sans contenu,
// le navigateur abonné recharge aussitôt via l'API habituelle (les droits d'accès restent vérifiés).
// Actif si SUPABASE_ANON_KEY est défini (clé publique « anon » de Supabase) ; sinon les pages interrogent régulièrement.
import { SUPABASE_URL, SUPABASE_KEY, USE_SUPABASE } from "./config.js";

const ANON = process.env.SUPABASE_ANON_KEY || "";
export const REALTIME = USE_SUPABASE && ANON ? { url: SUPABASE_URL, key: ANON } : null;

export async function ping(topic) {
  if (!REALTIME) return;
  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic, event: "ping", payload: {} }] }),
      signal: AbortSignal.timeout(1500),
    });
  } catch { /* le rafraîchissement régulier prend le relais */ }
}
export const eventTopic = (slug) => `ev-${slug}`;
export const dmTopic = (a, b) => `dm-${Math.min(a, b)}-${Math.max(a, b)}`;
