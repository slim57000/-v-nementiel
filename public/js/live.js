import { api, $, esc, shareSheet, toast, guestName, viewPhoto, pickAndUploadPhoto, contentMenu, isHidden, isVideo, liveState } from "./common.js";
import { icon } from "./icons.js";

const slug = new URLSearchParams(location.search).get("e") || "";

// Transforme un lien YouTube / Twitch en adresse de lecteur intégrable (null si non reconnu).
export function embedUrl(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id = null;
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com") {
    id = u.searchParams.get("v") || u.pathname.match(/^\/(?:live|embed|shorts)\/([\w-]+)/)?.[1];
  }
  if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1&playsinline=1`;
  if (host === "twitch.tv") {
    const channel = u.pathname.split("/")[1];
    if (channel) return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${location.hostname}&muted=true`;
  }
  return null;
}

// Aperçu d'une caméra : miniature YouTube ou image du direct Twitch.
export function thumbnailUrl(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const id = host === "youtu.be" ? u.pathname.slice(1)
    : host === "youtube.com" ? u.searchParams.get("v") || u.pathname.match(/^\/(?:live|embed|shorts)\/([\w-]+)/)?.[1] : null;
  if (id) return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`;
  if (host === "twitch.tv" && u.pathname.split("/")[1]) {
    return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${encodeURIComponent(u.pathname.split("/")[1].toLowerCase())}-320x180.jpg`;
  }
  return null;
}

let cameras = [];
let isOwner = false;
const base = `/api/public/${encodeURIComponent(slug)}`;

function play(index) {
  const src = embedUrl(cameras[index]?.url);
  $("#stage iframe")?.remove();
  $("#empty").classList.toggle("hidden", Boolean(src));
  if (src) {
    $("#stage").insertAdjacentHTML("afterbegin",
      `<iframe src="${esc(src)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Direct"></iframe>`);
  }
  document.querySelectorAll(".cam").forEach((b, i) => b.classList.toggle("active", i === index));
}

async function load() {
  // Lien d'invitation au live d'un événement privé : « /live?e=slug&code=XXXX ».
  const code = new URLSearchParams(location.search).get("code");
  if (code) {
    await api(`/api/public/${encodeURIComponent(slug)}/unlock`, { method: "POST", body: { code } }).catch(() => {});
    history.replaceState(null, "", `/live?e=${encodeURIComponent(slug)}`);
  }
  let ev;
  try {
    ev = await api(`/api/public/${encodeURIComponent(slug)}`);
  } catch (err) {
    $("#title").textContent = err.message;
    return;
  }
  // Événement privé non déverrouillé : on passe par l'écran du code.
  if (ev.locked) return location.replace(`/e/${encodeURIComponent(slug)}`);

  document.title = `Live — ${ev.name}`;
  $("#title").textContent = ev.name;
  $("#close").href = `/e/${encodeURIComponent(slug)}`;
  $("#share").onclick = () => shareSheet({ title: ev.name, text: `📺 Suivez « ${ev.name} » en direct !`, url: location.href });

  if (ev.cagnotteUrl) {
    for (const el of [$("#pot"), $("#pot-btn")]) {
      el.href = ev.cagnotteUrl;
      el.classList.remove("hidden");
    }
  } else {
    $("#reactions").style.gridTemplateColumns = "repeat(5, 1fr)";
    $("#nav-pot").remove();
    document.querySelector(".live-tabs").style.gridTemplateColumns = "repeat(4, 1fr)";
  }

  isOwner = ev.isOwner;
  cameras = ev.cameras;
  // Après l'événement : replay pendant 15 jours, puis plus de lecteur.
  const state = liveState(ev);
  if (state !== "live") {
    $(".live-badge").textContent = "REPLAY";
    $(".live-badge").classList.add("is-replay");
  }
  if (state === "expired") {
    cameras = [];
    $("#empty").innerHTML = '<span style="font-size:2rem">🎞️</span>Le replay n\'est plus disponible.<br><small>Merci d\'avoir partagé ce moment !</small>';
  }
  $("#cams").innerHTML = cameras.map((c, i) => {
    const thumb = thumbnailUrl(c.url);
    return `<button class="cam ${thumb ? "has-thumb" : ""}" data-index="${i}" ${thumb ? `style="background-image:url('${esc(thumb)}')"` : ""}>${esc(c.name)}</button>`;
  }).join("");
  // Fond du lecteur avant le direct : couverture de l'événement, sinon visuel de salle.
  $("#stage").style.backgroundImage = `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.55)), url("${ev.cover || "/img/maquette/salle.jpg"}")`;
  $("#cams-section").classList.toggle("hidden", cameras.length < 2);
  play(0);
  heartbeat();
  poll();
  loadPhotos();
  setInterval(loadPhotos, 20000);
}

$("#cams").addEventListener("click", (e) => {
  const btn = e.target.closest(".cam");
  if (btn) play(Number(btn.dataset.index));
});

// --- Spectateurs : signal de présence toutes les 15 s ---
let clientId;
try { clientId = sessionStorage.getItem("em-cid"); } catch { /* ignoré */ }
if (!clientId) {
  clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { sessionStorage.setItem("em-cid", clientId); } catch { /* ignoré */ }
}
const formatCount = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",").replace(",0", "")}K` : String(n));

async function heartbeat() {
  if (!document.hidden) {
    try {
      const { viewers } = await api(`${base}/presence`, { method: "POST", body: { clientId } });
      $("#viewers").innerHTML = `${icon("eye", 16)} ${formatCount(viewers)}`;
      $("#viewers").classList.remove("hidden");
    } catch { /* réseau : on réessaie */ }
  }
  setTimeout(heartbeat, 15000);
}

// --- Chat et réactions : interrogation du serveur toutes les 3 s ---
let lastId = 0;
let firstLoad = true;
const mine = new Set(); // ids de nos propres envois (déjà affichés / animés)

function floatEmoji(emoji) {
  const el = document.createElement("span");
  el.textContent = emoji;
  el.style.setProperty("--dx", `${Math.round(Math.random() * 40 - 20)}px`);
  $("#floaters").append(el);
  setTimeout(() => el.remove(), 2500);
}

const shown = new Set(); // messages déjà affichés (évite les doublons envoi / interrogation)

const messages = new Map(); // id → message (pour le menu ⋯)

function addChat(m) {
  if (shown.has(m.id) || isHidden(m.author)) return;
  shown.add(m.id);
  messages.set(m.id, m);
  const list = $("#chat-list");
  list.querySelector(".chat-empty")?.remove();
  list.insertAdjacentHTML("beforeend",
    `<div class="chat-msg" data-id="${m.id}"><i>${esc(m.name.charAt(0).toUpperCase())}</i><div><b>${esc(m.name)}</b>${esc(m.text)}</div><button class="more-btn" data-more aria-label="Plus d'actions">⋯</button></div>`);
  while (list.children.length > 50) list.firstElementChild.remove();
  list.scrollTop = list.scrollHeight;
}

function handle(items) {
  for (const m of items) {
    lastId = Math.max(lastId, m.id);
    if (mine.has(m.id)) continue;
    if (m.kind === "chat") addChat(m);
    else if (!firstLoad && !isHidden(m.author)) floatEmoji(m.text);
  }
  firstLoad = false;
}

async function poll() {
  if (!document.hidden) {
    try { handle(await api(`${base}/feed?after=${lastId}`)); } catch { /* réseau : on réessaie */ }
  }
  setTimeout(poll, 3000);
}

$("#reactions").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-emoji]");
  if (!btn) return;
  floatEmoji(btn.dataset.emoji);
  let name = "Invité";
  try { name = localStorage.getItem("em-name") || name; } catch { /* ignoré */ }
  api(`${base}/reactions`, { method: "POST", body: { emoji: btn.dataset.emoji, name } })
    .then((m) => mine.add(m.id), (err) => toast(err.message));
});

// Menu ⋯ d'un message : signaler, masquer ; organisateur : supprimer, bloquer.
$("#chat-list").addEventListener("click", (e) => {
  if (!e.target.matches("[data-more]")) return;
  const el = e.target.closest("[data-id]");
  const m = messages.get(Number(el.dataset.id));
  contentMenu({
    slug, kind: "message", item: m, isOwner,
    onDelete: () => api(`${base}/messages/${m.id}`, { method: "DELETE" }),
    onChange: () => {
      document.querySelectorAll(".chat-msg").forEach((node) => {
        const msg = messages.get(Number(node.dataset.id));
        if (!msg || msg === m || isHidden(msg.author)) node.remove();
      });
    },
  });
});

$("#chat").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("#chat-text").value.trim();
  if (!text) return;
  const name = await guestName();
  try {
    addChat(await api(`${base}/messages`, { method: "POST", body: { name, text } }));
    $("#chat-text").value = "";
  } catch (err) {
    toast(err.message);
  }
});

// --- Photos des invités ---
let photos = [];

async function loadPhotos() {
  try { photos = (await api(`${base}/photos`)).filter((p) => !isHidden(p.author)); } catch { return; }
  $("#photo-count").textContent = photos.length ? ` ${photos.length}` : "";
  const thumbs = photos.slice(0, 4).map((p, i) => (isVideo(p.url)
    ? `<div class="vid" data-i="${i}"><video src="${esc(p.url)}#t=0.1" muted playsinline preload="metadata"></video></div>`
    : `<img src="${esc(p.url)}" alt="Photo de ${esc(p.name)}" data-i="${i}" loading="lazy">`));
  while (thumbs.length < 4) thumbs.push('<div class="ph"></div>');
  $("#photo-strip").innerHTML = `${thumbs.join("")}<button id="add-photo" aria-label="Ajouter une photo">+</button>`;
}

$("#photo-strip").addEventListener("click", async (e) => {
  if (e.target.id === "add-photo") {
    await pickAndUploadPhoto(slug).catch(() => null);
    return loadPhotos();
  }
  const photo = photos[e.target.closest("[data-i]")?.dataset.i];
  if (!photo) return;
  const remove = async () => { await api(`${base}/photos/${photo.id}`, { method: "DELETE" }); loadPhotos(); };
  viewPhoto(photo, isOwner ? remove : null,
    () => contentMenu({ slug, kind: "photo", item: photo, isOwner, onDelete: remove, onChange: loadPhotos }));
});

// Barre d'onglets du bas : accès rapide aux sections de la page.
document.querySelectorAll("[data-nav-icon]").forEach((el) => { el.insertAdjacentHTML("afterbegin", icon(el.dataset.navIcon)); });

load();
