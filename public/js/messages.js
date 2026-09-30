import { api, $, esc, toast, tabbar, goLogin, onRealtime } from "./common.js";

tabbar("messages");
const otherId = Number(new URLSearchParams(location.search).get("u")) || null;
let meId = null;

export const avatarHtml = (p) => (p?.avatar
  ? `<span class="avatar" style="background-image:url('${esc(p.avatar)}')"></span>`
  : `<span class="avatar">${esc((p?.name || "?").charAt(0).toUpperCase())}</span>`);

const time = (d) => new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// --- Liste des conversations ---
async function showList() {
  const [friends, blocked] = await Promise.all([api("/api/me/friends"), api("/api/me/blocks")]);
  $("#friends").innerHTML = friends.map((f) => `
    <a class="friend-row" href="/messages?u=${f.id}">
      ${avatarHtml(f)}
      <span class="friend-main"><b>${esc(f.name)}</b>
        <span class="muted small">${f.last ? `${f.last.from === meId ? "Vous : " : ""}${esc(f.last.text)}` : "Dites bonjour 👋"}</span></span>
      ${f.last ? `<span class="muted small">${time(f.last.createdAt)}</span>` : ""}
    </a>`).join("");
  $("#no-friends").classList.toggle("hidden", friends.length > 0);
  $("#blocked-box").classList.toggle("hidden", !blocked.length);
  $("#blocked-count").textContent = `(${blocked.length})`;
  $("#blocked").innerHTML = blocked.map((b) => `
    <div class="friend-row">${avatarHtml(b)}<span class="friend-main"><b>${esc(b.name)}</b></span>
      <button class="btn btn-light btn-sm" data-unblock="${b.id}">Débloquer</button></div>`).join("");
}

$("#blocked").addEventListener("click", async (e) => {
  const id = e.target.dataset.unblock;
  if (!id) return;
  await api(`/api/me/blocks/${id}`, { method: "DELETE" });
  toast("Personne débloquée");
  showList();
});

// --- Conversation ---
let lastId = 0;

function addMessages(list) {
  const thread = $("#thread");
  const atBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
  for (const m of list) {
    if (m.id <= lastId) continue;
    lastId = m.id;
    thread.insertAdjacentHTML("beforeend",
      `<div class="bubble ${m.from === meId ? "mine" : ""}">${esc(m.text)}<span>${time(m.createdAt)}</span></div>`);
  }
  if (atBottom || list.length) thread.scrollTop = thread.scrollHeight;
}

async function refresh() {
  try {
    const data = await api(`/api/me/dm/${otherId}?after=${lastId}`);
    addMessages(data.messages);
    return data;
  } catch (err) {
    $("#thread").innerHTML = `<p class="muted" style="text-align:center">${esc(err.message)}</p>`;
    $("#dm-form").classList.add("hidden");
    return null;
  }
}

async function showConversation() {
  $("#list-view").classList.add("hidden");
  $("#dm-view").classList.remove("hidden");
  const data = await refresh();
  if (!data) return;
  $("#dm-name").textContent = data.with?.name || "";
  $("#dm-avatar").outerHTML = avatarHtml(data.with);
  document.title = `${data.with?.name || "Messages"} — EverMoments`;
  // Instantané via le temps réel si disponible (secours toutes les 20 s), sinon toutes les 4 s.
  const live = await onRealtime(`dm-${Math.min(meId, otherId)}-${Math.max(meId, otherId)}`, () => refresh());
  setInterval(() => { if (!document.hidden) refresh(); }, live ? 20000 : 4000);
}

$("#dm-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("#dm-text").value.trim();
  if (!text) return;
  try {
    addMessages([await api(`/api/me/dm/${otherId}`, { method: "POST", body: { text } })]);
    $("#dm-text").value = "";
  } catch (err) { toast(err.message); }
});

// Bloquer / retirer un ami (exigence App Store et Play Store).
$("#dm-more").addEventListener("click", () => {
  document.body.insertAdjacentHTML("beforeend", `
    <div class="sheet" id="dm-menu" role="dialog" aria-modal="true"><div class="card menu-card">
      <button class="btn btn-ghost btn-block" data-a="remove">👋 Retirer de mes amis</button>
      <button class="btn btn-ghost btn-block" data-a="block">⛔ Bloquer cette personne</button>
      <button class="btn btn-light btn-block" data-a="close">Annuler</button>
    </div></div>`);
  const sheet = $("#dm-menu");
  sheet.addEventListener("click", async (e) => {
    const a = e.target.dataset.a || (e.target === sheet ? "close" : null);
    if (!a) return;
    sheet.remove();
    if (a === "remove" && confirm("Retirer cette personne de vos amis ?")) {
      await api(`/api/me/friends/${otherId}`, { method: "DELETE" });
      location.replace("/messages");
    }
    if (a === "block" && confirm("Bloquer cette personne ? Elle ne pourra plus vous écrire.")) {
      await api(`/api/me/blocks/${otherId}`, { method: "POST" });
      location.replace("/messages");
    }
  });
});

try {
  meId = (await api("/api/auth/me")).id;
  otherId ? await showConversation() : await showList();
} catch (err) {
  if (err.status === 401) goLogin();
}
