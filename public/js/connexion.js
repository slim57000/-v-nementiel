import { api, $ } from "./common.js";

// Page de retour après connexion (chemin interne uniquement).
const next = new URLSearchParams(location.search).get("next");
const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

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

// Mot de passe oublié : lien de réinitialisation envoyé par email.
$("#forgot-pw").addEventListener("click", async (e) => {
  e.preventDefault();
  $("#error").textContent = "";
  if (!$("#email").value.trim()) { $("#error").textContent = "Saisissez d'abord votre adresse email."; return $("#email").focus(); }
  try {
    await api("/api/auth/forgot", { method: "POST", body: { email: $("#email").value } });
    $("#error").textContent = "📧 Si un compte existe pour cette adresse, un lien pour choisir un nouveau mot de passe vient d'y être envoyé.";
  } catch (err) { $("#error").textContent = err.message; }
});

// « Code oublié » : proposé seulement si l'envoi d'emails est configuré.
fetch("/api/config").then((r) => r.json()).then((c) => {
  if (c.emailEnabled) $("#forgot").classList.remove("hidden");
  // Connexion Google (si configurée), masquée dans l'application iOS / Android.
  for (const provider of ["google", "facebook"]) {
    if (c.social?.includes(provider) && !window.Capacitor?.isNativePlatform?.()) {
      $(`#${provider}`).href = `/api/auth/${provider}?next=${encodeURIComponent(target)}`;
      $(`#${provider}`).classList.remove("hidden");
    }
  }
}).catch(() => {});
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
