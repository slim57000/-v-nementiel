import { api, $, esc, shareSheet, toast, guestName, viewPhoto, pickAndUploadPhoto, contentMenu, isHidden, isVideo, liveState, coverOf, onRealtime, embedUrl, thumbnailUrl } from "./common.js";
import { icon } from "./icons.js";

const slug = new URLSearchParams(location.search).get("e") || "";

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
  // Croix : retour à la page précédente du site (accueil, découvrir, tableau de bord…), sinon à l'accueil.
  $("#close").href = "/";
  $("#close").onclick = (e) => {
    if (document.referrer.startsWith(location.origin) && history.length > 1) { e.preventDefault(); history.back(); }
  };
  $("#share").onclick = () => shareSheet({ title: ev.name, text: `📺 Suivez « ${ev.name} » en direct !`, url: location.href });

  if (ev.cagnotteUrl) {
    for (const el of [$("#pot"), $("#pot-btn")]) {
      el.href = ev.cagnotteUrl;
      el.classList.remove("hidden");
    }
  } else {
    $("#reactions").style.gridTemplateColumns = "repeat(5, minmax(0, 1fr))";
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
  $("#stage").style.backgroundImage = `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.55)), url("${coverOf(ev)}")`;
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

// Chat : instantané via le temps réel si disponible (rafraîchissement de secours toutes les 15 s), sinon toutes les 3 s.
let pollDelay = 3000;
const fetchFeed = async () => { try { handle(await api(`${base}/feed?after=${lastId}`)); } catch { /* réseau : on réessaie */ } };
onRealtime(`ev-${slug}`, fetchFeed).then((on) => { if (on) pollDelay = 15000; });
async function poll() {
  if (!document.hidden) await fetchFeed();
  setTimeout(poll, pollDelay);
}

$("#reactions").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-emoji]");
  if (!btn) return;
  const emoji = btn.dataset.emoji;
  floatEmoji(emoji);
  let name = "Invité";
  try { name = localStorage.getItem("em-name") || name; } catch { /* ignoré */ }
  api(`${base}/reactions`, { method: "POST", body: { emoji, name } })
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

// Envoi : un seul message à la fois, puis 1 s de pause (évite les doublons par double appui).
let sendingChat = false;
$("#chat").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("#chat-text").value.trim();
  if (!text || sendingChat) return;
  sendingChat = true;
  const name = await guestName();
  $("#chat-text").value = "";
  try {
    addChat(await api(`${base}/messages`, { method: "POST", body: { name, text } }));
  } catch (err) {
    $("#chat-text").value = text;
    toast(err.message);
  }
  setTimeout(() => { sendingChat = false; }, 1000);
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

// Barre du bas : chaque onglet agit (et pas seulement un saut d'ancre).
document.querySelector(".live-tabs").addEventListener("click", (e) => {
  const tab = e.target.closest("a");
  if (!tab) return;
  e.preventDefault();
  document.querySelectorAll(".live-tabs a").forEach((a) => a.classList.toggle("active", a === tab));
  const go = (el) => el.scrollIntoView({ behavior: "smooth", block: "center" });
  const target = tab.getAttribute("href");
  if (target === "#chat-list") { go($("#chat")); $("#chat-text").focus({ preventScroll: true }); }
  else if (target === "#reactions") { go($("#reactions")); $("#reactions").animate([{ transform: "scale(1)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }], 400); }
  else if (target === "#pot-btn") window.open($("#pot-btn").href, "_blank", "noopener");
  else if (target === "#photo-strip") { go($("#photo-strip")); if (!photos.length) $("#add-photo").click(); }
  else if (target === "#cams-section") {
    if ($("#cams-section").classList.contains("hidden")) toast(cameras.length ? "Une seule caméra pour ce direct 🎥" : "Aucune caméra pour le moment");
    else go($("#cams-section"));
  }
});
