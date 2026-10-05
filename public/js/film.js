// ✨ « Revivez l'événement » : film souvenir de 30 à 60 s monté automatiquement dans le navigateur,
// avec les photos et vidéos des invités, quelques mots du livre d'or et une musique douce générée (sans droits).
import { api, esc, formatDate, coverOf, isVideo, isHidden, shareSheet, EN } from "./common.js";

const T = EN
  ? { thanks: "Thank you for sharing this moment 💛", made: "Made with MaFeliza", create: "✨ Create yours", replay: "↺ Watch again", share: "Share", play: "▶ Play the film", close: "Close" }
  : { thanks: "Merci d'avoir partagé ce moment 💛", made: "Fait avec MaFeliza", create: "✨ Créez le vôtre", replay: "↺ Revoir", share: "Partager", play: "▶ Lancer le film", close: "Fermer" };

// Médias et messages de l'événement : de quoi faire un film ?
export async function filmScenes(ev) {
  const base = `/api/public/${encodeURIComponent(ev.slug)}`;
  const [photos, book] = await Promise.all([api(`${base}/photos?limit=200`).catch(() => []), api(`${base}/guestbook`).catch(() => [])]);
  const media = [...photos, ...book.filter((g) => g.photoUrl).map((g) => ({ url: g.photoUrl, name: g.name, author: g.author }))]
    .filter((p) => p.url && !isHidden(p.author));
  // Au plus 12 médias, répartis sur toute la soirée, et 3 messages courts du livre d'or (les épinglés d'abord).
  const pick = media.length <= 12 ? media : Array.from({ length: 12 }, (_, i) => media[Math.floor((i * media.length) / 12)]);
  const words = book.filter((g) => g.text && g.text.length <= 160 && !isHidden(g.author))
    .sort((a, b) => (b.pinned - a.pinned) || (b.likes || 0) - (a.likes || 0)).slice(0, 3);
  const scenes = [{ kind: "title" }];
  pick.forEach((m, i) => {
    scenes.push({ kind: isVideo(m.url) ? "video" : "photo", url: m.url, name: m.name });
    if (words.length && (i + 1) % 4 === 0) scenes.push({ kind: "quote", ...words.shift() });
  });
  words.forEach((w) => scenes.push({ kind: "quote", ...w }));
  scenes.push({ kind: "end" });
  return { scenes, count: pick.length };
}

// Musique douce : accords de piano électrique + clochettes, synthétisés (Web Audio), avec fondu final.
function music(seconds) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, ctx.currentTime);
  out.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.5);
  out.gain.setValueAtTime(0.5, ctx.currentTime + seconds - 3);
  out.gain.linearRampToValueAtTime(0, ctx.currentTime + seconds);
  out.connect(ctx.destination);
  const hz = (n) => 440 * 2 ** ((n - 69) / 12);
  const chords = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]]; // Do maj7, La m7, Fa maj7, Sol
  const beat = 0.6;
  const note = (n, t, dur, vol, type = "sine") => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = hz(n);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  };
  const t0 = ctx.currentTime + 0.1;
  for (let bar = 0; bar * 8 * beat < seconds; bar++) {
    const c = chords[bar % 4], start = t0 + bar * 8 * beat;
    c.forEach((n) => note(n - 12, start, 8 * beat, 0.05, "triangle"));
    for (let i = 0; i < 8; i++) note(c[[0, 2, 1, 3, 2, 1, 3, 2][i]] + 12, start + i * beat, 1.4, 0.035);
  }
  return ctx;
}

export function playFilm(ev, scenes) {
  const DUR = { title: 3500, photo: 3200, video: 4500, quote: 4200, end: 5000 };
  const total = scenes.reduce((n, s) => n + DUR[s.kind], 0);
  document.body.insertAdjacentHTML("beforeend", `
    <div class="film" id="film" role="dialog" aria-modal="true">
      <div class="film-bars">${scenes.map(() => "<i><b></b></i>").join("")}</div>
      <button type="button" class="film-x" aria-label="${T.close}">✕</button>
      <button type="button" class="film-sound" aria-label="Son">🔊</button>
      <div class="film-stage"></div>
      ${ev.premium ? "" : '<span class="film-brand"><img src="/img/logo.png" alt="">mafeliza.com</span>'}
      <button type="button" class="film-start">${T.play}</button>
    </div>`);
  const root = document.getElementById("film"), stage = root.querySelector(".film-stage");
  const bars = [...root.querySelectorAll(".film-bars b")];
  stage.innerHTML = `<div class="film-scene"><div class="film-bg blur" style="background-image:url('${esc(coverOf(ev))}')"></div></div>`;
  let i = -1, timer = null, audio = null, muted = false;
  const close = () => { clearTimeout(timer); audio?.close().catch(() => {}); root.remove(); };
  root.querySelector(".film-x").onclick = close;
  root.querySelector(".film-sound").onclick = (e) => {
    muted = !muted; e.currentTarget.textContent = muted ? "🔇" : "🔊";
    if (audio) muted ? audio.suspend() : audio.resume();
  };
  const render = (s) => {
    if (s.kind === "title") return `<div class="film-bg kb" style="background-image:url('${esc(coverOf(ev))}')"></div>
      <div class="film-text film-title"><small>${esc(formatDate(ev.date).replace(/^./, (c) => c.toUpperCase()))}</small><h2>${esc(ev.name)}</h2></div>`;
    if (s.kind === "photo") return `<div class="film-bg blur" style="background-image:url('${esc(s.url)}')"></div><img class="film-media kb${i % 2 ? " kb2" : ""}" src="${esc(s.url)}" alt="">
      ${s.name ? `<span class="film-who">📷 ${esc(s.name)}</span>` : ""}`;
    if (s.kind === "video") return `<video class="film-media" src="${esc(s.url)}" autoplay muted playsinline></video>${s.name ? `<span class="film-who">🎬 ${esc(s.name)}</span>` : ""}`;
    if (s.kind === "quote") return `<div class="film-text film-quote"><p>“${esc(s.text)}”</p><small>— ${esc(s.name)}</small></div>`;
    return `<div class="film-bg kb" style="background-image:url('${esc(coverOf(ev))}')"></div>
      <div class="film-text film-end"><h2>${T.thanks}</h2><p>${esc(ev.name)}</p>
      <div class="film-actions"><button type="button" data-film="again">${T.replay}</button><button type="button" data-film="share">↗ ${T.share}</button></div>
      ${ev.premium ? "" : `<a class="film-made" href="/?ref=film"><img src="/img/logo.png" alt=""> ${T.made} · <b>${T.create}</b></a>`}</div>`;
  };
  const next = () => {
    i++;
    if (i >= scenes.length) return;
    const s = scenes[i];
    bars.forEach((b, k) => { b.style.transition = "none"; b.style.width = k < i ? "100%" : "0"; });
    requestAnimationFrame(() => { bars[i].style.transition = `width ${DUR[s.kind]}ms linear`; bars[i].style.width = "100%"; });
    const el = document.createElement("div");
    el.className = "film-scene";
    el.innerHTML = render(s);
    stage.append(el);
    setTimeout(() => [...stage.children].slice(0, -1).forEach((c) => c.remove()), 900);
    if (s.kind !== "end") timer = setTimeout(next, DUR[s.kind]);
  };
  root.addEventListener("click", (e) => {
    const act = e.target.closest("[data-film]")?.dataset.film;
    if (act === "again") { audio?.close().catch(() => {}); audio = muted ? null : music(total / 1000); i = -1; next(); }
    if (act === "share") {
      const u = new URL(location.href); u.searchParams.set("film", "1"); u.hash = "";
      shareSheet({ title: ev.name, text: T.thanks, url: u.href });
    }
  });
  // Le son ne peut démarrer qu'après un toucher : bouton « Lancer le film ».
  root.querySelector(".film-start").onclick = (e) => {
    e.currentTarget.remove();
    audio = music(total / 1000);
    next();
  };
}
