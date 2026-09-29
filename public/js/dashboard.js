import { api, $, esc, copy, share, toast, eventUrl, formatDate, dayBadge, tabbar, goLogin, EVENT_TYPES } from "./common.js";

tabbar("home");

if (new URLSearchParams(location.search).has("saved")) {
  toast("Événement enregistré ✔");
  history.replaceState(null, "", "/dashboard");
}

let events = [];
let filter = "all";
const today = new Date().toISOString().slice(0, 10);
const bg = (url) => (url ? `style="background-image:url('${esc(url)}')"` : "");

async function load() {
  try {
    events = await api("/api/events");
  } catch (err) {
    if (err.status === 401) return goLogin();
    return toast(err.message);
  }
  render();
}

function renderStories() {
  const upcoming = events.filter((e) => e.date >= today);
  $("#stories").innerHTML = `
    <a class="story new" href="/edit"><div class="story-img">+</div><span>Créer un événement</span></a>
    ${upcoming.map((ev) => {
      const badge = dayBadge(ev.date);
      return `<a class="story" href="/e/${esc(ev.slug)}">
        <div class="story-img" ${bg(ev.cover)}>${ev.cover ? "" : EVENT_TYPES[ev.type].icon}
          <span class="story-badge ${badge === "Aujourd'hui" ? "today" : ""}">${badge}</span></div>
        <span>${esc(ev.name)}</span></a>`;
    }).join("")}`;
}

function card(ev) {
  const type = EVENT_TYPES[ev.type];
  const isPrivate = ev.visibility === "private";
  return `
  <article class="ev-card event-item" data-slug="${esc(ev.slug)}">
    <div class="ev-head">
      <div class="ev-avatar" ${bg(ev.cover)}>${ev.cover ? "" : type.icon}</div>
      <div><h3>${esc(ev.name)}</h3><div class="muted">${type.label} · ${esc(ev.location)}</div></div>
      <span class="badge ${isPrivate ? "private" : ""}">${isPrivate ? "🔒 Privé" : "🔓 Public"}</span>
    </div>
    <div class="ev-cover" ${bg(ev.cover)}>
      <div class="when">${esc(dayBadge(ev.date))}</div>
      <a class="btn btn-block" href="/e/${esc(ev.slug)}">Voir la page de l'événement</a>
    </div>
    <div class="ev-info">
      <div><span>📍</span><span><b>Lieu</b>${esc(ev.location)}</span></div>
      <div><span>📅</span><span><b>Date</b>${esc(formatDate(ev.date, ev.time))}</span></div>
      ${isPrivate ? `<div style="grid-column:1/-1"><span>🔑</span><span><b>Code d'accès invités</b><span class="code" style="font-size:1.05rem">${esc(ev.accessCode)}</span></span></div>` : ""}
      <div style="grid-column:1/-1"><span>🎥</span><span><b>Code caméraman</b><span class="code" style="font-size:1.05rem">${esc(ev.cameramanCode)}</span></span></div>
    </div>
    <div class="ev-tools">
      <button class="btn btn-light btn-sm" data-action="share">Partager</button>
      <button class="btn btn-light btn-sm" data-action="link">Copier le lien</button>
      ${isPrivate ? `<button class="btn btn-light btn-sm" data-action="code">Copier le code</button>
      <button class="btn btn-light btn-sm" data-action="direct">Lien + code</button>` : ""}
      <button class="btn btn-light btn-sm" data-action="cameraman">Accès caméraman</button>
      <a class="btn btn-ghost btn-sm" href="/edit?id=${ev.id}">Modifier</a>
      <button class="btn btn-danger btn-sm" data-action="delete">Supprimer</button>
    </div>
  </article>`;
}

function render() {
  renderStories();
  const shown = events.filter((e) =>
    filter === "upcoming" ? e.date >= today : filter === "past" ? e.date < today : true);
  $("#empty").classList.toggle("hidden", shown.length > 0);
  $("#empty-text").innerHTML = events.length
    ? "Aucun événement dans cette catégorie."
    : "Vous n'avez pas encore d'événement.<br>Créez le premier en quelques minutes !";
  $("#list").innerHTML = shown.map(card).join("");
}

document.querySelector(".segments").addEventListener("click", (e) => {
  if (!e.target.dataset.filter) return;
  filter = e.target.dataset.filter;
  document.querySelectorAll(".segments button").forEach((b) => b.classList.toggle("active", b === e.target));
  render();
});

$("#list").addEventListener("click", async (e) => {
  const action = e.target.dataset.action;
  if (!action) return;
  const ev = events.find((x) => x.slug === e.target.closest("[data-slug]").dataset.slug);
  const url = eventUrl(ev.slug);

  if (action === "link") copy(url, "Lien copié !");
  if (action === "code") copy(ev.accessCode, "Code copié !");
  // Lien qui déverrouille directement l'événement privé (à n'envoyer qu'aux invités).
  if (action === "direct") copy(`${url}?code=${ev.accessCode}`, "Lien avec code copié !");
  if (action === "cameraman") {
    copy(`Espace caméraman « ${ev.name} » : ${location.origin}/cameraman — code : ${ev.cameramanCode}`, "Accès caméraman copié !");
  }
  if (action === "share") {
    const text = ev.visibility === "private"
      ? `Vous êtes invité·e à « ${ev.name} » ! Code d'accès : ${ev.accessCode}`
      : `Vous êtes invité·e à « ${ev.name} » !`;
    share({ title: ev.name, text, url });
  }
  if (action === "delete" && confirm(`Supprimer définitivement « ${ev.name} » ?`)) {
    try {
      await api(`/api/events/${ev.id}`, { method: "DELETE" });
      events = events.filter((x) => x !== ev);
      render();
      toast("Événement supprimé");
    } catch (err) {
      toast(err.message);
    }
  }
});

load();
