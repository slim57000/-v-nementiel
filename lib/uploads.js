// Images : Supabase Storage (bucket public) si configuré, sinon disque local (UPLOAD_DIR).
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { ON_VERCEL, USE_SUPABASE, STORAGE_BUCKET } from "./config.js";

export const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
if (!USE_SUPABASE && !ON_VERCEL) mkdirSync(UPLOAD_DIR, { recursive: true });

const bucket = USE_SUPABASE ? (await import("./supabase.js")).supabase.storage.from(STORAGE_BUCKET) : null;
const PUBLIC_MARKER = `/storage/v1/object/public/${STORAGE_BUCKET}/`;

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 4 * 1024 * 1024; // limite de corps de requête Vercel : 4,5 Mo

// Les images arrivent en data URL (redimensionnées côté navigateur) : pas besoin de multer.
export async function saveDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Format d'image non accepté (JPEG, PNG ou WebP).");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_BYTES) throw new Error("Image trop lourde (4 Mo max).");
  const name = `${randomBytes(12).toString("hex")}.${TYPES[match[1]]}`;

  if (bucket) {
    const { error } = await bucket.upload(name, buffer, { contentType: match[1], cacheControl: "31536000" });
    if (error) throw new Error(`Envoi de l'image impossible : ${error.message}`);
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
