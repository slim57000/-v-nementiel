import { api, $, esc, copy, shareSheet, toast, eventUrl, formatDate, dayBadge, tabbar, goLogin, EVENT_TYPES, publicCard } from "./common.js";
import { icon } from "./icons.js";

$("#profile-btn").innerHTML = icon("user");

tabbar("home");

if (new URLSearchParams(location.search).has("saved")) {
  toast("Événement enregistré ✔");
  history.replaceState(null, "", "/dashboard");
}

let events = [];
let discover = []; // événements publics des autres organisateurs
let filter = "all";
const today = new Date().toISOString().slice(0, 10);
// « En direct » : événement du jour avec au moins une caméra.
const isLive = (e) => e.date === today && e.cameras?.length > 0;
const bg = (url) => (url ? `style="background-image:url('${esc(url)}')"` : "");

async function load() {
  try {
    [events, discover] = await Promise.all([api("/api/events"), api("/api/public?limit=30").catch(() => [])]);
  } catch (err) {
    if (err.status === 401) return goLogin();
    return toast(err.message);
  }
  render();
}

function renderStories() {
  const mine = new Set(events.map((e) => e.slug));
  const upcoming = [...events.filter((e) => e.date >= today), ...discover.filter((e) => !mine.has(e.slug)).slice(0, 12)];
  $("#stories").innerHTML = `
    <a class="story new" href="/edit"><div class="story-img">+</div><span>Créer un événement</span></a>
    ${upcoming.map((ev) => {
      const badge = dayBadge(ev.date);
      const live = isLive(ev);
      return `<a class="story" href="${live ? `/live?e=${encodeURIComponent(ev.slug)}` : `/e/${esc(ev.slug)}`}">
        <div class="story-img ${live ? "live" : ""}" ${bg(ev.cover)}>${ev.cover ? "" : EVENT_TYPES[ev.type].icon}
          <span class="story-badge ${live || badge === "Aujourd'hui" ? "today" : ""}">${live ? "LIVE" : badge}</span></div>
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
      <div><h3>${esc(ev.name)}</h3><div class="muted">${type.label} · ${esc(ev.location)}</div>
        ${ev.reports ? `<a class="report-badge" href="/e/${esc(ev.slug)}">⚠️ ${ev.reports} signalement${ev.reports > 1 ? "s" : ""}</a>` : ""}</div>
      ${isLive(ev) ? '<span class="live-tag" style="margin-left:auto">LIVE</span>' : `<span class="badge ${isPrivate ? "private" : ""}">${isPrivate ? "🔒 Privé" : "🔓 Public"}</span>`}
    </div>
    <div class="ev-cover" ${bg(ev.cover)}>
      ${isLive(ev)
        ? `<div class="live-now">LIVE EN COURS</div>
           <a class="btn btn-block" href="/live?e=${encodeURIComponent(ev.slug)}">${icon("play", 16)} Rejoindre le Live</a>`
        : `<div class="when">${esc(dayBadge(ev.date))}</div>
           <a class="btn btn-block" href="/e/${esc(ev.slug)}">Voir la page de l'événement</a>`}
    </div>
    <div class="ev-info">
      <div><span style="color:var(--primary)">${icon("pin", 20)}</span><span><b>Lieu</b>${esc(ev.location)}</span></div>
      <div><span style="color:var(--primary)">${icon("calendar", 20)}</span><span><b>Date</b>${esc(formatDate(ev.date, ev.time))}</span></div>
      ${isPrivate ? `<div style="grid-column:1/-1"><span>🔑</span><span><b>Code d'accès invités</b><span class="code" style="font-size:1.05rem">${esc(ev.accessCode)}</span></span></div>` : ""}
      <div style="grid-column:1/-1"><span>🎥</span><span><b>Code caméraman</b><span class="code" style="font-size:1.05rem">${esc(ev.cameramanCode)}</span></span></div>
    </div>
    ${ev.cagnotteUrl ? `<div class="ev-pot"><span style="color:var(--primary)">${icon("gift")}</span><span><b>Cagnotte</b><span class="muted small">Plateforme externe</span></span>
      <a class="btn btn-sm" href="${esc(ev.cagnotteUrl)}" target="_blank" rel="noopener">Voir la cagnotte</a></div>` : ""}
    <div class="ev-tools">
      <a class="btn btn-sm" href="/faire-part?id=${ev.id}">💌 Mes faire-part</a>
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
  const keep = (e) => (filter === "upcoming" ? e.date >= today : filter === "live" ? isLive(e) : true);
  const shown = events.filter(keep);
  const mine = new Set(events.map((e) => e.slug));
  const others = discover.filter((e) => !mine.has(e.slug) && keep(e));
  $("#empty").classList.toggle("hidden", shown.length > 0 || others.length > 0);
  $("#empty-text").innerHTML = events.length
    ? "Aucun événement dans cette catégorie."
    : "Vous n'avez pas encore d'événement.<br>Créez le premier en quelques minutes !";
  $("#list").innerHTML = shown.map(card).join("") + (others.length
    ? `<div class="section-title"><h2>À découvrir</h2><a href="/decouvrir" class="see-all">Voir tout</a></div>
       <div class="p-grid">${others.map((e) => (isLive(e) ? publicCard(e).replace(`href="/e/${esc(e.slug)}"`, `href="/live?e=${encodeURIComponent(e.slug)}"`) : publicCard(e))).join("")}</div>`
    : "");
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
    shareSheet({ title: ev.name, text, url: ev.visibility === "private" ? `${url}?code=${ev.accessCode}` : url });
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
