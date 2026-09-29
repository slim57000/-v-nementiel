// Images : Vercel Blob en production, disque local (./uploads) en développement.
import { put, del } from "@vercel/blob";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";

const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
export const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
if (!USE_BLOB) mkdirSync(UPLOAD_DIR, { recursive: true });

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 4 * 1024 * 1024; // limite de corps de requête Vercel : 4,5 Mo

// Les images arrivent en data URL (redimensionnées côté navigateur) : pas besoin de multer.
export async function saveDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Format d'image non accepté (JPEG, PNG ou WebP).");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_BYTES) throw new Error("Image trop lourde (4 Mo max).");
  const name = `${randomBytes(12).toString("hex")}.${TYPES[match[1]]}`;

  if (USE_BLOB) {
    const blob = await put(`evenements/${name}`, buffer, { access: "public", contentType: match[1] });
    return blob.url;
  }
  writeFileSync(`${UPLOAD_DIR}/${name}`, buffer);
  return `/uploads/${name}`;
}

export async function removeUpload(url) {
  try {
    if (USE_BLOB && url?.includes(".blob.vercel-storage.com/")) await del(url);
    else if (url?.startsWith("/uploads/")) unlinkSync(`${UPLOAD_DIR}/${url.slice(9)}`);
  } catch { /* déjà supprimé */ }
}

// Vrai si l'URL désigne une image que nous avons nous-mêmes stockée.
export const isOwnUpload = (url) =>
  typeof url === "string" && (url.startsWith("/uploads/") || url.includes(".blob.vercel-storage.com/"));
