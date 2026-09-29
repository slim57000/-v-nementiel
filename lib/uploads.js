// Images : Supabase Storage (bucket public) si configuré, sinon disque local (UPLOAD_DIR).
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { ON_VERCEL, USE_SUPABASE, STORAGE_BUCKET } from "./config.js";

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

// Les fichiers arrivent en data URL (images redimensionnées côté navigateur) : pas besoin de multer.
// `kind` : "image" (défaut) ou "audio" (messages vocaux du livre d'or).
export async function saveDataUrl(dataUrl, kind = "image") {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,(.+)$/.exec(dataUrl || "");
  const type = match?.[1];
  if (!type || !TYPES[type] || !type.startsWith(`${kind}/`)) {
    throw new Error({ audio: "Format audio non accepté.", video: "Format vidéo non accepté (MP4, MOV ou WebM)." }[kind]
      || "Format d'image non accepté (JPEG, PNG ou WebP).");
  }
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_BYTES) throw new Error("Fichier trop lourd (4 Mo max).");
  const name = `${randomBytes(12).toString("hex")}.${TYPES[type]}`;

  if (bucket) {
    const { error } = await bucket.upload(name, buffer, { contentType: type, cacheControl: "31536000" });
    if (error) throw new Error(`Envoi du fichier impossible : ${error.message}`);
    return bucket.getPublicUrl(name).data.publicUrl;
  }
  writeFileSync(`${UPLOAD_DIR}/${name}`, buffer);
  return `/uploads/${name}`;
}

export async function removeUpload(url) {
  try {
    if (bucket && url?.includes(PUBLIC_MARKER)) await bucket.remove([url.split(PUBLIC_MARKER)[1]]);
    else if (url?.startsWith("/uploads/")) unlinkSync(`${UPLOAD_DIR}/${url.slice(9)}`);
  } catch { /* déjà supprimé */ }
}

// Vrai si l'URL désigne une image que nous avons nous-mêmes stockée.
export const isOwnUpload = (url) =>
  typeof url === "string" && (url.startsWith("/uploads/") || url.includes(PUBLIC_MARKER));
