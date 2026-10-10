// Notifications push web (standard Web Push, clés VAPID).
// Clés VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY si définies ; sinon générées une fois et gardées en base (réglage « vapid »).
import webpush from "web-push";
import { listPushSubs, deletePushSub, getSetting, setSetting } from "./store.js";
import { notifyNative } from "./native-push.js";
import { translateNotif } from "../public/js/notif-i18n.js";

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

// owners : ["org:12", "gid:abc…"] ; message : { title, body, url } (en français).
// La cloche garde le français (traduit à l'affichage) ; le téléphone reçoit la langue de chaque personne.
export async function notify(owners, message) {
  owners = [...new Set(owners)].filter(Boolean);
  await Promise.all(owners.filter((o) => o.startsWith("org:")).map((o) => remember(o.slice(4), message)));
  const langs = await Promise.all(owners.map((o) => (o.startsWith("org:") ? getSetting(`lang:${o.slice(4)}`).catch(() => null) : null)));
  const en = owners.filter((_, i) => langs[i] === "en"), fr = owners.filter((_, i) => langs[i] !== "en");
  const enMsg = { ...message, title: translateNotif(message.title, "en"), body: translateNotif(message.body, "en") };
  return (fr.length ? await deliver(fr, message) : 0) + (en.length ? await deliver(en, enMsg) : 0);
}
async function deliver(owners, message) {
  // Applications iPhone / Android (si les clés APNs / Firebase sont configurées).
  const native = await notifyNative(owners, message).catch(() => 0);
  if (!owners.length || !(await vapidKey())) return native;
  const subs = await listPushSubs(owners).catch(() => []);
  const payload = JSON.stringify({ icon: "/img/icon-192.png", ...message });
  let sent = 0;
  await Promise.all(subs.map(async (sub) => {
    try { await webpush.sendNotification(sub, payload, { TTL: 86400 }); sent++; }
    catch (err) { if (err.statusCode === 404 || err.statusCode === 410) await deletePushSub(sub.endpoint).catch(() => {}); }
  }));
  return sent + native;
}
export const orgOwner = (id) => `org:${id}`;

// Retire une notification (envoyée par l'administration) de la cloche de chaque compte.
export async function forget(ids, nid) {
  await Promise.all(ids.map(async (id) => {
    const list = (await getSetting(`notifs:${id}`).catch(() => null)) || [];
    if (list.some((n) => n.nid === nid)) await setSetting(`notifs:${id}`, list.filter((n) => n.nid !== nid)).catch(() => {});
  }));
}

// Cloche du site : 30 dernières notifications par compte (réglage « notifs:{id} »), même sans push.
async function remember(id, { title, body, url, nid }) {
  try {
    const list = (await getSetting(`notifs:${id}`)) || [];
    list.unshift({ at: Date.now(), title: String(title || "").slice(0, 120), body: String(body || "").slice(0, 200), url: String(url || ""), ...(nid ? { nid } : {}) });
    await setSetting(`notifs:${id}`, list.slice(0, 30));
  } catch { /* la notification reste envoyée en push */ }
}
