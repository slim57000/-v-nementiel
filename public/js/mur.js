// 📺 Mur photo en direct : à afficher sur une TV ou un vidéoprojecteur pendant la fête.
// Les photos et vidéos des invités défilent (les nouvelles passent en premier), avec un QR code pour envoyer les siennes.
import { api, $, esc, qrUrl, goLogin, isVideo } from "./common.js";
import { t as tr } from "./i18n.js";

const id = new URLSearchParams(location.search).get("id");
const SHOW_MS = 7000; // durée d'une photo à l'écran
let ev, items = [], seen = new Set(), queue = [], i = -1, timer = null;

function show(item) {
  const el = document.createElement("div");
  el.className = "wall-slide";
  el.innerHTML = (isVideo(item.url)
    ? `<video src="${esc(item.url)}" autoplay muted playsinline></video>`
    : `<img src="${esc(item.url)}" alt="">`) + (item.name ? `<span class="wall-who">${esc(item.name)}</span>` : "");
  $("#stage").append(el);
  requestAnimationFrame(() => el.classList.add("on"));
  setTimeout(() => [...$("#stage").children].slice(0, -1).forEach((c) => c.remove()), 1200);
  clearTimeout(timer);
  const v = el.querySelector("video");
  // Vidéo : jusqu'à la fin (30 s max) ; photo : 7 s.
  if (v) { v.onended = next; timer = setTimeout(next, 30000); } else timer = setTimeout(next, SHOW_MS);
}
function next() {
  if (!items.length) return;
  const item = queue.length ? queue.shift() : items[(i = (i + 1) % items.length)];
  show(item);
}

async function refresh() {
  let list;
  try { list = await api(`/api/public/${encodeURIComponent(ev.slug)}/photos?limit=200`); } catch { return; }
  const fresh = list.filter((p) => !seen.has(p.id));
  fresh.forEach((p) => seen.add(p.id));
  items = list;
  $("#w-count").textContent = list.length ? `${list.length} ${tr(list.length > 1 ? "photos et vidéos" : "photo")}` : "";
  $("#empty").classList.toggle("hidden", list.length > 0);
  if (!fresh.length) return;
  if (timer === null) return next(); // premier chargement
  // Nouvelles photos : affichées tout de suite, avec le nom de l'invité.
  queue.push(...fresh.reverse());
  const who = fresh.at(-1)?.name;
  $("#new").textContent = `📸 ${tr("Nouvelle photo")}${who ? ` · ${who}` : ""}`;
  $("#new").classList.remove("hidden");
  setTimeout(() => $("#new").classList.add("hidden"), 5000);
  clearTimeout(timer); next();
}

try {
  ev = await api(`/api/events/${encodeURIComponent(id)}`);
} catch (err) {
  if (err.status === 401) goLogin(); else document.body.innerHTML = `<p style="color:#fff;padding:20px">${esc(err.message)}</p>`;
  throw err;
}
document.title = `${tr("Mur photo")} — ${ev.name}`;
$("#w-name").textContent = ev.name;
// Lien du QR code : la page de l'événement (avec le code pour un événement privé : les invités sont dans la salle).
const link = `${location.origin}/e/${encodeURIComponent(ev.slug)}${ev.visibility === "private" ? `?code=${encodeURIComponent(ev.accessCode)}` : ""}#photos`;
$("#w-qr").src = qrUrl(link);
await refresh();
setInterval(refresh, 8000);
// Écran toujours allumé + plein écran au toucher.
try { await navigator.wakeLock?.request("screen"); } catch { /* non disponible */ }
$("#full").onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
