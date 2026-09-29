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
