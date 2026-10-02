// Export des souvenirs d'un événement (organisateur) : photos et vidéos des invités, livre d'or
// (textes, réponses, photos, vidéos, vocaux) et replay du live dans un seul fichier .zip.
import { api, toast, LOCALE } from "./common.js";
import { makeZip } from "./zip.js";

const ext = (url) => (url.split("?")[0].match(/\.(\w{2,4})$/)?.[1] || "jpg").toLowerCase();
const fetchBytes = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error();
  return new Uint8Array(await res.arrayBuffer());
};

export async function exportEvent(ev, onProgress = () => {}) {
  const base = `/api/public/${encodeURIComponent(ev.slug)}`;
  const [photos, entries, replay] = await Promise.all([
    api(`${base}/photos?limit=200`), api(`${base}/guestbook`), api(`/api/events/${ev.id}/replay`).catch(() => []),
  ]);
  const files = [];
  const enc = new TextEncoder();
  const lines = [`Livre d'or — ${ev.name}`, ""];
  const media = [];
  photos.forEach((p, i) => media.push({ url: p.url, name: `photos-invites/${String(i + 1).padStart(3, "0")}-${p.name}.${ext(p.url)}` }));
  entries.slice().reverse().forEach((e, i) => {
    const n = String(i + 1).padStart(3, "0");
    lines.push(`#${n} ${e.name} (${new Date(e.createdAt).toLocaleString(LOCALE)}) — ❤️ ${e.likes || 0}`);
    if (e.text) lines.push(e.text);
    for (const r of e.replies || []) lines.push(`   ↳ ${r.name} : ${r.text}`);
    lines.push("");
    if (e.photoUrl) media.push({ url: e.photoUrl, name: `livre-d-or/${n}-${e.name}.${ext(e.photoUrl)}` });
    if (e.audioUrl) media.push({ url: e.audioUrl, name: `livre-d-or/${n}-${e.name}-vocal.${ext(e.audioUrl)}` });
  });
  // Replay du live (enregistré par le téléphone du caméraman), inclus automatiquement, partie par partie.
  const perCam = {};
  replay.forEach((r) => {
    const n = (perCam[r.camera] = (perCam[r.camera] || 0) + 1);
    media.push({ url: r.url, name: `replay/${r.camera}-partie-${String(n).padStart(2, "0")}.${ext(r.url)}` });
  });
  files.push({ name: "livre-d-or.txt", data: enc.encode(lines.join("\n")) });
  let done = 0, failed = 0;
  for (const m of media) {
    try { files.push({ name: m.name.replace(/[\\:*?"<>|]/g, "_"), data: await fetchBytes(m.url) }); } catch { failed++; }
    onProgress(++done, media.length);
  }
  const blob = makeZip(files);
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${ev.slug}-souvenirs.zip` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  toast(failed ? `Archive créée (${failed} fichier(s) indisponible(s))` : `Archive créée : ${media.length} fichier(s) ✔`);
}

// Replay seul en .zip (proposé juste avant sa suppression, pour en garder une copie).
export async function exportReplay(ev) {
  const replay = await api(`/api/events/${ev.id}/replay`).catch(() => []);
  if (!replay.length) return false;
  const files = [], perCam = {};
  for (const r of replay) {
    const n = (perCam[r.camera] = (perCam[r.camera] || 0) + 1);
    try { files.push({ name: `replay/${r.camera}-partie-${String(n).padStart(2, "0")}.${ext(r.url)}`.replace(/[\\:*?"<>|]/g, "_"), data: await fetchBytes(r.url) }); } catch { /* partie indisponible */ }
  }
  if (!files.length) return false;
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(makeZip(files)), download: `${ev.slug}-replay.zip` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  return true;
}
