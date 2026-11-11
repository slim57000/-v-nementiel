// 👤 Profil public d'un membre : photo, nom, abonnés / abonnements, bouton Suivre, ses réels et ses événements publics.
import { api, $, esc, toast, tabbar, goLogin, publicCard, shareSheet } from "./common.js";
import { t } from "./i18n.js";
import { icon } from "./icons.js";

tabbar("");
const id = Number(new URLSearchParams(location.search).get("id"));
let p;
try { p = await api(`/api/public/u/${id}`); }
catch (err) { $("#up-head").innerHTML = `<p class="muted">${esc(err.message)}</p>`; throw err; }
document.title = `${p.name} — MaFeliza`;
const n = (x) => new Intl.NumberFormat().format(x);
const head = () => {
  $("#up-head").innerHTML = `
    <div class="up-av">${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : `<span>${esc((p.name || "?")[0].toUpperCase())}</span>`}</div>
    <h1>${esc(p.name)}</h1>
    ${p.bio ? `<p class="up-bio">${esc(p.bio)}</p>` : ""}
    <div class="up-stats">
      <div><b>${n(p.reels.length)}</b><small>${t("Réels")}</small></div>
      <div><b id="up-fol">${n(p.followers)}</b><small>${t("Abonnés")}</small></div>
      <div><b>${n(p.following)}</b><small>${t("Abonnements")}</small></div>
    </div>
    <div class="up-actions">
      ${p.isMe ? `<a class="btn btn-light" href="/profil">${t("Modifier mon profil")}</a>`
        : `<button class="btn ${p.isFollowing ? "btn-light" : ""}" id="up-follow">${t(p.isFollowing ? "Abonné ✓" : "Suivre")}</button>`}
      <button class="btn btn-light up-share" id="up-share" aria-label="${esc(t("Partager"))}">${icon("share", 20)}</button>
    </div>`;
  $("#up-follow")?.addEventListener("click", follow);
  $("#up-share").onclick = () => shareSheet({ title: p.name, text: `${p.name} — MaFeliza`, url: location.href });
};
async function follow() {
  const btn = $("#up-follow");
  btn.disabled = true;
  try {
    const r = await api(`/api/me/follow/${id}`, { method: p.isFollowing ? "DELETE" : "POST" });
    p.isFollowing = !p.isFollowing; p.followers = r.followers;
    navigator.vibrate?.(10);
    head();
  } catch (err) { if (err.status === 401) goLogin(); else toast(err.message); btn.disabled = false; }
}
head();

// Onglets : réels (grille 3 colonnes, lecteur plein écran au toucher) et événements publics.
const tabs = { reels: ["reels", "Réels"], events: ["calendar", "Événements"] };
document.querySelectorAll(".up-tabs button").forEach((b) => { const [ic, label] = tabs[b.dataset.tab]; b.innerHTML = `${icon(ic, 17)}<span>${t(label)}</span>`; });
document.querySelector(".up-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (!b) return;
  document.querySelectorAll(".up-tabs button").forEach((x) => x.classList.toggle("active", x === b));
  $("#up-reels").classList.toggle("hidden", b.dataset.tab !== "reels");
  $("#up-events").classList.toggle("hidden", b.dataset.tab !== "events");
});
const grid = $("#up-reels");
grid._reels = p.reels;
grid.innerHTML = p.reels.length ? p.reels.map((v) => `<button type="button" class="insp-card" data-yt="${esc(v.id)}" aria-label="${esc(v.title || "")}">
  ${v.thumb ? `<img src="${esc(v.thumb)}" alt="" loading="lazy">` : `<video src="${esc(v.src)}#t=0.3" muted playsinline preload="metadata"></video>`}<span class="insp-play">▶</span>${v.nc ? `<small>💬 ${v.nc}</small>` : ""}</button>`).join("")
  : `<p class="muted up-empty">${t("Aucun réel pour le moment.")}</p>`;
$("#up-events").innerHTML = p.events.length ? `<div class="p-grid">${p.events.map(publicCard).join("")}</div>` : `<p class="muted up-empty">${t("Aucun événement public.")}</p>`;
