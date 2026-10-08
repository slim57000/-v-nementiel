// Fonctions natives des applications iPhone / Android (Capacitor) : notifications push,
// partage natif, bouton retour Android, liens profonds, vibrations et mode hors connexion.
// Chargé uniquement dans l'application (window.Capacitor), jamais sur le site web.
const cap = window.Capacitor;
const P = cap?.Plugins || {};
const platform = cap?.getPlatform?.() || "web";

// --- Notifications push natives ---
async function initPush() {
  const push = P.PushNotifications;
  if (!push) return;
  push.addListener("registration", ({ value }) => {
    fetch("/api/push/native", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: value, platform }) }).catch(() => {});
  });
  // Toucher une notification : ouvre la page concernée (message, événement, live…).
  push.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const url = notification?.data?.url;
    if (url && url.startsWith("/")) location.href = url;
  });
  let perm = await push.checkPermissions();
  if (perm.receive === "prompt") perm = await push.requestPermissions();
  if (perm.receive === "granted") await push.register();
}

// --- Bouton retour Android et liens profonds (mafeliza.com/... ouvert dans l'application) ---
function initApp() {
  const app = P.App;
  if (!app) return;
  app.addListener("backButton", ({ canGoBack }) => (canGoBack ? history.back() : app.exitApp()));
  app.addListener("appUrlOpen", ({ url }) => {
    try { const u = new URL(url); if (/mafeliza\.com$/.test(u.hostname)) location.href = u.pathname + u.search; } catch { /* lien ignoré */ }
  });
}

// --- Hors connexion : bandeau, puis rechargement au retour du réseau ---
function initNetwork() {
  const net = P.Network;
  if (!net) return;
  const banner = document.createElement("div");
  banner.className = "offline-banner hidden";
  banner.textContent = "📡 Pas de connexion internet";
  document.body.append(banner);
  net.addListener("networkStatusChange", ({ connected }) => {
    banner.classList.toggle("hidden", connected);
    if (connected && banner.dataset.was === "off") location.reload();
    banner.dataset.was = connected ? "on" : "off";
  });
}

// --- Partage natif (feuille de partage iOS / Android) ---
export async function nativeShare({ title, text, url }) {
  if (!P.Share) return false;
  try { await P.Share.share({ title, text, url, dialogTitle: title }); } catch { /* partage annulé */ }
  return true;
}

// --- Petite vibration sur les actions (j'aime, réactions, envoi) ---
export function tap() { P.Haptics?.impact?.({ style: "LIGHT" }).catch?.(() => {}); }

export const isNativeApp = Boolean(cap?.isNativePlatform?.());

if (isNativeApp) {
  document.documentElement.classList.add("native-app");
  initApp();
  initNetwork();
  initPush().catch(() => {});
  // Vibration légère sur les boutons d'action principaux.
  document.addEventListener("click", (e) => { if (e.target.closest(".btn, [data-react], [data-fav], .tabbar a")) tap(); });
}

// --- Connexion Apple native (application Flutter iPhone : canal JavaScript « MaFelizaApple ») ---
// Le bouton Apple du site appelle la fenêtre système d'Apple ; l'app renvoie le jeton à mafelizaAppleDone().
export const hasNativeApple = () => typeof window.MaFelizaApple?.postMessage === "function";
export function appleNative(next, onError) {
  window.mafelizaAppleDone = async (data) => {
    try {
      const res = await fetch("/api/auth/apple/native", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, next }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Connexion Apple refusée.");
      location.href = out.next || next || "/dashboard";
    } catch (err) { onError?.(err.message); }
  };
  window.mafelizaAppleError = (msg) => { if (msg !== "canceled") onError?.("Connexion Apple annulée."); };
  window.MaFelizaApple.postMessage("signin");
}
