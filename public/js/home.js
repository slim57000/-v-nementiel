import { api, $, toast, publicCard } from "./common.js";
import { icon, BRAND } from "./icons.js";

// Pictogrammes et logos des boutons de connexion.
document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon, 26); });
document.querySelectorAll("[data-social]").forEach((b) => { b.innerHTML = BRAND[b.dataset.social.toLowerCase()]; });

// Déjà connecté : « Créer mon événement » mène directement au formulaire.
api("/api/auth/me").then(() => { $("#create").href = "/edit"; }).catch(() => {});

// Connexions sociales : prévues dans une prochaine version.
document.querySelectorAll("[data-social]").forEach((b) =>
  b.addEventListener("click", () => toast(`Connexion ${b.dataset.social} : bientôt disponible`)));

// « J'ai reçu une invitation » : le code suffit à ouvrir l'événement.
const sheet = $("#join");
$("#invited").addEventListener("click", () => {
  sheet.classList.remove("hidden");
  $("#join-code").focus();
});
$("#join-close").addEventListener("click", () => sheet.classList.add("hidden"));
sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.classList.add("hidden"); });

$("#join-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#join-error").textContent = "";
  try {
    const { slug } = await api("/api/public/join", { method: "POST", body: { code: $("#join-code").value } });
    location.href = `/e/${slug}`;
  } catch (err) {
    $("#join-error").textContent = err.message;
  }
});

// Événements publics à venir.
api("/api/public?limit=10").then((events) => {
  if (!events.length) return;
  $("#upcoming-list").innerHTML = events.map(publicCard).join("");
  $("#upcoming").classList.remove("hidden");
}).catch(() => {});
