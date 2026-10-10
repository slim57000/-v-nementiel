// Mode simple (« grand-parent ») : très gros textes, un seul gros bouton pour regarder le live.
import { api, $, esc, formatDate, liveState } from "./common.js";

const q = new URLSearchParams(location.search);
const slug = q.get("e") || "";
let timer;

async function unlock(code) {
  await api(`/api/public/${encodeURIComponent(slug)}/unlock`, { method: "POST", body: { code } });
}

async function load() {
  if (q.get("code")) { await unlock(q.get("code")).catch(() => {}); history.replaceState(null, "", `/simple?e=${encodeURIComponent(slug)}`); }
  let ev;
  try { ev = await api(`/api/public/${encodeURIComponent(slug)}`); } catch { $("#s-kicker").textContent = "Événement introuvable."; return; }
  if (ev.locked) {
    $("#s-kicker").textContent = "🔒 Événement privé";
    $("#s-name").textContent = ev.name || "";
    $("#s-hint").textContent = "Entrez le code reçu avec l'invitation.";
    $("#s-code").classList.remove("hidden");
    return;
  }
  $("#s-code").classList.add("hidden");
  document.title = `${ev.name} — MaFeliza`;
  $("#s-name").textContent = ev.name;
  $("#s-when").textContent = formatDate(ev.date, ev.time);
  $("#s-more").href = `/e/${encodeURIComponent(ev.slug)}`;
  $("#s-more").classList.remove("hidden");
  const watch = $("#s-watch");
  watch.href = `/live?e=${encodeURIComponent(ev.slug)}`;
  watch.classList.remove("hidden");
  const state = liveState(ev);
  const onAir = (ev.cameras || []).some((c) => c.live);
  if (state === "replay") {
    $("#s-kicker").textContent = "🎞️ Le replay est disponible";
    watch.textContent = "▶ Revoir l'événement";
    $("#s-hint").textContent = "Touchez le gros bouton pour revoir le moment.";
  } else if (state === "expired" || state === "pending") {
    $("#s-kicker").textContent = "Merci d'avoir partagé ce moment 💛";
    watch.classList.add("hidden");
    $("#s-hint").textContent = "";
  } else if (onAir) {
    $("#s-kicker").textContent = "🔴 C'EST EN DIRECT !";
    watch.textContent = "▶ Regarder le live";
    watch.classList.add("is-live");
    $("#s-hint").textContent = "Touchez le gros bouton rose. Pensez à monter le son 🔊";
  } else {
    $("#s-kicker").textContent = ev.date === new Date().toISOString().slice(0, 10) ? "C'est aujourd'hui ! 🎉" : "Vous êtes invité·e 💌";
    watch.textContent = "▶ Regarder le live";
    watch.classList.remove("is-live");
    $("#s-hint").textContent = ev.time ? `Le direct commencera à ${ev.time.replace(":", "h")}. Revenez sur cette page à ce moment-là.` : "Revenez sur cette page au moment du direct.";
  }
  clearTimeout(timer);
  timer = setTimeout(load, 30_000); // la page se met à jour toute seule
}

$("#s-code").addEventListener("submit", async (e) => {
  e.preventDefault();
  try { await unlock($("#s-code-input").value.trim()); load(); }
  catch (err) { $("#s-hint").textContent = err.message; }
});
load();
