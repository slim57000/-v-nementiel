// Connexion Google dans l'application iOS / Android : Google refuse les vues intégrées, la connexion s'ouvre donc
// dans le navigateur (Safari / Chrome). L'appli attend ici, puis se connecte dès que la personne a validé le code.
import { api, esc } from "./common.js";
import { t as tr } from "./i18n.js";

export async function googleInApp(next, toast) {
  let start;
  try { start = await api("/api/auth/google/app-start", { method: "POST", body: { next } }); }
  catch (err) { return toast(err.message); }
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.setAttribute("role", "dialog");
  sheet.innerHTML = `<div class="card" style="text-align:center">
    <h2>${esc(tr("Connexion avec Google"))}</h2>
    <p class="muted">${esc(tr("Terminez la connexion dans le navigateur, puis vérifiez que ce code s'affiche :"))}</p>
    <p style="font-size:3rem;font-weight:800;letter-spacing:.1em;margin:8px 0">${esc(start.code)}</p>
    <p class="muted">${esc(tr("Revenez ensuite ici : la connexion se fait toute seule."))}</p>
    <button type="button" class="btn btn-block" data-open>${esc(tr("Rouvrir Google"))}</button>
    <button type="button" class="btn btn-ghost btn-block" style="margin-top:8px" data-close>${esc(tr("Annuler"))}</button>
  </div>`;
  document.body.append(sheet);
  let done = false;
  const stop = () => { done = true; clearInterval(timer); document.removeEventListener("visibilitychange", poll); sheet.remove(); };
  async function poll() {
    if (done || document.hidden) return;
    try {
      const r = await api("/api/auth/google/app-poll", { method: "POST", body: { id: start.id, secret: start.secret } });
      if (r.ok) { stop(); location.href = r.next || "/dashboard"; }
    } catch (err) { stop(); toast(err.message); }
  }
  const timer = setInterval(poll, 2000);
  document.addEventListener("visibilitychange", poll);
  sheet.querySelector("[data-close]").onclick = stop;
  sheet.querySelector("[data-open]").onclick = () => { location.href = start.url; };
  location.href = start.url; // lien externe : l'appli l'ouvre dans le navigateur
}

// Appli récente : fenêtre Google native du téléphone (2 touches, sans navigateur ni code).
// Si elle n'est pas disponible (identifiant iPhone non configuré, ancienne version), parcours par le navigateur.
export const hasNativeGoogle = () => typeof window.MaFelizaGoogle?.postMessage === "function";
export function googleSignIn(next, toast) {
  if (!hasNativeGoogle()) return googleInApp(next, toast);
  window.mafelizaGoogleDone = async (data) => {
    try {
      const r = await api("/api/auth/google/native", { method: "POST", body: { idToken: data.idToken, next } });
      location.href = r.next || next || "/dashboard";
    } catch (err) { toast(err.message); }
  };
  window.mafelizaGoogleError = (msg) => {
    if (msg === "canceled") return;
    if (msg === "unavailable") return googleInApp(next, toast);
    toast(tr("Connexion Google impossible. Réessayez ou utilisez votre email."));
  };
  window.MaFelizaGoogle.postMessage("signin");
}
