import { api, $, tabbar, goLogin } from "./common.js";

tabbar("profile");

try {
  const me = await api("/api/auth/me");
  $("#email").textContent = me.email;
  $("#code").textContent = me.code;
  $("#count").textContent = (await api("/api/events")).length;
} catch {
  goLogin();
}

$("#logout").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  location.replace("/");
});
