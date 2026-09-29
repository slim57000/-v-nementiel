import { api, $, toast, formatDate, pickAndUploadPhoto, livePlaceholder } from "./common.js";

const params = new URLSearchParams(location.search);
let slug = params.get("e") || "";

let camPlaceholder = "https://youtube.com/live/…";
livePlaceholder().then((p) => { camPlaceholder = p; });

// Une ligne « caméra » éditable (6 max).
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

function showSpace(ev) {
  document.title = `Caméraman — ${ev.name}`;
  $("#ev-name").textContent = ev.name;
  $("#ev-when").textContent = `${formatDate(ev.date, ev.time)} · ${ev.location}`;
  $("#notes").textContent = ev.notes || "Aucune consigne particulière pour le moment.";
  $("#cameras").innerHTML = "";
  (ev.cameras.length ? ev.cameras : [{}]).forEach(addCamera);
  $("#open-live").href = `/live?e=${encodeURIComponent(ev.slug)}`;
  $("#login").classList.add("hidden");
  $("#space").classList.remove("hidden");
}

async function load() {
  if (slug) {
    try { return showSpace(await api(`/api/cameraman/${encodeURIComponent(slug)}`)); } catch { /* code requis */ }
  }
  $("#login").classList.remove("hidden");
  $("#code").focus();
}

$("#login").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#login-error").textContent = "";
  try {
    ({ slug } = await api("/api/cameraman/login", { method: "POST", body: { code: $("#code").value } }));
    history.replaceState(null, "", `/cameraman?e=${encodeURIComponent(slug)}`);
    showSpace(await api(`/api/cameraman/${encodeURIComponent(slug)}`));
  } catch (err) {
    $("#login-error").textContent = err.message;
  }
});

$("#add-camera").addEventListener("click", () => addCamera());
$("#cameras").addEventListener("click", (e) => {
  if (e.target.matches("[data-remove]")) e.target.closest(".camera-row").remove();
});

$("#save").addEventListener("click", async () => {
  $("#cam-error").textContent = "";
  const cameras = [...document.querySelectorAll(".camera-row")].map((row) => ({
    name: row.querySelector("[name=cam-name]").value,
    url: row.querySelector("[name=cam-url]").value,
  }));
  try {
    await api(`/api/cameraman/${encodeURIComponent(slug)}/cameras`, { method: "PUT", body: { cameras } });
    toast("Liens enregistrés ✔");
  } catch (err) {
    $("#cam-error").textContent = err.message;
  }
});

$("#share-photo").addEventListener("click", () =>
  pickAndUploadPhoto(slug).then(() => toast("Image partagée ✔"), () => {}));

load();
