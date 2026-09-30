// Notifications push web (standard Web Push, clés VAPID).
// Actives si VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY sont définis ; sinon les envois sont ignorés.
import webpush from "web-push";
import { listPushSubs, deletePushSub } from "./store.js";

export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
export const PUSH_ENABLED = Boolean(VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (PUSH_ENABLED) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contact@evermoments.app", VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

// owners : ["org:12", "gid:abc…"] ; message : { title, body, url }
export async function notify(owners, message) {
  if (!PUSH_ENABLED || !owners.length) return 0;
  const subs = await listPushSubs([...new Set(owners)]).catch(() => []);
  const payload = JSON.stringify({ icon: "/img/icon-192.png", ...message });
  let sent = 0;
  await Promise.all(subs.map(async (sub) => {
    try { await webpush.sendNotification(sub, payload, { TTL: 86400 }); sent++; }
    catch (err) { if (err.statusCode === 404 || err.statusCode === 410) await deletePushSub(sub.endpoint).catch(() => {}); }
  }));
  return sent;
}
export const orgOwner = (id) => `org:${id}`;
