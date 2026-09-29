import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// En production (Vercel), SESSION_SECRET est obligatoire : sinon les sessions sauteraient à chaque déploiement.
if (!process.env.SESSION_SECRET && process.env.VERCEL) {
  throw new Error("Variable d'environnement SESSION_SECRET manquante.");
}
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
const ONE_YEAR = 365 * 24 * 3600 * 1000;

const sign = (value) => createHmac("sha256", SECRET).update(value).digest("base64url");

export function setSigned(res, name, value) {
  res.cookie(name, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
  });
}

export function getSigned(req, name) {
  const raw = parseCookies(req.headers.cookie)[name];
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  const value = raw.slice(0, i);
  const expected = Buffer.from(sign(value));
  const given = Buffer.from(raw.slice(i + 1));
  return given.length === expected.length && timingSafeEqual(given, expected) ? value : null;
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header.split(";").filter(Boolean).map((c) => {
      const i = c.indexOf("=");
      return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
    })
  );
}

// Empreinte courte du code d'accès : si l'organisateur change le code, les anciens cookies invités ne valent plus.
export const codeFingerprint = (code) => sign(`code:${code}`).slice(0, 12);
