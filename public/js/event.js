// Page publique d'un événement : faire-part, compte à rebours, stories, réponses, livre d'or, cagnotte.
import { api, $, esc, copy, shareSheet, formatDate, eventUrl, viewPhoto, pickAndUploadPhoto, contentMenu, isHidden, isVideo, liveState, EVENT_TYPES, openStories, toast, guestName, LOCALE, placeholderCover, tabbar, createSheet } from "./common.js";
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
    // Événement supprimé ou lien erroné : on renvoie vers le site plutôt que de laisser une page vide.
    if (err.status === 404) return location.replace(`/introuvable`);
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
    .toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" })
    .replace(/^(\d+) (\p{L})/u, (m, d, l) => `${d} ${l.toUpperCase()}`);
  $("#lock").textContent = { private: "🔒 Privé", unlisted: "🔗 Non répertorié" }[ev.visibility] || "🔓 Public";
  renderStories(ev);
  initFavorite(ev);
  welcome(ev);
  initGuestbook(ev);

  $("#when").textContent = formatDate(ev.date, ev.time);
  $("#where").textContent = ev.location;
  $("#map").href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`;
  // Ajouter au calendrier : fichier .ics (iPhone, Android, Outlook) ou Google Agenda.
  $("#cal-ics").href = `/api/public/${encodeURIComponent(ev.slug)}/calendar.ics`;
  const d = ev.date.replace(/-/g, ""), t = (ev.time || "12:00").replace(":", "");
  const endH = String(Math.min(23, Number(t.slice(0, 2)) + 5)).padStart(2, "0");
  $("#cal-google").href = `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE", text: ev.name, dates: `${d}T${t}00/${d}T${endH}${t.slice(2)}00`, location: ev.location, details: location.href.split("?")[0],
  })}`;
  initRsvp(ev);
  // Programme de la journée et infos pratiques.
  const steps = ev.program?.steps || [];
  if (steps.length || ev.program?.practical) {
    $("#program-card").classList.remove("hidden");
    $("#timeline").innerHTML = steps.map((st) => `<li><time>${esc(st.time ? st.time.replace(":", "h") : "")}</time><span>${esc(st.label)}</span></li>`).join("");
    if (ev.program.practical) { $("#practical").textContent = ev.program.practical; $("#practical-box").classList.remove("hidden"); }
  }
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
    const pot = ev.pot;
    if (pot && (pot.raised || pot.goal)) {
      const eur = (n) => n.toLocaleString(LOCALE) + " €";
      const pct = pot.goal ? Math.min(100, Math.round((pot.raised / pot.goal) * 100)) : 0;
      $("#pot-box").innerHTML = `<div class="pot-head"><span>🎁 Cagnotte</span><b>${eur(pot.raised)}</b></div>`
        + (pot.goal ? `<div class="pot-bar"><i style="width:${pct}%"></i></div><div class="pot-sub">${pct} % de l'objectif de ${eur(pot.goal)}</div>` : `<div class="pot-sub">déjà collectés</div>`);
      $("#pot-box").classList.remove("hidden");
    }
  }

  // Premium : page sans marque MaFeliza.
  if (ev.premium) document.querySelector(".invite-hero-heart")?.remove();
  renderInvite($("#invite"), ev, ev.invite, ev.inviteStyle, invitePhotoUrl(ev.invite, ev.cover));
  $("#invite").append($("#invite-extra")); // compte à rebours et mention du live dans la carte du faire-part
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
      .map(() => `<div class="story-circle teaser"><div style="background-image:url('${placeholderCover(ev.type)}')">🔒</div></div>`).join("");
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
      : `<p class="muted small" style="margin:0">Aucune story pour l'instant.${ev.isOwner ? " Partagez la première !" : ""}</p>`;
    $("#stories-row").onclick = (e) => {
      const who = e.target.closest("[data-who]")?.dataset.who;
      if (!who) return;
      const ordered = [...stories.filter((p) => p.name === who), ...stories.filter((p) => p.name !== who)];
      openStories(ordered, { onDelete: ev.isOwner ? async (p) => { await api(`${base}/photos/${p.id}`, { method: "DELETE" }); load(); } : null });
    };
  };
  // Stories : seul le créateur de l'événement peut en publier.
  $("#add-story").classList.toggle("hidden", !ev.isOwner);
  if (ev.isOwner) $("#add-story").onclick = () => pickAndUploadPhoto(ev.slug, { story: true }).then(() => { toast("Story publiée pour 24 h ✨"); load(); }, () => {});
  load();
}

// Invité connecté : menu du bas + carte qui donne envie de découvrir le reste du site.
function welcome(ev) {
  if (!ev.loggedIn) { $("#promo").classList.remove("hidden"); return; } // visiteur : on présente MaFeliza
  $("#brand-link").href = "/dashboard";
  $("#brand-cta").classList.add("hidden");
  tabbar("");
  $("#back").remove(); // le bouton retour est dans la barre du haut
  if (ev.isOwner) return;
  $("#welcome").innerHTML = `
    <h2>👋 Bienvenue sur MaFeliza !</h2>
    <p class="muted small">Suivez cet événement, puis découvrez ceux de vos proches ou créez le vôtre : faire-part, live, photos et souvenirs au même endroit.</p>
    <div class="welcome-actions">
      <a class="btn" href="/edit" id="welcome-create">✨ Créer mon événement</a>
      <a class="btn btn-light" href="/decouvrir">🔎 Découvrir</a>
      <a class="btn btn-light" href="/amis">👥 Mes amis</a>
    </div>`;
  $("#welcome").classList.remove("hidden");
  $("#welcome-create").addEventListener("click", createSheet);
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

// Réponse à l'invitation : je viens / peut-être / je ne viens pas (+ nombre de personnes).
async function initRsvp(ev) {
  const base = `/api/public/${encodeURIComponent(ev.slug)}/rsvp`;
  const LABEL = { yes: "✅ Vient", maybe: "🤔 Peut-être", no: "❌ Ne vient pas" };
  const paint = (r) => {
    const mine = r.mine?.status;
    document.querySelectorAll("[data-rsvp]").forEach((b) => b.classList.toggle("active", b.dataset.rsvp === mine));
    $("#rsvp-count-wrap").classList.toggle("hidden", !mine || mine === "no");
    if (r.mine?.count) $("#rsvp-count").value = r.mine.count;
    $("#rsvp-summary").textContent = r.yes || r.maybe
      ? `${r.yes} personne${r.yes > 1 ? "s" : ""} ${r.yes > 1 ? "viennent" : "vient"}${r.maybe ? ` · ${r.maybe} peut-être` : ""}`
      : "Soyez le premier à répondre !";
    $("#rsvp-list").innerHTML = r.list?.length
      ? `<p class="tools-title">Réponses (visibles par vous seul)</p>` + r.list.map((x) => `<div class="inv-row"><span>${esc(x.name)}${x.count > 1 ? ` (+${x.count - 1})` : ""}</span><b>${LABEL[x.status]}</b></div>`).join("")
      : "";
  };
  const load = () => api(base).then(paint).catch(() => {});
  const send = async (status) => {
    try {
      const name = await guestName();
      await api(base, { method: "POST", body: { status, name, count: Number($("#rsvp-count").value) || 1 } });
      toast(status === "yes" ? "Super, à bientôt ! 🎉" : status === "maybe" ? "Réponse enregistrée" : "Dommage ! Réponse enregistrée");
      load();
    } catch (err) { toast(err.message); }
  };
  $("#rsvp").addEventListener("click", (e) => { if (e.target.dataset.rsvp) send(e.target.dataset.rsvp); });
  $("#rsvp-count").addEventListener("change", () => { const a = document.querySelector("[data-rsvp].active"); if (a) send(a.dataset.rsvp); });
  load();
}
