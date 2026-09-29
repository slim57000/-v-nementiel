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
};
const MAX_BYTES = 4 * 1024 * 1024; // limite de corps de requête Vercel : 4,5 Mo

// Les fichiers arrivent en data URL (images redimensionnées côté navigateur) : pas besoin de multer.
// `kind` : "image" (défaut) ou "audio" (messages vocaux du livre d'or).
export async function saveDataUrl(dataUrl, kind = "image") {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,(.+)$/.exec(dataUrl || "");
  const type = match?.[1];
  if (!type || !TYPES[type] || !type.startsWith(`${kind}/`)) {
    throw new Error(kind === "audio" ? "Format audio non accepté." : "Format d'image non accepté (JPEG, PNG ou WebP).");
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
