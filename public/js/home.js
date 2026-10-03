// Page d'accueil publique (visiteurs non connectés).
import { api, $, esc, toast, dayBadge, coverOf, liveAttrs } from "./common.js";
import { icon, BRAND } from "./icons.js";

// Pictogrammes et logos des boutons de connexion.
document.querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon, 26); });
document.querySelectorAll("[data-social]").forEach((b) => { b.innerHTML = BRAND[b.dataset.social.toLowerCase()]; });

// Déjà connecté : « Créer mon événement » mène directement au formulaire.
api("/api/auth/me").then(() => { $("#create").href = "/edit"; }).catch(() => {});

// Dans l'application iOS / Android, les connexions sociales sont masquées :
// Apple refuse les boutons non fonctionnels et Google la connexion dans une vue intégrée.
if (window.Capacitor?.isNativePlatform?.()) {
  document.querySelector(".socials")?.remove();
  document.querySelector(".divider")?.remove();
}

// Connexions sociales : actives si configurées sur le serveur (Google pour l'instant), sinon « bientôt ».
let social = [];
fetch("/api/config").then((r) => r.json()).then((c) => { social = c.social || []; }).catch(() => {});
document.querySelectorAll("[data-social]").forEach((b) => b.addEventListener("click", () => {
  const provider = b.dataset.social.toLowerCase();
  if (social.includes(provider)) location.href = `/api/auth/${provider}?next=/dashboard`;
  else toast(`Connexion ${b.dataset.social} : bientôt disponible`);
}));

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

// « En direct actuellement » : vrais événements publics (en direct aujourd'hui d'abord),
// complétés par des exemples tant qu'il y en a moins de 3.
const EXAMPLES = [
  { name: "Aminata & Kevin", location: "Abidjan, Côte d'Ivoire", image: "/img/demo/mariage.jpg" },
  { name: "Sarah & William", location: "Paris, France", image: "/img/demo/live-mariage.jpg" },
  { name: "Remise de diplôme de Junior", location: "Montréal, Canada", image: "/img/demo/diplome.jpg" },
];
const today = new Date().toISOString().slice(0, 10);

const formatCount = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",").replace(",0", "")}K` : String(n));

function liveCard({ href, image, tag, live, name, location, viewers, ev }) {
  const bg = ev ? liveAttrs(ev) : image ? `style="background-image:url('${esc(image)}')"` : "";
  return `<a class="live-card" ${href ? `href="${esc(href)}"` : ""} ${bg}>
    <span class="tag ${live ? "is-live" : ""}">${esc(tag)}</span>
    <b>${esc(name)}</b><span>${esc(location)}</span>
    ${viewers ? `<span class="viewers-mini">${icon("eye", 14)} ${formatCount(viewers)}</span>` : ""}
    <i class="heart">${icon("heart", 18)}</i>
  </a>`;
}

api("/api/public?limit=10").catch(() => []).then((events) => {
  // Les directs du jour d'abord, puis les événements privés (rien ne transparaît), puis le reste.
  const built = events.map((e) => {
    // Événement privé : sa photo, mais ni nom ni lieu. Le clic mène à l'écran « entrez votre code ».
    if (e.visibility === "private") return { live: false, html: liveCard({
      href: `/e/${encodeURIComponent(e.slug)}`, image: coverOf(e), tag: "🔒 Sur invitation", live: false,
      name: "Événement privé", location: "Accès par code",
    }) };
    const live = e.date === today && Boolean(e.cameras?.length);
    return { live, html: liveCard({
      href: live ? `/live?e=${encodeURIComponent(e.slug)}` : `/e/${encodeURIComponent(e.slug)}`,
      ev: e, image: coverOf(e), tag: live ? "LIVE" : dayBadge(e.date), live, name: e.name, location: e.location, viewers: e.viewers,
    }) };
  });
  const cards = [...built].sort((a, b) => Number(b.live) - Number(a.live)).map((c) => c.html);
  EXAMPLES.slice(0, Math.max(0, 3 - cards.length)).forEach((ex) => cards.push(liveCard({ ...ex, href: "/decouvrir", tag: "Exemple" })));
  $("#upcoming-list").innerHTML = cards.join("");
});
