// Album souvenir imprimable (ou enregistrable en PDF) : couverture, photos et vidéos des invités, livre d'or.
import { api, $, esc, goLogin, coverOf, isVideo, formatDate, EVENT_TYPES } from "./common.js";

const id = new URLSearchParams(location.search).get("id");
$("#print").addEventListener("click", () => print());

try {
  const ev = await api(`/api/events/${id}`);
  const base = `/api/public/${encodeURIComponent(ev.slug)}`;
  const [photos, entries] = await Promise.all([api(`${base}/photos?limit=200`), api(`${base}/guestbook`)]);
  document.title = `Album — ${ev.name}`;
  const pictures = [
    ...photos.filter((p) => !isVideo(p.url)).map((p) => ({ url: p.url, name: p.name })),
    ...entries.filter((e) => e.photoUrl && !isVideo(e.photoUrl)).map((e) => ({ url: e.photoUrl, name: e.name })),
  ];
  const words = entries.filter((e) => e.text).slice().reverse();
  $("#album").innerHTML = `
    <section class="album-cover" style="background-image:url('${esc(coverOf(ev))}')">
      <div><p class="album-kicker">${EVENT_TYPES[ev.type]?.icon || "🎉"} Album souvenir</p>
        <h1>${esc(ev.name)}</h1><p>${esc(formatDate(ev.date, ev.time))} · ${esc(ev.location)}</p>
        ${ev.premium ? "" : '<p class="album-brand">EverMoments</p>'}</div>
    </section>
    ${pictures.length ? `<h2>Vos photos (${pictures.length})</h2>
      <div class="album-grid">${pictures.map((p) => `<figure><img src="${esc(p.url)}" alt=""><figcaption>${esc(p.name)}</figcaption></figure>`).join("")}</div>` : ""}
    ${words.length ? `<h2>Le livre d'or</h2>
      <div class="album-words">${words.map((e) => `<blockquote><p>${esc(e.text)}</p><cite>— ${esc(e.name)}</cite>
        ${(e.replies || []).map((r) => `<p class="album-reply">↳ <b>${esc(r.name)}</b> ${esc(r.text)}</p>`).join("")}</blockquote>`).join("")}</div>` : ""}
    ${!pictures.length && !words.length ? '<p class="muted" style="text-align:center">Les photos et messages de vos invités apparaîtront ici.</p>' : ""}`;
} catch (err) {
  if (err.status === 401) goLogin();
  else $("#album").innerHTML = `<p class="error" style="text-align:center">${esc(err.message)}</p>`;
}
