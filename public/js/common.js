// Utilitaires partagés par toutes les pages.
import { icon } from "./icons.js";

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
export function publicCard(ev) {
  const cover = ev.cover ? `style="background-image:url('${esc(ev.cover)}')"` : "";
  return `<a class="pub-card" href="/e/${esc(ev.slug)}" ${cover}>
    <span class="tag">${esc(dayBadge(ev.date))}</span>
    <b>${esc(ev.name)}</b>
    <span>${EVENT_TYPES[ev.type].icon} ${esc(ev.location)}</span>
  </a>`;
}

// Barre d'onglets du bas (pages connectées). `active` : "home" | "discover" | "profile".
export function tabbar(active) {
  const tab = (key, href, ico, label) =>
    `<a href="${href}" class="${active === key ? "active" : ""}"><span class="ico">${icon(ico)}</span>${label}</a>`;
  document.body.classList.add("has-tabbar");
  document.body.insertAdjacentHTML("beforeend", `
    <nav class="tabbar" aria-label="Navigation">
      ${tab("home", "/dashboard", "home", "Accueil")}
      ${tab("discover", "/decouvrir", "search", "Découvrir")}
      <a href="/edit" aria-label="Créer un événement"><span class="plus">+</span></a>
      <span class="soon" title="Bientôt disponible"><span class="ico">${icon("chat")}</span>Messages</span>
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
      <img src="${esc(photo.url)}" alt="">
      <div class="viewer-bar">
        <span>📷 ${esc(photo.name)}</span>
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

// Choisit une photo, la redimensionne et l'envoie comme photo d'invité. Renvoie la photo créée.
export function pickAndUploadPhoto(slug) {
  return new Promise((resolve, reject) => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept: "image/*" });
    input.addEventListener("change", async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const [image, name] = await Promise.all([resizeImage(file, 1600), guestName()]);
        toast("Envoi de la photo…");
        resolve(await api(`/api/public/${encodeURIComponent(slug)}/photos`, { method: "POST", body: { name, image } }));
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
