import { api, $, esc, copy, shareSheet, formatDate, eventUrl, viewPhoto, pickAndUploadPhoto, contentMenu, isHidden, isVideo, liveState, EVENT_TYPES, openStories, toast } from "./common.js";
import { renderInvite, invitePhotoUrl } from "./invitation.js";
import { initGuestbook } from "./guestbook.js";

const slug = decodeURIComponent(location.pathname.split("/").pop());
const url = eventUrl(slug);

// Invitation reçue par email (?inv=…) : l'organisateur voit qu'elle a été ouverte, puis acceptée.
const inviteToken = new URLSearchParams(location.search).get("inv");
const trackInvite = () => inviteToken && api(`/api/public/${encodeURIComponent(slug)}/seen`, { method: "POST", body: { inv: inviteToken } }).catch(() => {});
trackInvite();

async function load() {
  // Lien direct « /e/slug?code=XXXX » : on tente de déverrouiller puis on retire le code de l'URL.
  const code = new URLSearchParams(location.search).get("code");
  if (code) {
    await api(`/api/public/${slug}/unlock`, { method: "POST", body: { code } }).catch(() => {});
    history.replaceState(null, "", location.pathname);
  }

  let ev;
  try {
    ev = await api(`/api/public/${slug}`);
  } catch (err) {
    $("#loading").textContent = err.message;
    return;
  }
  $("#loading").remove();
  ev.locked ? showLocked(ev) : showEvent(ev);
}

function showLocked(ev) {
  $("#locked-name").textContent = ev.name;
  $("#locked").classList.remove("hidden");
  $("#code").focus();
}

$("#unlock").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#unlock-error").textContent = "";
  try {
    await api(`/api/public/${slug}/unlock`, { method: "POST", body: { code: $("#code").value } });
    trackInvite();
    // Le cookie est posé : les visites suivantes arriveront directement sur la page.
    const ev = await api(`/api/public/${slug}`);
    $("#locked").classList.add("hidden");
    showEvent(ev);
  } catch (err) {
    $("#unlock-error").textContent = err.message;
  }
});

function showEvent(ev) {
  const type = EVENT_TYPES[ev.type];
  document.title = ev.name;
  $("#name").textContent = ev.name;
  $("#subtitle").textContent = SUBTITLES[ev.type] ?? type.label;
  $("#date-big").textContent = new Date(`${ev.date}T${ev.time}`)
    .toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    .replace(/^(\d+) (\p{L})/u, (m, d, l) => `${d} ${l.toUpperCase()}`);
  $("#lock").textContent = ev.visibility === "private" ? "🔒 Privé" : "🔓 Public";
  renderStories(ev);
  initFavorite(ev);
  initGuestbook(ev);

  $("#when").textContent = formatDate(ev.date, ev.time);
  $("#where").textContent = ev.location;
  $("#map").href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`;
  $("#description").textContent = ev.description;
  $("#description").classList.toggle("hidden", !ev.description);

  const state = liveState(ev);
  if (ev.cameras.length && state !== "expired") {
    $("#live-link").href = `/live?e=${encodeURIComponent(ev.slug)}`;
    if (state === "replay") $("#live-link").textContent = "▶ Voir le replay";
    $("#live-link").classList.remove("hidden");
  }
  if (ev.cagnotteUrl) {
    $("#cagnotte-link").href = ev.cagnotteUrl;
    $("#cagnotte-link").classList.remove("hidden");
  }

  // Premium : page sans marque MaFeliza.
  if (ev.premium) document.querySelector(".invite-hero-heart")?.remove();
  renderInvite($("#invite"), ev, ev.invite, ev.inviteStyle, invitePhotoUrl(ev.invite, ev.cover));
  startCountdown(new Date(`${ev.date}T${ev.time}`));

  $("#share").onclick = () => shareSheet({ title: ev.name, text: `Vous êtes invité·e à « ${ev.name} » !`, url });
  $("#copy").onclick = () => copy(url, "Lien copié !");
  $("#page").classList.remove("hidden");
}

// Sous-titre manuscrit sous le nom, selon le type d'événement.
const SUBTITLES = {
  mariage: "se marient", fiancailles: "se fiancent", bapteme: "Baptême", communion: "Communion",
  anniversaire: "Joyeux anniversaire", "baby-shower": "Baby shower", diplome: "Remise de diplôme",
  retraite: "Départ en retraite", inauguration: "Inauguration", autre: "",
};

// Stories : publiées pour 24 h par l'organisateur et les invités, visibles une fois connecté.
async function renderStories(ev) {
  const loggedIn = ev.isOwner || (await api("/api/auth/me").then(() => true, () => false));
  if (!loggedIn) {
    const first = ev.cover ? `<div class="story-circle"><div style="background-image:url('${esc(ev.cover)}')"></div></div>` : "";
    const teasers = [1, 2, 3, 4].slice(ev.cover ? 1 : 0)
      .map((n) => `<div class="story-circle teaser"><div style="background-image:url('/img/maquette/story${n}.jpg')">🔒</div></div>`).join("");
    $("#stories-row").innerHTML = first + teasers;
    $("#signup").href = `/connexion?next=${encodeURIComponent(location.pathname)}`;
    $("#signup").classList.remove("hidden");
    return;
  }
  const base = `/api/public/${encodeURIComponent(ev.slug)}`;
  // Stories temporaires (24 h) : un rond par personne, lecteur plein écran façon Instagram.
  const load = async () => {
    const stories = (await api(`${base}/stories`).catch(() => [])).filter((p) => !isHidden(p.author));
    const people = [...new Set(stories.map((p) => p.name))];
    $("#stories-row").innerHTML = people.length
      ? people.map((name) => {
        const first = stories.find((p) => p.name === name);
        const thumb = isVideo(first.url) ? "background:#2b2530" : `background-image:url('${esc(first.url)}')`;
        return `<button class="story-circle has-story" data-who="${esc(name)}" aria-label="Stories de ${esc(name)}"><div style="${thumb}"></div><span class="story-label">${esc(name)}</span></button>`;
      }).join("")
      : '<p class="muted small" style="margin:0">Aucune story pour l\'instant. Partagez la première !</p>';
    $("#stories-row").onclick = (e) => {
      const who = e.target.closest("[data-who]")?.dataset.who;
      if (!who) return;
      const ordered = [...stories.filter((p) => p.name === who), ...stories.filter((p) => p.name !== who)];
      openStories(ordered, { onDelete: ev.isOwner ? async (p) => { await api(`${base}/photos/${p.id}`, { method: "DELETE" }); load(); } : null });
    };
  };
  $("#add-story").classList.remove("hidden");
  $("#add-story").onclick = () => pickAndUploadPhoto(ev.slug, { story: true }).then(() => { toast("Story publiée pour 24 h ✨"); load(); }, () => {});
  load();
}

// Favori (utilisateur connecté, hors organisateur).
async function initFavorite(ev) {
  if (!ev.loggedIn || ev.isOwner) return;
  const btn = $("#fav");
  let on = (await api("/api/me/favorites").catch(() => [])).some((e) => e.id === ev.id);
  const paint = () => { btn.textContent = on ? "♥" : "♡"; btn.classList.toggle("on", on); };
  paint();
  btn.classList.remove("hidden");
  btn.onclick = async () => {
    on = !on;
    paint();
    await api(`/api/me/favorites/${ev.id}`, { method: on ? "POST" : "DELETE" }).catch(() => {});
  };
}

function startCountdown(target) {
  const el = $("#countdown");
  const tick = () => {
    const diff = target - Date.now();
    if (diff <= 0) {
      const sameDay = new Date().toDateString() === target.toDateString();
      el.classList.add("done");
      el.innerHTML = `<p style="text-align:center;margin:0">${sameDay ? "C'est aujourd'hui ! 🎉" : "L'événement a eu lieu. Merci à tous ! 💛"}</p>`;
      return clearInterval(timer);
    }
    const s = Math.floor(diff / 1000);
    const parts = [[Math.floor(s / 86400), "jours"], [Math.floor(s / 3600) % 24, "heures"], [Math.floor(s / 60) % 60, "min"], [s % 60, "sec"]];
    el.innerHTML = parts.map(([n, l]) => `<div><strong>${String(n).padStart(2, "0")}</strong><span>${l}</span></div>`).join("");
  };
  const timer = setInterval(tick, 1000);
  tick();
}

load();

// Bouton retour : page précédente du site, sinon l'accueil.
document.getElementById("back")?.addEventListener("click", (e) => {
  if (document.referrer.startsWith(location.origin) && history.length > 1) { e.preventDefault(); history.back(); }
});
