// 🎬 Création d'un réel : vidéo (filmée ou choisie), légende, événement lié facultatif.
// La vidéo est recompressée dans le téléphone (720p, 60 s max) puis envoyée au serveur en morceaux de 900 Ko.
import { api, $, esc, toast } from "./common.js";
import { t } from "./i18n.js";

const MAX_S = 60;
const CHUNK = 900 * 1024;

// Recompression en temps réel : la vidéo est rejouée dans un canvas et enregistrée (MediaRecorder), son compris.
async function compress(file, onProgress) {
  const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  const mime = window.MediaRecorder && types.find((x) => MediaRecorder.isTypeSupported?.(x));
  const v = document.createElement("video");
  v.playsInline = true; v.preload = "auto"; v.src = URL.createObjectURL(file);
  await new Promise((ok, ko) => { v.onloadedmetadata = ok; v.onerror = () => ko(new Error(t("Vidéo illisible."))); });
  const dur = Math.min(v.duration || MAX_S, MAX_S);
  const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
  const cv = document.createElement("canvas");
  cv.width = Math.round((v.videoWidth * scale) / 2) * 2; cv.height = Math.round((v.videoHeight * scale) / 2) * 2;
  // Miniature : première image.
  await new Promise((ok) => { v.onseeked = ok; v.currentTime = Math.min(0.5, dur / 2); });
  const g = cv.getContext("2d");
  g.drawImage(v, 0, 0, cv.width, cv.height);
  const thumb = cv.toDataURL("image/jpeg", 0.8);
  const small = file.size <= 15 * 1024 * 1024 && (v.duration || 0) <= MAX_S + 1;
  if (small || !mime || !cv.captureStream) {
    if ((v.duration || 0) > MAX_S + 1) throw new Error(t("Vidéo trop longue : 60 secondes maximum."));
    URL.revokeObjectURL(v.src);
    return { blob: file, type: file.type || "video/mp4", thumb };
  }
  try { return await record(v, cv, g, dur, mime, onProgress, thumb); }
  catch {
    // Recompression impossible (navigateur) : vidéo d'origine si elle passe.
    if (file.size > 80 * 1024 * 1024 || (v.duration || 0) > MAX_S + 1) throw new Error(t("Vidéo trop lourde ou trop longue : 60 secondes maximum."));
    return { blob: file, type: file.type || "video/mp4", thumb };
  } finally { URL.revokeObjectURL(v.src); }
}

async function record(v, cv, g, dur, mime, onProgress, thumb) {
  const stream = cv.captureStream(30);
  const Ctx = window.AudioContext || window.webkitAudioContext;
  let ac = null;
  try { ac = new Ctx(); const dest = ac.createMediaStreamDestination(); ac.createMediaElementSource(v).connect(dest); dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr)); }
  catch { v.muted = true; } // pas de son récupérable : vidéo muette
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 }), chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  v.currentTime = 0;
  await new Promise((ok) => { v.onseeked = ok; });
  rec.start(1000);
  await v.play().catch(() => { v.muted = true; return v.play(); });
  await new Promise((done) => {
    const tick = () => {
      g.drawImage(v, 0, 0, cv.width, cv.height);
      onProgress(Math.min(1, v.currentTime / dur));
      if (v.ended || v.currentTime >= dur) return done();
      requestAnimationFrame(tick);
    };
    tick();
  });
  v.pause();
  await new Promise((ok) => { rec.onstop = ok; rec.stop(); });
  ac?.close().catch(() => {});
  return { blob: new Blob(chunks, { type: mime.split(";")[0] }), type: mime.split(";")[0], thumb };
}

async function upload(blob, onProgress) {
  const u = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
  for (let i = 0, off = 0; off < blob.size; i++, off += CHUNK) {
    const r = await fetch(`/api/reels/chunk?u=${u}&i=${i}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: blob.slice(off, off + CHUNK) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || t("Envoi impossible, réessayez."));
    onProgress(Math.min(1, (off + CHUNK) / blob.size));
  }
  return u;
}

export function openReelComposer(file) {
  const url = URL.createObjectURL(file);
  document.body.insertAdjacentHTML("beforeend", `<div class="sheet" id="reel-new" role="dialog" aria-modal="true"><div class="card reel-new">
    <h2>🎬 ${t("Nouveau réel")}</h2>
    <video src="${url}" playsinline muted autoplay loop></video>
    <textarea id="rn-caption" maxlength="150" rows="2" placeholder="${esc(t("Ajoutez une légende…"))}"></textarea>
    <select id="rn-event" hidden><option value="">${t("Lier à un événement (facultatif)")}</option></select>
    <p class="muted small">${t("60 secondes maximum · visible par tous dans Réels")}</p>
    <div class="rn-bar" hidden><i></i></div><p class="rn-status muted small" hidden></p>
    <button class="btn btn-block" id="rn-go">${t("Publier")}</button>
    <button class="btn btn-light btn-block" id="rn-cancel">${t("Annuler")}</button>
  </div></div>`);
  const sheet = $("#reel-new");
  const close = () => { URL.revokeObjectURL(url); sheet.remove(); };
  $("#rn-cancel").onclick = close;
  api("/api/events").then((list) => {
    const pub = (list || []).filter((e) => e.visibility === "public");
    if (!pub.length) return;
    $("#rn-event").insertAdjacentHTML("beforeend", pub.map((e) => `<option value="${esc(e.slug)}">${esc(e.name)}</option>`).join(""));
    $("#rn-event").hidden = false;
  }).catch(() => {});
  $("#rn-go").onclick = async (e) => {
    const btn = e.currentTarget, bar = sheet.querySelector(".rn-bar"), status = sheet.querySelector(".rn-status");
    btn.disabled = true; $("#rn-cancel").hidden = true; bar.hidden = false; status.hidden = false;
    const step = (label, p) => { status.textContent = `${label} ${Math.round(p * 100)}%`; bar.firstElementChild.style.width = `${p * 100}%`; };
    try {
      step(t("Préparation de la vidéo…"), 0);
      const out = await compress(file, (p) => step(t("Préparation de la vidéo…"), p));
      const u = await upload(out.blob, (p) => step(t("Envoi…"), p));
      await api("/api/reels", { method: "POST", body: { u, type: out.type, thumb: out.thumb, caption: $("#rn-caption").value, slug: $("#rn-event").value } });
      close();
      toast(t("Réel publié 🎉"));
      setTimeout(() => { location.href = "/dashboard#reels"; }, 700);
    } catch (err) {
      toast(err.message);
      btn.disabled = false; $("#rn-cancel").hidden = false; bar.hidden = true; status.hidden = true;
    }
  };
}
