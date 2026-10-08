// Image du faire-part (PNG 1080×1350) pour le partager sur WhatsApp, SMS… avec le lien en dessous.
// Dessinée sur un canvas aux couleurs du style choisi : titre, photo ronde, texte, date, lieu, lien et QR code.
import { formatDate, qrUrl, EN } from "./common.js";

const THEMES = {
  classique: { bg: ["#fffaf0", "#f6ead2"], ink: "#3a2e1e", accent: "#a8823a", serif: true },
  moderne: { bg: ["#fd1a85", "#8b2fd6"], ink: "#ffffff", accent: "#ffe3f1", serif: false },
  elegant: { bg: ["#2b2440", "#15111f"], ink: "#f6ecd2", accent: "#e5c77d", serif: true },
  fleuri: { bg: ["#fff0f4", "#e8f6e8"], ink: "#5a2a3a", accent: "#c2416b", serif: true },
};

const load = (src) => new Promise((resolve) => {
  if (!src) return resolve(null);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

// Découpe un texte en lignes qui tiennent dans `width`.
function lines(ctx, text, width, max) {
  const out = [];
  for (const para of String(text || "").split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > width && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  const clean = out.filter((l, i) => l || (i > 0 && out[i - 1]));
  if (clean.length > max) { clean.length = max; clean[max - 1] = `${clean[max - 1].replace(/\s+\S*$/, "")}…`; }
  return clean;
}

export async function inviteImage(ev, invite, style, photoUrl, link) {
  const t = THEMES[style] || THEMES.classique;
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const serif = t.serif ? "Georgia, 'Times New Roman', serif" : "-apple-system, 'Helvetica Neue', Arial, sans-serif";
  const [photo, qr] = await Promise.all([load(photoUrl), load(qrUrl(link))]);

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, t.bg[0]); g.addColorStop(1, t.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Cadre fin
  ctx.strokeStyle = t.accent; ctx.lineWidth = 4; ctx.globalAlpha = .6;
  ctx.strokeRect(40, 40, W - 80, H - 80); ctx.globalAlpha = 1;
  if (style === "fleuri") { ctx.font = "64px serif"; ctx.fillText("🌸", 70, 140); ctx.fillText("🌿", W - 140, 140); }

  ctx.textAlign = "center"; ctx.fillStyle = t.accent;
  let y = 150;
  ctx.font = `600 34px ${serif}`;
  ctx.fillText(String(invite.kicker || "").toUpperCase().split("").join(" "), W / 2, y);
  y += 90;
  ctx.fillStyle = t.ink; ctx.font = `${t.serif ? "italic " : ""}700 76px ${serif}`;
  for (const l of lines(ctx, invite.title || ev.name, W - 200, 2)) { ctx.fillText(l, W / 2, y); y += 86; }

  if (photo) {
    const r = 170, cx = W / 2, cy = y + r - 10;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    const s = Math.max((2 * r) / photo.width, (2 * r) / photo.height);
    ctx.drawImage(photo, cx - (photo.width * s) / 2, cy - (photo.height * s) / 2, photo.width * s, photo.height * s);
    ctx.restore();
    ctx.strokeStyle = t.accent; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    y = cy + r + 70;
  } else y += 20;

  ctx.fillStyle = t.accent; ctx.fillRect(W / 2 - 80, y - 30, 160, 3);
  ctx.fillStyle = t.ink; ctx.font = `400 38px ${serif}`;
  const max = photo ? 5 : 9;
  for (const l of lines(ctx, invite.text, W - 220, max)) { ctx.fillText(l, W / 2, y + 24); y += 52; }
  y += 40;
  const when = ev.date ? formatDate(ev.date, ev.time) : "";
  ctx.font = `700 40px ${serif}`;
  if (when) { ctx.fillText(when.replace(/^./, (x) => x.toUpperCase()), W / 2, y); y += 54; }
  ctx.font = `400 34px ${serif}`;
  if (ev.location) for (const l of lines(ctx, `📍 ${ev.location}`, W - 240, 2)) { ctx.fillText(l, W / 2, y); y += 46; }

  // Bas : lien + QR code
  const by = H - 200;
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.beginPath(); ctx.roundRect?.(80, by, W - 160, 130, 26); ctx.fill();
  ctx.fillStyle = "#c20f68"; ctx.textAlign = "left"; ctx.font = "700 34px -apple-system, Arial, sans-serif";
  ctx.fillText(EN ? "Open the link below the image 👇" : "Ouvrez le lien sous l'image 👇", 110, by + 55);
  ctx.fillStyle = "#555"; ctx.font = "400 28px -apple-system, Arial, sans-serif";
  ctx.fillText(link.replace(/^https?:\/\//, "").replace(/\?.*$/, "").slice(0, 38), 110, by + 98);
  if (qr) ctx.drawImage(qr, W - 80 - 120, by + 5, 120, 120);
  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}

// Partage une image déjà prête (Blob) + texte + lien. Appelé directement dans le toucher (exigence iPhone).
export async function shareBlob(blob, name, text, link) {
  try {
    const file = new File([blob], name, { type: "image/png" });
    if (!navigator.canShare?.({ files: [file] })) return false;
    await navigator.share({ files: [file], text: `${text}\n${link}` });
    return true;
  } catch (err) {
    return err?.name === "AbortError"; // partage annulé : rien d'autre à faire
  }
}
