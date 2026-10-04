// « Mes faire-part » : le faire-part de l'événement et l'invitation au live (générée automatiquement),
// chacun avec QR code, lien, code et boutons de partage.
import { api, $, copy, shareSheet, qrUrl, tabbar, goLogin, formatDate, EVENT_TYPES, EN, toast } from "./common.js";
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
    text: `Nous avons la joie de vous annoncer ${what}, le ${formatDate(ev.date, ev.time).toLowerCase()}.\n\nParce que vous comptez pour nous et que nous souhaitons partager ce moment malgré la distance, nous vous invitons à le suivre en direct !\n\nScannez le QR code ou ouvrez le lien : messages, réactions et photos, vivez ce moment avec nous.`,
  };
}

// Autres textes proposés pour l'invitation au live (bouton « Texte proposé » : un nouveau à chaque appui).
function liveTexts(ev) {
  const when = formatDate(ev.date, ev.time);
  if (EN) return [liveInvite(ev).text,
    `We are delighted to announce our celebration, held in an intimate setting on ${when}.\n\nBecause you matter to us and we want to share this moment despite the distance, we invite you to follow the ceremony live!\n\nScan the QR code or open the link a few minutes before it starts.`,
    `Save the date: ${when}.\n\nWherever you are, join us live from your phone, tablet or computer. Send your messages and reactions: we will see them in real time ❤️`];
  const what = { mariage: "notre mariage", bapteme: "le baptême", communion: "la communion", fiancailles: "nos fiançailles",
    anniversaire: "l'anniversaire", "baby-shower": "la baby shower", diplome: "la remise de diplôme",
    retraite: "le départ en retraite", inauguration: "l'inauguration" }[ev.type] || "l'événement";
  return [liveInvite(ev).text,
    `Nous avons la joie de vous annoncer ${what}, qui se déroulera en petit comité le ${when.toLowerCase()}.\n\nParce que vous comptez pour nous et que nous souhaitons partager ce moment malgré la distance, nous vous invitons à suivre la cérémonie en direct !\n\nScannez le QR code ou ouvrez le lien quelques minutes avant le début de la diffusion.`,
    `Réservez la date : ${when.toLowerCase()}.\n\nOù que vous soyez, rejoignez-nous en direct depuis votre téléphone, votre tablette ou votre ordinateur. Envoyez-nous vos messages et vos réactions : nous les verrons en temps réel ❤️`,
    `Vous ne pourrez pas être à nos côtés ? Pas de souci : ${what} sera diffusé en direct le ${when.toLowerCase()}.\n\nInstallez-vous confortablement, ouvrez le lien et vivez ce moment avec nous comme si vous y étiez !`];
}
let liveTextIdx = 0;

// Invitation au live : texte personnalisé par l'organisateur, sinon le texte proposé.
const liveCard = (ev) => {
  const auto = liveInvite(ev);
  return ev.invite?.liveText ? { ...auto, text: ev.invite.liveText } : auto;
};

let ev;
let tab = "invite";

// Juste après la création : rappel des codes à garder (invités et caméraman).
function codesReminder(ev) {
  const row = (label, code, hint) => `<div class="code-remind"><span><b>${label}</b><small class="muted">${hint}</small></span>
    <button type="button" class="code" data-copy="${code}" aria-label="Copier ${label}">${code} 📋</button></div>`;
  document.body.insertAdjacentHTML("beforeend", `<div class="sheet" id="codes-sheet" role="dialog" aria-modal="true">
    <div class="card"><h2 style="margin-top:0">🎉 Votre événement est créé !</h2>
      <p class="muted" style="margin-top:0">Notez bien ces codes, vous les retrouverez aussi sur votre tableau de bord.</p>
      ${row("🔑 Code d'invitation", ev.accessCode, ev.visibility === "private" ? "À donner à vos invités pour entrer" : "Permet de retrouver l'événement (Découvrir → code)")}
      ${row("🎥 Code caméraman", ev.cameramanCode, "Pour la personne qui filme le live")}
      <button class="btn btn-block" type="button" id="codes-ok" style="margin-top:14px">J'ai noté mes codes</button></div></div>`);
  const sheet = $("#codes-sheet");
  sheet.addEventListener("click", (e) => {
    if (e.target.dataset.copy) copy(e.target.dataset.copy, "Code copié !");
    if (e.target.id === "codes-ok") sheet.remove();
  });
}

function render() {
  const base = `${location.origin}/e/${encodeURIComponent(ev.slug)}`;
  const withCode = ev.visibility === "private" ? `?code=${ev.accessCode}` : "";
  const isLive = tab === "live";
  const link = isLive
    ? `${location.origin}/live?e=${encodeURIComponent(ev.slug)}${ev.visibility === "private" ? `&code=${ev.accessCode}` : ""}`
    : `${base}${withCode}`;
  const invite = isLive ? liveCard(ev) : ev.invite;
  const style = isLive ? "moderne" : ev.inviteStyle;
  const photo = invitePhotoUrl(ev.invite, ev.cover);
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
  closeEditor();
  render();
});

// Modification du texte directement depuis « Mes faire-part ».
const form = $("#fp-editor");
function fill(inv) {
  form.kicker.value = inv.kicker || ""; form.title.value = inv.title || ""; form.text.value = inv.text || "";
}
function closeEditor() { form.classList.add("hidden"); $("#edit-text").classList.remove("hidden"); }
$("#edit-text").addEventListener("click", () => {
  const live = tab === "live";
  fill(live ? liveCard(ev) : ev.invite || {});
  form.kicker.parentElement.classList.toggle("hidden", live);
  form.title.parentElement.classList.toggle("hidden", live);
  $("#fp-reset").classList.toggle("hidden", !live);
  form.classList.remove("hidden");
  $("#edit-text").classList.add("hidden");
  form.text.focus();
});
$("#fp-reset").addEventListener("click", () => {
  const list = liveTexts(ev);
  liveTextIdx = (liveTextIdx + 1) % list.length;
  form.text.value = list[liveTextIdx];
});
$("#fp-cancel").addEventListener("click", closeEditor);
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = tab === "live"
    ? { liveText: form.text.value.trim() === liveInvite(ev).text ? "" : form.text.value }
    : { kicker: form.kicker.value, title: form.title.value, text: form.text.value };
  try {
    ev = await api(`/api/events/${encodeURIComponent(ev.id)}/invite-text`, { method: "PATCH", body });
    closeEditor();
    render();
    toast(EN ? "Text saved" : "Texte enregistré ✓");
  } catch (err) { toast(err.message); }
});
$("#print").addEventListener("click", () => print());

try {
  ev = await api(`/api/events/${encodeURIComponent(id)}`);
  document.title = `Faire-part — ${ev.name}`;
  $("#edit").href = `/edit?id=${ev.id}`;
  if (!EVENT_TYPES[ev.type]) throw new Error();
  render();
  if (new URLSearchParams(location.search).has("new")) {
    history.replaceState(null, "", `/faire-part?id=${ev.id}`);
    codesReminder(ev);
  }
} catch (err) {
  if (err.status === 401) goLogin();
  else $("#card").textContent = "Événement introuvable.";
}
