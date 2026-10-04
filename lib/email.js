// Envoi d'emails via Resend (https://resend.com) si RESEND_API_KEY est défini ; sinon, aucun envoi.
const KEY = process.env.RESEND_API_KEY;
// Expéditeur : EMAIL_FROM, sinon contact@mafeliza.com (domaine vérifié dans Resend) ; si Resend le refuse, adresse de test Resend.
const FROM = process.env.EMAIL_FROM || "MaFeliza <contact@mafeliza.com>";
const FALLBACK = "MaFeliza <onboarding@resend.dev>";
export let lastEmailError = "";
export const EMAIL_ENABLED = Boolean(KEY);

// Habillage aux couleurs MaFeliza : bandeau dégradé avec le logo, carte blanche, pied de page.
const SITE = (process.env.PUBLIC_URL || "https://mafeliza.com").replace(/\/$/, "");
const GRADIENT = "linear-gradient(135deg,#fe7320 0%,#fd1a85 50%,#8a1de9 100%)";
export const emailButton = (href, label) => `<p style="text-align:center;margin:26px 0">
  <a href="${href}" style="display:inline-block;background:#fd1a85;background-image:${GRADIENT};color:#fff;padding:15px 28px;border-radius:14px;text-decoration:none;font-weight:700;font-size:16px">${label}</a></p>`;
export const emailCode = (code) => `<p style="margin:18px 0;text-align:center"><span style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:10px;color:#c20f68;background:#ffe8f3;border:2px dashed #fd1a85;padding:12px 22px;border-radius:14px">${code}</span></p>`;
// Langue d'une requête (cookie posé par le site) : "en" ou "fr".
export const reqLang = (req) => (/(?:^|;\s*)em-lang=en/.test(req?.headers?.cookie || "") ? "en" : "fr");
const layout = (title, body, lang = "fr") => `
  <div style="background:#faf7f8;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#1d1a20">
    <div style="max-width:520px;margin:auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.06)">
      <div style="background:#fd1a85;background-image:${GRADIENT};padding:26px 20px;text-align:center">
        <img src="${SITE}/img/logo.png" width="56" height="56" alt="" style="display:block;margin:0 auto 8px;background:#fff;border-radius:16px;padding:6px">
        <div style="font-size:26px;font-weight:800;color:#fff;letter-spacing:.5px">MaFeliza</div>
        <div style="font-size:13px;color:#fff;opacity:.9;margin-top:4px">${lang === "en" ? "Share the emotion before, during, after." : "Partagez l'émotion avant, pendant, après."}</div>
      </div>
      <div style="padding:26px 24px 8px">
        <h2 style="font-size:20px;margin:0 0 12px;color:#c20f68">${title}</h2>${body}
      </div>
      <div style="padding:14px 24px 22px;border-top:1px solid #f3e6ec;color:#8a7f86;font-size:12px;text-align:center">
        ${lang === "en" ? "You receive this email because you use" : "Vous recevez cet email car vous utilisez"} <a href="${SITE}" style="color:#c20f68;text-decoration:none;font-weight:700">MaFeliza</a>.
      </div>
    </div>
  </div>`;

export async function sendEmail({ to, subject, title, body, replyTo, lang = "fr" }) {
  if (!KEY) return false;
  const send = (from) => fetch(`${process.env.RESEND_API_BASE || "https://api.resend.com"}/emails`, { // base modifiable pour les tests
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html: layout(title, body, lang), ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  try {
    let res = await send(FROM);
    // Domaine pas encore vérifié : nouvel essai avec l'adresse de test (n'arrive qu'au propriétaire du compte Resend).
    if (res.status === 403 && FROM !== FALLBACK) res = await send(FALLBACK);
    if (res.ok) { lastEmailError = ""; return true; }
    const data = await res.json().catch(() => ({}));
    lastEmailError = data.message || `Erreur ${res.status}`;
    console.error("Email non envoyé :", res.status, lastEmailError);
    return false;
  } catch (err) {
    lastEmailError = err.message;
    console.error("Email non envoyé :", err.message);
    return false;
  }
}

export const codeEmail = (to, code, temporary = false, lang = "fr") => sendEmail({
  to, lang,
  subject: lang === "en" ? (temporary ? "Your MaFeliza sign-in code" : "Your MaFeliza organizer code") : (temporary ? "Votre code de connexion MaFeliza" : "Votre code organisateur MaFeliza"),
  title: lang === "en" ? (temporary ? "Your sign-in code" : "Your organizer code") : (temporary ? "Votre code de connexion" : "Votre code organisateur"),
  body: `<p>${lang === "en"
    ? (temporary ? "Here is your sign-in code, valid for 15 minutes and usable once:" : "Here is the code to sign in to your space:")
    : (temporary ? "Voici votre code de connexion, valable 15 minutes et utilisable une seule fois :" : "Voici le code à saisir pour vous connecter à votre espace :")}</p>
    ${emailCode(code)}`,
});

export const resetEmail = (to, link, code, lang = "fr") => sendEmail({
  to, lang,
  subject: lang === "en" ? `${code} — your MaFeliza code` : `${code} — votre code MaFeliza`,
  title: lang === "en" ? "Forgot your password?" : "Mot de passe oublié ?",
  body: lang === "en"
    ? `<p>Enter this code on MaFeliza to choose a new password (valid for 1 hour):</p>
    ${emailCode(code)}
    <p>Or tap the button:</p>
    ${emailButton(link, "Choose a new password")}
    <p style="color:#888;font-size:13px">If you didn't ask for anything, ignore this email: your password stays the same.</p>`
    : `<p>Saisissez ce code sur MaFeliza pour choisir un nouveau mot de passe (valable 1 heure) :</p>
    ${emailCode(code)}
    <p>Ou appuyez sur le bouton :</p>
    ${emailButton(link, "Choisir un nouveau mot de passe")}
    <p style="color:#888;font-size:13px">Si vous n'avez rien demandé, ignorez cet email : votre mot de passe reste inchangé.</p>`,
});

// Lien magique : connexion en un clic, valable 15 minutes, une seule fois.
export const magicEmail = (to, link, lang = "fr") => sendEmail({
  to, lang,
  subject: lang === "en" ? "Your MaFeliza sign-in link" : "Votre lien de connexion MaFeliza",
  title: lang === "en" ? "Sign in to MaFeliza" : "Connexion à MaFeliza",
  body: lang === "en"
    ? `<p>Tap the button to sign in. The link is valid for 15 minutes and works once.</p>${emailButton(link, "Sign me in")}<p style="color:#888;font-size:13px">Didn't ask for it? Just ignore this email.</p>`
    : `<p>Touchez le bouton pour vous connecter. Le lien est valable 15 minutes et ne fonctionne qu'une fois.</p>${emailButton(link, "Me connecter")}<p style="color:#888;font-size:13px">Vous n'avez rien demandé ? Ignorez simplement cet email.</p>`,
});
