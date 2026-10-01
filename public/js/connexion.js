import { api, $, toast } from "./common.js";
import { BRAND } from "./icons.js";

// Page de retour après connexion (chemin interne uniquement).
const next = new URLSearchParams(location.search).get("next");
const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
let social = []; // connexions sociales configurées sur le serveur

api("/api/auth/me").then(() => location.replace(target)).catch(() => {});

$("#login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.submitter;
  $("#error").textContent = "";
  button.disabled = true;
  try {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: { email: $("#email").value, password: $("#password").value, code: $("#code").value },
    });
    location.href = target;
  } catch (err) {
    // Ancien compte sans mot de passe : le code organisateur reste accepté.
    if (err.data?.legacy) $("#code-block").classList.remove("hidden");
    if (err.data?.needPassword && !err.data.error) {
      $("#password").focus();
      $("#error").textContent = err.data.isNew ? "Nouveau compte : choisissez un mot de passe (8 caractères minimum)." : "Saisissez votre mot de passe.";
    } else {
      $("#error").textContent = err.message;
    }
  } finally {
    button.disabled = false;
  }
});

$("#continue").addEventListener("click", () => { location.href = target; });

// Afficher / masquer le mot de passe.
$("#toggle-pw").addEventListener("click", () => { const i = $("#password"); i.type = i.type === "password" ? "text" : "password"; });

// Mot de passe oublié, tout sur un seul écran : email → code reçu → nouveau mot de passe → connecté.
$("#forgot-pw").addEventListener("click", (e) => {
  e.preventDefault();
  document.body.insertAdjacentHTML("beforeend", `<div class="sheet" id="fp-sheet" role="dialog" aria-modal="true">
    <form class="card" id="fp-form" novalidate>
      <h2 style="margin-top:0">Mot de passe oublié</h2>
      <label for="fp-email">Votre adresse email</label>
      <input id="fp-email" type="email" autocomplete="username" inputmode="email" required>
      <div id="fp-step2" class="hidden">
        <p class="small muted" style="margin:10px 0 4px">📧 Code envoyé ! Regardez vos emails (et les spams).</p>
        <label for="fp-code">Code reçu (6 chiffres)</label>
        <input id="fp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="code-input" placeholder="••••••">
        <label for="fp-pw">Nouveau mot de passe</label>
        <input id="fp-pw" type="password" autocomplete="new-password" minlength="8" placeholder="8 caractères minimum">
      </div>
      <p class="error" id="fp-error" role="alert"></p>
      <button class="btn btn-block" type="submit" id="fp-btn">Recevoir mon code</button>
      <button class="btn btn-light btn-block" type="button" id="fp-close" style="margin-top:8px">Annuler</button>
    </form></div>`);
  const sheet = $("#fp-sheet"), step2 = $("#fp-step2"), err = $("#fp-error");
  $("#fp-email").value = $("#email").value.trim();
  ($("#fp-email").value ? $("#fp-btn") : $("#fp-email")).focus();
  sheet.addEventListener("click", (ev) => { if (ev.target === sheet || ev.target.id === "fp-close") sheet.remove(); });
  $("#fp-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    err.textContent = "";
    const email = $("#fp-email").value.trim(), btn = $("#fp-btn");
    btn.disabled = true;
    try {
      if (step2.classList.contains("hidden")) {
        await api("/api/auth/forgot", { method: "POST", body: { email } });
        step2.classList.remove("hidden");
        btn.textContent = "Valider et me connecter";
        $("#fp-code").focus();
      } else {
        await api("/api/auth/reset-code", { method: "POST", body: { email, code: $("#fp-code").value, password: $("#fp-pw").value } });
        location.href = target;
      }
    } catch (e2) { err.textContent = e2.message; }
    btn.disabled = false;
  });
});

// « Code oublié » : proposé seulement si l'envoi d'emails est configuré.
fetch("/api/config").then((r) => r.json()).then((c) => {
  if (c.emailEnabled) $("#forgot").classList.remove("hidden");
  // Connexion Google (si configurée), masquée dans l'application iOS / Android.
  social = c.social || [];
}).catch(() => {});

// Logos Apple / Google / Facebook : connexion si configurée, sinon « bientôt ». Masqués dans l'app iOS / Android.
if (window.Capacitor?.isNativePlatform?.()) $("#social-block")?.remove();
document.querySelectorAll("[data-social]").forEach((b) => {
  b.innerHTML = BRAND[b.dataset.social.toLowerCase()];
  b.addEventListener("click", () => {
    const provider = b.dataset.social.toLowerCase();
    if (social.includes(provider)) location.href = `/api/auth/${provider}?next=${encodeURIComponent(target)}`;
    else toast(`Connexion ${b.dataset.social} : bientôt disponible`);
  });
});
$("#forgot").addEventListener("click", async (e) => {
  e.preventDefault();
  $("#error").textContent = "";
  try {
    await api("/api/auth/send-code", { method: "POST", body: { email: $("#email").value } });
    $("#error").textContent = "📧 Si un compte existe pour cette adresse, un code valable 15 minutes vient d'y être envoyé.";
  } catch (err) {
    $("#error").textContent = err.message;
  }
});
