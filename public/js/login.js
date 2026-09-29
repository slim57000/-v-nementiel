import { api, $ } from "./common.js";

api("/api/auth/me").then(() => location.replace("/dashboard")).catch(() => {});

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
      location.href = "/dashboard";
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
