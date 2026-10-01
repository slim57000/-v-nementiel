import { api, $, esc, toast, tabbar, goLogin, resizeImage, publicCard, viewPhoto, enablePush, pushState } from "./common.js";
import { lang, setLang, themePref, setTheme } from "./i18n.js";

tabbar("profile");

// Apparence (automatique / clair / sombre) et langue.
function paintPrefs() {
  document.querySelectorAll("[data-theme-pref]").forEach((b) => b.classList.toggle("active", b.dataset.themePref === themePref()));
  document.querySelectorAll("[data-lang]").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
}
$("#theme").addEventListener("click", (e) => { if (e.target.dataset.themePref) { setTheme(e.target.dataset.themePref); paintPrefs(); } });
$("#lang").addEventListener("click", (e) => { if (e.target.dataset.lang && e.target.dataset.lang !== lang) setLang(e.target.dataset.lang); });
paintPrefs();

function paintAvatar(p) {
  const el = $("#avatar");
  el.style.backgroundImage = p.avatar ? `url("${p.avatar}")` : "";
  el.textContent = p.avatar ? "" : (p.name || "?").charAt(0).toUpperCase();
}

let me;
try {
  const [auth, profile] = await Promise.all([api("/api/auth/me"), api("/api/me")]);
  me = { ...profile, code: auth.code };
  $("#name").textContent = me.name;
  $("#email").textContent = me.email;
  if (auth.hasPassword) { $("#pw-current").classList.remove("hidden"); $("#pw-hint").textContent = "Pour changer votre mot de passe, saisissez l'actuel puis le nouveau."; }
  $("#st-events").textContent = me.stats.events;
  $("#st-part").textContent = me.stats.participations;
  $("#st-friends").textContent = me.stats.friends;
  $("#admin-link").classList.toggle("hidden", !auth.isAdmin);
  if (auth.premium) $("#email").insertAdjacentHTML("afterend", '<span class="badge" style="margin-top:6px">✨ Premium</span>');
  paintAvatar(me);
  showTab("favorites");
  showFriends();
} catch (err) {
  // Seule une session absente renvoie vers la connexion (sinon boucle connexion ⇄ profil).
  if (err.status === 401) goLogin();
  else toast("Profil momentanément indisponible, réessayez plus tard.");
}

$("#edit-name").addEventListener("click", async () => {
  const name = prompt("Votre nom (affiché à vos amis) :", me.displayName || me.name);
  if (name === null) return;
  try {
    const p = await api("/api/me/profile", { method: "PUT", body: { displayName: name } });
    me = { ...me, ...p, displayName: name };
    $("#name").textContent = p.name;
    paintAvatar(me);
    toast("Nom enregistré");
  } catch (err) { toast(err.message); }
});

$("#avatar-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const p = await api("/api/me/profile", { method: "PUT", body: { avatar: await resizeImage(file, 400) } });
    me = { ...me, ...p };
    paintAvatar(me);
    toast("Photo de profil mise à jour");
  } catch (err) { toast(err.message); }
});

// Favoris, participations et « mes cadeaux » (cagnottes des événements suivis).
async function showTab(tab) {
  document.querySelectorAll("#p-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const list = $("#p-list");
  if (tab === "gifts") {
    const events = [...await api("/api/me/history"), ...await api("/api/me/favorites")]
      .filter((e, i, arr) => e.cagnotteUrl && arr.findIndex((x) => x.id === e.id) === i);
    list.innerHTML = events.length ? events.map((e) => `
      <a class="friend-row" href="${esc(e.cagnotteUrl)}" target="_blank" rel="noopener">
        <span class="avatar">🎁</span><span class="friend-main"><b>${esc(e.name)}</b><span class="muted small">Participer à la cagnotte</span></span>›</a>`).join("")
      : '<p class="muted small" style="text-align:center">Les cagnottes des événements que vous suivez apparaîtront ici.</p>';
    return;
  }
  if (tab === "videos") {
    videos = await api("/api/me/videos");
    list.innerHTML = videos.length ? `<div class="p-grid">${videos.map((v, i) => `
      <button class="video-tile" data-video="${i}" aria-label="Vidéo de ${esc(v.name)}">
        <video src="${esc(v.url)}#t=0.1" muted playsinline preload="metadata"></video>
        <span class="play">▶</span><span class="cap"><b>${esc(v.name)}</b>${esc(v.event)}</span></button>`).join("")}</div>`
      : '<p class="muted small" style="text-align:center">Les vidéos partagées dans vos événements apparaîtront ici.</p>';
    return;
  }
  const events = await api(`/api/me/${tab}`);
  list.innerHTML = events.length ? `<div class="p-grid">${events.map(publicCard).join("")}</div>`
    : `<p class="muted small" style="text-align:center">${tab === "favorites" ? "Ajoutez des événements en favoris avec le ♡ sur leur page." : "Les événements auxquels vous participez apparaîtront ici."}</p>`;
}
$("#p-tabs").addEventListener("click", (e) => { if (e.target.dataset.tab) showTab(e.target.dataset.tab); });
// Case « Participations » : ouvre l'onglet correspondant et y descend.
$("#st-part-link").addEventListener("click", (e) => { e.preventDefault(); showTab("history"); $("#p-tabs").scrollIntoView({ behavior: "smooth", block: "start" }); });
let videos = [];
$("#p-list").addEventListener("click", (e) => {
  const tile = e.target.closest("[data-video]");
  if (tile) viewPhoto(videos[tile.dataset.video]);
});

$("#logout").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  location.replace("/");
});

$("#delete-account").addEventListener("click", async () => {
  const answer = prompt("Cette action est définitive. Tapez SUPPRIMER pour confirmer.");
  if (answer?.trim().toUpperCase() !== "SUPPRIMER") return;
  try {
    await api("/api/auth/me", { method: "DELETE" });
    location.replace("/?compte-supprime");
  } catch (err) {
    alert(err.message);
  }
});

// Notifications push de cet appareil.
const paintPush = () => { if (pushState() === "granted") { $("#push-btn").textContent = "🔔 Notifications activées ✔"; } };
paintPush();
$("#push-btn").addEventListener("click", async () => {
  try { await enablePush(); paintPush(); toast("Notifications activées 🔔"); } catch (err) { toast(err.message); }
});

// Définir / changer le mot de passe.
$("#pw-save").addEventListener("click", async () => {
  try {
    await api("/api/auth/password", { method: "POST", body: { current: $("#pw-current").value, password: $("#pw-new").value } });
    $("#pw-current").value = $("#pw-new").value = "";
    $("#pw-current").classList.remove("hidden");
    toast("Mot de passe enregistré 🔒");
  } catch (err) { toast(err.message); }
});

// 👥 Mes amis : avatars cliquables (ouvrent la conversation), ou invitation à en ajouter.
async function showFriends() {
  const friends = await api("/api/me/friends").catch(() => []);
  $("#friends-list").innerHTML = friends.length
    ? friends.map((f) => `<a href="/messages?u=${f.id}" class="friend-chip">
        <span class="avatar" ${f.avatar ? `style="background-image:url('${esc(f.avatar)}')"` : ""}>${f.avatar ? "" : esc(f.name.charAt(0).toUpperCase())}</span>
        <span>${esc(f.name)}</span></a>`).join("")
    : '<p class="muted small" style="margin:8px 0 0">Pas encore d\'amis. Touchez « + » et envoyez votre lien à vos proches.</p>';
}
