import { lang } from "./i18n.js";
const t = (fr, en) => (lang === "en" ? en : fr); // textes avec nombres (non traduisibles par le dictionnaire)
// Fil d'actualité façon Instagram : nouveaux événements, photos/vidéos des invités, messages du livre d'or.
import { api, $, esc, toast, tabbar, goLogin, coverOf, isLiveNow, dayBadge, isVideo, viewPhoto, EVENT_TYPES, LOCALE, shareSheet, liveState } from "./common.js";

tabbar("home");

const ago = (iso) => {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (!(s >= 0)) return "";
  if (s < 3600) return t(`il y a ${Math.max(1, Math.round(s / 60))} min`, `${Math.max(1, Math.round(s / 60))} min ago`);
  if (s < 86400) return t(`il y a ${Math.round(s / 3600)} h`, `${Math.round(s / 3600)} h ago`);
  return new Date(iso).toLocaleDateString(LOCALE, { day: "numeric", month: "long" });
};
const eventLink = (ev) => (ev.date === new Date().toISOString().slice(0, 10) ? `/live?e=${encodeURIComponent(ev.slug)}` : `/e/${encodeURIComponent(ev.slug)}`);

let items = [];
const liked = new Set((() => { try { return JSON.parse(localStorage.getItem("em-likes") || "[]"); } catch { return []; } })());

function post(it, i) {
  const ev = it.event;
  const media = it.url
    ? (isVideo(it.url) ? `<video src="${esc(it.url)}#t=0.1" controls playsinline preload="metadata"></video>` : `<img src="${esc(it.url)}" alt="" loading="lazy" data-view="${i}">`)
    : it.kind === "event" ? `<a href="${eventLink(ev)}"><img src="${esc(coverOf(ev))}" alt="" loading="lazy"></a>` : "";
  const title = it.kind === "event"
    ? `${isLiveNow(ev) ? t("● En direct", "● Live") : t("Nouvel événement", "New event")} · ${esc(dayBadge(ev.date))}`
    : it.kind === "photo" ? `<b>${esc(it.name)}</b> a partagé ${isVideo(it.url) ? "une vidéo" : "une photo"}`
    : `<b>${esc(it.name)}</b> a écrit dans le livre d'or`;
  return `<article class="feed-post">
    <header><a href="${eventLink(ev)}" class="feed-ev" style="background-image:url('${esc(coverOf(ev))}')" aria-label="${esc(ev.name)}"></a>
      <div><a href="${eventLink(ev)}"><b>${esc(ev.name)}</b></a><span class="muted small">${title} · ${ago(it.at)}</span></div></header>
    ${media}
    ${it.text ? `<p>${esc(it.text)}</p>` : ""}
    ${it.audio ? `<audio controls preload="none" src="${esc(it.audio)}"></audio>` : ""}
    <footer>
      ${it.kind === "message" ? `<button data-like="${i}" class="${liked.has(it.id) ? "on" : ""}">❤️ ${it.likes}</button>
        <a class="btn btn-ghost btn-sm" href="/e/${encodeURIComponent(ev.slug)}#gb-list">💬 ${it.replies || "Répondre"}</a>` : ""}
      ${it.kind === "event" ? `<a class="btn btn-sm" href="${eventLink(ev)}">${isLiveNow(ev) ? "● Rejoindre le live" : "Voir l'événement"}</a>` : ""}
      ${ev.cameras?.length && liveState(ev) === "replay" ? `<a class="btn btn-sm" href="/live?e=${encodeURIComponent(ev.slug)}">▶ Revoir le live</a>` : ""}
      <button type="button" class="btn btn-ghost btn-sm" data-share="${i}">↗ Partager</button>
      ${ev.cagnotteUrl ? `<a class="btn btn-light btn-sm" href="${esc(ev.cagnotteUrl)}" target="_blank" rel="noopener">🎁 Cagnotte</a>` : ""}
    </footer>
  </article>`;
}

try {
  items = await api("/api/me/feed");
  $("#feed").innerHTML = items.map(post).join("");
  $("#feed-empty").classList.toggle("hidden", items.length > 0);
} catch (err) {
  if (err.status === 401) goLogin(); else toast(err.message);
}

$("#feed").addEventListener("click", async (e) => {
  const v = e.target.dataset.view;
  if (v !== undefined) viewPhoto({ url: items[v].url, name: items[v].name });
  // Republier : partage du moment (photo, message ou événement) vers WhatsApp, SMS, Instagram…
  const sh = e.target.dataset.share;
  if (sh !== undefined) {
    const it = items[sh], ev = it.event;
    const text = it.kind === "photo" ? `📸 Un beau moment de « ${ev.name} » sur MaFeliza`
      : it.kind === "message" ? `💬 « ${String(it.text || "").slice(0, 100)} » — ${ev.name}`
      : `🎉 « ${ev.name} » sur MaFeliza`;
    return shareSheet({ title: ev.name, text, url: `${location.origin}${eventLink(ev)}` });
  }
  const l = e.target.dataset.like;
  if (l === undefined) return;
  const it = items[l];
  if (liked.has(it.id)) return;
  try {
    const r = await api(`/api/public/${encodeURIComponent(it.event.slug)}/guestbook/${it.id}/like`, { method: "POST" });
    it.likes = r.likes;
    liked.add(it.id);
    try { localStorage.setItem("em-likes", JSON.stringify([...liked])); } catch { /* ignoré */ }
    e.target.textContent = `❤️ ${it.likes}`;
    e.target.classList.add("on");
  } catch (err) { toast(err.message); }
});
