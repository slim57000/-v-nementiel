import { api, $, esc, toast, tabbar, goLogin, onRealtime, LOCALE, shareSheet, copy } from "./common.js";

tabbar("messages");
const otherId = Number(new URLSearchParams(location.search).get("u")) || null;
let meId = null;

export const avatarHtml = (p) => (p?.avatar
  ? `<span class="avatar" style="background-image:url('${esc(p.avatar)}')"></span>`
  : `<span class="avatar">${esc((p?.name || "?").charAt(0).toUpperCase())}</span>`);

// --- Devenir amis : un code / lien personnel à partager, ou le code d'un proche à saisir ---
const addFriend = async (code) => {
  const { id } = await api("/api/me/friends/add", { method: "POST", body: { code } });
  toast("Vous êtes maintenant amis 🎉");
  location.href = "/amis?new=" + id;
};
const invited = new URLSearchParams(location.search).get("ami");
// Depuis le profil (« + ») : ouvre directement la fenêtre d'ajout d'ami.
if (new URLSearchParams(location.search).has("add")) setTimeout(() => $("#add-friend")?.click(), 300);
if (invited) {
  // Non connecté : connexion puis retour ici avec le même lien.
  addFriend(invited).catch((err) => { if (err.status === 401) return goLogin(); history.replaceState(null, "", "/messages"); toast(err.message); });
}
$("#add-friend")?.addEventListener("click", async () => {
  let code = "";
  try { ({ code } = await api("/api/me/friend-code")); } catch (err) { return err.status === 401 ? goLogin() : toast(err.message); }
  const link = `${location.origin}/messages?ami=${code}`;
  document.body.insertAdjacentHTML("beforeend", `<div class="sheet" id="friend-sheet" role="dialog" aria-modal="true">
    <div class="card"><h2 style="margin-top:0"><b style="font-size:1.15em;line-height:1">+</b> Ajouter un ami</h2>
      <p class="muted" style="margin-top:0">Envoyez votre lien : la personne l'ouvre et vous êtes amis.</p>
      <div class="code-remind"><span><b>Mon code ami</b><small class="muted">À donner de vive voix</small></span>
        <button type="button" class="code" id="fr-copy">${code} 📋</button></div>
      <button class="btn btn-block" type="button" id="fr-share" style="margin-top:12px">📤 Envoyer mon lien</button>
      <form id="fr-form" class="code-find" style="margin-top:14px">
        <input id="fr-code" maxlength="6" autocapitalize="characters" autocomplete="off" placeholder="Code d'un ami" aria-label="Code d'un ami">
        <button class="btn btn-sm" type="submit">Ajouter</button>
      </form>
      <p class="error" id="fr-error" role="alert"></p>
      <button class="btn btn-light btn-block" type="button" id="fr-close">Fermer</button></div></div>`);
  const sheet = $("#friend-sheet");
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet || e.target.id === "fr-close") sheet.remove();
    if (e.target.id === "fr-copy") copy(code, "Code copié !");
    if (e.target.id === "fr-share") shareSheet({ title: "Ajoute-moi sur MaFeliza", text: "👋 Ajoute-moi en ami sur MaFeliza pour partager nos événements :", url: link });
  });
  $("#fr-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await addFriend($("#fr-code").value); } catch (err) { $("#fr-error").textContent = err.message; }
  });
});

const time = (d) => new Date(d).toLocaleString(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

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
      `<div class="bubble ${m.from === meId ? "mine" : ""}" data-id="${m.id}">${linkify(m.text)}<span>${time(m.createdAt)}</span></div>`);
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
  document.title = `${data.with?.name || "Messages"} — MaFeliza`;
  // Instantané via le temps réel si disponible (secours toutes les 20 s), sinon toutes les 4 s.
  const live = await onRealtime(`dm-${Math.min(meId, otherId)}-${Math.max(meId, otherId)}`, () => refresh());
  setInterval(() => { if (!document.hidden) refresh(); }, live ? 20000 : 4000);
}

// Envoi : un seul message à la fois, puis 1 s de pause (évite les doublons par double appui).
let sending = false;
$("#dm-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("#dm-text").value.trim();
  if (!text || sending) return;
  sending = true;
  const btn = $("#dm-form button");
  btn.disabled = true;
  $("#dm-text").value = "";
  try {
    addMessages([await api(`/api/me/dm/${otherId}`, { method: "POST", body: { text } })]);
  } catch (err) {
    $("#dm-text").value = text;
    toast(err.message);
  }
  setTimeout(() => { sending = false; btn.disabled = false; }, 1000);
});

// Toucher un de ses messages : proposition de le supprimer.
$("#thread").addEventListener("click", async (e) => {
  const b = e.target.closest(".bubble.mine");
  if (!b || e.target.closest("a")) return;
  if (!confirm("Supprimer ce message ? Il disparaîtra aussi chez votre ami.")) return;
  try {
    await api(`/api/me/dm/${otherId}/${b.dataset.id}`, { method: "DELETE" });
    b.remove();
    toast("Message supprimé");
  } catch (err) { toast(err.message); }
});

// Bloquer / retirer un ami (exigence App Store et Play Store).
$("#dm-more").addEventListener("click", () => {
  document.body.insertAdjacentHTML("beforeend", `
    <div class="sheet" id="dm-menu" role="dialog" aria-modal="true"><div class="card menu-card">
      <button class="btn btn-ghost btn-block" data-a="clear">🗑️ Supprimer la conversation</button>
      <button class="btn btn-ghost btn-block" data-a="remove">👋 Retirer de mes amis</button>
      <button class="btn btn-ghost btn-block" data-a="block">⛔ Bloquer cette personne</button>
      <button class="btn btn-light btn-block" data-a="close">Annuler</button>
    </div></div>`);
  const sheet = $("#dm-menu");
  sheet.addEventListener("click", async (e) => {
    const a = e.target.dataset.a || (e.target === sheet ? "close" : null);
    if (!a) return;
    sheet.remove();
    if (a === "clear" && confirm("Supprimer toute la conversation de votre côté ?")) {
      await api(`/api/me/dm/${otherId}`, { method: "DELETE" });
      $("#thread").innerHTML = "";
      toast("Conversation supprimée");
    }
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

// Liens du site cliquables dans les messages (faire-part, événements).
function linkify(text) {
  return esc(text).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:inherit;text-decoration:underline;overflow-wrap:anywhere">${url.replace(/^https?:\/\//, "")}</a>`);
}
