import { Router } from "express";
import { findOrganizerByEmail, findOrganizer, createOrganizer, deleteOrganizer, listEvents, saveOrganizer, getSetting, setSetting, clearLimit } from "../lib/store.js";
import { loginCode } from "../lib/codes.js";
import { setSigned, getSigned } from "../lib/session.js";
import { codeEmail, resetEmail, EMAIL_ENABLED, lastEmailError } from "../lib/email.js";
import { setPassword, hasPassword, checkPassword, passwordError } from "../lib/password.js";
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
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const code = String(req.body.code || "").trim();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Adresse email invalide." });

  const organizer = await findOrganizerByEmail(email);

  // Inscription : email + mot de passe (8 caractères minimum).
  if (!organizer) {
    if (!password) return res.status(401).json({ needPassword: true, isNew: true });
    const bad = passwordError(password);
    if (bad) return res.status(400).json({ needPassword: true, isNew: true, error: bad });
    const created = await createOrganizer(email, loginCode());
    await setPassword(created.id, password);
    setSigned(res, "org", String(created.id));
    return res.json({ created: true });
  }

  if (organizer.blocked) return res.status(403).json({ error: "Ce compte a été suspendu. Contactez le support." });
  if (!password && !code) return res.status(401).json({ needPassword: true, legacy: !(await hasPassword(organizer.id)) });
  // Anti-bruteforce partagé entre toutes les instances : 10 essais par email toutes les 15 min.
  if (await tooFast(`login:${email}`, 10, 15 * 60 * 1000)) return res.status(429).json({ error: "Trop d'essais, réessayez dans 15 minutes." });
  let ok = false;
  if (password) ok = await checkPassword(organizer.id, password);
  if (!ok && code) {
    // Anciens comptes : code organisateur permanent, ou code temporaire reçu par email (15 min, usage unique).
    const otp = await getSetting(`otp:${email}`).catch(() => null);
    const otpOk = otp && otp.code === code && otp.exp > Date.now();
    ok = code === organizer.loginCode || otpOk;
    if (otpOk) await setSetting(`otp:${email}`, null);
  }
  if (!ok) {
    const legacy = password && !(await hasPassword(organizer.id));
    return res.status(401).json({ needPassword: true, legacy, error: legacy
      ? "Ce compte n'a pas encore de mot de passe : utilisez « Mot de passe oublié » pour en créer un."
      : "Email ou mot de passe incorrect." });
  }
  await clearLimit(`login:${email}`).catch(() => {});
  setSigned(res, "org", String(organizer.id));
  res.json({ created: false });
});

// Mot de passe oublié : lien de réinitialisation valable 1 heure (réponse identique que le compte existe ou non).
router.post("/forgot", async (req, res) => {
  if (!EMAIL_ENABLED) return res.status(503).json({ error: "L'envoi d'emails n'est pas encore activé." });
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Saisissez d'abord votre adresse email." });
  if (await tooFast(`forgot:${email}`, 3, 3_600_000)) return res.status(429).json({ error: "Patientez avant de redemander un lien." });
  const organizer = await findOrganizerByEmail(email);
  if (organizer && !organizer.blocked) {
    const token = randomBytes(24).toString("base64url");
    await setSetting(`reset:${token}`, { id: organizer.id, exp: Date.now() + 3_600_000 });
    if (!(await resetEmail(email, `${origin(req)}/reinitialiser?token=${token}`))) {
      const unverified = /own email address|verify a domain|not verified/i.test(lastEmailError);
      return res.status(502).json({ error: unverified
        ? "L'envoi d'emails est en cours d'activation (domaine mafeliza.com à vérifier dans Resend). Réessayez plus tard ou connectez-vous avec Google."
        : `L'email n'a pas pu être envoyé (${lastEmailError || "erreur inconnue"}). Réessayez dans quelques minutes ou connectez-vous avec Google.` });
    }
  }
  res.json({ ok: true });
});

router.post("/reset", async (req, res) => {
  const token = String(req.body?.token || "");
  const bad = passwordError(req.body?.password);
  if (bad) return res.status(400).json({ error: bad });
  const entry = /^[\w-]{20,64}$/.test(token) ? await getSetting(`reset:${token}`).catch(() => null) : null;
  if (!entry || entry.exp < Date.now()) return res.status(400).json({ error: "Lien expiré ou déjà utilisé. Redemandez-en un." });
  const organizer = await findOrganizer(entry.id);
  if (!organizer || organizer.blocked) return res.status(400).json({ error: "Compte indisponible." });
  await setPassword(organizer.id, req.body.password);
  await setSetting(`reset:${token}`, null);
  setSigned(res, "org", String(organizer.id));
  res.json({ ok: true });
});

// Définir ou changer son mot de passe (connecté).
router.post("/password", async (req, res) => {
  const organizer = await currentOrganizer(req);
  if (!organizer) return res.status(401).json({ error: "Non connecté." });
  const bad = passwordError(req.body?.password);
  if (bad) return res.status(400).json({ error: bad });
  if (await hasPassword(organizer.id) && !(await checkPassword(organizer.id, String(req.body?.current || "")))) {
    return res.status(400).json({ error: "Mot de passe actuel incorrect." });
  }
  await setPassword(organizer.id, req.body.password);
  res.json({ ok: true });
});

// Connexion Google : redirection vers Google, puis retour ici (le compte est créé à la première connexion).
const safeNext = (n) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard");
// Adresse publique fixe (PUBLIC_URL) si définie : évite les « redirect_uri_mismatch » quand le site est ouvert
// par une autre adresse (aperçu Vercel, ancien domaine…). Sinon, l'adresse de la requête.
const origin = (req) => (process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
const callbackUrl = (req) => `${origin(req)}/api/auth/google/callback`;
// Diagnostic : adresses de retour à enregistrer dans Google Cloud / Facebook (rien de secret).
router.get("/redirect-uris", (req, res) => res.json({
  google: callbackUrl(req), facebook: fbCallbackUrl(req), publicUrl: process.env.PUBLIC_URL || "(non défini)",
}));

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
    id: organizer.id, email: organizer.email, code: organizer.loginCode, isAdmin: await isAdmin(organizer), superAdmin: isSuperAdmin(organizer), hasPassword: await hasPassword(organizer.id),
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
