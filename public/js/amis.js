// « Mes amis » : liste complète, recherche, écrire à un ami ou le retirer.
import { api, $, esc, toast, tabbar, goLogin } from "./common.js";

tabbar("profile");
let friends = [];
const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const avatar = (f) => `<span class="avatar" ${f.avatar ? `style="background-image:url('${esc(f.avatar)}')"` : ""}>${f.avatar ? "" : esc(f.name.charAt(0).toUpperCase())}</span>`;

function show() {
  const q = norm($("#search").value);
  const list = friends.filter((f) => norm(f.name).includes(q));
  $("#list").innerHTML = list.map((f) => `<div class="friend-row">
    ${avatar(f)}<span class="friend-main" style="flex:1;min-width:0"><b>${esc(f.name)}</b></span>
    <a class="btn btn-sm" href="/messages?u=${f.id}" aria-label="Écrire à ${esc(f.name)}">💬</a>
    <button class="btn btn-ghost btn-sm" data-remove="${f.id}" aria-label="Retirer ${esc(f.name)} de mes amis">👋</button></div>`).join("");
  $("#empty").classList.toggle("hidden", friends.length > 0);
  $("#count").textContent = friends.length ? `(${friends.length})` : "";
}

// Demandes d'ami reçues (bouton « Ajouter l'organisateur ») : accepter ou refuser.
async function showRequests() {
  const reqs = await api("/api/me/friends/requests").catch(() => []);
  $("#requests").innerHTML = reqs.length ? `<h2 style="font-size:1.05rem;margin:4px 0 8px">👋 Demandes d'ami (${reqs.length})</h2>` + reqs.map((f) => `<div class="friend-row">
    ${avatar(f)}<span class="friend-main" style="flex:1;min-width:0"><b>${esc(f.name)}</b></span>
    <button class="btn btn-sm" data-req="${f.id}" data-answer="accept">Accepter</button>
    <button class="btn btn-ghost btn-sm" data-req="${f.id}" data-answer="decline" aria-label="Refuser">✕</button></div>`).join("") + `<h2 style="font-size:1.05rem;margin:16px 0 8px">Mes amis</h2>` : "";
}
$("#requests").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-req]");
  if (!b) return;
  b.disabled = true;
  try {
    await api(`/api/me/friends/requests/${b.dataset.req}/${b.dataset.answer}`, { method: "POST" });
    if (b.dataset.answer === "accept") { toast("Vous êtes maintenant amis 🎉"); friends = (await api("/api/me/friends")).sort((a, c) => a.name.localeCompare(c.name)); show(); }
    showRequests();
  } catch (err) { toast(err.message); b.disabled = false; }
});
showRequests();

try {
  friends = (await api("/api/me/friends")).sort((a, b) => a.name.localeCompare(b.name));
  show();
  // Ami tout juste ajouté : message de bienvenue et mise en avant.
  const added = new URLSearchParams(location.search).get("new");
  if (added) {
    history.replaceState(null, "", "/amis");
    toast("Vous êtes maintenant amis 🎉");
    document.querySelector(`[data-remove="${CSS.escape(added)}"]`)?.closest(".friend-row")?.classList.add("new");
  }
} catch (err) { if (err.status === 401) goLogin(); else toast(err.message); }

$("#search").addEventListener("input", show);
$("#list").addEventListener("click", async (e) => {
  const id = e.target.closest("[data-remove]")?.dataset.remove;
  if (!id || !confirm("Retirer cette personne de vos amis ?")) return;
  try {
    await api(`/api/me/friends/${id}`, { method: "DELETE" });
    friends = friends.filter((f) => String(f.id) !== id);
    show();
    toast("Ami retiré");
  } catch (err) { toast(err.message); }
});
