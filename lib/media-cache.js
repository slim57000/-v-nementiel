// Cache disque des photos et vidéos Supabase Storage : chaque fichier n'est téléchargé qu'une fois depuis
// Supabase puis servi par le serveur (/media/…). Évite de dépasser le quota de bande passante de Supabase.
import { createWriteStream, existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { SUPABASE_URL, STORAGE_BUCKET } from "./config.js";

// Actif tant qu'une adresse Supabase est connue (aussi après la migration : anciens liens éventuels).
const ORIGIN = SUPABASE_URL ? `${String(SUPABASE_URL).replace(/\/$/, "")}/storage/v1/object/public/${STORAGE_BUCKET}/` : null;
const DIR = `${process.env.DATA_DIR || "./data"}/media-cache`;
if (ORIGIN) mkdirSync(DIR, { recursive: true });
const pending = new Map(); // fichier en cours de téléchargement → promesse (une seule copie à la fois)

// Remplace les adresses Supabase Storage par /media/… dans une réponse (JSON ou HTML).
export const localMedia = (text, to = "/media/") => (ORIGIN && typeof text === "string" ? text.split(ORIGIN).join(to) : text);

// Adresses /media/… renvoyées par l'appli (formulaires) : remises en adresse Supabase avant enregistrement.
const toOrigin = (v, depth = 0) => {
  if (typeof v === "string") return v.startsWith("/media/") ? ORIGIN + v.slice(7) : v;
  if (!v || typeof v !== "object" || depth > 6) return v;
  for (const k of Object.keys(v)) v[k] = toOrigin(v[k], depth + 1);
  return v;
};

export function mediaJson(req, res, next) {
  if (!ORIGIN) return next();
  if (req.body && typeof req.body === "object") toOrigin(req.body);
  const json = res.json.bind(res);
  res.json = (body) => json(body && typeof body === "object" ? JSON.parse(localMedia(JSON.stringify(body))) : body);
  next();
}

async function download(name, file) {
  const r = await fetch(ORIGIN + name.split("/").map(encodeURIComponent).join("/"), { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw Object.assign(new Error(`Supabase ${r.status}`), { status: r.status });
  const tmp = `${file}.part${process.pid}`;
  try { await pipeline(Readable.fromWeb(r.body), createWriteStream(tmp)); renameSync(tmp, file); }
  catch (err) { try { unlinkSync(tmp); } catch { /* déjà absent */ } throw err; }
}

export async function serveMedia(req, res, next) {
  const name = req.params[0];
  if (!ORIGIN || !/^[\w./-]+$/.test(name) || name.includes("..")) return next();
  const file = `${DIR}/${name.replace(/\//g, "__")}`;
  try {
    if (!existsSync(file)) {
      if (!pending.has(file)) pending.set(file, download(name, file).finally(() => pending.delete(file)));
      await pending.get(file);
    }
    res.sendFile(file, { root: "/", maxAge: "365d", immutable: true });
  } catch (err) {
    if (err.status === 404 || err.status === 400) return res.status(404).end();
    res.redirect(302, ORIGIN + name); // Supabase en direct en dernier recours
  }
}
