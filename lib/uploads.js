import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";

export const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
mkdirSync(UPLOAD_DIR, { recursive: true });

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 5 * 1024 * 1024;

// Les images arrivent en data URL (redimensionnées côté navigateur) : pas besoin de multer.
export function saveDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Format d'image non accepté (JPEG, PNG ou WebP).");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_BYTES) throw new Error("Image trop lourde (5 Mo max).");
  const name = `${randomBytes(12).toString("hex")}.${TYPES[match[1]]}`;
  writeFileSync(`${UPLOAD_DIR}/${name}`, buffer);
  return `/uploads/${name}`;
}

export function removeUpload(path) {
  if (!path?.startsWith("/uploads/")) return;
  try { unlinkSync(`${UPLOAD_DIR}/${path.slice(9)}`); } catch { /* déjà supprimé */ }
}
