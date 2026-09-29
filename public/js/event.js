import { api, $, esc, copy, share, formatDate, eventUrl, EVENT_TYPES } from "./common.js";
import { renderInvite, invitePhotoUrl } from "./invitation.js";

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

// Aperçu des stories : invitation à créer un compte tant que l'invité n'est pas connecté.
async function renderStories(ev) {
  const loggedIn = await api("/api/auth/me").then(() => true, () => false);
  const first = ev.cover ? `<div class="story-circle"><div style="background-image:url('${esc(ev.cover)}')"></div></div>` : "";
  $("#stories-row").innerHTML = first + '<div class="story-circle locked"><div>🔒</div></div>'.repeat(ev.cover ? 3 : 4);
  $("#stories-soon").classList.toggle("hidden", !loggedIn);
  if (!loggedIn) {
    $("#signup").href = `/connexion?next=${encodeURIComponent(location.pathname)}`;
    $("#signup").classList.remove("hidden");
  }
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
