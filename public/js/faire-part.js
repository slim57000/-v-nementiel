// « Mes faire-part » : le faire-part de l'événement et l'invitation au live (générée automatiquement),
// chacun avec QR code, lien, code et boutons de partage.
import { api, $, copy, shareSheet, qrUrl, tabbar, goLogin, formatDate, EVENT_TYPES, EN } from "./common.js";
import { renderInvite, invitePhotoUrl } from "./invitation.js";

tabbar("home");
const id = new URLSearchParams(location.search).get("id");

// Texte prêt à l'emploi de l'invitation au live, selon le type d'événement.
function liveInvite(ev) {
  if (EN) {
    return {
      kicker: "Live invitation", title: ev.name,
      text: `Can't make it? Watch it live from your phone on ${formatDate(ev.date, ev.time)}.\n\nMessages, reactions and photos: share this moment with us!`,
    };
  }
  const what = { mariage: "notre mariage", bapteme: "le baptême", communion: "la communion", fiancailles: "nos fiançailles",
    anniversaire: "l'anniversaire", "baby-shower": "la baby shower", diplome: "la remise de diplôme",
    retraite: "le départ en retraite", inauguration: "l'inauguration" }[ev.type] || "l'événement";
  return {
    kicker: "Invitation au live",
    title: ev.name,
    text: `Vous ne pourrez pas être présent ? Suivez ${what} en direct depuis votre téléphone, le ${formatDate(ev.date, ev.time).toLowerCase()}.\n\nMessages, réactions et photos : vivez ce moment avec nous !`,
  };
}

let ev;
let tab = "invite";

function render() {
  const base = `${location.origin}/e/${encodeURIComponent(ev.slug)}`;
  const withCode = ev.visibility === "private" ? `?code=${ev.accessCode}` : "";
  const isLive = tab === "live";
  const link = isLive
    ? `${location.origin}/live?e=${encodeURIComponent(ev.slug)}${ev.visibility === "private" ? `&code=${ev.accessCode}` : ""}`
    : `${base}${withCode}`;
  const invite = isLive ? liveInvite(ev) : ev.invite;
  const style = isLive ? "moderne" : ev.inviteStyle;
  const photo = invitePhotoUrl(ev.invite, ev.cover) || "/img/demo/live-mariage.jpg";
  renderInvite($("#card"), ev, invite, style, isLive ? photo : invitePhotoUrl(ev.invite, ev.cover));

  $("#qr").src = qrUrl(link);
  $("#qr-title").textContent = isLive ? "Scannez pour suivre le live" : "Scannez pour ouvrir l'événement";
  $("#qr-link").textContent = link.replace(/^https?:\/\//, "");
  $("#qr-code").textContent = ev.accessCode;
  $("#qr-code-line").classList.toggle("hidden", ev.visibility !== "private");

  const text = isLive
    ? (EN ? `📺 Watch "${ev.name}" live on MaFeliza!` : `📺 Suivez « ${ev.name} » en direct sur MaFeliza !`)
    : (EN ? `💌 You're invited to "${ev.name}"!${ev.visibility === "private" ? ` Access code: ${ev.accessCode}` : ""}`
      : `💌 Vous êtes invité·e à « ${ev.name} » !${ev.visibility === "private" ? ` Code d'accès : ${ev.accessCode}` : ""}`);
  $("#share").onclick = () => shareSheet({ title: ev.name, text, url: link });
  $("#copy").onclick = () => copy(link, "Lien copié !");
}

document.querySelector(".fp-tabs").addEventListener("click", (e) => {
  if (!e.target.dataset.tab) return;
  tab = e.target.dataset.tab;
  document.querySelectorAll(".fp-tabs button").forEach((b) => b.classList.toggle("active", b === e.target));
  render();
});
$("#print").addEventListener("click", () => print());

try {
  ev = await api(`/api/events/${encodeURIComponent(id)}`);
  document.title = `Faire-part — ${ev.name}`;
  $("#edit").href = `/edit?id=${ev.id}`;
  if (!EVENT_TYPES[ev.type]) throw new Error();
  render();
} catch (err) {
  if (err.status === 401) goLogin();
  else $("#card").textContent = "Événement introuvable.";
}
