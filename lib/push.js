// Notifications push web (standard Web Push, clés VAPID).
// Clés VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY si définies ; sinon générées une fois et gardées en base (réglage « vapid »).
import webpush from "web-push";
import { listPushSubs, deletePushSub, getSetting, setSetting } from "./store.js";

let ready;
// Renvoie la clé publique (et configure web-push), ou "" si la base est indisponible.
export function vapidKey() {
  ready ||= (async () => {
    let keys = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
      ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
      : await getSetting("vapid");
    if (!keys?.publicKey) {
      await setSetting("vapid", webpush.generateVAPIDKeys());
      keys = await getSetting("vapid"); // relu : garde la même paire si deux instances démarrent ensemble
    }
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contact@mafeliza.com", keys.publicKey, keys.privateKey);
    return keys.publicKey;
  })().catch((err) => { ready = null; console.error("VAPID :", err.message); return ""; });
  return ready;
}

// owners : ["org:12", "gid:abc…"] ; message : { title, body, url }
export async function notify(owners, message) {
  if (!owners.length || !(await vapidKey())) return 0;
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
