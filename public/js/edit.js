// Création et modification d'un événement : infos, accès, faire-part, live, cagnotte, programme.
import { api, $, esc, toast, resizeImage, goLogin, EVENT_TYPES, livePlaceholder, tabbar } from "./common.js";
import { defaultInvite, renderInvite, invitePhotoUrl, templatesFor } from "./invitation.js";
tabbar("");
let phoneCams = []; // caméras « téléphone » (live en un clic)

const form = $("#form");
const id = new URLSearchParams(location.search).get("id");

// État local des images : URL déjà enregistrée ou nouvelle image (data URL) à envoyer.
const state = {
  cover: null,          // URL affichée de la couverture
  coverData: null,      // nouvelle couverture à envoyer
  removeCover: false,
  invitePhoto: "cover", // "cover" | "none" | URL existante | data URL
  inviteTouched: false, // l'utilisateur a-t-il modifié le texte du faire-part ?
};

$("#types").innerHTML = Object.entries(EVENT_TYPES).map(([value, t], i) => `
  <label class="choice" style="margin:0">
    <input type="radio" name="type" value="${value}" ${i === 0 ? "checked" : ""}>
    <span><b>${t.icon}</b>${t.label}</span>
  </label>`).join("");

// Photo du faire-part choisie : data URL (nouvelle) ou URL déjà stockée (disque local ou Supabase Storage).
const isImage = (v) => /^(data:|\/|https:)/.test(v);

const field = (name) => form.elements[name];
const values = () => ({
  name: field("name").value,
  type: field("type").value,
  date: field("date").value,
  time: field("time").value,
  location: field("location").value,
  description: field("description").value,
  visibility: field("visibility").value,
  inviteStyle: field("style").value,
});
const invite = () => ({ kicker: $("#inv-kicker").value, title: $("#inv-title").value, text: $("#inv-text").value });

function fillInvite(inv) {
  $("#inv-kicker").value = inv.kicker ?? "";
  $("#inv-title").value = inv.title ?? "";
  $("#inv-text").value = inv.text ?? "";
}

function refresh() {
  const v = values();
  // Tant que le texte n'a pas été retouché, il suit le type et le nom de l'événement.
  if (!state.inviteTouched) fillInvite(defaultInvite(v));

  const coverShown = state.removeCover ? null : state.cover;
  $("#cover-preview").classList.toggle("hidden", !coverShown);
  if (coverShown) $("#cover-preview").src = coverShown;
  $("#remove-cover").classList.toggle("hidden", !coverShown);

  $("#inv-photo-file").classList.toggle("hidden", field("inv-photo").value !== "custom");
  const isPrivate = v.visibility === "private";
  $("#code-info").classList.toggle("hidden", !isPrivate || !id);
  $("#code-new").classList.toggle("hidden", !isPrivate || !!id);

  const photo = field("inv-photo").value === "custom"
    ? (isImage(state.invitePhoto) ? state.invitePhoto : null)
    : invitePhotoUrl({ photo: field("inv-photo").value }, coverShown);
  renderInvite($("#invite"), v, invite(), v.inviteStyle, photo);
}

form.addEventListener("input", (e) => {
  if (e.target.id?.startsWith("inv-") && e.target.type !== "file") state.inviteTouched = true;
  refresh();
});
form.addEventListener("change", refresh);

// Textes du faire-part : « Générer » propose le texte suivant du type d'événement,
// « Textes prêts » affiche toute la liste pour en choisir un.
let textIndex = 0;
function applyTemplate([kicker, text]) {
  $("#inv-kicker").value = kicker;
  $("#inv-text").value = text;
  if (!$("#inv-title").value) $("#inv-title").value = field("name").value;
  state.inviteTouched = true;
  refresh();
}

$("#gen-text").addEventListener("click", () => {
  const list = templatesFor(field("type").value);
  textIndex = (textIndex + 1) % list.length;
  applyTemplate(list[textIndex]);
  toast(`Texte ${textIndex + 1} / ${list.length}`);
});

$("#ready-texts").addEventListener("click", () => {
  const list = templatesFor(field("type").value);
  document.body.insertAdjacentHTML("beforeend", `
    <div class="sheet" id="texts-sheet" role="dialog" aria-modal="true" aria-labelledby="texts-title">
      <div class="card">
        <h2 id="texts-title" style="font-size:1.1rem">Textes prêts</h2>
        <div class="texts-list">${list.map(([k, t], i) => `
          <button type="button" class="text-option" data-i="${i}"><b>${esc(k)}</b><span>${esc(t)}</span></button>`).join("")}</div>
        <button type="button" class="btn btn-light btn-block" data-close style="margin-top:10px">Fermer</button>
      </div>
    </div>`);
  const sheet = $("#texts-sheet");
  sheet.addEventListener("click", (e) => {
    const opt = e.target.closest("[data-i]");
    if (opt) { textIndex = Number(opt.dataset.i); applyTemplate(list[textIndex]); }
    if (opt || e.target.closest("[data-close]") || e.target === sheet) sheet.remove();
  });
});

$("#cover").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    state.coverData = state.cover = await resizeImage(file);
    state.removeCover = false;
    refresh();
  } catch (err) { toast(err.message); }
});

$("#remove-cover").addEventListener("click", () => {
  state.removeCover = true;
  state.coverData = null;
  $("#cover").value = "";
  refresh();
});

$("#inv-photo-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    state.invitePhoto = await resizeImage(file, 1080);
    refresh();
  } catch (err) { toast(err.message); }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#error").textContent = "";
  const choice = field("inv-photo").value;
  if (choice === "custom" && !isImage(state.invitePhoto)) {
    $("#error").textContent = "Choisissez la photo du faire-part ou une autre option.";
    return;
  }
  const body = {
    ...values(),
    cameras: [...document.querySelectorAll(".camera-row")].map((row) => ({
      name: row.querySelector("[name=cam-name]").value,
      url: row.querySelector("[name=cam-url]").value,
    })).concat(phoneCams),
    cagnotteUrl: $("#cagnotte").value,
    potRaised: $("#pot-raised").value,
    potGoal: $("#pot-goal").value,
    program: [...document.querySelectorAll(".step-row")].map((r) => ({ time: r.querySelector("[name=step-time]").value, label: r.querySelector("[name=step-label]").value })),
    practical: $("#practical").value,
    cameramanNotes: $("#cameraman-notes").value,
    regenerateCameramanCode: $("#regenerate-cam").checked,
    invite: { ...invite(), photo: choice === "custom" ? state.invitePhoto : choice },
    coverData: state.coverData,
    removeCover: state.removeCover,
    regenerateCode: $("#regenerate").checked,
  };
  $("#save").disabled = true;
  try {
    const saved = await api(id ? `/api/events/${id}` : "/api/events", { method: id ? "PUT" : "POST", body });
    // Nouvel événement : on montre directement ses faire-part à partager.
    location.href = id ? "/dashboard?saved=1" : `/faire-part?id=${saved.id}&new=1`;
  } catch (err) {
    if (err.status === 401) return goLogin();
    $("#error").textContent = err.message;
    $("#save").disabled = false;
  }
});

// Lignes « caméra » du live (6 max).
let camPlaceholder = "https://youtube.com/live/…";
livePlaceholder().then((p) => { camPlaceholder = p; });
function addCamera(cam = {}) {
  const list = $("#cameras");
  if (list.children.length >= 6) return toast("6 caméras maximum");
  const n = list.children.length + 1;
  list.insertAdjacentHTML("beforeend", `
    <div class="camera-row row" style="margin-bottom:8px">
      <input name="cam-name" maxlength="40" placeholder="Caméra ${n}" style="flex:1 1 90px">
      <input name="cam-url" type="url" inputmode="url" maxlength="300" placeholder="${camPlaceholder}" style="flex:3 1 180px">
      <button type="button" class="btn btn-ghost btn-sm" data-remove style="flex:none" aria-label="Retirer">✕</button>
    </div>`);
  const row = list.lastElementChild;
  row.querySelector("[name=cam-name]").value = cam.name || "";
  row.querySelector("[name=cam-url]").value = cam.url || "";
}
$("#add-camera").addEventListener("click", () => addCamera());
$("#cameras").addEventListener("click", (e) => {
  if (e.target.matches("[data-remove]")) e.target.closest(".camera-row").remove();
});

async function init() {
  if (!id) {
    try { await api("/api/auth/me"); } catch { return goLogin(); }
    return refresh();
  }
  $("#page-title").textContent = "Modifier l'événement";
  document.title = "Modifier l'événement";
  try {
    const ev = await api(`/api/events/${id}`);
    for (const key of ["name", "date", "time", "location", "description"]) field(key).value = ev[key];
    // Caméras « téléphone » : gérées depuis l'espace caméraman, conservées telles quelles.
    phoneCams = ev.cameras.filter((c) => c.url.startsWith("lk:"));
    const links = ev.cameras.filter((c) => !c.url.startsWith("lk:"));
    links.forEach(addCamera);
    if (links.length) $("#cam-advanced").open = true;
    $("#cagnotte").value = ev.cagnotteUrl;
    $("#pot-raised").value = ev.pot?.raised || "";
    $("#pot-goal").value = ev.pot?.goal || "";
    (ev.program?.steps || []).forEach(addStep);
    $("#practical").value = ev.program?.practical || "";
    $("#cameraman-notes").value = ev.cameramanNotes;
    if (ev.blockedCount) {
      $("#blocked-count").textContent = ev.blockedCount;
      $("#blocked-info").classList.remove("hidden");
      $("#unblock-all").onclick = async () => {
        await api(`/api/public/${encodeURIComponent(ev.slug)}/blocks`, { method: "DELETE" });
        $("#blocked-info").classList.add("hidden");
        toast("Toutes les personnes ont été débloquées");
      };
    }
    if (ev.cameramanCode) {
      $("#cameraman-code").textContent = ev.cameramanCode;
      $("#cameraman-info").classList.remove("hidden");
    }
    form.querySelector(`[name=type][value="${ev.type}"]`).checked = true;
    form.querySelector(`[name=visibility][value="${ev.visibility}"]`).checked = true;
    form.querySelector(`[name=style][value="${ev.inviteStyle}"]`).checked = true;
    $("#access-code").textContent = ev.accessCode;
    state.cover = ev.cover;
    state.invitePhoto = ev.invite.photo || "cover";
    const photoChoice = ["cover", "none"].includes(state.invitePhoto) ? state.invitePhoto : "custom";
    form.querySelector(`[name=inv-photo][value="${photoChoice}"]`).checked = true;
    fillInvite(ev.invite);
    state.inviteTouched = true;
    refresh();
  } catch (err) {
    if (err.status === 401) return goLogin();
    toast(err.message);
  }
}

init();

// --- Programme de la journée : étapes (heure + intitulé), 12 max ---
function addStep(step = {}) {
  const list = $("#program");
  if (list.children.length >= 12) return toast("12 étapes maximum");
  list.insertAdjacentHTML("beforeend", `
    <div class="step-row">
      <input name="step-time" type="time" aria-label="Heure">
      <input name="step-label" maxlength="80" placeholder="Cérémonie, cocktail, dîner…" aria-label="Étape">
      <button type="button" class="btn btn-ghost btn-sm" data-remove-step aria-label="Retirer">✕</button>
    </div>`);
  const row = list.lastElementChild;
  row.querySelector("[name=step-time]").value = step.time || "";
  row.querySelector("[name=step-label]").value = step.label || "";
}
const PROGRAMS = {
  mariage: [["14:00", "Cérémonie à la mairie"], ["15:30", "Cérémonie religieuse"], ["17:00", "Vin d'honneur"], ["20:00", "Dîner"], ["22:30", "Soirée dansante"]],
  fiancailles: [["19:00", "Accueil des invités"], ["20:00", "Demande officielle"], ["20:30", "Dîner"], ["22:30", "Soirée"]],
  anniversaire: [["19:00", "Accueil et apéritif"], ["20:30", "Dîner"], ["22:00", "Gâteau et bougies"], ["22:30", "Soirée dansante"]],
  bapteme: [["11:00", "Cérémonie"], ["12:30", "Vin d'honneur"], ["13:30", "Déjeuner"], ["16:00", "Goûter"]],
  communion: [["10:30", "Messe"], ["12:30", "Apéritif"], ["13:30", "Déjeuner"]],
  "baby-shower": [["15:00", "Accueil"], ["15:30", "Jeux"], ["16:30", "Ouverture des cadeaux"], ["17:00", "Goûter"]],
  diplome: [["14:00", "Remise des diplômes"], ["16:00", "Photos"], ["19:00", "Dîner de célébration"]],
  retraite: [["18:00", "Accueil"], ["18:30", "Discours"], ["19:00", "Cocktail"]],
  inauguration: [["18:00", "Accueil"], ["18:30", "Coupure du ruban"], ["19:00", "Cocktail"]],
  autre: [["19:00", "Accueil"], ["20:00", "Dîner"], ["22:00", "Soirée"]],
};
$("#add-step").addEventListener("click", () => addStep());
$("#program").addEventListener("click", (e) => { if (e.target.matches("[data-remove-step]")) e.target.closest(".step-row").remove(); });
$("#program-template").addEventListener("click", () => {
  const type = document.querySelector("[name=type]:checked")?.value || "autre";
  if (document.querySelector(".step-row") && !confirm("Remplacer le programme actuel par un programme type ?")) return;
  $("#program").innerHTML = "";
  (PROGRAMS[type] || PROGRAMS.autre).forEach(([time, label]) => addStep({ time, label }));
});

// Cagnotte : après l'avoir créée sur Leetchi / Lydia / PayPal, le lien copié se colle en un clic
// (et automatiquement au retour sur la page si le téléphone l'autorise).
{
  const input = $("#cagnotte");
  const isPot = (t) => /^https?:\/\/\S*(leetchi|lydia|paypal|lepotcommun|onparticipe|helloasso|gofundme|kisskiss|ulule|sumeria)\S*$/i.test(t.trim());
  const show = () => {
    $("#cagnotte-ok").classList.toggle("hidden", !isPot(input.value));
    $("#pot-amounts").classList.toggle("hidden", !input.value.trim()); // montants seulement si une cagnotte existe
  };
  const tryPaste = async (manual) => {
    try {
      const t = (await navigator.clipboard.readText()).trim();
      if (isPot(t) || (manual && /^https?:\/\//.test(t))) { input.value = t; show(); return true; }
      if (manual) toast("Copiez d'abord le lien de votre cagnotte, puis touchez « Coller ».");
    } catch { if (manual) input.focus(); }
    return false;
  };
  let waiting = false;
  addEventListener("blur", () => { waiting = true; }); // l'organisateur part créer sa cagnotte ailleurs
  addEventListener("focus", () => { if (waiting && !input.value) tryPaste(false).then((ok) => { if (ok) waiting = false; }); });
  $("#cagnotte-paste").addEventListener("click", () => tryPaste(true));
  input.addEventListener("input", show);
  setTimeout(show, 1500);
}
