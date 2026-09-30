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
  (ev.cameras.length ? ev.cameras : [{}]).forEach(addCamera);
  $("#open-live").href = `/live?e=${encodeURIComponent(ev.slug)}`;
  // Live en un clic depuis le téléphone (si activé) ; les liens YouTube / Twitch restent possibles en secours.
  if (ev.phoneLive) {
    $("#phone-live").classList.remove("hidden");
    $("#links-card h2").textContent = "🔗 Ou un lien YouTube / Twitch";
  }
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

// --- Direct depuis le téléphone (WebRTC → Cloudflare Stream, protocole WHIP) ---
let pc = null, stream = null, resource = null, facing = "environment", wakeLock = null;
const status = (t) => { $("#live-status").textContent = t; };

async function getCamera() {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: { echoCancellation: true, noiseSuppression: true },
  });
}

async function startLive() {
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) return toast("Ce navigateur ne permet pas de filmer. Utilisez Safari ou Chrome à jour.");
  $("#go-live").disabled = true;
  status("Accès à la caméra…");
  try {
    stream = await getCamera();
    $("#preview").srcObject = stream;
    $("#preview-wrap").classList.remove("hidden");
    status("Connexion au direct…");
    const { whip } = await api(`/api/cameraman/${encodeURIComponent(slug)}/go-live`, { method: "POST", body: { name: $("#cam-label").value } });
    pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }], bundlePolicy: "max-bundle" });
    for (const track of stream.getTracks()) pc.addTransceiver(track, { direction: "sendonly" });
    await pc.setLocalDescription(await pc.createOffer());
    await new Promise((ok) => {
      if (pc.iceGatheringState === "complete") return ok();
      pc.addEventListener("icegatheringstatechange", () => pc.iceGatheringState === "complete" && ok());
      setTimeout(ok, 2500);
    });
    const res = await fetch(whip, { method: "POST", headers: { "Content-Type": "application/sdp" }, body: pc.localDescription.sdp });
    if (!res.ok) throw new Error("Le service vidéo a refusé la connexion, réessayez.");
    resource = res.headers.get("Location") ? new URL(res.headers.get("Location"), whip).href : null;
    await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
    pc.addEventListener("connectionstatechange", () => {
      if (pc?.connectionState === "failed" || pc?.connectionState === "disconnected") status("⚠️ Connexion perdue : vérifiez le réseau puis relancez.");
      if (pc?.connectionState === "connected") status("Les invités vous voient. Gardez cet écran ouvert.");
    });
    try { wakeLock = await navigator.wakeLock?.request("screen"); } catch { /* facultatif */ }
    $("#go-live").classList.add("hidden");
    $("#live-controls").classList.remove("hidden");
    $("#live-dot").classList.add("on");
    status("Démarrage du direct…");
  } catch (err) {
    stopLive(true);
    status("");
    toast(err.name === "NotAllowedError" ? "Autorisez la caméra et le micro dans les réglages du navigateur." : err.message);
  }
  $("#go-live").disabled = false;
}

async function stopLive(silent) {
  if (resource) fetch(resource, { method: "DELETE" }).catch(() => {});
  pc?.close();
  stream?.getTracks().forEach((t) => t.stop());
  wakeLock?.release?.().catch(() => {});
  pc = stream = resource = wakeLock = null;
  $("#preview-wrap").classList.add("hidden");
  $("#live-controls").classList.add("hidden");
  $("#go-live").classList.remove("hidden");
  $("#live-dot").classList.remove("on");
  if (!silent) { status("Direct arrêté. Il est enregistré pour le replay."); toast("Direct arrêté"); }
}

// Retourner la caméra (avant / arrière) sans couper le direct.
async function flipCamera() {
  facing = facing === "environment" ? "user" : "environment";
  try {
    const fresh = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
    const track = fresh.getVideoTracks()[0];
    await pc?.getSenders().find((s) => s.track?.kind === "video")?.replaceTrack(track);
    stream.getVideoTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
    stream.addTrack(track);
    $("#preview").srcObject = stream;
  } catch { toast("Impossible de changer de caméra."); }
}

$("#go-live").addEventListener("click", startLive);
// Partager le live aux invités : lien direct (+ code si l'événement est privé).
$("#share-live").addEventListener("click", () => {
  const url = `${location.origin}/live?e=${encodeURIComponent(current.slug)}`;
  const text = current.accessCode
    ? `🔴 Suivez « ${current.name} » en direct ! Code d'accès : ${current.accessCode}`
    : `🔴 Suivez « ${current.name} » en direct !`;
  shareSheet({ title: current.name, text, url: current.accessCode ? `${location.origin}/e/${encodeURIComponent(current.slug)}?code=${current.accessCode}` : url });
});
$("#stop-live").addEventListener("click", () => stopLive());
$("#flip").addEventListener("click", flipCamera);
addEventListener("beforeunload", (e) => { if (pc) { e.preventDefault(); e.returnValue = ""; } });

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
