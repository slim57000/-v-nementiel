// Livre d'or multimédia de la page événement : texte, photo, message vocal, likes, filtres, recherche.
import { api, $, esc, toast, guestName, resizeImage, viewPhoto, contentMenu, isHidden } from "./common.js";

const MAX_VOICE_SECONDS = 60;

// Likes déjà donnés depuis cet appareil (évite les doubles clics).
const liked = new Set((() => { try { return JSON.parse(localStorage.getItem("em-likes") || "[]"); } catch { return []; } })());
const saveLikes = () => { try { localStorage.setItem("em-likes", JSON.stringify([...liked])); } catch { /* ignoré */ } };

export function initGuestbook(ev) {
  const base = `/api/public/${encodeURIComponent(ev.slug)}/guestbook`;
  let entries = [];
  let filter = "all";

  async function load() {
    try { entries = (await api(base)).filter((e) => !isHidden(e.author)); } catch { return; }
    render();
  }

  function render() {
    const q = $("#gb-search").value.trim().toLowerCase();
    const shown = entries
      .filter((e) => filter === "all" || (filter === "photos" && e.photoUrl) || (filter === "voice" && e.audioUrl) || (filter === "pinned" && e.pinned))
      .filter((e) => !q || `${e.name} ${e.text}`.toLowerCase().includes(q))
      .sort((a, b) => b.pinned - a.pinned || b.id - a.id);
    $("#gb-count").textContent = entries.length ? `(${entries.length})` : "";
    $("#gb-list").innerHTML = shown.length ? shown.map(card).join("") :
      `<p class="muted small" style="text-align:center">${entries.length ? "Aucun message ne correspond." : "Soyez le premier à laisser un mot ✍️"}</p>`;
  }

  const card = (e) => `
    <article class="gb-entry ${e.pinned ? "pinned" : ""}" data-id="${e.id}">
      <header><i>${esc(e.name.charAt(0).toUpperCase())}</i><div><b>${esc(e.name)}</b>
        <span class="muted small">${new Date(e.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}${e.pinned ? " · ⭐ À la une" : ""}</span></div></header>
      ${e.text ? `<p>${esc(e.text)}</p>` : ""}
      ${e.photoUrl ? `<img src="${esc(e.photoUrl)}" alt="Photo de ${esc(e.name)}" loading="lazy" data-photo>` : ""}
      ${e.audioUrl ? `<audio controls preload="none" src="${esc(e.audioUrl)}"></audio>` : ""}
      <footer>
        <button class="gb-like ${liked.has(e.id) ? "on" : ""}" data-like>❤️ ${e.likes || 0}</button>
        <button data-more aria-label="Plus d'actions">⋯</button>
        ${ev.isOwner ? `<button data-pin>${e.pinned ? "Retirer de la une" : "⭐ Mettre en avant"}</button><button data-del class="danger">Supprimer</button>` : ""}
      </footer>
    </article>`;

  // --- Filtres et recherche ---
  $("#gb-filters").addEventListener("click", (e) => {
    if (!e.target.dataset.filter) return;
    filter = e.target.dataset.filter;
    document.querySelectorAll("#gb-filters button").forEach((b) => b.classList.toggle("active", b === e.target));
    render();
  });
  $("#gb-search").addEventListener("input", render);

  // --- Actions sur une entrée ---
  $("#gb-list").addEventListener("click", async (e) => {
    const el = e.target.closest("[data-id]");
    if (!el) return;
    const entry = entries.find((x) => x.id === Number(el.dataset.id));
    const url = `${base}/${entry.id}`;
    try {
      if (e.target.matches("[data-photo]")) viewPhoto({ url: entry.photoUrl, name: entry.name });
      if (e.target.matches("[data-more]")) {
        contentMenu({
          slug: ev.slug, kind: "guestbook", item: entry, isOwner: ev.isOwner,
          onDelete: () => api(url, { method: "DELETE" }), onChange: load,
        });
      }
      if (e.target.matches("[data-like]") && !liked.has(entry.id)) {
        Object.assign(entry, await api(`${url}/like`, { method: "POST" }));
        liked.add(entry.id);
        saveLikes();
        render();
      }
      if (e.target.matches("[data-pin]")) {
        Object.assign(entry, await api(url, { method: "PATCH", body: { pinned: !entry.pinned } }));
        render();
      }
      if (e.target.matches("[data-del]") && confirm("Supprimer ce message du livre d'or ?")) {
        await api(url, { method: "DELETE" });
        entries = entries.filter((x) => x !== entry);
        render();
      }
    } catch (err) {
      toast(err.message);
    }
  });

  // --- Formulaire d'écriture ---
  const draft = { image: null, audio: null };
  const sheet = $("#gb-sheet");
  const resetDraft = () => {
    draft.image = draft.audio = null;
    $("#gb-text").value = "";
    $("#gb-photo-preview").classList.add("hidden");
    $("#gb-audio-preview").classList.add("hidden");
    $("#gb-error").textContent = "";
  };

  $("#gb-open").addEventListener("click", () => sheet.classList.remove("hidden"));
  $("#gb-cancel").addEventListener("click", () => { stopRecording(); sheet.classList.add("hidden"); });

  $("#gb-photo").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      draft.image = await resizeImage(file, 1400);
      $("#gb-photo-preview").src = draft.image;
      $("#gb-photo-preview").classList.remove("hidden");
    } catch (err) { toast(err.message); }
    e.target.value = "";
  });

  // Enregistrement vocal (MediaRecorder), arrêt automatique à 60 s.
  let recorder = null;
  let timer = null;

  function stopRecording() {
    if (recorder?.state === "recording") recorder.stop();
  }

  $("#gb-record").addEventListener("click", async () => {
    if (recorder?.state === "recording") return stopRecording();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast("Enregistrement vocal non disponible sur ce navigateur.");
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast("Micro refusé : autorisez-le pour enregistrer un vocal."); }
    const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined);
    const chunks = [];
    let seconds = 0;
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      $("#gb-record").textContent = "🎙️ Refaire le vocal";
      const blob = new Blob(chunks, { type: recorder.mimeType.split(";")[0] });
      const reader = new FileReader();
      reader.onload = () => {
        draft.audio = reader.result;
        $("#gb-audio-preview").src = draft.audio;
        $("#gb-audio-preview").classList.remove("hidden");
      };
      reader.readAsDataURL(blob);
    };
    recorder.start();
    $("#gb-record").textContent = `⏹ Arrêter (0 s / ${MAX_VOICE_SECONDS} s)`;
    timer = setInterval(() => {
      seconds++;
      $("#gb-record").textContent = `⏹ Arrêter (${seconds} s / ${MAX_VOICE_SECONDS} s)`;
      if (seconds >= MAX_VOICE_SECONDS) stopRecording();
    }, 1000);
  });

  $("#gb-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    stopRecording();
    $("#gb-error").textContent = "";
    const text = $("#gb-text").value.trim();
    if (!text && !draft.image && !draft.audio) {
      $("#gb-error").textContent = "Écrivez un message, ajoutez une photo ou un vocal.";
      return;
    }
    const button = e.submitter;
    button.disabled = true;
    try {
      const name = await guestName();
      const entry = await api(base, { method: "POST", body: { name, text, image: draft.image, audio: draft.audio } });
      entries.unshift(entry);
      render();
      resetDraft();
      sheet.classList.add("hidden");
      toast("Merci pour votre message 💛");
    } catch (err) {
      $("#gb-error").textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });

  load();
}
