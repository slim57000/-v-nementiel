import { api, $, esc, copy, share, formatDate, eventUrl, viewPhoto, pickAndUploadPhoto, EVENT_TYPES } from "./common.js";
import { renderInvite, invitePhotoUrl } from "./invitation.js";
import { initGuestbook } from "./guestbook.js";

const slug = decodeURIComponent(location.pathname.split("/").pop());
const url = eventUrl(slug);

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
  initGuestbook(ev);

  $("#when").textContent = formatDate(ev.date, ev.time);
  $("#where").textContent = ev.location;
  $("#map").href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`;
  $("#description").textContent = ev.description;
  $("#description").classList.toggle("hidden", !ev.description);

  if (ev.cameras.length) {
    $("#live-link").href = `/live?e=${encodeURIComponent(ev.slug)}`;
    $("#live-link").classList.remove("hidden");
  }
  if (ev.cagnotteUrl) {
    $("#cagnotte-link").href = ev.cagnotteUrl;
    $("#cagnotte-link").classList.remove("hidden");
  }

  renderInvite($("#invite"), ev, ev.invite, ev.inviteStyle, invitePhotoUrl(ev.invite, ev.cover));
  startCountdown(new Date(`${ev.date}T${ev.time}`));

  $("#share").onclick = () => share({ title: ev.name, text: `Vous êtes invité·e à « ${ev.name} » !`, url });
  $("#copy").onclick = () => copy(url, "Lien copié !");
  $("#page").classList.remove("hidden");
}

// Sous-titre manuscrit sous le nom, selon le type d'événement.
const SUBTITLES = {
  mariage: "se marient", fiancailles: "se fiancent", bapteme: "Baptême", communion: "Communion",
  anniversaire: "Joyeux anniversaire", "baby-shower": "Baby shower", diplome: "Remise de diplôme",
  retraite: "Départ en retraite", inauguration: "Inauguration", autre: "",
};

// Stories : photos des invités des dernières 24 h, visibles une fois connecté.
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
  const load = async () => {
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const stories = (await api(`${base}/photos`).catch(() => [])).filter((p) => new Date(p.createdAt) > dayAgo);
    $("#stories-row").innerHTML = stories.length
      ? stories.map((p, i) => `<button class="story-circle" data-i="${i}" aria-label="Photo de ${esc(p.name)}"><div style="background-image:url('${esc(p.url)}')"></div></button>`).join("")
      : '<p class="muted small" style="margin:0">Aucune story pour l\'instant. Partagez la première photo !</p>';
    $("#stories-row").onclick = (e) => {
      const photo = stories[e.target.closest("[data-i]")?.dataset.i];
      if (!photo) return;
      viewPhoto(photo, ev.isOwner ? async () => {
        await api(`${base}/photos/${photo.id}`, { method: "DELETE" });
        load();
      } : null);
    };
  };
  $("#add-story").classList.remove("hidden");
  $("#add-story").onclick = () => pickAndUploadPhoto(ev.slug).then(load, () => {});
  load();
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
