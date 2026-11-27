// Images : Supabase Storage (bucket public) si configuré, sinon disque local (UPLOAD_DIR).
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { ON_VERCEL, USE_SUPABASE, STORAGE_BUCKET } from "./config.js";
import { getSetting, setSetting } from "./store.js";

export const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
if (!USE_SUPABASE && !ON_VERCEL) mkdirSync(UPLOAD_DIR, { recursive: true });

const bucket = USE_SUPABASE ? (await import("./supabase.js")).supabase.storage.from(STORAGE_BUCKET) : null;
const PUBLIC_MARKER = `/storage/v1/object/public/${STORAGE_BUCKET}/`;

const TYPES = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // limite par fichier de Supabase (offre gratuite)

// Vidéo courte : avec Supabase, le navigateur l'envoie directement au stockage via une URL signée
// (pas de limite de 4,5 Mo de Vercel). Sans Supabase, elle passe par l'API en base64 (4 Mo max).
export async function videoUploadTarget(type) {
  type = String(type || "").split(";")[0].trim().toLowerCase(); // « video/mp4;codecs=avc1 » (iPhone) → « video/mp4 »
  if (type === "video/x-m4v") type = "video/mp4";
  if (!VIDEO_TYPES.includes(type)) throw new Error("Format vidéo non accepté (MP4, MOV ou WebM).");
  if (!bucket) return { mode: "inline" };
  const name = `${randomBytes(12).toString("hex")}.${TYPES[type]}`;
  const { data, error } = await bucket.createSignedUploadUrl(name);
  if (error) throw new Error(`Envoi de la vidéo impossible : ${error.message}`);
  return { mode: "direct", uploadUrl: data.signedUrl, publicUrl: bucket.getPublicUrl(name).data.publicUrl };
}

// Vrai pour une vidéo (photos / stories / livre d'or ; les vocaux sont stockés à part).
export const isVideoUrl = (url) => /\.(mp4|mov|webm)(\?|$)/i.test(url || "");
const MAX_BYTES = 4 * 1024 * 1024; // limite de corps de requête Vercel : 4,5 Mo

// Stockage : chaque image est recompressée (2560 px max, métadonnées GPS retirées, orientation appliquée).
// Qualité visuelle identique à l'œil ; on garde l'original s'il est déjà plus léger.
const sharp = await import("sharp").then((m) => m.default).catch(() => null);
export async function shrinkImage(buffer, type) {
  if (!sharp) return { buffer, type };
  try {
    const img = sharp(buffer, { failOn: "none" }).rotate().resize(2560, 2560, { fit: "inside", withoutEnlargement: true });
    const meta = await sharp(buffer).metadata();
    let out, outType = type;
    if (type === "image/webp") out = await img.webp({ quality: 82 }).toBuffer();
    else if (type === "image/png" && meta.hasAlpha) out = await img.png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
    else { out = await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer(); outType = "image/jpeg"; }
    return out.length < buffer.length ? { buffer: out, type: outType } : { buffer, type };
  } catch { return { buffer, type }; }
}

// Les fichiers arrivent en data URL (images redimensionnées côté navigateur) : pas besoin de multer.
// `kind` : "image" (défaut) ou "audio" (messages vocaux du livre d'or).
export async function saveDataUrl(dataUrl, kind = "image") {
  // Paramètres éventuels (« ;codecs=avc1,mp4a.40.2 » sur iPhone, virgule comprise) ignorés : seul le type compte.
  const match = /^data:([a-z]+\/[a-z0-9.+-]+)(?:;[^;]*?)*;base64,(.+)$/s.exec(dataUrl || "");
  let type = match?.[1];
  if (!type || !TYPES[type] || !type.startsWith(`${kind}/`)) {
    throw new Error({ audio: "Format audio non accepté.", video: "Format vidéo non accepté (MP4, MOV ou WebM)." }[kind]
      || "Format d'image non accepté (JPEG, PNG ou WebP).");
  }
  let buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_BYTES) throw new Error("Fichier trop lourd (4 Mo max).");
  if (kind === "image") ({ buffer, type } = await shrinkImage(buffer, type));
  const name = `${randomBytes(12).toString("hex")}.${TYPES[type]}`;

  if (bucket) {
    const { error } = await bucket.upload(name, buffer, { contentType: type, cacheControl: "31536000" });
    if (error) throw new Error(`Envoi du fichier impossible : ${error.message}`);
    return bucket.getPublicUrl(name).data.publicUrl;
  }
  writeFileSync(`${UPLOAD_DIR}/${name}`, buffer);
  return `/uploads/${name}`;
}

// Nom de fichier produit par nos envois (24 caractères hexadécimaux + extension) : rien d'autre n'est jamais supprimé.
export const SAFE_NAME = /^[a-f0-9]{16,32}\.[a-z0-9]{2,5}$/;
export async function removeUpload(url) {
  try {
    const name = typeof url === "string" ? (bucket && url.includes(PUBLIC_MARKER) ? url.split(PUBLIC_MARKER)[1] : url.startsWith("/uploads/") ? url.slice(9) : "") : "";
    if (!SAFE_NAME.test(name)) return;
    if (bucket && url.includes(PUBLIC_MARKER)) await bucket.remove([name]);
    else unlinkSync(`${UPLOAD_DIR}/${name}`);
  } catch { /* déjà supprimé */ }
}

// Vrai si l'URL désigne une image que nous avons nous-mêmes stockée.
// Nom vérifié : une URL forgée (« ../ », fichier d'un autre) n'est jamais considérée comme la nôtre.
export const isOwnUpload = (url) =>
  typeof url === "string" && SAFE_NAME.test(url.startsWith("/uploads/") ? url.slice(9) : url.split(PUBLIC_MARKER)[1] || "");

// Replay d'un live « téléphone » (segments vidéo de quelques minutes) : envoi direct au stockage si Supabase,
// sinon fichier local reçu par l'API (développement uniquement).
export const HAS_STORAGE = Boolean(bucket) || !ON_VERCEL;
export function saveLocalVideo(buffer, type) {
  type = String(type || "").split(";")[0].trim().toLowerCase();
  if (!VIDEO_TYPES.includes(type)) throw new Error("Format vidéo non accepté.");
  const name = `${randomBytes(12).toString("hex")}.${TYPES[type]}`;
  writeFileSync(`${UPLOAD_DIR}/${name}`, buffer);
  return `/uploads/${name}`;
}

// Vidéos envoyées en deux temps (fichier, puis publication) : l'adresse délivrée est notée avec son auteur.
// À la publication, seule la personne à qui l'adresse a été délivrée peut l'utiliser, une seule fois :
// impossible de publier (puis supprimer) le fichier de quelqu'un d'autre.
const uplKey = (url) => `upl:${String(url).split("/").pop()}`;
export async function issueUpload(url, owner) {
  if (url) await setSetting(uplKey(url), { owner, exp: Date.now() + 4 * 864e5 });
  return url;
}
export async function claimUpload(url, owner) {
  if (!isOwnUpload(url)) return false;
  const rec = await getSetting(uplKey(url)).catch(() => null);
  if (!rec || rec.owner !== owner || rec.exp < Date.now()) return false;
  await setSetting(uplKey(url), null);
  return true;
}

// Fichier envoyé tel quel par l'application (photo JPEG/PNG/WebP déjà réduite par le téléphone, ou vidéo).
// Le contenu est vérifié (signature du format), pas seulement le type annoncé.
const MAGIC = { "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8, "image/png": (b) => b.subarray(1, 4).toString() === "PNG",
  "image/webp": (b) => b.subarray(8, 12).toString() === "WEBP", "video/mp4": (b) => b.subarray(4, 8).toString() === "ftyp",
  "video/quicktime": (b) => ["ftyp", "moov", "wide", "mdat", "free"].includes(b.subarray(4, 8).toString()), "video/webm": (b) => b.readUInt32BE(0) === 0x1a45dfa3 };
export async function saveRawFile(buffer, type) {
  type = String(type || "").split(";")[0].trim().toLowerCase();
  if (!MAGIC[type] || buffer.length < 16 || !MAGIC[type](buffer)) throw new Error("Format non accepté (photo JPEG, PNG, WebP ou vidéo MP4, MOV, WebM).");
  if (buffer.length > (type.startsWith("video/") ? MAX_VIDEO_BYTES : 12 * 1024 * 1024)) throw new Error("Fichier trop lourd.");
  if (type.startsWith("image/")) ({ buffer, type } = await shrinkImage(buffer, type));
  const name = `${randomBytes(12).toString("hex")}.${TYPES[type]}`;
  if (bucket) {
    const { error } = await bucket.upload(name, buffer, { contentType: type, cacheControl: "31536000" });
    if (error) throw new Error(`Envoi du fichier impossible : ${error.message}`);
    return bucket.getPublicUrl(name).data.publicUrl;
  }
  writeFileSync(`${UPLOAD_DIR}/${name}`, buffer);
  return `/uploads/${name}`;
}
