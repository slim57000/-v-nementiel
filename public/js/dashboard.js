import { api, $, esc, copy, share, toast, eventUrl, formatDate, EVENT_TYPES } from "./common.js";

const params = new URLSearchParams(location.search);
if (params.has("saved")) {
  toast("Événement enregistré ✔");
  history.replaceState(null, "", "/dashboard");
}

let events = [];

async function load() {
  try {
    const me = await api("/api/auth/me");
    $("#account").innerHTML = `Connecté : <b>${esc(me.email)}</b> · code organisateur <b>${esc(me.code)}</b>`;
    events = await api("/api/events");
  } catch (err) {
    if (err.status === 401) return location.replace("/");
    return toast(err.message);
  }
  render();
}

function render() {
  $("#empty").classList.toggle("hidden", events.length > 0);
  $("#list").innerHTML = events.map((ev) => {
    const type = EVENT_TYPES[ev.type];
    const isPrivate = ev.visibility === "private";
    return `
    <article class="card event-item" data-slug="${esc(ev.slug)}">
      ${ev.cover ? `<img class="event-thumb" src="${esc(ev.cover)}" alt="">` : `<div class="event-thumb">${type.icon}</div>`}
      <div>
        <h3 style="margin:0">${esc(ev.name)}</h3>
        <div class="muted small">${type.label} · ${esc(formatDate(ev.date, ev.time))}</div>
        <div class="row" style="margin-top:6px;gap:6px">
          <span class="badge ${isPrivate ? "private" : ""}" style="flex:none">${isPrivate ? "🔒 Privé" : "🔓 Public"}</span>
          ${isPrivate ? `<span class="small" style="flex:none">Code : <b class="code" style="font-size:1rem">${esc(ev.accessCode)}</b></span>` : ""}
        </div>
      </div>
      <div class="event-actions">
        <a class="btn btn-light btn-sm" href="/e/${esc(ev.slug)}">Voir</a>
        <button class="btn btn-light btn-sm" data-action="share">Partager</button>
        <button class="btn btn-light btn-sm" data-action="link">Copier le lien</button>
        ${isPrivate ? `<button class="btn btn-light btn-sm" data-action="code">Copier le code</button>
        <button class="btn btn-light btn-sm" data-action="direct">Lien + code</button>` : ""}
        <a class="btn btn-ghost btn-sm" href="/edit?id=${ev.id}">Modifier</a>
        <button class="btn btn-danger btn-sm" data-action="delete">Supprimer</button>
      </div>
    </article>`;
  }).join("");
}

$("#list").addEventListener("click", async (e) => {
  const action = e.target.dataset.action;
  if (!action) return;
  const ev = events.find((x) => x.slug === e.target.closest("[data-slug]").dataset.slug);
  const url = eventUrl(ev.slug);

  if (action === "link") copy(url, "Lien copié !");
  if (action === "code") copy(ev.accessCode, "Code copié !");
  // Lien qui déverrouille directement l'événement privé (à n'envoyer qu'aux invités).
  if (action === "direct") copy(`${url}?code=${ev.accessCode}`, "Lien avec code copié !");
  if (action === "share") {
    const text = ev.visibility === "private"
      ? `Vous êtes invité·e à « ${ev.name} » ! Code d'accès : ${ev.accessCode}`
      : `Vous êtes invité·e à « ${ev.name} » !`;
    share({ title: ev.name, text, url });
  }
  if (action === "delete" && confirm(`Supprimer définitivement « ${ev.name} » ?`)) {
    try {
      await api(`/api/events/${ev.id}`, { method: "DELETE" });
      events = events.filter((x) => x !== ev);
      render();
      toast("Événement supprimé");
    } catch (err) {
      toast(err.message);
    }
  }
});

$("#logout").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  location.replace("/");
});

load();
