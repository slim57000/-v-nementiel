import { api, $, esc, share, toast, eventUrl } from "./common.js";

const slug = new URLSearchParams(location.search).get("e") || "";

// Transforme un lien YouTube / Twitch en adresse de lecteur intégrable (null si non reconnu).
export function embedUrl(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id = null;
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com") {
    id = u.searchParams.get("v") || u.pathname.match(/^\/(?:live|embed|shorts)\/([\w-]+)/)?.[1];
  }
  if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1&playsinline=1`;
  if (host === "twitch.tv") {
    const channel = u.pathname.split("/")[1];
    if (channel) return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${location.hostname}&muted=true`;
  }
  return null;
}

let cameras = [];

function play(index) {
  const src = embedUrl(cameras[index]?.url);
  $("#stage iframe")?.remove();
  $("#empty").classList.toggle("hidden", Boolean(src));
  if (src) {
    $("#stage").insertAdjacentHTML("afterbegin",
      `<iframe src="${esc(src)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Direct"></iframe>`);
  }
  document.querySelectorAll(".cam").forEach((b, i) => b.classList.toggle("active", i === index));
}

async function load() {
  let ev;
  try {
    ev = await api(`/api/public/${encodeURIComponent(slug)}`);
  } catch (err) {
    $("#title").textContent = err.message;
    return;
  }
  // Événement privé non déverrouillé : on passe par l'écran du code.
  if (ev.locked) return location.replace(`/e/${encodeURIComponent(slug)}`);

  document.title = `Live — ${ev.name}`;
  $("#title").textContent = ev.name;
  $("#close").href = `/e/${encodeURIComponent(slug)}`;
  $("#share").onclick = () => share({ title: ev.name, text: `Suivez « ${ev.name} » en direct !`, url: location.href });

  if (ev.cagnotteUrl) {
    for (const el of [$("#pot"), $("#pot-btn")]) {
      el.href = ev.cagnotteUrl;
      el.classList.remove("hidden");
    }
  } else {
    $("#reactions").style.gridTemplateColumns = "repeat(5, 1fr)";
  }

  cameras = ev.cameras;
  $("#cams").innerHTML = cameras.map((c, i) => `<button class="cam" data-index="${i}">${esc(c.name)}</button>`).join("");
  $("#cams-section").classList.toggle("hidden", cameras.length < 2);
  play(0);
}

$("#cams").addEventListener("click", (e) => {
  const btn = e.target.closest(".cam");
  if (btn) play(Number(btn.dataset.index));
});

// Réactions : animation à l'écran (le partage en temps réel arrive avec le chat).
$("#reactions").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-emoji]");
  if (!btn) return;
  const el = document.createElement("span");
  el.textContent = btn.dataset.emoji;
  el.style.setProperty("--dx", `${Math.round(Math.random() * 40 - 20)}px`);
  $("#floaters").append(el);
  setTimeout(() => el.remove(), 2500);
});

$("#chat").addEventListener("submit", (e) => {
  e.preventDefault();
  toast("Le chat en direct arrive très bientôt 💬");
});
$("#add-photo").addEventListener("click", () => toast("L'envoi de photos arrive très bientôt 📷"));

load();
