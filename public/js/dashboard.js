// Accueil connecté : ronds des stories, onglets Pour vous / En direct / À venir, cartes des événements.
import { api, $, esc, copy, shareSheet, toast, eventUrl, formatDate, dayBadge, tabbar, goLogin, EVENT_TYPES, publicCard, coverOf, openStories, liveAttrs, createSheet, syncFavs, LOCALE } from "./common.js";
import { t } from "./i18n.js";
import { icon } from "./icons.js";

// Bandeau « Découvrir » au-dessus des stories (Créer : carré « + » ; Messages et Profil : menu 👤 en haut).
document.querySelector(".stories").insertAdjacentHTML("beforebegin", `<div class="hd-top">
  <form class="hd-search" action="/decouvrir" role="search"><span aria-hidden="true">🔍</span><input name="q" type="search" enterkeyhint="search" placeholder="Rechercher un événement, une ville…" aria-label="Rechercher un événement"></form>
</div>`);

tabbar("home");

if (new URLSearchParams(location.search).has("saved")) {
  toast("Événement enregistré ✔");
  history.replaceState(null, "", "/dashboard");
}

let events = [];
let discover = []; // événements publics des autres organisateurs
let joined = []; // événements où je suis invité + ceux de mes amis (privés compris)
let stories = []; // stories des dernières 24 h, par événement
let filter = "all";
let myId = null; // compte connecté : les rappels caméraman de ce téléphone lui sont propres
const today = new Date().toISOString().slice(0, 10);
// Jour J : l'événement est considéré « en direct » (un clic sur sa miniature ouvre le live).
const isLive = (e) => e.date === today;
const bg = (url) => (url ? `style="background-image:url('${esc(url)}')"` : "");

async function load() {
  try {
    [events, discover, stories, joined, myId] = await Promise.all([api("/api/events"), api("/api/public?limit=30").catch(() => []), api("/api/me/stories").catch(() => []), api("/api/me/circle").catch(() => []), api("/api/auth/me").then((m) => m.id).catch(() => null)]);
  } catch (err) {
    if (err.status === 401) return goLogin();
    return toast(err.message);
  }
  // Événements privés / non répertoriés d'abord : sinon noyés parmi les nombreux événements publics (démo).
  discover.sort((a, b) => (a.visibility === "public") - (b.visibility === "public"));
  try { localStorage.setItem(DASH_KEY, JSON.stringify({ events, discover: discover.slice(0, 30), stories, joined, myId })); } catch { /* plein ou indisponible */ }
  render();
}

// Mélange privés / non répertoriés et publics (un sur deux), pour que les privés ne soient pas noyés en fin de liste.
function mix(list) {
  // Jour J d'abord : les événements qui commencent sont tout en haut (« ▶ Voir le live »).
  const now = list.filter(isLive);
  return [...now, ...mixRest(list.filter((e) => !isLive(e)))];
}
function mixRest(list) {
  const priv = list.filter((e) => e.visibility && e.visibility !== "public"), pub = list.filter((e) => !priv.includes(e));
  const out = [];
  while (priv.length || pub.length) { if (pub.length) out.push(pub.shift()); if (priv.length) out.push(priv.shift()); }
  return out;
}

const VIS = { private: ["Privé", "private"], unlisted: ["Non répertorié", "unlisted"], public: ["Public", ""] };

function renderStories() {
  const mine = new Set(events.map((e) => e.slug));
  // Événements avec des stories récentes en premier (rond coloré), puis les autres.
  const withStory = new Set(stories.map((g) => g.slug));
  const guest = joined.filter((e) => e.date >= today && !mine.has(e.slug));
  const all = [...events.filter((e) => e.date >= today), ...guest, ...discover.filter((e) => e.slug && !mine.has(e.slug) && !guest.some((g) => g.slug === e.slug)).slice(0, 12)];
  const extra = stories.filter((g) => !all.some((e) => e.slug === g.slug)).map((g) => ({ ...g }));
  const upcoming = mix([...extra, ...all].sort((a, b) => withStory.has(b.slug) - withStory.has(a.slug)));
  $("#stories").innerHTML = `
    <a class="story new" href="/edit" data-create><div class="story-img">+</div><span>Créer</span></a>
    ${upcoming.map((ev) => {
      const badge = dayBadge(ev.date);
      const live = isLive(ev);
      return `<a class="story" href="${live ? `/live?e=${encodeURIComponent(ev.slug)}` : `/e/${esc(ev.slug)}`}">
        <div class="story-img ${live ? "live" : ""} ${withStory.has(ev.slug) ? "has-story" : ""}" data-story="${withStory.has(ev.slug) ? esc(ev.slug) : ""}" ${liveAttrs(ev)}>
          <span class="story-badge ${live || badge === "Aujourd'hui" ? "today" : ""}">${live ? "● En direct" : badge}</span>
          </div>
        <span>${esc(evTitle(ev))}</span>
        ${ev.visibility ? `<small class="story-vis ${(VIS[ev.visibility] || VIS.public)[1]}">${(VIS[ev.visibility] || VIS.public)[0]}</small>` : ""}</a>`;
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
      ${isLive(ev) ? '<span class="live-tag" style="margin-left:auto">LIVE</span>' : `<span class="badge ${(VIS[ev.visibility] || VIS.public)[1]}">${(VIS[ev.visibility] || VIS.public)[0]}</span>`}
    </div>
    <div class="ev-cover" ${liveAttrs(ev)}>
      ${isLive(ev)
        ? `<div class="live-now">C'EST AUJOURD'HUI</div>
           <a class="btn btn-block" href="/live?e=${encodeURIComponent(ev.slug)}">${icon("play", 16)} Voir le live</a>`
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
      <a class="btn btn-sm tool-main btn-golive" href="/cameraman?code=${esc(ev.cameramanCode)}">🔴 Lancer le live</a>
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

// Événements filmés supprimés, suspendus ou déplacés dans le passé : retirés du rappel (et de la mémoire du téléphone).
async function pruneCams(list) {
  const gone = [];
  await Promise.all(list.map(async (x) => {
    const ev = await api(`/api/public/${encodeURIComponent(x.slug)}`).catch((err) => (err.status === 404 ? null : undefined));
    if (ev === null || (ev?.date && ev.date < today)) gone.push(x.slug);
  }));
  if (!gone.length) return;
  try { localStorage.setItem("em-cam", JSON.stringify(JSON.parse(localStorage.getItem("em-cam") || "[]").filter((x) => !gone.includes(x.slug)))); } catch { /* ignoré */ }
  document.querySelectorAll(".cam-reminder").forEach((a) => { if (gone.includes(a.dataset.slug)) a.remove(); });
}

// Rappel « Espace caméraman » : événements à venir pour lesquels ce téléphone filme.
function camReminder() {
  let list = [];
  try { list = JSON.parse(localStorage.getItem("em-cam") || "[]").filter((x) => x.date >= today && myId && x.uid === myId); } catch { /* ignoré */ }
  // Mes propres événements : celui du jour, sinon le prochain (l'organisateur filme souvent lui-même).
  const own = events.filter((e) => e.date >= today && e.cameramanCode).sort((a, b) => a.date.localeCompare(b.date));
  const mineToShow = own.filter((e) => e.date === today);
  // Sinon le prochain, seulement s'il a lieu dans la semaine (pas de rappel des semaines à l'avance).
  const inWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  if (!mineToShow.length && own[0] && own[0].date <= inWeek) mineToShow.push(own[0]);
  list = [...mineToShow.map((e) => ({ slug: e.slug, name: e.name, date: e.date, code: e.cameramanCode })), ...list.filter((x) => !mineToShow.some((e) => e.slug === x.slug))];
  setTimeout(() => pruneCams(list.filter((x) => !mineToShow.some((e) => e.slug === x.slug))), 0);
  return list.map((x) => `<a class="cam-reminder" data-slug="${esc(x.slug)}" href="/cameraman?${x.code ? `code=${encodeURIComponent(x.code)}` : `e=${encodeURIComponent(x.slug)}`}">
    <span>🎥</span><div><b>Espace caméraman</b><small>${esc(x.name)}${x.date === today ? " · c'est aujourd'hui !" : ""}</small></div><em>Ouvrir ›</em></a>`).join("");
}

function render() {
  renderStories();
  // « À venir » : pas encore commencé (les directs du jour sont dans « En direct »).
  const keep = (e) => (filter === "upcoming" ? e.date >= today && !isLive(e) : filter === "live" ? isLive(e) : true);
  const shown = events.filter(keep);
  const mine = new Set(events.map((e) => e.slug));
  // Grille : mes événements à venir, ceux où je suis invité, puis les événements publics des autres.
  const guest = joined.filter((e) => e.date >= today && !mine.has(e.slug) && keep(e));
  const others = mix([...events.filter((e) => e.date >= today && keep(e)), ...guest, ...discover.filter((e) => !mine.has(e.slug) && !guest.some((g) => g.slug === e.slug) && keep(e))]);
  $("#empty").classList.toggle("hidden", shown.length > 0 || others.length > 0 || !$("#feed-wrap").classList.contains("hidden"));
  $("#empty-text").innerHTML = events.length
    ? "Aucun événement dans cette catégorie."
    : "Vous n'avez pas encore d'événement.<br>Créez le premier en quelques minutes !";
  $("#list").innerHTML = camReminder() + shown.map(card).join("") + (others.length
    ? `<div class="section-title"><h2>Événements à venir</h2><a href="/decouvrir" class="see-all">Voir tout</a></div>
       ${((up) => `${upFeatured(up[0])}<div class="up-list">${mixFeed(up.slice(1).map(upRow), new Set(up.map((e) => e.slug)))}</div>`)([...others].sort((a, b) => `${a.date}${a.time || ""}`.localeCompare(`${b.date}${b.time || ""}`)))}`
    : "");
  syncFavs();
}

// Événement masqué (privé / sur invitation) : on affiche son type (« Mariage ») plutôt qu'« Événement privé ».
const MASKED = new Set(["Événement privé", "Événement sur invitation"]);
const isMasked = (ev) => MASKED.has(ev.name);
const evTitle = (ev) => (isMasked(ev) ? ev.host || t((EVENT_TYPES[ev.type] || EVENT_TYPES.autre || { label: ev.name }).label) : ev.name);

// Onglet « Tout » : publications du fil (photos, messages, nouveaux événements) glissées entre les événements (1 tous les 2).
let feedMod = null;
function mixFeed(rows, listed = new Set()) {
  if (filter !== "all") return rows.join("");
  if (!feedMod) { import("./fil.js").then((m) => m.feedLoaded.then(() => { if (!feedMod) { feedMod = m; render(); } })).catch(() => {}); return rows.join(""); }
  // Pas deux fois le même événement (déjà dans la liste).
  const posts = feedMod.items.map((it, i) => [it, i]).filter(([it]) => it.kind !== "event" || !listed.has(it.event?.slug)).map(([it, i]) => feedMod.post(it, i));
  const out = [];
  rows.forEach((r, k) => { out.push(r); if (k % 2 === 1 && posts.length) out.push(posts.shift()); });
  return out.concat(posts).join("");
}

// « Événements à venir » : le prochain en grande carte, puis une liste façon agenda.
const upHref = (ev) => (!ev.slug ? "#" : ev.date === new Date().toISOString().slice(0, 10) ? `/live?e=${encodeURIComponent(ev.slug)}` : `/e/${esc(ev.slug)}`);
const upLock = (ev) => (ev.visibility === "private" ? " 🔒" : ev.visibility === "unlisted" || !ev.slug ? " 🔗" : "");
const upDate = (ev) => { const d = new Date(`${ev.date}T12:00`); return { day: d.getDate(), mon: d.toLocaleDateString(LOCALE, { month: "short" }).replace(".", "") }; };
const upWhere = (ev) => { const ty = EVENT_TYPES[ev.type] || EVENT_TYPES.autre || { icon: "🎉", label: "" }; if (isMasked(ev)) return `${ty.icon} ${ev.host ? `${esc(t(ty.label))} · ` : ""}${esc(t(ev.visibility === "private" ? "Privé" : "Sur invitation"))}`;
  return `${ty.icon} ${esc(ev.slug && ev.location ? ev.location : t(ty.label))}`; };
const upFav = (ev) => (ev.slug ? `<button type="button" class="card-fav" data-fav="${esc(ev.slug)}" aria-label="Ajouter aux favoris">♡</button>` : "");
function upFeatured(ev) {
  const { day, mon } = upDate(ev);
  return `<a class="up-feat" href="${upHref(ev)}" ${ev.slug ? "" : "data-invite-only"} ${liveAttrs(ev)}>
    <span class="up-cal"><b>${day}</b><small>${esc(mon)}</small></span>${upFav(ev)}
    <div class="up-feat-txt"><span class="up-count">${esc(dayBadge(ev.date))}${upLock(ev)}</span><h3>${esc(evTitle(ev))}</h3><p>${upWhere(ev)}</p></div>
  </a>`;
}
function upRow(ev) {
  const { day, mon } = upDate(ev);
  return `<a class="up-row" href="${upHref(ev)}" ${ev.slug ? "" : "data-invite-only"}>
    <span class="up-thumb" ${liveAttrs(ev)}></span>
    <span class="up-cal sm"><b>${day}</b><small>${esc(mon)}</small></span>
    <span class="up-info"><b>${esc(evTitle(ev))}</b><small>${upWhere(ev)}</small><em>${esc(dayBadge(ev.date))}${upLock(ev)}</em></span>${upFav(ev)}
  </a>`;
}

document.querySelector(".segments").addEventListener("click", (e) => {
  if (!e.target.dataset.filter) return;
  const feed = e.target.dataset.filter === "feed";
  document.querySelectorAll(".segments button").forEach((b) => b.classList.toggle("active", b === e.target));
  // Fil : onglet de l'accueil (chargé une seule fois), sans changer de page.
  $("#feed-wrap").classList.toggle("hidden", !feed);
  $("#list").classList.toggle("hidden", feed);
  if (feed) { $("#empty").classList.add("hidden"); import("./fil.js"); return; }
  filter = e.target.dataset.filter;
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

// Affichage instantané : la dernière version vue sur ce téléphone, puis mise à jour dès que le serveur répond.
const DASH_KEY = "em-dash";
try {
  const saved = JSON.parse(localStorage.getItem(DASH_KEY) || "null");
  if (saved?.events) { ({ events, discover, stories, joined, myId } = saved); render(); }
  else {
    $("#stories").innerHTML = '<div class="story skel"></div>'.repeat(5);
    $("#list").innerHTML = '<div class="skel skel-card"></div>'.repeat(2);
  }
} catch { /* stockage indisponible */ }

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

// « + Créer » des stories : même choix que le + du menu (story ou événement).
document.addEventListener("click", (e) => { if (e.target.closest("[data-create]")) createSheet(e); });

// Tuto de bienvenue : affiché à chaque connexion (marqueur « em-tuto » posé par le serveur, effacé ici).
(async () => {
  if (!/(^|; )em-tuto=1/.test(document.cookie)) return;
  document.cookie = "em-tuto=; path=/; max-age=0";
  if (document.getElementById("guide")) return; // jamais deux guides superposés
  document.body.insertAdjacentHTML("beforeend", `<div class="sheet" id="guide" role="dialog" aria-modal="true"><div class="card guide-card">
    <h2>Bienvenue sur MaFeliza 👋</h2>
    <ol class="guide-steps">
      <li><b>✨ Créez votre événement</b><span>Touchez le bouton rose « ➕ Créer » en haut de l'accueil : nom, date, lieu. Le faire-part se crée tout seul.</span></li>
      <li><b>💌 Partagez-le</b><span>Envoyez le lien à vos proches par WhatsApp, SMS ou email. Plus vous le partagez, plus il y a de monde au rendez-vous !</span></li>
      <li><b>🎁 Ajoutez une cagnotte</b><span>Vos proches, même éloignés, offrent un cadeau en un clic. Plus elle est partagée, plus elle grandit 😄</span></li>
      <li><b>🔴 Le jour J, lancez le live</b><span>Ouvrez votre événement et touchez « Lancer le live » : vos proches vous regardent en direct.</span></li>
    </ol>
    <button class="btn btn-block btn-big" id="guide-ok">C'est parti !</button>
  </div></div>`);
  // Fermeture : bouton « C'est parti ! » ou toucher en dehors de la carte.
  const guide = document.getElementById("guide");
  guide.addEventListener("click", (e) => { if (e.target === guide || e.target.closest("#guide-ok")) guide.remove(); });
})();
