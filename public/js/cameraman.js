import { api, $, toast, formatDate, pickAndUploadPhoto, livePlaceholder, shareSheet } from "./common.js";

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

let current = null;
function showSpace(ev) {
  current = ev;
  document.title = `Caméraman — ${ev.name}`;
  $("#ev-name").textContent = ev.name;
  $("#ev-when").textContent = `${formatDate(ev.date, ev.time)} · ${ev.location}`;
  $("#notes").textContent = ev.notes || "Aucune consigne particulière pour le moment.";
  $("#cameras").innerHTML = "";
  // Caméras « téléphone » : pas de lien à modifier, conservées à l'enregistrement.
  const links = ev.cameras.filter((c) => !c.url.startsWith("lk:"));
  (links.length ? links : [{}]).forEach(addCamera);
  if (ev.phoneLive) {
    $("#phone-live").classList.remove("hidden");
    $("#links-card h2").textContent = "🔗 Ou un lien YouTube / Twitch";
  }
  $("#open-live").href = `/live?e=${encodeURIComponent(ev.slug)}`;
  $("#login").classList.add("hidden");
  $("#space").classList.remove("hidden");
}

async function load() {
  // Lien reçu de l'organisateur (/cameraman?code=XXXXXX) : connexion automatique.
  const code = params.get("code");
  if (code && !slug) {
    try {
      ({ slug } = await api("/api/cameraman/login", { method: "POST", body: { code } }));
      history.replaceState(null, "", `/cameraman?e=${encodeURIComponent(slug)}`);
    } catch (err) { $("#login-error").textContent = err.message; }
  }
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
  })).concat(current.cameras.filter((c) => c.url.startsWith("lk:")));
  try {
    await api(`/api/cameraman/${encodeURIComponent(slug)}/cameras`, { method: "PUT", body: { cameras } });
    toast("Liens enregistrés ✔");
  } catch (err) {
    $("#cam-error").textContent = err.message;
  }
});

$("#share-photo").addEventListener("click", () =>
  pickAndUploadPhoto(slug).then(() => toast("Image partagée ✔"), () => {}));

// --- Direct depuis le téléphone (LiveKit) ---
let room = null, wakeLock = null, facing = "environment";
const status = (t) => { $("#live-status").textContent = t; };

async function startLive() {
  if (!navigator.mediaDevices?.getUserMedia || !window.LivekitClient) return toast("Ce navigateur ne permet pas de filmer. Utilisez Safari ou Chrome à jour.");
  const { Room, RoomEvent, createLocalTracks } = window.LivekitClient;
  $("#go-live").disabled = true;
  status("Accès à la caméra…");
  try {
    const tracks = await createLocalTracks({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: { facingMode: facing, resolution: { width: 1280, height: 720 } },
    });
    const video = tracks.find((t) => t.kind === "video");
    video.attach($("#preview"));
    $("#preview-wrap").classList.remove("hidden");
    status("Connexion au direct…");
    const { url, token, name } = await api(`/api/cameraman/${encodeURIComponent(slug)}/go-live`, { method: "POST", body: { name: $("#cam-label").value } });
    room = new Room({ dynacast: true });
    room.on(RoomEvent.Reconnecting, () => status("⚠️ Réseau instable, reconnexion…"));
    room.on(RoomEvent.Reconnected, () => status("Les invités vous voient. Gardez cet écran ouvert."));
    room.on(RoomEvent.Disconnected, () => { if (room) status("⚠️ Connexion perdue : vérifiez le réseau puis relancez."); });
    await room.connect(url, token);
    for (const t of tracks) await room.localParticipant.publishTrack(t);
    try { wakeLock = await navigator.wakeLock?.request("screen"); } catch { /* facultatif */ }
    if (!current.cameras.some((c) => c.name === name && c.url.startsWith("lk:"))) current = await api(`/api/cameraman/${encodeURIComponent(slug)}`);
    $("#go-live").classList.add("hidden");
    $("#live-controls").classList.remove("hidden");
    $("#live-dot").classList.add("on");
    status("Les invités vous voient. Gardez cet écran ouvert.");
  } catch (err) {
    await stopLive(true);
    status("");
    toast(err.name === "NotAllowedError" ? "Autorisez la caméra et le micro dans les réglages du navigateur." : err.message);
  }
  $("#go-live").disabled = false;
}

async function stopLive(silent) {
  const r = room;
  room = null;
  r?.localParticipant.trackPublications.forEach((p) => p.track?.stop());
  await r?.disconnect().catch(() => {});
  $("#preview").srcObject?.getTracks?.().forEach((t) => t.stop());
  wakeLock?.release?.().catch(() => {});
  wakeLock = null;
  $("#preview-wrap").classList.add("hidden");
  $("#live-controls").classList.add("hidden");
  $("#go-live").classList.remove("hidden");
  $("#live-dot").classList.remove("on");
  if (!silent) { status("Direct arrêté."); toast("Direct arrêté"); }
}

// Retourner la caméra (avant / arrière) sans couper le direct.
async function flipCamera() {
  facing = facing === "environment" ? "user" : "environment";
  const pub = [...(room?.localParticipant.videoTrackPublications.values() || [])][0];
  try { await pub?.track?.restartTrack({ facingMode: facing }); } catch { toast("Impossible de changer de caméra."); }
}

$("#go-live").addEventListener("click", startLive);
$("#stop-live").addEventListener("click", () => stopLive());
$("#flip").addEventListener("click", flipCamera);
addEventListener("beforeunload", (e) => { if (room) { e.preventDefault(); e.returnValue = ""; } });

// Partager le live aux invités : lien direct (+ code si l'événement est privé).
$("#share-live").addEventListener("click", () => {
  const url = `${location.origin}/live?e=${encodeURIComponent(current.slug)}`;
  const text = current.accessCode
    ? `🔴 Suivez « ${current.name} » en direct ! Code d'accès : ${current.accessCode}`
    : `🔴 Suivez « ${current.name} » en direct !`;
  shareSheet({ title: current.name, text, url: current.accessCode ? `${location.origin}/e/${encodeURIComponent(current.slug)}?code=${current.accessCode}` : url });
});

load();

// Coller en un geste le lien copié depuis YouTube / Twitch dans le premier champ vide.
$("#paste-link").addEventListener("click", async () => {
  let text = "";
  try { text = (await navigator.clipboard.readText()).trim(); } catch { /* accès refusé */ }
  if (!/^https?:\/\//.test(text)) { toast("Copiez d'abord le lien du direct (YouTube : Partager → Copier le lien)."); return; }
  const urls = () => [...document.querySelectorAll('#cameras [name="cam-url"]')];
  let input = urls().find((i) => !i.value);
  if (!input) { $("#add-camera").click(); input = urls().pop(); }
  if (input) { input.value = text; toast("Lien collé ✓ Pensez à enregistrer."); }
});
