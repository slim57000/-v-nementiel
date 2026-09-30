// Envoi d'emails via Resend (https://resend.com) si RESEND_API_KEY est défini ; sinon, aucun envoi.
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "MaFeliza <onboarding@resend.dev>";
export const EMAIL_ENABLED = Boolean(KEY);

const layout = (title, body) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#1d1a20">
    <p style="font-size:22px;font-weight:800;margin:0 0 16px">Ever<span style="color:#e8137a">Moments</span></p>
    <h2 style="font-size:18px">${title}</h2>${body}
    <p style="color:#6e6873;font-size:12px;margin-top:32px">Vous recevez cet email car vous utilisez MaFeliza.</p>
  </div>`;

export async function sendEmail({ to, subject, title, body }) {
  if (!KEY) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html: layout(title, body) }),
    });
    if (!res.ok) console.error("Email non envoyé :", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Email non envoyé :", err.message);
    return false;
  }
}

export const codeEmail = (to, code, temporary = false) => sendEmail({
  to,
  subject: temporary ? "Votre code de connexion MaFeliza" : "Votre code organisateur MaFeliza",
  title: temporary ? "Votre code de connexion" : "Votre code organisateur",
  body: `<p>${temporary ? "Voici votre code de connexion, valable 15 minutes et utilisable une seule fois :" : "Voici le code à saisir pour vous connecter à votre espace :"}</p>
    <p style="font-size:28px;font-weight:800;letter-spacing:6px;background:#ffe8f3;padding:12px;border-radius:12px;text-align:center">${code}</p>`,
});

export const resetEmail = (to, link) => sendEmail({
  to,
  subject: "Réinitialisez votre mot de passe MaFeliza",
  title: "Mot de passe oublié ?",
  body: `<p>Pour choisir un nouveau mot de passe, appuyez sur le bouton ci-dessous (lien valable 1 heure) :</p>
    <p style="text-align:center;margin:24px 0"><a href="${link}" style="background:#e8137a;color:#fff;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:700">Choisir un nouveau mot de passe</a></p>
    <p style="color:#888;font-size:13px">Si vous n'avez rien demandé, ignorez cet email : votre mot de passe reste inchangé.</p>`,
});
