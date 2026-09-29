import { api, $, tabbar, goLogin } from "./common.js";

tabbar("profile");

try {
  const me = await api("/api/auth/me");
  $("#email").textContent = me.email;
  $("#code").textContent = me.code;
  $("#admin-link").classList.toggle("hidden", !me.isAdmin);
  $("#count").textContent = (await api("/api/events")).length;
} catch {
  goLogin();
}

$("#logout").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  location.replace("/");
});

$("#delete-account").addEventListener("click", async () => {
  const answer = prompt("Cette action est définitive. Tapez SUPPRIMER pour confirmer.");
  if (answer?.trim().toUpperCase() !== "SUPPRIMER") return;
  try {
    await api("/api/auth/me", { method: "DELETE" });
    location.replace("/?compte-supprime");
  } catch (err) {
    alert(err.message);
  }
});
