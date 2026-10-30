// ✨ « Revivez l'événement » : film souvenir de 30 à 60 s monté automatiquement dans le navigateur,
// avec les photos et vidéos des invités, quelques mots du livre d'or et une musique douce générée (sans droits).
import { api, esc, formatDate, coverOf, isVideo, isHidden, shareSheet } from "./common.js";
import { tr } from "./i18n.js";

// Textes du film dans la langue du visiteur (dictionnaire du site).
const T = { thanks: tr("Merci d'avoir partagé ce moment 💛"), made: tr("Fait avec MaFeliza"), create: tr("✨ Créez le vôtre"), replay: tr("↺ Revoir"), share: tr("Partager"), play: tr("▶ Lancer le film"), close: tr("Fermer"),
  video: tr("⬇ Vidéo"), making: tr("Création de la vidéo…"), keep: tr("Gardez cet écran ouvert"), ready: tr("Votre vidéo est prête 🎉"), save: tr("Enregistrer la vidéo"), nosupport: tr("Votre navigateur ne permet pas de créer la vidéo.") };

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
export function music(seconds, ctx0) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = ctx0 || new Ctx();
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, ctx.currentTime);
  out.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.5);
  out.gain.setValueAtTime(0.5, ctx.currentTime + seconds - 3);
  out.gain.linearRampToValueAtTime(0, ctx.currentTime + seconds);
  out.connect(ctx.dest || ctx.destination);
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
      <button type="button" class="film-dl" data-film="video">${T.video}</button>
      ${ev.premium ? "" : `<a class="film-made" href="/?ref=${encodeURIComponent(ev.slug)}"><img src="/img/logo.png" alt=""> ${T.made} · <b>${T.create}</b></a>`}</div>`;
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
    if (act === "video") exportFilm(ev, scenes, root);
  });
  // Le son ne peut démarrer qu'après un toucher : bouton « Lancer le film ».
  root.querySelector(".film-start").onclick = (e) => {
    e.currentTarget.remove();
    audio = music(total / 1000);
    next();
  };
}

// 🎬 Export en vraie vidéo verticale 720×1280 (Instagram, TikTok, WhatsApp) : le film est redessiné
// dans un canvas et enregistré en temps réel (MediaRecorder), musique comprise.
const W = 720, H = 1280;
const loadImg = (url) => new Promise((ok) => {
  const im = new Image(); im.crossOrigin = "anonymous";
  im.onload = () => ok(im); im.onerror = () => ok(null); im.src = url;
});
const loadVid = (url) => new Promise((ok) => {
  const v = document.createElement("video"); v.crossOrigin = "anonymous"; v.muted = true; v.playsInline = true; v.preload = "auto";
  v.onloadeddata = () => ok(v); v.onerror = () => ok(null); v.src = url; setTimeout(() => ok(null), 8000);
});
function fit(g, im, iw, ih, mode, zoom = 1, dx = 0) {
  const r = (mode === "cover" ? Math.max : Math.min)(W / iw, H / ih) * zoom;
  g.drawImage(im, (W - iw * r) / 2 + dx * W, (H - ih * r) / 2, iw * r, ih * r);
}
function wrap(g, text, x, y, maxW, lh) {
  const lines = [];
  text.split(/\s+/).forEach((w) => {
    const l = lines.length ? `${lines[lines.length - 1]} ${w}` : w;
    if (lines.length && g.measureText(l).width <= maxW) lines[lines.length - 1] = l; else lines.push(w);
  });
  lines.forEach((l, k) => g.fillText(l, x, y + (k - (lines.length - 1) / 2) * lh));
}

export async function exportFilm(ev, scenes, root) {
  const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  const mime = window.MediaRecorder && types.find((t) => MediaRecorder.isTypeSupported?.(t));
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  if (!mime || !cv.captureStream) return alert(T.nosupport);
  root.insertAdjacentHTML("beforeend", `<div class="film-export"><canvas></canvas><b>${T.making} <span>0%</span></b><small>${T.keep}</small></div>`);
  const box = root.querySelector(".film-export"), pct = box.querySelector("span");
  box.querySelector("canvas").replaceWith(cv);
  const g = cv.getContext("2d");
  // Médias préchargés (une image refusée par le CORS est remplacée par la couverture).
  const cover = await loadImg(coverOf(ev)), logo = await loadImg("/img/logo.png");
  const assets = await Promise.all(scenes.map((s) => s.kind === "photo" ? loadImg(s.url) : s.kind === "video" ? loadVid(s.url) : null));
  const DUR = { title: 3000, photo: 3000, video: 4500, quote: 4000, end: 4000 };
  const total = scenes.reduce((n, s) => n + DUR[s.kind], 0);
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ac = Ctx && new Ctx(), dest = ac?.createMediaStreamDestination?.();
  if (dest) { ac.dest = dest; music(total / 1000, ac); }
  const stream = cv.captureStream(30);
  dest?.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5e6 }), chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const bg = (im, a = 0.45) => {
    g.fillStyle = "#1a0414"; g.fillRect(0, 0, W, H);
    if (im) { g.globalAlpha = 1; fit(g, im, im.naturalWidth || im.videoWidth, im.naturalHeight || im.videoHeight, "cover", 1.15); }
    g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(0, 0, W, H);
  };
  const text = (t, y, size, weight = 700, font = "system-ui, -apple-system, sans-serif", style = "") => {
    g.font = `${style} ${weight} ${size}px ${font}`; g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = 16; wrap(g, t, W / 2, y, W - 120, size * 1.25); g.shadowBlur = 0;
  };
  const draw = (k, p) => {
    const s = scenes[k], a = assets[k], z = 1 + 0.12 * p;
    if (s.kind === "title" || s.kind === "end") {
      g.fillStyle = "#1a0414"; g.fillRect(0, 0, W, H);
      if (cover) fit(g, cover, cover.naturalWidth, cover.naturalHeight, "cover", s.kind === "title" ? z : 1.12 - 0.12 * p);
      const grd = g.createLinearGradient(0, H * 0.4, 0, H); grd.addColorStop(0, "rgba(0,0,0,0)"); grd.addColorStop(1, "rgba(0,0,0,.75)");
      g.fillStyle = s.kind === "end" ? "rgba(0,0,0,.5)" : grd; g.fillRect(0, 0, W, H);
      if (s.kind === "title") {
        text(formatDate(ev.date).toUpperCase(), H * 0.72, 30, 600);
        text(ev.name, H * 0.8, 64, 800);
      } else {
        text(T.thanks, H * 0.42, 52, 800);
        text(ev.name, H * 0.52, 34, 500);
        if (logo) g.drawImage(logo, W / 2 - 60, H * 0.66, 120, 120 * logo.naturalHeight / logo.naturalWidth);
        text("mafeliza.com", H * 0.66 + 160, 36, 800);
      }
    } else if (s.kind === "quote") {
      const grd = g.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, H * 0.7); grd.addColorStop(0, "#6d0a52"); grd.addColorStop(1, "#1a0414");
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      g.fillStyle = "#fd1a85"; g.font = "120px Georgia, serif"; g.textAlign = "center"; g.fillText("❝", W / 2, H * 0.28);
      text(`“${s.text}”`, H * 0.47, 46, 400, "Georgia, serif", "italic");
      text(`— ${s.name}`, H * 0.68, 32, 600);
    } else {
      const iw = a?.naturalWidth || a?.videoWidth, ih = a?.naturalHeight || a?.videoHeight;
      bg(a || cover, 0.6);
      if (a) fit(g, a, iw, ih, "contain", s.kind === "photo" ? (k % 2 ? 1.08 - 0.08 * p : z * 0.95) : 1, s.kind === "photo" ? (k % 2 ? 0.02 - 0.04 * p : 0) : 0);
      if (s.name) {
        g.font = "600 28px system-ui, sans-serif"; const label = `${s.kind === "video" ? "🎬" : "📷"} ${s.name}`, w = g.measureText(label).width + 40;
        g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.roundRect?.(30, H - 120, w, 56, 28); g.fill();
        g.fillStyle = "#fff"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(label, 50, H - 92);
      }
    }
    if (!ev.premium && s.kind !== "end" && logo) {
      g.globalAlpha = 0.8; g.drawImage(logo, W - 210, 40, 36, 36 * logo.naturalHeight / logo.naturalWidth);
      g.font = "700 24px system-ui, sans-serif"; g.fillStyle = "#fff"; g.textAlign = "left"; g.fillText("mafeliza.com", W - 168, 60); g.globalAlpha = 1;
    }
  };
  const starts = []; scenes.reduce((n, s, k) => (starts[k] = n, n + DUR[s.kind]), 0);
  let cur = -1, stopped = false;
  rec.start(500);
  const t0 = performance.now();
  await new Promise((done) => {
    const tick = () => {
      if (stopped || !root.isConnected) return done();
      const t = performance.now() - t0;
      if (t >= total) return done();
      let k = starts.findLastIndex ? starts.findLastIndex((x) => x <= t) : starts.filter((x) => x <= t).length - 1;
      if (k !== cur) { assets[cur]?.pause?.(); cur = k; if (assets[k]?.play) { assets[k].currentTime = 0; assets[k].play().catch(() => {}); } }
      const p = (t - starts[k]) / DUR[scenes[k].kind];
      draw(k, p);
      // Fondu enchaîné sur les 400 premières ms de chaque scène.
      if (k > 0 && t - starts[k] < 400) { g.globalAlpha = 1 - (t - starts[k]) / 400; draw(k - 1, 1); g.globalAlpha = 1; }
      pct.textContent = `${Math.min(99, Math.round((t / total) * 100))}%`;
      requestAnimationFrame(tick);
    };
    tick();
  });
  await new Promise((ok) => { rec.onstop = ok; rec.stop(); });
  ac?.close().catch(() => {});
  assets.forEach((a) => a?.pause?.());
  if (!root.isConnected) return;
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  const blob = new Blob(chunks, { type: mime.split(";")[0] });
  const file = new File([blob], `${(ev.slug || "film").slice(0, 40)}.${ext}`, { type: blob.type });
  const url = URL.createObjectURL(blob);
  box.innerHTML = `<video src="${url}" controls playsinline autoplay></video><b>${T.ready}</b>
    <div class="film-actions"><button type="button" data-x="share">↗ ${T.share}</button><a class="film-save" href="${url}" download="${esc(file.name)}">⬇ ${T.save}</a></div>
    <button type="button" class="film-dl" data-x="close">${T.close}</button>`;
  const sh = box.querySelector('[data-x="share"]');
  if (!navigator.canShare?.({ files: [file] })) sh.remove();
  else sh.onclick = () => navigator.share({ files: [file], title: ev.name }).catch(() => {});
  box.querySelector('[data-x="close"]').onclick = () => { URL.revokeObjectURL(url); box.remove(); };
}
