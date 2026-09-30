// Live « en un clic » depuis le téléphone du caméraman : Cloudflare Stream (WebRTC / WHIP).
// Actif si CLOUDFLARE_ACCOUNT_ID et CLOUDFLARE_STREAM_TOKEN sont définis. Chaque caméra = une « live input » :
// l'adresse d'envoi (WHIP) reste côté serveur et n'est donnée qu'au caméraman ; les invités lisent le lecteur public,
// qui enregistre automatiquement le direct pour le replay.
import { getSetting, setSetting } from "./store.js";

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_STREAM_TOKEN;
const API = process.env.CLOUDFLARE_API_BASE || "https://api.cloudflare.com/client/v4"; // modifiable pour les tests
export const STREAM_ENABLED = Boolean(ACCOUNT && TOKEN);

async function createLiveInput(name) {
  const res = await fetch(`${API}/accounts/${ACCOUNT}/stream/live_inputs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ meta: { name }, recording: { mode: "automatic", timeoutSeconds: 60 } }),
  });
  const data = await res.json();
  if (!res.ok || !data.result) throw new Error("Service vidéo indisponible, réessayez dans un instant.");
  const r = data.result;
  const host = new URL(r.webRTCPlayback?.url || r.webRTC.url).host; // customer-xxxx.cloudflarestream.com
  return { uid: r.uid, whip: r.webRTC.url, player: `https://${host}/${r.uid}/iframe` };
}

// Caméra « téléphone » d'un événement : réutilisée si elle existe déjà sous ce nom.
export async function phoneCamera(event, name) {
  const key = `stream:${event.id}`;
  const list = (await getSetting(key).catch(() => null)) || [];
  let cam = list.find((c) => c.name === name);
  if (!cam) {
    cam = { name, ...(await createLiveInput(`${event.name} — ${name}`)) };
    await setSetting(key, [...list, cam]);
  }
  return cam;
}
