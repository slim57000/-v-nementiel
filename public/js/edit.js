import { api, $, toast, resizeImage, EVENT_TYPES } from "./common.js";
import { defaultInvite, renderInvite, invitePhotoUrl } from "./invitation.js";

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

$("#regen-text").addEventListener("click", () => {
  state.inviteTouched = false;
  refresh();
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
    state.invitePhoto = await resizeImage(file, 1200);
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
    invite: { ...invite(), photo: choice === "custom" ? state.invitePhoto : choice },
    coverData: state.coverData,
    removeCover: state.removeCover,
    regenerateCode: $("#regenerate").checked,
  };
  $("#save").disabled = true;
  try {
    await api(id ? `/api/events/${id}` : "/api/events", { method: id ? "PUT" : "POST", body });
    location.href = "/dashboard?saved=1";
  } catch (err) {
    if (err.status === 401) return location.replace("/");
    $("#error").textContent = err.message;
    $("#save").disabled = false;
  }
});

async function init() {
  if (!id) {
    try { await api("/api/auth/me"); } catch { return location.replace("/"); }
    return refresh();
  }
  $("#page-title").textContent = "Modifier l'événement";
  document.title = "Modifier l'événement";
  try {
    const ev = await api(`/api/events/${id}`);
    for (const key of ["name", "date", "time", "location", "description"]) field(key).value = ev[key];
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
    if (err.status === 401) return location.replace("/");
    toast(err.message);
  }
}

init();
