import { api, $, esc, toast, formatDate, goLogin, EVENT_TYPES, LOCALE, backButton } from "./common.js";
backButton();

let tab = "events";
let timer;

const row = (main, sub, actions) => `
  <div class="admin-row"><div class="admin-main">${main}<div class="muted small">${sub}</div></div><div class="admin-actions">${actions}</div></div>`;

const me = await api("/api/auth/me").catch(() => ({}));

const views = {
  async events(q) {
    const list = await api(`/api/admin/events?q=${encodeURIComponent(q)}`);
    return list.map((e) => row(
      `<b>${esc(e.name)}</b> ${e.suspended ? '<span class="badge private">Suspendu</span>' : ""} ${e.reports ? `<span class="report-badge">⚠️ ${e.reports}</span>` : ""}`,
      `${EVENT_TYPES[e.type]?.label || e.type} · ${esc(formatDate(e.date, "00:00").split(" à")[0])} · ${esc(e.location)} · ${esc(e.organizer)} · ${e.visibility === "private" ? "🔒" : "🔓"}`,
      `<a class="btn btn-light btn-sm" href="/e/${esc(e.slug)}" target="_blank">Voir</a>
       <button class="btn btn-ghost btn-sm" data-act="suspend" data-id="${e.id}" data-on="${!e.suspended}">${e.suspended ? "Réactiver" : "Suspendre"}</button>
       <button class="btn btn-danger btn-sm" data-act="delete-event" data-id="${e.id}">Supprimer</button>`,
    )).join("") || "<p class='muted'>Aucun événement.</p>";
  },
  async organizers(q) {
    const list = await api(`/api/admin/organizers?q=${encodeURIComponent(q)}`);
    return list.map((o) => row(
      `<b>${esc(o.email)}</b> ${o.superAdmin ? '<span class="badge">👑 Admin principal</span>' : o.admin ? '<span class="badge">Admin</span>' : ""} ${o.blocked ? '<span class="badge private">Bloqué</span>' : ""} ${o.premium ? '<span class="badge">✨ Premium</span>' : ""}`,
      `${o.events} événement(s) · inscrit le ${new Date(o.createdAt).toLocaleDateString(LOCALE)}`,
      (o.superAdmin || !me.superAdmin ? "" : `<button class="btn btn-light btn-sm" data-act="admin" data-id="${o.id}" data-on="${!o.admin}">${o.admin ? "Retirer admin" : "👑 Passer admin"}</button> `)
      + `<button class="btn btn-light btn-sm" data-act="premium" data-id="${o.id}" data-on="${!o.premium}">${o.premium ? "Retirer Premium" : "✨ Passer Premium"}</button>`
      + (o.admin ? "" : ` <button class="btn ${o.blocked ? "btn-light" : "btn-danger"} btn-sm" data-act="block" data-id="${o.id}" data-on="${!o.blocked}">${o.blocked ? "Débloquer" : "Bloquer"}</button>`),
    )).join("") || "<p class='muted'>Aucun utilisateur.</p>";
  },
  async reports() {
    const list = await api("/api/admin/reports");
    const kinds = { message: "Message du chat", photo: "Photo", guestbook: "Livre d'or" };
    return list.map((r) => row(
      `<b>${kinds[r.kind] || r.kind}</b> sur « ${esc(r.eventName)} »`,
      `${esc(r.reason || "Sans motif")} · ${new Date(r.createdAt).toLocaleString(LOCALE)}`,
      `${r.eventSlug ? `<a class="btn btn-light btn-sm" href="/e/${esc(r.eventSlug)}" target="_blank">Voir</a>` : ""}
       <button class="btn btn-ghost btn-sm" data-act="close-report" data-id="${r.id}">Traité</button>`,
    )).join("") || "<p class='muted'>Aucun signalement 🎉</p>";
  },
  async settings() {
    const s = await api("/api/admin/settings");
    return `<section class="card">
      <h2 style="font-size:1rem">Plateforme live par défaut</h2>
      <p class="muted small">Proposée aux organisateurs et caméramans lors de l'ajout d'une caméra.</p>
      <div class="segments" id="platform">
        <button data-p="youtube" class="${s.defaultLivePlatform === "youtube" ? "active" : ""}">YouTube</button>
        <button data-p="twitch" class="${s.defaultLivePlatform === "twitch" ? "active" : ""}">Twitch</button>
      </div></section>
      <section class="card">
      <h2 style="font-size:1rem">Événements de démonstration</h2>
      <p class="muted small">50 faux événements (mariages, anniversaires…) créés sous le compte demo@evermoments.app, pour remplir Découvrir et l'accueil.</p>
      <button class="btn btn-block" data-demo="add"><b style="font-size:1.15em;line-height:1">+</b> Créer 50 événements</button>
      <button class="btn btn-ghost btn-block" data-demo="del" style="margin-top:8px">🗑️ Supprimer les événements de démo</button>
      <button class="btn btn-light btn-block" data-demo="msg" style="margin-top:8px">💬 Recevoir des messages privés de test</button>
      <button class="btn btn-light btn-block" data-demo="invite" style="margin-top:8px">💌 Recevoir un faire-part de test</button>
      <button class="btn btn-light btn-block" data-demo="album" style="margin-top:8px">📖 Créer un album souvenir de test</button>
      </section>
      <section class="card">
      <h2 style="font-size:1rem">Journal des actions</h2>
      <p class="muted small">Les 100 dernières actions d'administration (qui, quoi, quand).</p>
      <div class="audit">${(await api("/api/admin/audit")).map((a) => `<div class="audit-row"><b>${esc(a.by)}</b> · ${esc(a.action)}${a.detail ? ` <span class="muted">(${esc(a.detail)})</span>` : ""}<br><span class="muted small">${new Date(a.at).toLocaleString(LOCALE)}</span></div>`).join("") || '<p class="muted small">Aucune action pour le moment.</p>'}</div>
      </section>`;
  },
};

async function render() {
  $("#q").classList.toggle("hidden", tab === "reports" || tab === "settings");
  try {
    $("#content").innerHTML = await views[tab]($("#q").value.trim());
  } catch (err) {
    if (err.status === 401) return goLogin();
    $("#content").innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

$("#tabs").addEventListener("click", (e) => {
  if (!e.target.dataset.tab) return;
  tab = e.target.dataset.tab;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b === e.target));
  $("#q").value = "";
  render();
});
$("#q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(render, 300); });

$("#content").addEventListener("click", async (e) => {
  const { act, id, on, p, demo } = e.target.dataset;
  try {
    if (demo) {
      if (demo === "del" && !confirm("Supprimer tous les événements de démonstration ?")) return;
      e.target.disabled = true;
      if (demo === "invite") {
        await api("/api/admin/demo-invitation", { method: "POST" });
        e.target.disabled = false;
        return toast("Faire-part reçu de Awa (démo) — ouvrez Messages 💌");
      }
      if (demo === "album") {
        const a = await api("/api/admin/demo-album", { method: "POST" });
        location.href = `/album?id=${a.id}`;
        return;
      }
      if (demo === "msg") {
        const m = await api("/api/admin/demo-messages", { method: "POST" });
        e.target.disabled = false;
        return toast(`${m.count} messages reçus de ${m.from} — ouvrez Messages 💬`);
      }
      const r = await api("/api/admin/demo", { method: demo === "add" ? "POST" : "DELETE" });
      e.target.disabled = false;
      return toast(demo === "add" ? `${r.created} événements créés ✔` : `${r.deleted} événements supprimés`);
    }
    if (p) {
      await api("/api/admin/settings", { method: "PUT", body: { defaultLivePlatform: p } });
      toast("Réglage enregistré");
    }
    if (act === "suspend") await api(`/api/admin/events/${id}/suspend`, { method: "POST", body: { suspended: on === "true" } });
    if (act === "delete-event") {
      if (!confirm("Supprimer définitivement cet événement et tous ses contenus ?")) return;
      await api(`/api/admin/events/${id}`, { method: "DELETE" });
    }
    if (act === "admin") {
      if (on === "true" || confirm("Retirer les droits d'administration à cet utilisateur ?")) {
        await api(`/api/admin/organizers/${id}/admin`, { method: "POST", body: { admin: on === "true" } });
        toast(on === "true" ? "Utilisateur nommé administrateur 👑" : "Droits d'administration retirés");
        render();
      }
    }
    if (act === "premium") {
      await api(`/api/admin/organizers/${id}/premium`, { method: "POST", body: { premium: on === "true" } });
      toast(on === "true" ? "Compte passé en Premium ✨" : "Premium retiré");
      render();
    }
    if (act === "block") {
      if (on === "true" && !confirm("Bloquer cet utilisateur ? Ses événements seront suspendus.")) return;
      await api(`/api/admin/organizers/${id}/block`, { method: "POST", body: { blocked: on === "true" } });
    }
    if (act === "close-report") await api(`/api/admin/reports/${id}`, { method: "DELETE" });
    if (act || p) render();
  } catch (err) { toast(err.message); }
});

render();
