// Notifications push des applications iPhone (APNs) et Android (Firebase Cloud Messaging).
// Jetons des appareils gardés en base (réglage « native:{propriétaire} »), comme les abonnements web.
// Variables Vercel :
//   iPhone  : APNS_KEY (contenu du fichier .p8), APNS_KEY_ID, APNS_TEAM_ID, APNS_TOPIC (com.mafeliza.app)
//   Android : FCM_SERVICE_ACCOUNT (contenu JSON du compte de service Firebase)
import crypto from "node:crypto";
import http2 from "node:http2";
import { getSetting, setSetting } from "./store.js";

const b64 = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
const key = (owner) => `native:${owner}`;

export async function saveNativeToken(owner, token, platform) {
  const list = ((await getSetting(key(owner)).catch(() => null)) || []).filter((t) => t.token !== token);
  list.unshift({ token, platform: platform === "ios" ? "ios" : "android" });
  await setSetting(key(owner), list.slice(0, 5));
}

async function dropToken(owner, token) {
  const list = (await getSetting(key(owner)).catch(() => null)) || [];
  await setSetting(key(owner), list.filter((t) => t.token !== token)).catch(() => {});
}

// --- iPhone : APNs (HTTP/2, jeton JWT ES256 valable 1 h) ---
let apnsJwt = { value: "", at: 0 };
function apnsToken() {
  if (Date.now() - apnsJwt.at < 50 * 60_000) return apnsJwt.value;
  const head = b64({ alg: "ES256", kid: process.env.APNS_KEY_ID });
  const body = b64({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) });
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key: process.env.APNS_KEY.replace(/\\n/g, "\n"), dsaEncoding: "ieee-p1363" });
  apnsJwt = { value: `${head}.${body}.${sig.toString("base64url")}`, at: Date.now() };
  return apnsJwt.value;
}

function sendApns(token, { title, body, url }) {
  const host = process.env.APNS_SANDBOX ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  return new Promise((resolve) => {
    const client = http2.connect(host);
    client.on("error", () => resolve(0));
    const req = client.request({
      ":method": "POST", ":path": `/3/device/${token}`,
      authorization: `bearer ${apnsToken()}`, "apns-topic": process.env.APNS_TOPIC || "com.mafeliza.app", "apns-push-type": "alert",
    });
    let status = 0;
    req.on("response", (h) => { status = h[":status"]; });
    req.on("end", () => { client.close(); resolve(status); });
    req.on("error", () => { client.close(); resolve(0); });
    req.end(JSON.stringify({ aps: { alert: { title, body }, sound: "default" }, url }));
  });
}

// --- Android : FCM v1 (jeton OAuth obtenu avec le compte de service) ---
let fcmAuth = { value: "", at: 0 };
async function fcmToken(sa) {
  if (Date.now() - fcmAuth.at < 50 * 60_000) return fcmAuth.value;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const assertion = `${unsigned}.${crypto.sign("sha256", Buffer.from(unsigned), sa.private_key).toString("base64url")}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  fcmAuth = { value: (await res.json()).access_token || "", at: Date.now() };
  return fcmAuth.value;
}

async function sendFcm(token, { title, body, url }) {
  const sa = JSON.parse(process.env.FCM_SERVICE_ACCOUNT);
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST", headers: { Authorization: `Bearer ${await fcmToken(sa)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { token, notification: { title, body }, data: { url: url || "/" } } }),
  });
  return res.status;
}

// Envoi à tous les appareils des propriétaires (« org:{id} »). Jetons périmés supprimés.
export async function notifyNative(owners, message) {
  const ios = Boolean(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);
  const android = Boolean(process.env.FCM_SERVICE_ACCOUNT);
  if (!ios && !android) return 0;
  let sent = 0;
  await Promise.all(owners.map(async (owner) => {
    for (const t of (await getSetting(key(owner)).catch(() => null)) || []) {
      try {
        const status = t.platform === "ios" ? (ios ? await sendApns(t.token, message) : 0) : (android ? await sendFcm(t.token, message) : 0);
        if (status === 200) sent++;
        else if (status === 410 || status === 404 || status === 400) await dropToken(owner, t.token);
      } catch (err) { console.error("Push natif :", err.message); }
    }
  }));
  return sent;
}
