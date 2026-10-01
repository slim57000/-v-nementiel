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
