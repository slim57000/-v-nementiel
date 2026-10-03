// Invitations par email (Resend) : envoi avec lien de suivi, et rappel la veille de l'événement.
import { randomBytes } from "node:crypto";
import { addInvite, listInvites } from "./store.js";
import { sendEmail, emailButton } from "./email.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const link = (origin, event, token) =>
  `${origin}/e/${event.slug}?inv=${token}${event.visibility === "private" ? `&code=${event.accessCode}` : ""}`;
const when = (event) => new Date(`${event.date}T${event.time || "12:00"}`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) + ` à ${event.time}`;

const inviteEmail = (event, url, reminder) => ({
  subject: reminder ? `Rappel : « ${event.name} », c'est demain !` : `Vous êtes invité·e : ${event.name}`,
  title: reminder ? "C'est demain ! 🎉" : "Vous êtes invité·e 💌",
  body: `<p><b>${esc(event.name)}</b><br>${esc(when(event))}<br>📍 ${esc(event.location)}</p>
    ${emailButton(url, "Voir l'invitation")}
    ${event.visibility === "private" ? `<p>Code d'accès : <b>${esc(event.accessCode)}</b></p>` : ""}`,
});

export async function sendInvites(event, emails, origin) {
  const sent = [];
  for (const email of emails) {
    const token = randomBytes(9).toString("base64url");
    const invite = await addInvite(event.id, email, token);
    await sendEmail({ to: email, ...inviteEmail(event, link(origin, event, token), false) });
    sent.push(invite);
  }
  return sent;
}

// Rappel aux invités la veille (appelé par la tâche quotidienne).
export async function remindInvites(event) {
  const origin = process.env.PUBLIC_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  if (!origin) return 0;
  let n = 0;
  for (const i of await listInvites(event.id)) {
    if (await sendEmail({ to: i.email, ...inviteEmail(event, link(origin, event, i.token), true) })) n++;
  }
  return n;
}

// Le lendemain de l'événement : lien du replay envoyé automatiquement aux invités (et aux autres adresses fournies).
export async function sendReplay(event, extraEmails = []) {
  const origin = process.env.PUBLIC_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  if (!origin) return 0;
  const url = `${origin}/live?e=${encodeURIComponent(event.slug)}${event.visibility === "private" ? `&code=${event.accessCode}` : ""}`;
  const emails = new Set([...(await listInvites(event.id)).map((i) => i.email), ...extraEmails].map((e) => String(e).toLowerCase()));
  let n = 0;
  for (const to of emails) {
    if (await sendEmail({
      to,
      subject: `🎞️ Revivez « ${event.name} » : le replay est disponible`,
      title: "Le replay est disponible 🎞️",
      body: `<p>Merci d'avoir partagé ce moment ! Revoyez <b>${esc(event.name)}</b> quand vous voulez, pendant 15 jours.</p>
        ${emailButton(url, "▶ Voir le replay")}
        ${emailButton(`${url}&zip=1`, "📦 Télécharger le replay (.zip)")}
        ${event.visibility === "private" ? `<p>Code d'accès : <b>${esc(event.accessCode)}</b></p>` : ""}
        <p style="color:#888;font-size:13px">Photos, vidéos et messages des invités vous attendent aussi sur la page de l'événement.</p>`,
    })) n++;
  }
  return n;
}
