import { api, $, esc, copy, shareSheet, toast, eventUrl, formatDate, dayBadge, tabbar, goLogin, EVENT_TYPES, publicCard, coverOf, openStories } from "./common.js";
import { icon } from "./icons.js";

$("#profile-btn").innerHTML = icon("user");

tabbar("home");

if (new URLSearchParams(location.search).has("saved")) {
  toast("Événement enregistré ✔");
  history.replaceState(null, "", "/dashboard");
}

let events = [];
let discover = []; // événements publics des autres organisateurs
let stories = []; // stories des dernières 24 h, par événement
let filter = "all";
const today = new Date().toISOString().slice(0, 10);
// « En direct » : événement du jour avec au moins une caméra.
const isLive = (e) => e.date === today && e.cameras?.length > 0;
const bg = (url) => (url ? `style="background-image:url('${esc(url)}')"` : "");

async function load() {
  try {
    [events, discover, stories] = await Promise.all([api("/api/events"), api("/api/public?limit=30").catch(() => []), api("/api/me/stories").catch(() => [])]);
  } catch (err) {
    if (err.status === 401) return goLogin();
    return toast(err.message);
  }
  render();
}

function renderStories() {
  const mine = new Set(events.map((e) => e.slug));
  // Événements avec des stories récentes en premier (rond coloré), puis les autres.
  const withStory = new Set(stories.map((g) => g.slug));
  const all = [...events.filter((e) => e.date >= today), ...discover.filter((e) => !mine.has(e.slug)).slice(0, 12)];
  const extra = stories.filter((g) => !all.some((e) => e.slug === g.slug)).map((g) => ({ ...g }));
  const upcoming = [...extra, ...all].sort((a, b) => withStory.has(b.slug) - withStory.has(a.slug));
  $("#stories").innerHTML = `
    <a class="story new" href="/edit"><div class="story-img">+</div><span>Créer un événement</span></a>
    ${upcoming.map((ev) => {
      const badge = dayBadge(ev.date);
      const live = isLive(ev);
      return `<a class="story" href="${live ? `/live?e=${encodeURIComponent(ev.slug)}` : `/e/${esc(ev.slug)}`}">
        <div class="story-img ${live ? "live" : ""} ${withStory.has(ev.slug) ? "has-story" : ""}" data-story="${withStory.has(ev.slug) ? esc(ev.slug) : ""}" ${bg(coverOf(ev))}>
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
      <div class="ev-avatar" ${bg(coverOf(ev))}></div>
      <div><h3>${esc(ev.name)}</h3><div class="muted">${type.label} · ${esc(ev.location)}</div>
        ${ev.reports ? `<a class="report-badge" href="/e/${esc(ev.slug)}">⚠️ ${ev.reports} signalement${ev.reports > 1 ? "s" : ""}</a>` : ""}</div>
      ${isLive(ev) ? '<span class="live-tag" style="margin-left:auto">LIVE</span>' : `<span class="badge ${isPrivate ? "private" : ""}">${isPrivate ? "🔒 Privé" : "🔓 Public"}</span>`}
    </div>
    <div class="ev-cover" ${bg(coverOf(ev))}>
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
      <a class="btn btn-sm tool-main" href="/faire-part?id=${ev.id}">💌 Mes faire-part</a>
      <p class="tools-title">Partager & inviter</p>
      <div class="tools-grid">
        <button class="btn btn-light btn-sm" data-action="share">📤 Partager</button>
        <button class="btn btn-light btn-sm" data-action="link">🔗 Copier le lien</button>
        <button class="btn btn-light btn-sm" data-action="invite">✉️ Inviter</button>
        <button class="btn btn-light btn-sm" data-action="cameraman">🎥 Caméraman</button>
        ${isPrivate ? `<button class="btn btn-light btn-sm" data-action="code">🔑 Copier le code</button>
        <button class="btn btn-light btn-sm" data-action="direct">🔓 Lien + code</button>` : ""}
      </div>
      <p class="tools-title">Souvenirs</p>
      <div class="tools-grid">
        <button class="btn btn-light btn-sm" data-action="stats">📊 Statistiques</button>
        <a class="btn btn-light btn-sm" href="/album?id=${ev.id}">📖 Album</a>
        <button class="btn btn-light btn-sm" data-action="export">📦 Télécharger (zip)</button>
      </div>
      <div class="tools-grid tools-end">
        <a class="btn btn-ghost btn-sm" href="/edit?id=${ev.id}">✏️ Modifier</a>
        <button class="btn btn-danger btn-sm" data-action="delete">🗑️ Supprimer</button>
      </div>
    </div>
  </article>`;
}

// Appui sur un rond avec stories : lecteur plein écran (sinon, lien vers l'événement).
$("#stories").addEventListener("click", (e) => {
  const slug = e.target.closest("[data-story]")?.dataset.story;
  if (!slug) return;
  e.preventDefault();
  const g = stories.find((x) => x.slug === slug);
  openStories(g.items, { title: g.name });
});

function render() {
  renderStories();
  // « À venir » : pas encore commencé (les directs du jour sont dans « En direct »).
  const keep = (e) => (filter === "upcoming" ? e.date >= today && !isLive(e) : filter === "live" ? isLive(e) : true);
  const shown = events.filter(keep);
  const mine = new Set(events.map((e) => e.slug));
  const others = discover.filter((e) => !mine.has(e.slug) && keep(e));
  $("#empty").classList.toggle("hidden", shown.length > 0 || others.length > 0);
  $("#empty-text").innerHTML = events.length
    ? "Aucun événement dans cette catégorie."
    : "Vous n'avez pas encore d'événement.<br>Créez le premier en quelques minutes !";
  $("#list").innerHTML = shown.map(card).join("") + (others.length
    ? `<div class="section-title"><h2>À découvrir</h2><a href="/decouvrir" class="see-all">Voir tout</a></div>
       <div class="p-grid">${others.map(publicCard).join("")}</div>`
    : "");
}

document.querySelector(".segments").addEventListener("click", (e) => {
  if (!e.target.dataset.filter) return;
  if (e.target.dataset.filter === "feed") { location.href = "/fil"; return; }
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
  // Accès caméraman : un lien qui contient déjà le code (ouverture directe de son espace) + le code en secours.
  if (action === "cameraman") {
    const link = `${location.origin}/cameraman?code=${ev.cameramanCode}`;
    shareSheet({ title: `Caméraman — ${ev.name}`, text: `🎥 Vous filmez « ${ev.name} » ! Ouvrez ce lien puis appuyez sur « Démarrer le live » (code : ${ev.cameramanCode}).`, url: link });
  }
  if (action === "share") {
    const text = ev.visibility === "private"
      ? `Vous êtes invité·e à « ${ev.name} » ! Code d'accès : ${ev.accessCode}`
      : `Vous êtes invité·e à « ${ev.name} » !`;
    shareSheet({ title: ev.name, text, url: ev.visibility === "private" ? `${url}?code=${ev.accessCode}` : url });
  }
  if (action === "invite") openInvites(ev, url);
  if (action === "stats") openStats(ev);
  if (action === "export") {
    const btn = e.target;
    btn.disabled = true;
    try {
      const { exportEvent } = await import("./export.js");
      await exportEvent(ev, (n, total) => { btn.textContent = `📦 ${n} / ${total}…`; });
    } catch (err) {
      toast(err.message || "Export impossible.");
    }
    btn.disabled = false;
    btn.textContent = "📦 Télécharger (zip)";
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

// Invitations : par email (avec suivi envoyée / vue / a rejoint) ou par SMS (message prérempli).
async function openInvites(ev, url) {
  const link = ev.visibility === "private" ? `${url}?code=${ev.accessCode}` : url;
  const sms = `sms:?&body=${encodeURIComponent(`Vous êtes invité·e à « ${ev.name} » 🎉 ${link}`)}`;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="sheet" id="invite-sheet" role="dialog" aria-modal="true" aria-labelledby="inv-title">
      <div class="card">
        <h2 id="inv-title">Inviter à « ${esc(ev.name)} »</h2>
        <a class="btn btn-light btn-block" href="${esc(sms)}">📱 Inviter par SMS</a>
        <label for="inv-emails" style="margin-top:14px">Par email (une adresse par ligne)</label>
        <textarea id="inv-emails" rows="4" placeholder="awa@exemple.fr&#10;moussa@exemple.fr"></textarea>
        <button class="btn btn-block" id="inv-send" style="margin-top:10px">Envoyer les invitations</button>
        <div id="inv-list" style="margin-top:14px"></div>
        <button class="btn btn-ghost btn-block" id="inv-close" style="margin-top:10px">Fermer</button>
      </div>
    </div>`);
  const sheet = $("#invite-sheet");
  const close = () => sheet.remove();
  $("#inv-close").onclick = close;
  sheet.onclick = (e) => { if (e.target === sheet) close(); };
  const status = (i) => (i.joinedAt ? "✅ A rejoint" : i.seenAt ? "👀 Vue" : "📨 Envoyée");
  const refresh = async () => {
    const list = await api(`/api/events/${ev.id}/invites`).catch(() => []);
    $("#inv-list").innerHTML = list.length ? `<p class="muted small" style="margin:0 0 6px">${list.length} invitation(s) · ${list.filter((i) => i.joinedAt).length} ont rejoint</p>`
      + list.map((i) => `<div class="inv-row"><span>${esc(i.email)}</span><b>${status(i)}</b></div>`).join("") : "";
  };
  refresh();
  $("#inv-send").onclick = async () => {
    try {
      const r = await api(`/api/events/${ev.id}/invites`, { method: "POST", body: { emails: $("#inv-emails").value } });
      $("#inv-emails").value = "";
      toast(`${r.sent} invitation(s) envoyée(s) ✉️`);
      refresh();
    } catch (err) { toast(err.message); }
  };
}

// Statistiques de l'événement.
async function openStats(ev) {
  let st;
  try { st = await api(`/api/events/${ev.id}/stats`); } catch (err) { return toast(err.message); }
  const tile = (n, label) => `<div><b>${n}</b><span>${label}</span></div>`;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="sheet" id="stats-sheet" role="dialog" aria-modal="true" aria-labelledby="st-title">
      <div class="card">
        <h2 id="st-title">📊 ${esc(ev.name)}</h2>
        <div class="stats stats-grid">
          ${tile(st.views, "Vues de la page")}${tile(st.peak, "Pic de spectateurs")}${tile(st.chat, "Messages du chat")}
          ${tile(st.reactions, "Réactions")}${tile(st.photos, "Photos & vidéos")}${tile(st.guestbook, "Mots du livre d'or")}
          ${tile(st.likes, "J'aime")}${tile(st.invites, "Invitations")}${tile(st.invitesJoined, "Ont rejoint")}
        </div>
        <button class="btn btn-ghost btn-block" id="st-close" style="margin-top:12px">Fermer</button>
      </div>
    </div>`);
  const sheet = $("#stats-sheet");
  $("#st-close").onclick = () => sheet.remove();
  sheet.onclick = (e) => { if (e.target === sheet) sheet.remove(); };
}
