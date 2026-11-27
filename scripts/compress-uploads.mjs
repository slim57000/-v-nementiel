// Recompresse une fois les images déjà stockées (même nom, même format) : 2560 px max, qualité 82.
// Une image n'est remplacée que si le résultat est plus léger. Usage : UPLOAD_DIR=/chemin node scripts/compress-uploads.mjs
import { readdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import sharp from "sharp";

const dir = process.env.UPLOAD_DIR || "./uploads";
let before = 0, after = 0, done = 0;
for (const name of readdirSync(dir)) {
  const ext = name.split(".").pop().toLowerCase();
  if (!["jpg", "jpeg", "png", "webp"].includes(ext)) continue;
  const file = `${dir}/${name}`;
  try {
    const buf = readFileSync(file);
    const img = sharp(buf, { failOn: "none" }).rotate().resize(2560, 2560, { fit: "inside", withoutEnlargement: true });
    const out = ext === "png" ? await img.png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer()
      : ext === "webp" ? await img.webp({ quality: 82 }).toBuffer()
      : await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    before += buf.length;
    if (out.length < buf.length * 0.95) { writeFileSync(`${file}.tmp`, out); renameSync(`${file}.tmp`, file); after += out.length; done++; }
    else after += buf.length;
  } catch { /* fichier illisible : laissé tel quel */ }
}
const mb = (n) => (n / 1048576).toFixed(1);
console.log(`${done} images allégées : ${mb(before)} Mo → ${mb(after)} Mo`);
