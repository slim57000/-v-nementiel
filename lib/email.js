// Envoi d'emails via Resend (https://resend.com) si RESEND_API_KEY est défini ; sinon, aucun envoi.
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "EverMoments <onboarding@resend.dev>";
export const EMAIL_ENABLED = Boolean(KEY);

const layout = (title, body) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#1d1a20">
    <p style="font-size:22px;font-weight:800;margin:0 0 16px">Ever<span style="color:#d81f4f">Moments</span></p>
    <h2 style="font-size:18px">${title}</h2>${body}
    <p style="color:#6e6873;font-size:12px;margin-top:32px">Vous recevez cet email car vous utilisez EverMoments.</p>
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
  subject: temporary ? "Votre code de connexion EverMoments" : "Votre code organisateur EverMoments",
  title: temporary ? "Votre code de connexion" : "Votre code organisateur",
  body: `<p>${temporary ? "Voici votre code de connexion, valable 15 minutes et utilisable une seule fois :" : "Voici le code à saisir pour vous connecter à votre espace :"}</p>
    <p style="font-size:28px;font-weight:800;letter-spacing:6px;background:#fdecf0;padding:12px;border-radius:12px;text-align:center">${code}</p>`,
});
