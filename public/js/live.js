// Page du live : lecteur vidéo, chat, réactions, photos des invités, cagnotte, replay.
import { api, $, esc, shareSheet, toast, guestName, viewPhoto, pickAndUploadPhoto, contentMenu, isHidden, isVideo, liveState, coverOf, onRealtime, embedUrl, thumbnailUrl, openPot } from "./common.js";
import { icon } from "./icons.js";

const slug = new URLSearchParams(location.search).get("e") || "";

let cameras = [];
let isOwner = false;
const base = `/api/public/${encodeURIComponent(slug)}`;
const stage = $("#stage");

// Le lecteur annonce les dimensions réelles de son flux : la scène prend le format du direct,
// ce qui supprime les bandes noires (un téléphone filme en portrait, une scène 16/9 laisse du vide).
addEventListener("message", (e) => {
  if (e.source !== $("#stage iframe")?.contentWindow || e.data?.type !== "mf-size") return;
  const { w, h } = e.data;
  if (w > 0 && h > 0) stage.style.aspectRatio = `${w} / ${h}`;
});

function play(index) {
  const src = embedUrl(cameras[index]?.url);
  const frame = $("#stage iframe");
  frame?.remove();
  // Une caméra « téléphone » a le format de son flux ; sinon on garde la 16/9 classique.
  stage.style.aspectRatio = src?.startsWith("/lk?") ? "" : "16 / 9";
  $("#empty").classList.toggle("hidden", Boolean(src));
  if (src) {
    $("#stage").insertAdjacentHTML("afterbegin",
      `<iframe src="${esc(src)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Direct"></iframe>`);
  }
  document.querySelectorAll(".cam").forEach((b, i) => b.classList.toggle("active", i === index));
}

// Boutons de caméra : pastille « EN DIRECT » sur l'angle réellement diffusé.
function paintCams() {
  $("#cams").innerHTML = cameras.map((c, i) => {
    const thumb = thumbnailUrl(c.url);
    return `<button class="cam ${thumb ? "has-thumb" : ""} ${c.live ? "is-live" : ""}" data-index="${i}" ${thumb ? `style="background-image:url('${esc(thumb)}')"` : ""}>${esc(c.name)}</button>`;
  }).join("");
}

async function load() {
  // Lien d'invitation au live d'un événement privé : « /live?e=slug&code=XXXX ».
  const code = new URLSearchParams(location.search).get("code");
  if (code) {
    await api(`/api/public/${encodeURIComponent(slug)}/unlock`, { method: "POST", body: { code } }).catch(() => {});
    history.replaceState(null, "", `/live?e=${encodeURIComponent(slug)}`);
  }
  let ev;
  try {
    ev = await api(`/api/public/${encodeURIComponent(slug)}`);
  } catch (err) {
    $("#title").textContent = err.message;
    return;
  }
  // Événement privé non déverrouillé : on passe par l'écran du code.
  if (ev.locked) return location.replace(`/e/${encodeURIComponent(slug)}`);

  // Présence MaFeliza : lien vers la page de l'événement, et présentation du site aux visiteurs.
  $("#event-link").href = `/e/${encodeURIComponent(ev.slug || slug)}`;
  if (ev.loggedIn) $("#live-logo").href = "/dashboard";
  else $("#live-promo").classList.remove("hidden");
  document.title = `Live — ${ev.name}`;
  $("#title").textContent = ev.name;
  // Croix : retour à la page précédente du site (accueil, découvrir, tableau de bord…), sinon à l'accueil.
  $("#close").href = "/";
  $("#close").onclick = (e) => {
    if (document.referrer.startsWith(location.origin) && history.length > 1) { e.preventDefault(); history.back(); }
  };
  $("#share").onclick = () => shareSheet({ title: ev.name, text: `📺 Suivez « ${ev.name} » en direct !`, url: location.href });

  if (ev.cagnotteUrl) {
    for (const el of [$("#pot"), $("#pot-btn")]) {
      el.href = ev.cagnotteUrl;
      el.onclick = (e) => { e.preventDefault(); openPot(ev.slug || slug, ev.cagnotteUrl); };
      el.classList.remove("hidden");
    }
  } else {
    $("#reactions").style.gridTemplateColumns = "repeat(5, minmax(0, 1fr))";
    $("#nav-pot").remove();
    document.querySelector(".live-tabs").style.gridTemplateColumns = "repeat(4, 1fr)";
  }

  isOwner = ev.isOwner;
  cameras = ev.cameras;
  // Après l'événement : replay pendant 15 jours, puis plus de lecteur.
  const state = liveState(ev);
  if (state !== "live") {
    $(".live-badge").textContent = "REPLAY";
    $(".live-badge").classList.add("is-replay");
  }
  if (state === "pending") {
    cameras = [];
    $("#empty").innerHTML = '<span style="font-size:2rem">🎞️</span>Le replay n\'est pas disponible pour le moment.';
  }
  if (state === "expired") {
    cameras = [];
    $("#empty").innerHTML = ev.replayDeleted
      ? '<span style="font-size:2rem">🎞️</span>Le replay a été supprimé par l\'organisateur.'
      : '<span style="font-size:2rem">🎞️</span>Le replay n\'est plus disponible.<br><small>Merci d\'avoir partagé ce moment !</small>';
  }
  // Tout le monde (invités compris) : télécharger le replay en .zip. Lien « &zip=1 » de l'email : mis en avant.
  if (state === "replay" && cameras.some((c) => String(c.url).startsWith("lk:"))) {
    const bar = document.createElement("div");
    bar.className = "replay-zip";
    bar.innerHTML = `<button type="button" class="btn btn-block" id="replay-zip">📦 Télécharger le replay (.zip)</button>`;
    document.querySelector(".live-stage").after(bar);
    $("#replay-zip").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "⏳ Préparation du zip…";
      const { exportPublicReplay } = await import("./export.js");
      const ok = await exportPublicReplay(ev, cameras).catch(() => false);
      toast(ok ? "Replay téléchargé ✔" : "Replay indisponible pour le moment");
      btn.disabled = false;
      btn.textContent = "📦 Télécharger le replay (.zip)";
    });
    if (new URLSearchParams(location.search).get("zip")) bar.scrollIntoView({ block: "center" });
  }
  // Organisateur : mettre le replay en ligne (ou le retirer) et le supprimer.
  if (isOwner && state === "replay" && cameras.length) {
    document.querySelector(".live-stage").insertAdjacentHTML("afterend", `<div class="replay-bar">
      <span>${ev.replayOnline ? "🌍 Replay <b>en ligne</b> : vos invités peuvent le voir." : "🔒 Replay <b>retiré</b> : vous seul le voyez."}</span>
      <button type="button" class="btn btn-sm" id="replay-pub">${ev.replayOnline ? "🙈 Retirer" : "🌍 Mettre en ligne"}</button>
      ${ev.replayOnline ? '<button type="button" class="btn btn-sm btn-light" id="replay-mail">📧 Envoyer aux invités</button>' : ""}</div>`);
    $("#replay-mail")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      if (!confirm("Envoyer maintenant le lien du replay par email à vos invités (et à vous) ?")) return;
      btn.disabled = true;
      try {
        const r = await api(`/api/events/${ev.id}/replay/send`, { method: "POST" });
        toast(r.sent ? `📧 Replay envoyé à ${r.sent} adresse(s) ✔` : "Aucune adresse à qui l'envoyer (ajoutez des invités par email).");
      } catch (err) { toast(err.message); }
      btn.disabled = false;
    });
    $("#replay-pub").addEventListener("click", async () => {
      try {
        const r = await api(`/api/events/${ev.id}/replay`, { method: "PATCH", body: { online: !ev.replayOnline } });
        toast(r.online ? "Replay remis en ligne ✓" : "Replay retiré : vous seul le voyez");
        setTimeout(() => location.reload(), 1200);
      } catch (err) { toast(err.message); }
    });
    $("#stage").insertAdjacentHTML("beforeend", '<button type="button" class="replay-del" id="replay-del">🗑️ Supprimer le replay</button>');
    $("#replay-del").addEventListener("click", async () => {
      if (!confirm("Supprimer définitivement le replay ? Une copie (.zip) va d'abord être téléchargée sur votre appareil.")) return;
      const btn = $("#replay-del");
      btn.disabled = true;
      btn.textContent = "⏳ Préparation du zip…";
      // Copie du replay en .zip avant suppression ; si elle échoue, on ne supprime pas.
      const { exportReplay } = await import("./export.js");
      const saved = await exportReplay(ev).catch(() => false);
      if (!saved && !confirm("Impossible de préparer le zip du replay. Supprimer quand même ?")) { btn.disabled = false; btn.textContent = "🗑️ Supprimer le replay"; return; }
      try { await new Promise((r) => setTimeout(r, 1500)); await api(`/api/events/${ev.id}/replay`, { method: "DELETE" }); toast("Replay supprimé"); setTimeout(() => location.reload(), 700); }
      catch (err) { toast(err.message); }
    });
  }
  paintCams();
  // Fond du lecteur avant le direct : couverture de l'événement, sinon visuel de salle.
  // Photo du faire-part en attente du direct (voile sombre en thème clair seulement, cf. live.css).
  stage.style.setProperty("--cover", `url("${coverOf(ev)}")`);
  stage.classList.add("has-cover");
  $("#cams-section").classList.toggle("hidden", cameras.length < 2);
  // On ouvre sur l'angle réellement en direct (le caméraman n'est pas forcément le premier de la liste).
  play(Math.max(0, cameras.findIndex((c) => c.live)));
  // Badge : « LIVE » seulement quand un téléphone diffuse vraiment ; sinon « BIENTÔT » + heure prévue + agenda.
  const paintBadge = () => {
    if (state !== "live") return;
    const on = cameras.some((c) => c.live || !String(c.url).startsWith("lk:"));
    $(".live-badge").textContent = on ? "LIVE" : "BIENTÔT";
    $(".live-badge").classList.toggle("is-soon", !on);
    if (!on && !cameras.length) {
      $("#empty").innerHTML = `<span style="font-size:2rem">📡</span>Le direct n'a pas encore commencé.
        ${ev.time ? `<small>Début prévu à ${esc(ev.time.replace(":", "h"))}</small>` : ""}
        <a class="btn btn-sm" href="/api/public/${encodeURIComponent(ev.slug)}/calendar.ics" style="margin-top:10px">📅 Ajouter à mon agenda</a>`;
    }
  };
  paintBadge();
  // Un caméraman peut démarrer plus tard : on rafraîchit les pastilles sans changer l'angle choisi.
  setInterval(async () => {
    try {
      const fresh = (await api(`/api/public/${encodeURIComponent(slug)}`)).cameras || [];
      if (fresh.length !== cameras.length) return location.reload();
      cameras.forEach((c, i) => { c.live = Boolean(fresh[i]?.live); });
      paintBadge();
      const watching = Number(document.querySelector(".cam.active")?.dataset.index ?? -1);
      paintCams();
      if (watching >= 0) document.querySelectorAll(".cam")[watching]?.classList.add("active");
    } catch { /* réseau : on réessaie */ }
  }, 45000);
  // ✕ : retour à la page précédente du site, sinon accueil du compte (connecté) ou page de l'événement.
  $("#close").href = ev.loggedIn ? "/dashboard" : `/e/${encodeURIComponent(ev.slug)}`;
  $("#close").addEventListener("click", (e) => {
    if (document.referrer.startsWith(location.origin) && history.length > 1) { e.preventDefault(); history.back(); }
  });
  heartbeat();
  poll();
  loadPhotos();
  setInterval(loadPhotos, 20000);
}

$("#cams").addEventListener("click", (e) => {
  const btn = e.target.closest(".cam");
  if (btn) play(Number(btn.dataset.index));
});

// --- Plein écran : bouton ⛶ et tap sur le direct ---
// Deux niveaux : le plein écran système quand le navigateur l'autorise (bureau), sinon un mode
// immersif en CSS qui fonctionne partout, y compris sur iOS où un <div> ne peut pas passer plein écran.
function setImmersive(on) {
  document.body.classList.toggle("live-immersive", on);
  $("#fs").textContent = on ? "✕" : "⛶";
  $("#fs").setAttribute("aria-label", on ? "Quitter le plein écran" : "Plein écran");
}
$("#fs").addEventListener("click", () => {
  const on = !document.body.classList.contains("live-immersive");
  if (on) stage.requestFullscreen?.().catch(() => {}); // refusé (iOS, iframe) : le mode immersif prend le relais
  setImmersive(on);
});
// Bouton ✕ du plein écran (créé ici s'il manque à la page, par exemple une ancienne version encore en mémoire).
if (!$("#fs-exit")) stage.insertAdjacentHTML("beforeend", '<button type="button" class="fs-exit" id="fs-exit" aria-label="Quitter le plein écran">✕</button>');
$("#fs-exit").addEventListener("click", (e) => {
  e.stopPropagation();
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  setImmersive(false);
});
stage.addEventListener("click", (e) => {
  if (e.target.closest("a, button")) return; // cagnotte : le lien reste prioritaire
  setImmersive(!document.body.classList.contains("live-immersive"));
});
// Échap (clavier Android) ou sortie du plein écran système : on rend la page.
for (const type of ["fullscreenchange", "webkitfullscreenchange"]) document.addEventListener(type, () => { if (!document.fullscreenElement) setImmersive(false); });

// --- Spectateurs : signal de présence toutes les 15 s ---
let clientId;
try { clientId = sessionStorage.getItem("em-cid"); } catch { /* ignoré */ }
if (!clientId) {
  clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { sessionStorage.setItem("em-cid", clientId); } catch { /* ignoré */ }
}
const formatCount = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",").replace(",0", "")}K` : String(n));

async function heartbeat() {
  if (!document.hidden) {
    try {
      const { viewers } = await api(`${base}/presence`, { method: "POST", body: { clientId } });
      $("#viewers").innerHTML = `${icon("eye", 16)} ${formatCount(viewers)}`;
      $("#viewers").classList.remove("hidden");
    } catch { /* réseau : on réessaie */ }
  }
  setTimeout(heartbeat, 15000);
}

// --- Chat et réactions : interrogation du serveur toutes les 3 s ---
let lastId = 0;
let firstLoad = true;
const mine = new Set(); // ids de nos propres envois (déjà affichés / animés)

function floatEmoji(emoji) {
  const el = document.createElement("span");
  el.textContent = emoji;
  el.style.setProperty("--dx", `${Math.round(Math.random() * 40 - 20)}px`);
  $("#floaters").append(el);
  setTimeout(() => el.remove(), 2500);
}

const shown = new Set(); // messages déjà affichés (évite les doublons envoi / interrogation)

const messages = new Map(); // id → message (pour le menu ⋯)

function addChat(m) {
  if (shown.has(m.id) || isHidden(m.author)) return;
  shown.add(m.id);
  messages.set(m.id, m);
  const list = $("#chat-list");
  list.querySelector(".chat-empty")?.remove();
  list.insertAdjacentHTML("beforeend",
    `<div class="chat-msg" data-id="${m.id}"><i>${esc(m.name.charAt(0).toUpperCase())}</i><div><b>${esc(m.name)}</b>${esc(m.text)}</div><button class="more-btn" data-more aria-label="Plus d'actions">⋯</button></div>`);
  while (list.children.length > 50) list.firstElementChild.remove();
  list.scrollTop = list.scrollHeight;
}

function handle(items) {
  for (const m of items) {
    lastId = Math.max(lastId, m.id);
    if (mine.has(m.id)) continue;
    if (m.kind === "chat") addChat(m);
    else if (!firstLoad && !isHidden(m.author)) floatEmoji(m.text);
  }
  firstLoad = false;
}

// Chat : instantané via le temps réel si disponible (rafraîchissement de secours toutes les 15 s), sinon toutes les 3 s.
let pollDelay = 3000;
const fetchFeed = async () => { try { handle(await api(`${base}/feed?after=${lastId}`)); } catch { /* réseau : on réessaie */ } };
onRealtime(`ev-${slug}`, fetchFeed).then((on) => { if (on) pollDelay = 15000; });
async function poll() {
  if (!document.hidden) await fetchFeed();
  setTimeout(poll, pollDelay);
}

$("#reactions").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-emoji]");
  if (!btn) return;
  const emoji = btn.dataset.emoji;
  floatEmoji(emoji);
  let name = "Invité";
  try { name = localStorage.getItem("em-name") || name; } catch { /* ignoré */ }
  api(`${base}/reactions`, { method: "POST", body: { emoji, name } })
    .then((m) => mine.add(m.id), (err) => toast(err.message));
});


// Menu ⋯ d'un message : signaler, masquer ; organisateur : supprimer, bloquer.
$("#chat-list").addEventListener("click", (e) => {
  if (!e.target.matches("[data-more]")) return;
  const el = e.target.closest("[data-id]");
  const m = messages.get(Number(el.dataset.id));
  contentMenu({
    slug, kind: "message", item: m, isOwner,
    onDelete: () => api(`${base}/messages/${m.id}`, { method: "DELETE" }),
    onChange: () => {
      document.querySelectorAll(".chat-msg").forEach((node) => {
        const msg = messages.get(Number(node.dataset.id));
        if (!msg || msg === m || isHidden(msg.author)) node.remove();
      });
    },
  });
});

// Envoi : un seul message à la fois, puis 1 s de pause (évite les doublons par double appui).
let sendingChat = false;
$("#chat").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("#chat-text").value.trim();
  if (!text || sendingChat) return;
  sendingChat = true;
  const name = await guestName();
  $("#chat-text").value = "";
  try {
    addChat(await api(`${base}/messages`, { method: "POST", body: { name, text } }));
  } catch (err) {
    $("#chat-text").value = text;
    toast(err.message);
  }
  setTimeout(() => { sendingChat = false; }, 1000);
});

// --- Photos des invités ---
let photos = [];

async function loadPhotos() {
  try { photos = (await api(`${base}/photos`)).filter((p) => !isHidden(p.author)); } catch { return; }
  $("#photo-count").textContent = photos.length ? ` ${photos.length}` : "";
  const thumbs = photos.slice(0, 4).map((p, i) => (isVideo(p.url)
    ? `<div class="vid" data-i="${i}"><video src="${esc(p.url)}#t=0.1" muted playsinline preload="metadata"></video></div>`
    : `<img src="${esc(p.url)}" alt="Photo de ${esc(p.name)}" data-i="${i}" loading="lazy">`));
  while (thumbs.length < 4) thumbs.push('<div class="ph"></div>');
  $("#photo-strip").innerHTML = `${thumbs.join("")}<button id="add-photo" aria-label="Ajouter une photo">+</button>`;
}

$("#photo-strip").addEventListener("click", async (e) => {
  if (e.target.id === "add-photo") {
    await pickAndUploadPhoto(slug).catch(() => null);
    return loadPhotos();
  }
  const photo = photos[e.target.closest("[data-i]")?.dataset.i];
  if (!photo) return;
  const remove = async () => { await api(`${base}/photos/${photo.id}`, { method: "DELETE" }); loadPhotos(); };
  viewPhoto(photo, isOwner ? remove : null,
    () => contentMenu({ slug, kind: "photo", item: photo, isOwner, onDelete: remove, onChange: loadPhotos }));
});

// Barre d'onglets du bas : accès rapide aux sections de la page.
document.querySelectorAll("[data-nav-icon]").forEach((el) => { el.insertAdjacentHTML("afterbegin", icon(el.dataset.navIcon)); });

load();

// Barre du bas : chaque onglet agit (et pas seulement un saut d'ancre).
document.querySelector(".live-tabs").addEventListener("click", (e) => {
  const tab = e.target.closest("a");
  if (!tab) return;
  e.preventDefault();
  document.querySelectorAll(".live-tabs a").forEach((a) => a.classList.toggle("active", a === tab));
  const go = (el) => el.scrollIntoView({ behavior: "smooth", block: "center" });
  const target = tab.getAttribute("href");
  if (target === "#chat-list") { go($("#chat")); $("#chat-text").focus({ preventScroll: true }); }
  else if (target === "#reactions") { go($("#reactions")); $("#reactions").animate([{ transform: "scale(1)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }], 400); }
  else if (target === "#pot-btn") openPot(slug, $("#pot-btn").href);
  else if (target === "#photo-strip") { go($("#photo-strip")); if (!photos.length) $("#add-photo").click(); }
  else if (target === "#cams-section") {
    if ($("#cams-section").classList.contains("hidden")) toast(cameras.length ? "Une seule caméra pour ce direct 🎥" : "Aucune caméra pour le moment");
    else go($("#cams-section"));
  }
});
