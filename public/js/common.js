// Utilitaires partagés par toutes les pages.
import { icon } from "./icons.js";
import { lang } from "./i18n.js"; // langue (FR/EN) et thème (clair/sombre), appliqués au chargement

// Format des dates selon la langue choisie.
export const LOCALE = lang === "en" ? "en-GB" : "fr-FR";
export const EN = lang === "en";

export const EVENT_TYPES = {
  mariage: { label: "Mariage", icon: "💍" },
  anniversaire: { label: "Anniversaire", icon: "🎂" },
  bapteme: { label: "Baptême", icon: "🕊️" },
  communion: { label: "Communion", icon: "🕯️" },
  fiancailles: { label: "Fiançailles", icon: "💞" },
  "baby-shower": { label: "Baby shower", icon: "🍼" },
  diplome: { label: "Remise de diplôme", icon: "🎓" },
  retraite: { label: "Retraite", icon: "🌴" },
  inauguration: { label: "Inauguration", icon: "🎀" },
  autre: { label: "Autre", icon: "🎉" },
};

export async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Une erreur est survenue."), { status: res.status, data });
  return data;
}

export const $ = (sel, root = document) => root.querySelector(sel);

export function esc(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

export function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

export async function copy(text, message = "Copié !") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Repli pour les navigateurs sans API presse-papier (http, vieux Android).
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast(message);
}

// Partage natif si disponible (mobile), sinon copie du lien.
export async function share({ title, text, url }) {
  if (navigator.share) {
    try { return await navigator.share({ title, text, url }); } catch (e) { if (e.name === "AbortError") return; }
  }
  copy(url, "Lien copié !");
}

export const eventUrl = (slug) => `${location.origin}/e/${slug}`;

export function formatDate(date, time) {
  const d = new Date(`${date}T${time}`);
  const day = d.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return EN ? `${day} at ${time}` : `${day.charAt(0).toUpperCase()}${day.slice(1)} à ${time.replace(":", "h")}`;
}

// Redimensionne une photo côté navigateur (photos de téléphone souvent > 5 Mo) et renvoie une data URL JPEG.
export function resizeImage(file, maxSize = 1280) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Merci de choisir une image."));
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      // WebP (≈ 30 % plus léger) quand le navigateur sait l'encoder, sinon JPEG.
      const webp = canvas.toDataURL("image/webp", 0.75);
      resolve(webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => reject(new Error("Image illisible."));
    img.src = URL.createObjectURL(file);
  });
}

// Nombre de jours avant l'événement : « J-6 », « Aujourd'hui » ou « Passé ».
export function dayBadge(date) {
  const today = new Date(new Date().toDateString());
  const days = Math.round((new Date(`${date}T00:00`) - today) / 86400000);
  return days > 0 ? `J-${days}` : days === 0 ? "Aujourd'hui" : "Passé";
}

// Vignette d'un événement public (accueil, Découvrir).
// Photo par défaut selon le type, pour les événements sans photo de couverture.
// ❤️ sur les cartes d'événements : ajout / retrait des favoris en un geste (connexion demandée si besoin).
let favSlugs = null;
export async function syncFavs() {
  try { favSlugs ||= new Set((await api("/api/me/favorites")).map((e) => e.slug)); } catch { favSlugs = new Set(); }
  document.querySelectorAll("[data-fav]").forEach((b) => { const on = favSlugs.has(b.dataset.fav); b.textContent = on ? "❤️" : "♡"; b.classList.toggle("on", on); });
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-fav]");
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  const slug = b.dataset.fav, on = !b.classList.contains("on");
  try {
    await api(`/api/me/favorites/${encodeURIComponent(slug)}`, { method: on ? "POST" : "DELETE" });
    favSlugs?.[on ? "add" : "delete"](slug);
    document.querySelectorAll(`[data-fav="${CSS.escape(slug)}"]`).forEach((x) => { x.textContent = on ? "❤️" : "♡"; x.classList.toggle("on", on); });
    toast(on ? "Ajouté à vos favoris ❤️" : "Retiré des favoris");
  } catch (err) { if (err.status === 401) goLogin(); else toast(err.message); }
}, true);

// Sans photo choisie : fond MaFeliza (dégradé) avec l'emoji du type d'événement, jamais une photo de banque d'images.
const placeholders = {};
export const placeholderCover = (type) => (placeholders[type] ||= `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
  + `<stop offset="0" stop-color="#fe7320"/><stop offset=".5" stop-color="#fd1a85"/><stop offset="1" stop-color="#8a1de9"/></linearGradient></defs>`
  + `<rect width="800" height="500" fill="url(#g)"/><text x="400" y="250" font-size="150" text-anchor="middle" dominant-baseline="central">${EVENT_TYPES[type]?.icon || "🎉"}</text></svg>`,
)}`);
export const coverOf = (ev) => ev.cover || placeholderCover(ev.type);
// Transforme un lien YouTube / Twitch en adresse de lecteur intégrable (null si non reconnu).
export function embedUrl(url, slug = new URLSearchParams(location.search).get("e")) {
  // Caméra « téléphone » (LiveKit) : lecteur MaFeliza.
  if (url?.startsWith("lk:")) return slug ? `/lk?e=${encodeURIComponent(slug)}&room=${encodeURIComponent(url.slice(3))}` : null;
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
export function thumbnailUrl(url, { live = false } = {}) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const id = host === "youtu.be" ? u.pathname.slice(1)
    : host === "youtube.com" ? u.searchParams.get("v") || u.pathname.match(/^\/(?:live|embed|shorts)\/([\w-]+)/)?.[1] : null;
  const fresh = `t=${Math.floor(Date.now() / 60000)}`; // image renouvelée chaque minute pendant le direct
  if (id) return live ? `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault_live.jpg?${fresh}` : `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`;
  if (host === "twitch.tv" && u.pathname.split("/")[1]) {
    return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${encodeURIComponent(u.pathname.split("/")[1].toLowerCase())}-320x180.jpg?${fresh}`;
  }
  return null;
}

// « En direct » : événement du jour avec au moins une caméra.
export const isLiveNow = (ev) => ev.date === new Date().toISOString().slice(0, 10) && ev.cameras?.length > 0;

export function publicCard(ev) {
  const live = isLiveNow(ev);
  return `<a class="pub-card" href="${live ? `/live?e=${encodeURIComponent(ev.slug)}` : `/e/${esc(ev.slug)}`}" ${liveAttrs(ev)}>
    <span class="tag">${live ? "● LIVE" : esc(dayBadge(ev.date))}</span>
    <button type="button" class="card-fav" data-fav="${esc(ev.slug)}" aria-label="Ajouter aux favoris">♡</button>
    <b>${esc(ev.name)}</b>
    <span>${EVENT_TYPES[ev.type].icon} ${esc(ev.location)}</span>
  </a>`;
}

// Barre d'onglets du bas (pages connectées). `active` : "home" | "discover" | "messages" | "profile".
export function tabbar(active) {
  const tab = (key, href, ico, label) =>
    `<a href="${href}" class="${active === key ? "active" : ""}"><span class="ico">${icon(ico)}</span>${label}</a>`;
  document.body.classList.add("has-tabbar");
  document.body.insertAdjacentHTML("beforeend", `
    <nav class="tabbar" aria-label="Navigation">
      ${tab("home", "/dashboard", "home", "Accueil")}
      ${tab("discover", "/decouvrir", "search", "Découvrir")}
      <a href="/edit" aria-label="Créer" id="tab-create"><span class="plus">+</span></a>
      ${tab("messages", "/messages", "chat", "Messages")}
      ${tab("profile", "/profil", "user", "Profil")}
    </nav>`);
  $("#tab-create").addEventListener("click", createSheet);
  if (!["/dashboard", "/decouvrir", "/messages", "/profil"].includes(location.pathname)) backButton();
  bell();
}

// Bouton « ‹ » en haut à gauche des pages secondaires : page précédente du site, sinon l'accueil.
export function backButton(fallback = "/dashboard") {
  const bar = document.querySelector(".topbar");
  if (!bar || bar.querySelector(".top-back")) return;
  bar.insertAdjacentHTML("afterbegin", `<a class="top-back" href="${fallback}" aria-label="Retour">‹</a>`);
  bar.querySelector(".top-back").addEventListener("click", (e) => {
    if (document.referrer.startsWith(location.origin) && history.length > 1) { e.preventDefault(); history.back(); }
  });
}

// « + » du menu : choisir entre une story (sur un de ses événements) et un nouvel événement.
export function createSheet(e) {
  e.preventDefault();
  const events = api("/api/events").catch(() => null); // chargé tout de suite : le choix de fichier doit suivre un appui
  let list = null;
  events.then((l) => { list = l; });
  document.body.insertAdjacentHTML("beforeend", `<div class="sheet" id="create-sheet" role="dialog" aria-modal="true">
    <div class="card"><h2 style="margin-top:0">Que voulez-vous créer ?</h2>
      <div id="create-body" style="display:grid;gap:10px">
        <button class="btn btn-block create-big" type="button" id="create-story">Une story</button>
        <a class="btn btn-light btn-block create-big" href="/edit">Un événement</a>
      </div></div></div>`);
  const sheet = $("#create-sheet");
  const close = () => sheet.remove();
  sheet.addEventListener("click", (ev) => { if (ev.target === sheet) close(); });
  const publish = (slug) => {
    close();
    pickAndUploadPhoto(slug, { story: true }).then(() => { toast("Story publiée pour 24 h ✨"); setTimeout(() => location.reload(), 900); }, () => {});
  };
  $("#create-story").addEventListener("click", async () => {
    if (list === null) list = await events;
    if (list === null) return goLogin();
    const today = new Date().toISOString().slice(0, 10);
    const mine = [...list].sort((a, b) => (a.date < today) - (b.date < today) || a.date.localeCompare(b.date));
    if (!mine.length) { toast("Créez d'abord un événement pour y publier une story."); return; }
    if (mine.length === 1) return publish(mine[0].slug);
    $("#create-body").innerHTML = `<p class="muted" style="margin:0">Sur quel événement ?</p>` + mine.map((ev) =>
      `<button type="button" class="notif fav-row" data-slug="${esc(ev.slug)}" style="border:0;text-align:left;font:inherit;cursor:pointer">
        <span class="fav-thumb" style="background-image:url('${esc(coverOf(ev))}')"></span>
        <span><b>${esc(ev.name)}</b><small class="muted">${esc(formatDate(ev.date, ev.time))}</small></span></button>`).join("");
    $("#create-body").addEventListener("click", (ev) => { const b = ev.target.closest("[data-slug]"); if (b) publish(b.dataset.slug); });
  });
}

// Cloche 🔔 dans la barre du haut : nouveautés du compte (messages, livre d'or, réponses, lives…).
async function bell() {
  const bar = document.querySelector(".topbar");
  if (!bar) return;
  let data;
  try { data = await api("/api/me/notifications"); } catch { return; } // non connecté
  const unread = data.items.filter((n) => n.at > data.seen).length;
  const btn = document.createElement("button");
  btn.className = "bell";
  btn.type = "button";
  btn.setAttribute("aria-label", "Notifications");
  btn.innerHTML = `🔔${unread ? `<span class="bell-count">${unread > 9 ? "9+" : unread}</span>` : ""}`;
  const logo = bar.querySelector(".logo");
  if (logo) logo.after(btn); else bar.append(btn);
  btn.addEventListener("click", () => {
    btn.querySelector(".bell-count")?.remove();
    api("/api/me/notifications/read", { method: "POST" }).catch(() => {});
    const when = (t) => new Date(t).toLocaleString(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const rows = data.items.map((n) => `<a class="notif ${n.at > data.seen ? "new" : ""}" href="${esc(n.url.startsWith("/") ? n.url : "/dashboard")}">
      <b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ""}<small class="muted">${when(n.at)}</small></a>`).join("");
    document.body.insertAdjacentHTML("beforeend", `<div class="sheet" id="notif-sheet" role="dialog" aria-modal="true">
      <div class="card"><h2 style="margin-top:0">Notifications</h2>
        <div class="notif-list">${rows || '<p class="muted">Aucune notification pour le moment.</p>'}</div>
        <button class="btn btn-light btn-block" type="button" id="notif-close">Fermer</button></div></div>`);
    data.seen = Date.now();
    const sheet = $("#notif-sheet");
    sheet.addEventListener("click", (e) => { if (e.target === sheet || e.target.id === "notif-close") sheet.remove(); });
  });
}

// Redirige vers la connexion en revenant ensuite sur la page courante.
export const goLogin = () => location.replace(`/connexion?next=${encodeURIComponent(location.pathname + location.search)}`);

// Prénom de l'invité (chat, réactions, photos) : demandé une fois puis mémorisé sur l'appareil.
export function guestName() {
  let saved = "";
  try { saved = localStorage.getItem("em-name") || ""; } catch { /* stockage indisponible */ }
  if (saved) return Promise.resolve(saved);
  return new Promise((resolve) => {
    document.body.insertAdjacentHTML("beforeend", `
      <div class="sheet" id="name-sheet" role="dialog" aria-modal="true">
        <form class="card" style="color:var(--text)">
          <h2>Votre prénom</h2>
          <p class="muted">Il s'affichera à côté de vos messages et de vos photos.</p>
          <input name="n" maxlength="30" required autocomplete="given-name" placeholder="Ex. Sophie">
          <button class="btn btn-block" style="margin-top:12px">Valider</button>
        </form>
      </div>`);
    const sheet = document.getElementById("name-sheet");
    const input = sheet.querySelector("input");
    input.focus();
    sheet.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      try { localStorage.setItem("em-name", name); } catch { /* ignoré */ }
      sheet.remove();
      resolve(name);
    });
  });
}

// --- Modération côté invité : personnes masquées sur cet appareil ---
const HIDDEN_KEY = "em-hidden";
const hiddenSet = () => { try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]")); } catch { return new Set(); } };
export const isHidden = (author) => Boolean(author) && hiddenSet().has(author);
function hide(author) {
  const set = hiddenSet();
  set.add(author);
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set])); } catch { /* ignoré */ }
}

// Menu « ⋯ » d'un contenu (message, photo, mot du livre d'or).
// Invité : Signaler, Masquer cette personne. Organisateur : Supprimer, Bloquer cette personne.
export function contentMenu({ slug, kind, item, isOwner, onDelete, onChange }) {
  const base = `/api/public/${encodeURIComponent(slug)}`;
  const actions = [
    ["report", "🚩 Signaler ce contenu"],
    ...(!isOwner && item.author ? [["hide", "🙈 Masquer cette personne"]] : []),
    ...(isOwner && onDelete ? [["delete", "🗑️ Supprimer"]] : []),
    ...(isOwner && item.author ? [["block", "⛔ Bloquer cette personne"]] : []),
  ];
  document.body.insertAdjacentHTML("beforeend", `
    <div class="sheet" id="content-menu" role="dialog" aria-modal="true">
      <div class="card menu-card">
        ${actions.map(([a, label]) => `<button class="btn btn-ghost btn-block" data-a="${a}">${label}</button>`).join("")}
        <button class="btn btn-light btn-block" data-a="close">Annuler</button>
      </div>
    </div>`);
  const sheet = document.getElementById("content-menu");
  sheet.addEventListener("click", async (e) => {
    const a = e.target.dataset?.a || (e.target === sheet ? "close" : null);
    if (!a) return;
    sheet.remove();
    try {
      if (a === "report") {
        const reason = prompt("Pourquoi signalez-vous ce contenu ? (facultatif)") ?? null;
        if (reason === null) return;
        await api(`${base}/reports`, { method: "POST", body: { kind, itemId: item.id, reason } });
        toast("Merci, le signalement a été transmis.");
      }
      if (a === "hide") { hide(item.author); toast("Vous ne verrez plus les contenus de cette personne."); onChange?.(); }
      if (a === "delete" && confirm("Supprimer ce contenu ?")) { await onDelete(); onChange?.(); }
      if (a === "block" && confirm("Bloquer cette personne ? Ses contenus seront masqués et elle ne pourra plus publier.")) {
        await api(`${base}/blocks`, { method: "POST", body: { author: item.author } });
        toast("Personne bloquée.");
        onChange?.();
      }
    } catch (err) { toast(err.message); }
  });
}

// Affiche une photo en plein écran. `onDelete` (facultatif) ajoute un bouton de suppression,
// `onMore` (facultatif) un bouton « ⋯ » (signaler, masquer, bloquer).
export function viewPhoto(photo, onDelete, onMore) {
  document.body.insertAdjacentHTML("beforeend", `
    <div class="viewer" id="viewer" role="dialog" aria-modal="true">
      ${isVideo(photo.url)
        ? `<video src="${esc(photo.url)}" controls autoplay playsinline></video>`
        : `<img src="${esc(photo.url)}" alt="">`}
      <div class="viewer-bar">
        <span>${isVideo(photo.url) ? "🎬" : "📷"} ${esc(photo.name)}</span>
        ${onMore ? '<button class="btn btn-light btn-sm" data-more aria-label="Plus d\'actions">⋯</button>' : ""}
        ${onDelete ? '<button class="btn btn-danger btn-sm" data-del>Supprimer</button>' : ""}
        <button class="btn btn-light btn-sm" data-close>Fermer</button>
      </div>
    </div>`);
  const viewer = document.getElementById("viewer");
  viewer.addEventListener("click", async (e) => {
    if (e.target.matches("[data-more]")) { viewer.remove(); onMore(); return; }
    if (e.target.matches("[data-del]")) {
      if (!confirm("Supprimer cette photo ?")) return;
      await onDelete();
      viewer.remove();
    } else if (e.target.matches("[data-close]") || e.target === viewer) viewer.remove();
  });
}

// --- Vidéos courtes (stories, photos du live, livre d'or) ---
export const MAX_VIDEO_SECONDS = 30;
export const isVideo = (url) => /\.(mp4|mov|webm)(\?|$)/i.test(url || "");

// Durée d'une vidéo locale (en secondes), lue sans l'envoyer.
function videoDuration(file) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error("Vidéo illisible."));
  r.readAsDataURL(file);
});

// Envoie une vidéo courte : directement vers le stockage (Supabase) si possible, sinon via l'API.
// Renvoie les champs à joindre à la requête ({ videoUrl } ou { video }).
export async function uploadVideo(slug, file) {
  const duration = await videoDuration(file);
  if (duration > MAX_VIDEO_SECONDS + 0.5) throw new Error(`Vidéo trop longue (${MAX_VIDEO_SECONDS} secondes maximum).`);
  const type = file.type || "video/mp4";
  const target = await api(`/api/public/${encodeURIComponent(slug)}/upload-url`, { method: "POST", body: { type, size: file.size } });
  if (target.mode === "direct") {
    const res = await fetch(target.uploadUrl, { method: "PUT", headers: { "Content-Type": type }, body: file });
    if (!res.ok) throw new Error("Envoi de la vidéo impossible, réessayez.");
    return { videoUrl: target.publicUrl };
  }
  if (file.size > 4 * 1024 * 1024) throw new Error("Vidéo trop lourde (4 Mo maximum).");
  return { video: await readAsDataUrl(file) };
}

// Choisit une photo ou une vidéo courte et l'envoie comme média d'invité. Renvoie le média créé.
export function pickAndUploadPhoto(slug, { story = false } = {}) {
  return new Promise((resolve, reject) => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept: "image/*,video/*" });
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const name = await guestName();
        const media = file.type.startsWith("video/")
          ? (toast("Envoi de la vidéo…"), await uploadVideo(slug, file))
          : (toast("Envoi de la photo…"), { image: await resizeImage(file, 1280) });
        // Story : légende facultative (affichée sur la story).
        const caption = story ? (prompt("Ajouter une légende ? (facultatif)") || "").trim().slice(0, 120) : "";
        resolve(await api(`/api/public/${encodeURIComponent(slug)}/photos`, { method: "POST", body: { name, ...media, ...(story && { story: true, caption }) } }));
      } catch (err) {
        toast(err.message);
        reject(err);
      }
    });
    input.click();
  });
}

// --- Cookies et traceurs ---
// Cookies strictement nécessaires (session, accès aux événements privés) : toujours actifs.
// Mesure d'audience (Google Analytics) : chargée uniquement après accord explicite.
const CONSENT_KEY = "em-consent";

const readConsent = () => { try { return localStorage.getItem(CONSENT_KEY); } catch { return "refused"; } };

// Identifiant GA4 fourni par le serveur (variable GA_MEASUREMENT_ID) ; rien n'est chargé sans lui.
async function loadAnalytics() {
  if (window.gtag) return;
  const { gaId: GA_ID } = await fetch("/api/config").then((r) => r.json()).catch(() => ({}));
  if (!GA_ID) return;
  const script = Object.assign(document.createElement("script"), { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${GA_ID}` });
  document.head.append(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { anonymize_ip: true });
}

export function cookieBanner() {
  document.getElementById("cookie-banner")?.remove();
  document.body.insertAdjacentHTML("beforeend", `
    <div class="cookie-banner" id="cookie-banner" role="dialog" aria-label="Cookies">
      <p><b>🍪 Cookies</b> — Nous utilisons des cookies indispensables au fonctionnement du site (connexion, accès aux événements privés) et, avec votre accord, des cookies de mesure d'audience. <a href="/confidentialite#cookies">En savoir plus</a></p>
      <div class="row"><button class="btn btn-ghost btn-sm" data-consent="refused">Refuser</button><button class="btn btn-sm" data-consent="accepted">Accepter</button></div>
    </div>`);
  document.getElementById("cookie-banner").addEventListener("click", (e) => {
    const choice = e.target.dataset.consent;
    if (!choice) return;
    try { localStorage.setItem(CONSENT_KEY, choice); } catch { /* ignoré */ }
    document.getElementById("cookie-banner").remove();
    if (choice === "accepted") loadAnalytics();
  });
}

if (readConsent() === "accepted") loadAnalytics();
else if (!readConsent()) addEventListener("DOMContentLoaded", cookieBanner);
// Tout lien [data-cookies] rouvre le choix.
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-cookies]")) { e.preventDefault(); cookieBanner(); }
});

// --- Partage : WhatsApp, Facebook, Instagram, SMS, email, copie, partage natif ---
export function shareSheet({ title, text, url }) {
  const msg = `${text} ${url}`;
  const enc = encodeURIComponent;
  const links = [
    ["WhatsApp", "#25D366", `https://wa.me/?text=${enc(msg)}`],
    ["Facebook", "#1877F2", `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
    ["SMS", "#34C759", `sms:?&body=${enc(msg)}`],
    ["Email", "#6e6873", `mailto:?subject=${enc(title)}&body=${enc(msg)}`],
  ];
  document.body.insertAdjacentHTML("beforeend", `
    <div class="sheet" id="share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <div class="card">
        <h2 id="share-title" style="font-size:1.1rem">Partager</h2>
        <div class="share-grid">
          ${links.map(([n, c, href]) => `<a class="share-opt" href="${esc(href)}" target="_blank" rel="noopener"><i style="background:${c}">${n[0]}</i>${n}</a>`).join("")}
          <button class="share-opt" data-s="instagram"><i style="background:linear-gradient(45deg,#f58529,#dd2a7b,#8134af)">I</i>Instagram</button>
          <button class="share-opt" data-s="copy"><i style="background:var(--primary)">🔗</i>Copier le lien</button>
          ${navigator.share ? '<button class="share-opt" data-s="native"><i style="background:#1d1a20">⋯</i>Plus…</button>' : ""}
        </div>
        <button class="btn btn-light btn-block" data-s="close" style="margin-top:12px">Fermer</button>
      </div>
    </div>`);
  const sheet = document.getElementById("share-sheet");
  sheet.addEventListener("click", async (e) => {
    const s = e.target.closest("[data-s]")?.dataset.s || (e.target === sheet ? "close" : null);
    if (e.target.closest("a.share-opt")) return sheet.remove();
    if (!s) return;
    sheet.remove();
    // Instagram n'accepte pas de lien pré-rempli : on copie le message à coller en story ou en message.
    if (s === "instagram") copy(msg, "Message copié : collez-le dans Instagram");
    if (s === "copy") copy(url, "Lien copié !");
    if (s === "native") share({ title, text, url });
  });
}

// URL de l'image QR code d'un lien.
export const qrUrl = (link) => `/api/qr?data=${encodeURIComponent(link)}`;

// Exemple de lien affiché dans les champs « caméra », selon la plateforme choisie par l'administration.
export const livePlaceholder = () => fetch("/api/config").then((r) => r.json())
  .then((c) => (c.defaultLivePlatform === "twitch" ? "https://twitch.tv/votre-chaine" : "https://youtube.com/live/…"))
  .catch(() => "https://youtube.com/live/…");

// Replay : le live d'un événement reste visible 15 jours après la date de l'événement.
export const REPLAY_DAYS = 15;
export function liveState(ev) {
  const today = new Date().toISOString().slice(0, 10);
  if (ev.date >= today) return "live";
  if (ev.replayDeleted) return "expired";
  // Replay retiré par l'organisateur : invisible pour les invités.
  if (ev.replayOnline === false && !ev.isOwner) return "pending";
  const end = new Date(`${ev.date}T00:00`);
  end.setDate(end.getDate() + (ev.replayDays || REPLAY_DAYS) + 1);
  return Date.now() < end ? "replay" : "expired";
}

// Erreurs JavaScript : remontées au serveur (suivi des erreurs), 5 par page au maximum.
let reported = 0;
const reportClientError = (message, stack) => {
  if (reported++ >= 5 || !message) return;
  const body = JSON.stringify({ message: String(message).slice(0, 300), stack: String(stack || "").slice(0, 3000), url: location.href });
  try { navigator.sendBeacon?.("/api/client-error", new Blob([body], { type: "application/json" })) || fetch("/api/client-error", { method: "POST", headers: { "Content-Type": "application/json" }, body }); } catch { /* ignoré */ }
};
addEventListener("error", (e) => reportClientError(e.message, e.error?.stack));
addEventListener("unhandledrejection", (e) => reportClientError(e.reason?.message || String(e.reason), e.reason?.stack));

// Notifications push : abonnement de cet appareil (service worker + clé VAPID du serveur).
export async function enablePush() {
  const { vapidPublicKey } = await fetch("/api/config").then((r) => r.json());
  if (!vapidPublicKey) throw new Error("Les notifications ne sont pas encore activées sur la plateforme.");
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("Notifications indisponibles ici. Sur iPhone : Partager → « Sur l'écran d'accueil », puis ouvrez MaFeliza depuis l'icône.");
  }
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications refusées dans les réglages du téléphone.");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const key = Uint8Array.from(atob(vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(vapidPublicKey.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
  await api("/api/push/subscribe", { method: "POST", body: { subscription: sub.toJSON() } });
}
export const pushState = () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);

// Temps réel : appelle `onPing` dès qu'un signal arrive sur `topic` (Supabase Realtime, si activé).
// Renvoie vrai si l'abonnement est actif (la page peut alors espacer ses rafraîchissements).
let realtimeClient;
export async function onRealtime(topic, onPing) {
  try {
    const { realtime } = await fetch("/api/config").then((r) => r.json());
    if (!realtime) return false;
    realtimeClient ||= (await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")).createClient(realtime.url, realtime.key);
    realtimeClient.channel(topic).on("broadcast", { event: "ping" }, onPing).subscribe();
    return true;
  } catch {
    return false;
  }
}

// --- Lecteur de stories plein écran (façon Instagram) ---
// items : [{ url, name, caption, createdAt }] ; appui à droite = suivante, à gauche = précédente ; 5 s par photo.
const agoShort = (iso) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60000));
  return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`;
};
export function openStories(items, { start = 0, title = "", onDelete } = {}) {
  if (!items.length) return;
  document.getElementById("story-viewer")?.remove();
  document.body.insertAdjacentHTML("beforeend", `
    <div class="story-viewer" id="story-viewer" role="dialog" aria-modal="true" aria-label="Stories">
      <div class="sv-bars">${items.map(() => "<i><b></b></i>").join("")}</div>
      <div class="sv-head"><span class="sv-who"></span><button class="sv-close" aria-label="Fermer">✕</button></div>
      <div class="sv-media"></div>
      <p class="sv-caption"></p>
      ${onDelete ? '<button class="sv-del" aria-label="Supprimer la story">🗑️</button>' : ""}
      <button class="sv-prev" aria-label="Story précédente"></button><button class="sv-next" aria-label="Story suivante"></button>
    </div>`);
  const root = document.getElementById("story-viewer");
  const bars = [...root.querySelectorAll(".sv-bars b")];
  let i = start, timer, video;
  document.body.style.overflow = "hidden";
  const close = () => { clearTimeout(timer); root.remove(); document.body.style.overflow = ""; };
  const show = (n) => {
    clearTimeout(timer);
    if (n < 0) n = 0;
    if (n >= items.length) return close();
    i = n;
    const it = items[i];
    bars.forEach((b, k) => { b.style.transition = "none"; b.style.width = k < i ? "100%" : "0%"; });
    root.querySelector(".sv-who").innerHTML = `<b>${esc(it.name)}</b> <span>${title ? `${esc(title)} · ` : ""}il y a ${agoShort(it.createdAt)}</span>`;
    root.querySelector(".sv-caption").textContent = it.caption || "";
    const media = root.querySelector(".sv-media");
    const run = (ms) => {
      requestAnimationFrame(() => { bars[i].style.transition = `width ${ms}ms linear`; bars[i].style.width = "100%"; });
      timer = setTimeout(() => show(i + 1), ms);
    };
    if (isVideo(it.url)) {
      media.innerHTML = `<video src="${esc(it.url)}" autoplay playsinline></video>`;
      video = media.querySelector("video");
      video.onloadedmetadata = () => run(Math.min(30, video.duration || 10) * 1000);
      video.onerror = () => run(3000);
    } else {
      media.innerHTML = `<img src="${esc(it.url)}" alt="">`;
      run(5000);
    }
  };
  root.querySelector(".sv-close").onclick = close;
  root.querySelector(".sv-prev").onclick = () => show(i - 1);
  root.querySelector(".sv-next").onclick = () => show(i + 1);
  root.querySelector(".sv-del")?.addEventListener("click", async () => {
    if (!confirm("Supprimer cette story ?")) return;
    try { await onDelete(items[i]); items.splice(i, 1); root.querySelector(".sv-bars").lastChild?.remove(); bars.pop(); items.length ? show(Math.min(i, items.length - 1)) : close(); }
    catch (err) { toast(err.message); }
  });
  addEventListener("keydown", function onKey(e) {
    if (!document.getElementById("story-viewer")) return removeEventListener("keydown", onKey);
    if (e.key === "Escape") close(); if (e.key === "ArrowRight") show(i + 1); if (e.key === "ArrowLeft") show(i - 1);
  });
  show(start);
}

// --- Cartes des lives : image tirée du direct en cours + aperçu en restant appuyé ---
// Fond : dernière image du direct (renouvelée chaque minute) par-dessus la couverture, qui reste visible si l'image manque.
export function liveAttrs(ev) {
  const cover = coverOf(ev);
  const cam = isLiveNow(ev) ? ev.cameras[0]?.url : null;
  // Vidéo de démonstration : on garde la photo de l'événement (sa miniature n'a rien à voir avec l'événement).
  const demo = cam?.includes("aqz-KE-bpKQ");
  const thumb = cam && !demo && thumbnailUrl(cam, { live: true });
  const embed = cam && embedUrl(cam, ev.slug);
  return `style="background-image:${thumb ? `url('${esc(thumb)}'), ` : ""}url('${esc(cover)}')"${thumb && /ytimg/.test(thumb) ? " data-yt-thumb" : ""}${embed ? ` data-live-preview="${esc(embed)}"` : ""}`;
}

// Appui long (0,35 s) sur une carte de live : la diffusion se lance dans la carte (sans son) tant qu'on reste appuyé.
let holdTimer = null, previewing = null, suppressClick = false;
const stopPreview = () => {
  clearTimeout(holdTimer);
  previewing?.querySelector(".live-preview")?.remove();
  previewing?.classList.remove("previewing");
  if (previewing) suppressClick = true;
  previewing = null;
};
document.addEventListener("pointerdown", (e) => {
  const card = e.target.closest?.("[data-live-preview]");
  if (!card) return;
  suppressClick = false;
  holdTimer = setTimeout(() => {
    previewing = card;
    card.classList.add("previewing");
    card.insertAdjacentHTML("afterbegin", `<iframe class="live-preview" src="${esc(card.dataset.livePreview)}" allow="autoplay; encrypted-media" tabindex="-1" aria-hidden="true"></iframe>`);
    navigator.vibrate?.(15);
  }, 350);
});
// Relâchement du doigt (ou sortie de la carte) : l'aperçu s'arrête.
for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, () => { if (holdTimer || previewing) stopPreview(); }, true);
document.addEventListener("pointerout", (e) => {
  const card = e.target.closest?.("[data-live-preview]");
  if (card && (holdTimer || previewing) && !card.contains(e.relatedTarget)) stopPreview();
}, true);
document.addEventListener("click", (e) => {
  if (suppressClick && e.target.closest?.("[data-live-preview]")) { e.preventDefault(); suppressClick = false; }
}, true);
document.addEventListener("contextmenu", (e) => { if (e.target.closest?.("[data-live-preview]")) e.preventDefault(); });
