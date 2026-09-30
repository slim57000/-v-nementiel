// Utilitaires partagés par toutes les pages.
import { icon } from "./icons.js";
import "./i18n.js"; // langue (FR/EN) et thème (clair/sombre), appliqués au chargement

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
  const day = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} à ${time.replace(":", "h")}`;
}

// Redimensionne une photo côté navigateur (photos de téléphone souvent > 5 Mo) et renvoie une data URL JPEG.
export function resizeImage(file, maxSize = 1600) {
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
      resolve(canvas.toDataURL("image/jpeg", 0.85));
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
const TYPE_COVER = {
  mariage: "live-mariage", fiancailles: "mariage", bapteme: "bebe", "baby-shower": "bebe", communion: "costume",
  anniversaire: "anniversaire", diplome: "diplome", retraite: "anniversaire", inauguration: "enfants", autre: "live-mariage",
};
export const coverOf = (ev) => ev.cover || `/img/demo/${TYPE_COVER[ev.type] || "live-mariage"}.jpg`;
// « En direct » : événement du jour avec au moins une caméra.
export const isLiveNow = (ev) => ev.date === new Date().toISOString().slice(0, 10) && ev.cameras?.length > 0;

export function publicCard(ev) {
  const live = isLiveNow(ev);
  return `<a class="pub-card" href="${live ? `/live?e=${encodeURIComponent(ev.slug)}` : `/e/${esc(ev.slug)}`}" style="background-image:url('${esc(coverOf(ev))}')">
    <span class="tag">${live ? "● LIVE" : esc(dayBadge(ev.date))}</span>
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
      <a href="/edit" aria-label="Créer un événement"><span class="plus">+</span></a>
      ${tab("messages", "/messages", "chat", "Messages")}
      ${tab("profile", "/profil", "user", "Profil")}
    </nav>`);
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
export function pickAndUploadPhoto(slug) {
  return new Promise((resolve, reject) => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept: "image/*,video/*" });
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const name = await guestName();
        const media = file.type.startsWith("video/")
          ? (toast("Envoi de la vidéo…"), await uploadVideo(slug, file))
          : (toast("Envoi de la photo…"), { image: await resizeImage(file, 1600) });
        resolve(await api(`/api/public/${encodeURIComponent(slug)}/photos`, { method: "POST", body: { name, ...media } }));
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
  const end = new Date(`${ev.date}T00:00`);
  end.setDate(end.getDate() + REPLAY_DAYS + 1);
  return Date.now() < end ? "replay" : "expired";
}
