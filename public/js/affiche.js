// Supports à imprimer pour la salle : QR « photos » (album + mur photo) et QR « livre d'or ».
// 3 formats sur feuille A4 : affiche (1), cartes de table A6 (4), marque-pages 5 × 14,8 cm (8), avec traits de coupe.
import { api, $, esc, qrUrl, goLogin, formatDate, EVENT_TYPES } from "./common.js";
import { t } from "./i18n.js";

const id = new URLSearchParams(location.search).get("id");
let ev;
try { ev = await api(`/api/events/${encodeURIComponent(id)}`); }
catch (err) { if (err.status === 401) goLogin(); else document.body.textContent = err.message; throw err; }
const base = `${location.origin}/e/${encodeURIComponent(ev.slug)}${ev.visibility === "private" ? `?code=${encodeURIComponent(ev.accessCode)}` : ""}`;
const qrPhotos = qrUrl(`${base}#photos`), qrBook = qrUrl(`${base}#livre-dor`);
const kicker = t(EVENT_TYPES[ev.type]?.label || "Événement").toUpperCase();
const title = ev.invite?.title || ev.name;
const date = formatDate(ev.date, ev.time || "").split(/ à | at /)[0];
const L = {
  photos: t("Partagez vos photos"), photosSub: t("Elles s'affichent en direct sur le mur photo"),
  book: t("Signez le livre d'or"), bookSub: t(ev.type === "mariage" ? "Laissez un mot aux mariés" : "Laissez un mot à vos hôtes"),
  steps: t("Ouvrez l'appareil photo de votre téléphone et visez le QR code. Aucune application à installer."),
};
document.title = `${t("Affiche QR")} — ${ev.name}`;

const brand = `<p class="qp-brand"><img src="/img/logo.png" alt=""> mafeliza.com</p>`;
const head = `<p class="qp-kicker">${esc(kicker)}</p><h1 class="qp-name">${esc(title)}</h1><p class="qp-date">${esc(date)}</p>`;
const qr = (src, label, sub) => `<figure class="qp-qr"><img src="${src}" alt=""><figcaption><b>${esc(label)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</figcaption></figure>`;
const FORMATS = {
  // Affiche A4 : 1 par page.
  a4: { label: "Affiche A4", per: 1, card: () => `<div class="qp-card qp-a4">${head}<div class="qp-two">${qr(qrPhotos, `📸 ${L.photos}`, L.photosSub)}${qr(qrBook, `✍️ ${L.book}`, L.bookSub)}</div><p class="qp-steps">${esc(L.steps)}</p>${brand}</div>` },
  // Cartes de table A6 : 4 par page.
  a6: { label: "Cartes de table ×4", per: 4, card: () => `<div class="qp-card qp-a6">${head}<div class="qp-two">${qr(qrPhotos, `📸 ${L.photos}`)}${qr(qrBook, `✍️ ${L.book}`)}</div><p class="qp-steps">${esc(L.steps)}</p>${brand}</div>` },
  // Marque-pages 50 × 148 mm : 8 par page.
  bm: { label: "Marque-pages ×8", per: 8, card: () => `<div class="qp-card qp-bm">${head}${qr(qrPhotos, `📸 ${L.photos}`)}${qr(qrBook, `✍️ ${L.book}`)}${brand}</div>` },
};
let fmt = "a4";
try { fmt = FORMATS[localStorage.getItem("em-qp")] ? localStorage.getItem("em-qp") : "a4"; } catch { /* ignoré */ }

function render() {
  const f = FORMATS[fmt];
  $("#p-formats").innerHTML = Object.entries(FORMATS).map(([k, v]) => `<button type="button" class="${k === fmt ? "on" : ""}" data-f="${k}">${esc(t(v.label))}</button>`).join("");
  $("#sheets").innerHTML = `<section class="qp-sheet qp-sheet-${fmt}">${Array.from({ length: f.per }, f.card).join("")}</section>`;
  $("#p-hint").textContent = fmt === "a4" ? t("1 affiche par feuille A4.") : t("Découpez en suivant les pointillés.");
  fit();
}
// Aperçu à l'échelle de l'écran (la feuille fait 210 mm de large).
const fit = () => document.documentElement.style.setProperty("--qp-zoom", Math.min(1, (innerWidth - 24) / 794).toFixed(3));
addEventListener("resize", fit);
$("#p-formats").addEventListener("click", (e) => {
  const b = e.target.closest("[data-f]");
  if (!b) return;
  fmt = b.dataset.f;
  try { localStorage.setItem("em-qp", fmt); } catch { /* ignoré */ }
  render();
});
$("#p-print").textContent = `🖨️ ${t("Imprimer")}`;
$("#p-print").onclick = () => print();
render();
