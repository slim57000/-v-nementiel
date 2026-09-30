import { Router } from "express";
import { findOrganizerByEmail, findOrganizer, createOrganizer, deleteOrganizer, listEvents, saveOrganizer, getSetting, setSetting, clearLimit } from "../lib/store.js";
import { loginCode } from "../lib/codes.js";
import { setSigned, getSigned } from "../lib/session.js";
import { codeEmail, EMAIL_ENABLED } from "../lib/email.js";
import { GOOGLE_ENABLED, googleAuthUrl, googleIdentity } from "../lib/google.js";
import { FACEBOOK_ENABLED, facebookAuthUrl, facebookIdentity } from "../lib/facebook.js";
import { randomBytes, randomInt } from "node:crypto";
import { tooFast } from "../lib/limits.js";
import { isPremium } from "../lib/premium.js";

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


// Premier passage : crée le compte et renvoie le code (affiché une seule fois).
// Passages suivants : email + code exigés.
router.post("/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const code = String(req.body.code || "").trim();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Adresse email invalide." });

  const organizer = await findOrganizerByEmail(email);

  if (!organizer) {
    const created = await createOrganizer(email, loginCode());
    setSigned(res, "org", String(created.id));
    codeEmail(email, created.loginCode); // copie du code par email (si l'envoi est configuré)
    return res.json({ created: true, code: created.loginCode, emailed: EMAIL_ENABLED });
  }

  if (organizer.blocked) return res.status(403).json({ error: "Ce compte a été suspendu. Contactez le support." });
  if (!code) return res.status(401).json({ needCode: true });
  // Anti-bruteforce partagé entre toutes les instances : 10 essais par email toutes les 15 min.
  if (await tooFast(`login:${email}`, 10, 15 * 60 * 1000)) return res.status(429).json({ error: "Trop d'essais, réessayez dans 15 minutes." });
  // Code organisateur permanent, ou code temporaire reçu par email (valable 15 min, usage unique).
  const otp = await getSetting(`otp:${email}`).catch(() => null);
  const otpOk = otp && otp.code === code && otp.exp > Date.now();
  if (code !== organizer.loginCode && !otpOk) return res.status(401).json({ needCode: true, error: "Code incorrect." });
  if (otpOk) await setSetting(`otp:${email}`, null);
  await clearLimit(`login:${email}`).catch(() => {});
  setSigned(res, "org", String(organizer.id));
  res.json({ created: false });
});

// Connexion Google : redirection vers Google, puis retour ici (le compte est créé à la première connexion).
const safeNext = (n) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard");
// Adresse publique fixe (PUBLIC_URL) si définie : évite les « redirect_uri_mismatch » quand le site est ouvert
// par une autre adresse (aperçu Vercel, ancien domaine…). Sinon, l'adresse de la requête.
const origin = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
const callbackUrl = (req) => `${origin(req)}/api/auth/google/callback`;
router.get("/google", (req, res) => {
  if (!GOOGLE_ENABLED) return res.redirect("/connexion");
  const nonce = randomBytes(12).toString("hex");
  setSigned(res, "gstate", `${nonce}~${encodeURIComponent(safeNext(req.query.next))}`);
  res.redirect(googleAuthUrl(callbackUrl(req), nonce));
});
router.get("/google/callback", async (req, res) => {
  const [nonce, next] = (getSigned(req, "gstate") || "").split("~");
  res.clearCookie("gstate");
  if (!nonce || req.query.state !== nonce || !req.query.code) return res.redirect("/connexion");
  try {
    const who = await googleIdentity(String(req.query.code), callbackUrl(req));
    let organizer = await findOrganizerByEmail(who.email);
    if (!organizer) {
      organizer = await createOrganizer(who.email, loginCode());
      organizer = await saveOrganizer({ ...organizer, displayName: who.name.slice(0, 40), avatar: who.avatar });
    }
    if (organizer.blocked) return res.redirect("/connexion");
    setSigned(res, "org", String(organizer.id));
    res.redirect(safeNext(decodeURIComponent(next || "")));
  } catch (err) {
    console.error("Google :", err.message);
    res.redirect("/connexion");
  }
});

// Connexion Facebook : même principe que Google.
const fbCallbackUrl = (req) => `${origin(req)}/api/auth/facebook/callback`;
router.get("/facebook", (req, res) => {
  if (!FACEBOOK_ENABLED) return res.redirect("/connexion");
  const nonce = randomBytes(12).toString("hex");
  setSigned(res, "gstate", `${nonce}~${encodeURIComponent(safeNext(req.query.next))}`);
  res.redirect(facebookAuthUrl(fbCallbackUrl(req), nonce));
});
router.get("/facebook/callback", async (req, res) => {
  const [nonce, next] = (getSigned(req, "gstate") || "").split("~");
  res.clearCookie("gstate");
  if (!nonce || req.query.state !== nonce || !req.query.code) return res.redirect("/connexion");
  try {
    const who = await facebookIdentity(String(req.query.code), fbCallbackUrl(req));
    let organizer = await findOrganizerByEmail(who.email);
    if (!organizer) {
      organizer = await createOrganizer(who.email, loginCode());
      organizer = await saveOrganizer({ ...organizer, displayName: who.name.slice(0, 40), avatar: who.avatar });
    }
    if (organizer.blocked) return res.redirect("/connexion");
    setSigned(res, "org", String(organizer.id));
    res.redirect(safeNext(decodeURIComponent(next || "")));
  } catch (err) {
    console.error("Facebook :", err.message);
    res.redirect("/connexion");
  }
});

// « Code oublié » : renvoie le code organisateur par email (réponse identique que le compte existe ou non).
const resent = new Map();
router.post("/send-code", async (req, res) => {
  if (!EMAIL_ENABLED) return res.status(503).json({ error: "L'envoi d'emails n'est pas encore activé." });
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Adresse email invalide." });
  const last = resent.get(email) || 0;
  if (Date.now() - last < 60_000) return res.status(429).json({ error: "Patientez une minute avant de redemander le code." });
  resent.set(email, Date.now());
  const organizer = await findOrganizerByEmail(email);
  if (organizer && !organizer.blocked) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await setSetting(`otp:${email}`, { code, exp: Date.now() + 15 * 60 * 1000 });
    await codeEmail(email, code, true);
  }
  res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  res.clearCookie("org");
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  const organizer = await currentOrganizer(req);
  if (!organizer) return res.status(401).json({ error: "Non connecté." });
  res.json({
    id: organizer.id, email: organizer.email, code: organizer.loginCode, isAdmin: await isAdmin(organizer), superAdmin: isSuperAdmin(organizer),
    displayName: organizer.displayName || "", avatar: organizer.avatar || null, premium: await isPremium(organizer.id),
  });
});

// Suppression du compte (RGPD / exigence App Store et Play Store) : compte, événements et fichiers.
router.delete("/me", async (req, res) => {
  const organizer = await currentOrganizer(req);
  if (!organizer) return res.status(401).json({ error: "Non connecté." });
  const { destroyEvent } = await import("./events.js");
  for (const event of await listEvents(organizer.id)) await destroyEvent(event);
  await deleteOrganizer(organizer);
  res.clearCookie("org");
  res.json({ ok: true });
});

export async function currentOrganizer(req) {
  const id = getSigned(req, "org");
  const organizer = id ? await findOrganizer(id) : null;
  return organizer?.blocked ? null : organizer;
}

// Administrateurs : emails listés dans ADMIN_EMAILS (séparés par des virgules).
const ADMINS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
// Administrateurs : ceux de ADMIN_EMAILS (super-administrateurs, non retirables) + ceux nommés depuis l'interface.
export const isSuperAdmin = (organizer) => Boolean(organizer && ADMINS.includes(organizer.email));
export const listExtraAdmins = async () => (await getSetting("admins").catch(() => null)) || [];
export const isAdmin = async (organizer) =>
  Boolean(organizer && (isSuperAdmin(organizer) || (await listExtraAdmins()).includes(organizer.email)));

export async function requireOrganizer(req, res, next) {
  req.organizer = await currentOrganizer(req);
  if (!req.organizer) return res.status(401).json({ error: "Non connecté." });
  next();
}

export default router;
