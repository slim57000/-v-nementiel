// Interface d'administration : utilisateurs, événements, signalements, événements de démonstration.
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
      `<b>${esc(o.email)}</b> ${o.superAdmin ? '<span class="badge">👑 Admin principal</span>' : o.admin ? `<span class="badge">Admin${o.adminUntil ? ` · jusqu'au ${until(o.adminUntil)}` : ""}</span>` : ""} ${o.blocked ? '<span class="badge private">Bloqué</span>' : ""} ${o.premium ? `<span class="badge">✨ Premium${o.premiumUntil ? ` · jusqu'au ${until(o.premiumUntil)}` : ""}</span>` : ""}`,
      `${o.events} événement(s) · inscrit le ${new Date(o.createdAt).toLocaleDateString(LOCALE)}`,
      (o.superAdmin ? "" : `<button class="btn btn-light btn-sm" data-act="admin" data-id="${o.id}" data-on="${!o.admin}">${o.admin ? "Retirer admin" : "👑 Passer admin"}</button> ${o.admin ? `<button class="btn btn-ghost btn-sm" data-act="admin-dur" data-id="${o.id}">⏱ Durée admin</button> ` : ""}`)
      + `<button class="btn btn-light btn-sm" data-act="premium" data-id="${o.id}" data-on="${!o.premium}">${o.premium ? "Retirer Premium" : "✨ Passer Premium"}</button>${o.premium ? ` <button class="btn btn-ghost btn-sm" data-act="premium-dur" data-id="${o.id}">⏱ Durée Premium</button>` : ""}`
      + (o.admin ? "" : ` <button class="btn ${o.blocked ? "btn-light" : "btn-danger"} btn-sm" data-act="block" data-id="${o.id}" data-on="${!o.blocked}">${o.blocked ? "Débloquer" : "Bloquer"}</button>`),
    )).join("") || "<p class='muted'>Aucun utilisateur.</p>";
  },
  async reports() {
    const list = await api("/api/admin/reports");
    const kinds = { message: "Message du chat", photo: "Photo", guestbook: "Livre d'or", event: "Événement" };
    return list.map((r) => row(
      `<b>${kinds[r.kind] || r.kind}</b> sur « ${esc(r.eventName)} »`,
      `${esc(r.reason || "Sans motif")} · ${new Date(r.createdAt).toLocaleString(LOCALE)}`,
      `${r.eventSlug ? `<a class="btn btn-light btn-sm" href="/e/${esc(r.eventSlug)}" target="_blank">Voir</a>` : ""}
       <button class="btn btn-ghost btn-sm" data-act="close-report" data-id="${r.id}">Traité</button>`,
    )).join("") || "<p class='muted'>Aucun signalement 🎉</p>";
  },
  async contact() {
    const list = await api("/api/admin/contact");
    return list.map((m) => `<section class="card contact-msg">
      <div class="admin-main"><b>${esc(m.name || "Sans nom")}</b> · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a>
        ${m.replied ? '<span class="badge">✅ Répondu</span>' : '<span class="badge private">Nouveau</span>'}
        <div class="muted small">${esc(m.subject || "")} · ${new Date(m.at).toLocaleString(LOCALE)}</div></div>
      <p style="white-space:pre-line">${esc(m.message)}</p>
      ${m.replied ? `<p class="muted small" style="white-space:pre-line">↳ Réponse de ${esc(m.replied.by)} (${new Date(m.replied.at).toLocaleString(LOCALE)}) :\n${esc(m.replied.text)}</p>` : ""}
      <textarea data-reply="${esc(m.id)}" rows="3" placeholder="Votre réponse (envoyée par email)…"></textarea>
      <div class="row" style="gap:8px;margin-top:8px">
        <button class="btn btn-sm" data-act="reply" data-id="${esc(m.id)}">✉️ Répondre</button>
        <button class="btn btn-ghost btn-sm" data-act="del-contact" data-id="${esc(m.id)}">🗑️ Supprimer</button>
      </div></section>`).join("") || "<p class='muted'>Aucun message reçu.</p>";
  },
  async audience() {
    const a = await api("/api/admin/analytics?days=30");
    const max = Math.max(1, ...a.days.map((d) => d.views));
    const sum = (k) => a.days.reduce((n, d) => n + d[k], 0);
    const list = (rows, label) => `<h3 style="font-size:.9rem;margin:16px 0 6px">${label}</h3>${rows.length ? rows.map(([k, n]) => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)"><span>${esc(k)}</span><b>${n}</b></div>`).join("") : '<p class="muted small">Pas encore de données.</p>'}`;
    return `<div id="live-now">${await liveNow()}</div>
      <section class="card">
      <h2 style="font-size:1rem">📈 Audience · 30 derniers jours</h2>
      <div class="admin-stats">${[["Pages vues", sum("views")], ["Visiteurs", sum("visitors")], ["Aujourd'hui", a.days.at(-1).visitors]].map(([l, n]) => `<div><b>${n}</b><small>${l}</small></div>`).join("")}</div>
      <div style="display:flex;align-items:flex-end;gap:3px;height:120px;margin:16px 0 4px">${a.days.map((d) => `<i title="${d.date} : ${d.views} vues, ${d.visitors} visiteurs" style="flex:1;background:linear-gradient(#fd1a85,#c60bd2);border-radius:4px 4px 0 0;height:${Math.max(2, (d.views / max) * 100)}%"></i>`).join("")}</div>
      <p class="muted small" style="margin:0">Pages vues par jour · sans cookie, aucune donnée personnelle conservée</p>
      ${list(a.pages, "Pages les plus vues")}${list(a.sources, "D'où viennent les visiteurs")}${list(a.devices, "Appareils")}${list(a.langs, "Langue")}
    </section>`;
  },
  async notifs() {
    const sent = await api("/api/admin/notify").catch(() => []);
    return `<section class="card">
      <h2 style="font-size:1rem">📣 Envoyer une notification à tous</h2>
      <p class="muted small">Reçue dans la cloche 🔔 de chaque utilisateur, et en notification sur le téléphone de ceux qui les ont activées. Les notifications automatiques (messages, réponses, rappels J-1, début du live, replay) partent toutes seules.</p>
      <input id="n-title" maxlength="80" placeholder="Titre (ex. Nouveauté !)">
      <textarea id="n-body" maxlength="200" rows="2" placeholder="Message" style="margin-top:8px"></textarea>
      <input id="n-url" placeholder="Lien (facultatif, ex. /decouvrir)" style="margin-top:8px">
      <button class="btn btn-block" data-act="notify" style="margin-top:8px">📣 Envoyer</button>
      ${sent.length ? `<h3 style="font-size:.9rem;margin:16px 0 6px">Notifications envoyées</h3>${sent.map((n) => `<div class="admin-row" style="display:flex;gap:10px;align-items:center;padding:8px 0">
        <div style="flex:1;min-width:0"><b>${esc(n.title)}</b><div class="muted small">${esc(n.body)}</div><small class="muted">${new Date(n.at).toLocaleString("fr-FR")} · ${n.users} compte(s)</small></div>
        <button class="btn btn-ghost btn-sm" data-act="unnotify" data-nid="${esc(n.nid)}">🗑 Supprimer</button></div>`).join("")}` : ""}
      </section>`;
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

// Compteurs en haut de l'administration.
async function stats() {
  const s = await api("/api/admin/stats").catch(() => null);
  if (!s) return;
  const tile = (n, label) => `<div><b>${n}</b><span>${label}</span></div>`;
  $("#stats").innerHTML = tile(s.users, "Utilisateurs") + tile(s.premium, "Premium") + tile(s.events, "Événements")
    + tile(s.upcoming, "À venir") + tile(s.today, "Aujourd'hui") + tile(s.private, "🔒 Privés") + tile(s.unlisted, "🔗 Non répert.");
  $("#contact-count").textContent = s.contact ? `(${s.contact})` : "";
}
stats();

// Durée d'un rôle : fenêtre avec raccourcis, saisie libre, « Illimité » (0) et « Annuler » (null).
function askDays(role) {
  return new Promise((resolve) => {
    document.body.insertAdjacentHTML("beforeend", `<div class="sheet" id="days-sheet" role="dialog" aria-modal="true"><div class="card" style="text-align:center">
      <h2 style="margin-top:0">⏱ Durée · ${esc(role)}</h2>
      <div class="choices" style="grid-template-columns:repeat(2,minmax(0,1fr))">
        ${[[7, "7 jours"], [30, "30 jours"], [90, "3 mois"], [365, "1 an"]].map(([d, l]) => `<button type="button" class="btn btn-light" data-days="${d}">${l}</button>`).join("")}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px"><input id="days-custom" type="number" inputmode="numeric" min="1" max="3650" placeholder="Nombre de jours" style="flex:1;text-align:center"><button type="button" class="btn" id="days-ok">OK</button></div>
      <button type="button" class="btn btn-light btn-block" data-days="0" style="margin-top:10px">♾️ Illimité</button>
      <button type="button" class="btn btn-ghost btn-block" id="days-cancel" style="margin-top:8px">Annuler</button>
    </div></div>`);
    const sheet = $("#days-sheet");
    const done = (v) => { sheet.remove(); resolve(v); };
    sheet.addEventListener("click", (e) => {
      if (e.target === sheet || e.target.id === "days-cancel") return done(null);
      const d = e.target.closest("[data-days]")?.dataset.days;
      if (d !== undefined) return done(Number(d));
      if (e.target.id === "days-ok") {
        const n = Math.round(Number($("#days-custom").value));
        if (!(n >= 1 && n <= 3650)) return toast("Entrez un nombre de jours (1 à 3650)");
        done(n);
      }
    });
  });
}
const until = (ms) => new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

// « En direct » : rafraîchi tout seul toutes les 5 s tant que l'onglet Audience est affiché.
const PAGE_NAMES = { "/": "Accueil", "/decouvrir": "Découvrir", "/dashboard": "Mes événements", "/edit": "Création d'événement", "/live": "Regarde un live",
  "/lk": "Regarde un live", "/cameraman": "Filme un live 🎥", "/messages": "Messages", "/amis": "Amis", "/profil": "Profil", "/fil": "Fil", "/connexion": "Connexion",
  "/faire-part": "Faire-part", "/album": "Album", "/admin": "Administration", "/e/…": "Page d'un événement" };
const pageName = (p) => PAGE_NAMES[p] || PAGE_NAMES[p.replace(/^\/e\/.*/, "/e/…")] || p;
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "à l'instant" : m < 60 ? `depuis ${m} min` : `depuis ${Math.floor(m / 60)} h ${m % 60}`; };
let lastTotal = null;
async function liveNow() {
  const o = await api(`/api/admin/online?t=${Date.now()}`, { cache: "no-store" });
  const bump = lastTotal != null && o.total !== lastTotal ? " live-bump" : "";
  lastTotal = o.total;
  return `<section class="card live-now">
    <div class="live-head"><span class="live-dot"></span><h2 style="font-size:1rem;margin:0">En direct sur MaFeliza</h2>
      <a href="#" data-act="refresh-audience" class="muted small" style="margin-left:auto">↻ Actualiser</a></div>
    <div class="live-big${bump}"><b>${o.total}</b><span>${o.total > 1 ? "personnes sur le site en ce moment" : "personne sur le site en ce moment"}</span></div>
    <div class="admin-stats">${[["Utilisateurs connectés", o.logged], ["Visiteurs non connectés", o.total - o.logged]].map(([l, n]) => `<div><b>${n}</b><small>${l}</small></div>`).join("")}</div>
    ${o.pages.length ? `<h3 style="font-size:.9rem;margin:16px 0 6px">Où sont-ils ?</h3>${o.pages.map(([p, n]) => `<div class="live-bar"><span>${esc(pageName(p))}</span><i style="width:${Math.max(8, (n / o.total) * 100)}%"></i><b>${n}</b></div>`).join("")}` : ""}
    ${o.people.length ? `<h3 style="font-size:.9rem;margin:16px 0 6px">Qui est là ?</h3><div class="live-people">${o.people.map((v) => `<div class="live-person"><span class="live-av">${v.name ? esc(v.name.trim()[0] || "?").toUpperCase() : "👤"}</span><div style="flex:1;min-width:0"><b>${v.name ? esc(v.name) : "Visiteur"}</b> <small class="muted">${v.device}</small><div class="muted small">${esc(pageName(v.path))} · ${ago(v.since)}</div></div></div>`).join("")}</div>` : ""}
    <p class="muted small" style="margin:12px 0 0">Actifs sur les 2 dernières minutes · mis à jour toutes les 5 s</p>
  </section>`;
}
async function refreshLive(manual) {
  const box = document.getElementById("live-now");
  if (!box) return;
  try { box.innerHTML = await liveNow(); if (manual) toast("Mis à jour ✔"); } catch { /* réessaie au prochain tour */ }
}
setInterval(() => { if (tab === "audience" && !document.hidden) refreshLive(); }, 5000);

async function render() {
  $("#q").classList.toggle("hidden", ["reports", "settings", "contact", "audience", "notifs"].includes(tab));
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
  const btn = e.target.closest("[data-act]");
  if (btn?.dataset.act === "refresh-audience") { e.preventDefault(); refreshLive(true); return; }
  if (btn?.dataset.act === "notify") {
    try {
      const r = await api("/api/admin/notify", { method: "POST", body: { title: $("#n-title").value, body: $("#n-body").value, url: $("#n-url").value || "/dashboard" } });
      toast(`Notification envoyée à ${r.users} utilisateur(s) ✔`);
      render();
    } catch (err) { toast(err.message); }
    return;
  }
  if (btn?.dataset.act === "unnotify") {
    if (!confirm("Retirer cette notification de la cloche de tous les utilisateurs ?")) return;
    btn.disabled = true;
    try { await api(`/api/admin/notify/${encodeURIComponent(btn.dataset.nid)}`, { method: "DELETE" }); toast("Notification supprimée ✔"); render(); }
    catch (err) { toast(err.message); btn.disabled = false; }
    return;
  }
  if (btn?.dataset.act === "reply") {
    const text = document.querySelector(`[data-reply="${btn.dataset.id}"]`).value.trim();
    if (!text) return toast("Écrivez votre réponse.");
    btn.disabled = true;
    try { await api(`/api/admin/contact/${btn.dataset.id}/reply`, { method: "POST", body: { text } }); toast("Réponse envoyée ✉️"); stats(); render(); }
    catch (err) { toast(err.message); btn.disabled = false; }
    return;
  }
  if (btn?.dataset.act === "del-contact") {
    if (!confirm("Supprimer ce message ?")) return;
    await api(`/api/admin/contact/${btn.dataset.id}`, { method: "DELETE" }).catch(() => {});
    stats(); return render();
  }
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
      const days = on === "true" ? await askDays("Administrateur") : 0;
      if (days === null) return;
      if (on === "true" || confirm("Retirer les droits d'administration à cet utilisateur ?")) {
        await api(`/api/admin/organizers/${id}/admin`, { method: "POST", body: { admin: on === "true", days } });
        toast(on === "true" ? "Utilisateur nommé administrateur 👑" : "Droits d'administration retirés");
        render();
      }
    }
    if (act === "admin-dur" || act === "premium-dur") {
      const admin = act === "admin-dur";
      const days = await askDays(admin ? "Administrateur" : "Premium");
      if (days === null) return;
      await api(`/api/admin/organizers/${id}/${admin ? "admin" : "premium"}`, { method: "POST", body: { [admin ? "admin" : "premium"]: true, days } });
      toast(days ? `Durée enregistrée : ${days} jour(s)` : "Durée retirée : rôle illimité ♾️");
      render();
    }
    if (act === "premium") {
      const days = on === "true" ? await askDays("Premium") : 0;
      if (days === null) return;
      await api(`/api/admin/organizers/${id}/premium`, { method: "POST", body: { premium: on === "true", days } });
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
