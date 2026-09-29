import { api, $, esc, share, toast, guestName, viewPhoto, pickAndUploadPhoto } from "./common.js";

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
  $("#share").onclick = () => share({ title: ev.name, text: `Suivez « ${ev.name} » en direct !`, url: location.href });

  if (ev.cagnotteUrl) {
    for (const el of [$("#pot"), $("#pot-btn")]) {
      el.href = ev.cagnotteUrl;
      el.classList.remove("hidden");
    }
  } else {
    $("#reactions").style.gridTemplateColumns = "repeat(5, 1fr)";
  }

  isOwner = ev.isOwner;
  cameras = ev.cameras;
  $("#cams").innerHTML = cameras.map((c, i) => `<button class="cam" data-index="${i}">${esc(c.name)}</button>`).join("");
  $("#cams-section").classList.toggle("hidden", cameras.length < 2);
  play(0);
  poll();
  loadPhotos();
  setInterval(loadPhotos, 20000);
}

$("#cams").addEventListener("click", (e) => {
  const btn = e.target.closest(".cam");
  if (btn) play(Number(btn.dataset.index));
});

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

function addChat(m) {
  if (shown.has(m.id)) return;
  shown.add(m.id);
  const list = $("#chat-list");
  list.querySelector(".chat-empty")?.remove();
  list.insertAdjacentHTML("beforeend",
    `<div class="chat-msg"><i>${esc(m.name.charAt(0).toUpperCase())}</i><div><b>${esc(m.name)}</b>${esc(m.text)}</div></div>`);
  while (list.children.length > 50) list.firstElementChild.remove();
  list.scrollTop = list.scrollHeight;
}

function handle(items) {
  for (const m of items) {
    lastId = Math.max(lastId, m.id);
    if (mine.has(m.id)) continue;
    if (m.kind === "chat") addChat(m);
    else if (!firstLoad) floatEmoji(m.text);
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
  try { photos = await api(`${base}/photos`); } catch { return; }
  $("#photo-count").textContent = photos.length ? ` ${photos.length}` : "";
  const thumbs = photos.slice(0, 4).map((p, i) => `<img src="${esc(p.url)}" alt="Photo de ${esc(p.name)}" data-i="${i}" loading="lazy">`);
  while (thumbs.length < 4) thumbs.push('<div class="ph"></div>');
  $("#photo-strip").innerHTML = `${thumbs.join("")}<button id="add-photo" aria-label="Ajouter une photo">+</button>`;
}

$("#photo-strip").addEventListener("click", async (e) => {
  if (e.target.id === "add-photo") {
    await pickAndUploadPhoto(slug).catch(() => null);
    return loadPhotos();
  }
  const photo = photos[e.target.dataset.i];
  if (!photo) return;
  viewPhoto(photo, isOwner ? async () => {
    await api(`${base}/photos/${photo.id}`, { method: "DELETE" });
    loadPhotos();
  } : null);
});

load();
