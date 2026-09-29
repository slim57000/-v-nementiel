import { Router } from "express";
import { findOrganizerByEmail, findOrganizer, createOrganizer } from "../lib/store.js";
import { loginCode } from "../lib/codes.js";
import { setSigned, getSigned } from "../lib/session.js";

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Anti-bruteforce minimal en mémoire (par instance) : 8 essais ratés par email toutes les 15 min.
const failures = new Map();
const tooManyFailures = (email) => {
  const f = failures.get(email);
  return f && f.count >= 8 && Date.now() - f.since < 15 * 60 * 1000;
};
const recordFailure = (email) => {
  const f = failures.get(email);
  if (!f || Date.now() - f.since > 15 * 60 * 1000) failures.set(email, { count: 1, since: Date.now() });
  else f.count++;
};

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
    return res.json({ created: true, code: created.loginCode });
  }

  if (!code) return res.status(401).json({ needCode: true });
  if (tooManyFailures(email)) return res.status(429).json({ error: "Trop d'essais, réessayez dans 15 minutes." });
  if (code !== organizer.loginCode) {
    recordFailure(email);
    return res.status(401).json({ needCode: true, error: "Code incorrect." });
  }
  failures.delete(email);
  setSigned(res, "org", String(organizer.id));
  res.json({ created: false });
});

router.post("/logout", (req, res) => {
  res.clearCookie("org");
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  const organizer = await currentOrganizer(req);
  if (!organizer) return res.status(401).json({ error: "Non connecté." });
  res.json({ email: organizer.email, code: organizer.loginCode });
});

export async function currentOrganizer(req) {
  const id = getSigned(req, "org");
  return id ? findOrganizer(id) : null;
}

export async function requireOrganizer(req, res, next) {
  req.organizer = await currentOrganizer(req);
  if (!req.organizer) return res.status(401).json({ error: "Non connecté." });
  next();
}

export default router;
