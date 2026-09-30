// Live en un clic via LiveKit Cloud (offre gratuite) : le téléphone du caméraman publie sa caméra dans une « room »,
// les invités la regardent dans le lecteur /lk. Actif si LIVEKIT_URL, LIVEKIT_API_KEY et LIVEKIT_API_SECRET sont définis.
import { createHmac, randomBytes } from "node:crypto";
import { getSetting, setSetting } from "./store.js";

const URL_ = process.env.LIVEKIT_URL || ""; // ex. wss://mafeliza-xxxx.livekit.cloud
const KEY = process.env.LIVEKIT_API_KEY;
const SECRET = process.env.LIVEKIT_API_SECRET;
export const LIVEKIT_ENABLED = Boolean(URL_ && KEY && SECRET);
export const LIVEKIT_URL = URL_;

const b64 = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

// Jeton d'accès LiveKit (JWT HS256) : publication pour le caméraman, lecture seule pour les invités.
export function lkToken({ room, identity, name, publish = false, ttl = 6 * 3600 }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: KEY, sub: identity, name, nbf: now - 10, exp: now + ttl,
    video: { room, roomJoin: true, canPublish: publish, canSubscribe: !publish, canPublishData: false },
  };
  const data = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}`;
  return `${data}.${createHmac("sha256", SECRET).update(data).digest("base64url")}`;
}

// Caméra « téléphone » : stockée dans le live sous la forme « lk:<room> ».
export const LK_PREFIX = "lk:";
export const newRoom = (event) => `ev${event.id}-${randomBytes(4).toString("hex")}`;
export const isLkRoom = (event, room) => (event.cameras || []).some((c) => c.url === LK_PREFIX + room);

// Direct en cours : horodatage rafraîchi au démarrage et à chaque segment de replay (≈ 4 min).
const LIVE_MS = 7 * 60 * 1000;
export const markLive = (room, on) => setSetting(`lkalive:${room}`, on ? Date.now() : 0);
export const isLive = async (room) => Date.now() - ((await getSetting(`lkalive:${room}`)) || 0) < LIVE_MS;
