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
      body: { email: $("#email").value, code: $("#code").value },
    });
    if (res.created) {
      $("#new-code").textContent = res.code;
      $("#emailed").classList.toggle("hidden", !res.emailed);
      $("#login").classList.add("hidden");
      $("#created").classList.remove("hidden");
    } else {
      location.href = target;
    }
  } catch (err) {
    if (err.data?.needCode) {
      $("#code-block").classList.remove("hidden");
      $("#code").focus();
    }
    $("#error").textContent = err.data?.needCode && !err.data.error ? "" : err.message;
  } finally {
    button.disabled = false;
  }
});

$("#continue").addEventListener("click", () => { location.href = target; });

// « Code oublié » : proposé seulement si l'envoi d'emails est configuré.
fetch("/api/config").then((r) => r.json()).then((c) => {
  if (c.emailEnabled) $("#forgot").classList.remove("hidden");
  // Connexion Google (si configurée), masquée dans l'application iOS / Android.
  if (c.social?.includes("google") && !window.Capacitor?.isNativePlatform?.()) {
    $("#google").href = `/api/auth/google?next=${encodeURIComponent(target)}`;
    $("#google").classList.remove("hidden");
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
