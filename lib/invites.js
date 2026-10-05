// Invitations par email (Resend) : envoi avec lien de suivi, et rappel la veille de l'événement.
import { randomBytes } from "node:crypto";
import { addInvite, listInvites, getSetting } from "./store.js";
import { sendEmail, emailButton } from "./email.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const link = (origin, event, token) =>
  `${origin}/e/${event.slug}?inv=${token}${event.visibility === "private" ? `&code=${event.accessCode}` : ""}`;
const when = (event, lang) => new Date(`${event.date}T${event.time || "12:00"}`).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", { weekday: "long", day: "numeric", month: "long" }) + (lang === "en" ? ` at ${event.time}` : ` à ${event.time}`);
// Langue des emails d'un événement : celle de son organisateur (réglage « evlang:{id} »).
export const eventLang = async (event) => ((await getSetting(`evlang:${event.id}`).catch(() => null)) === "en" ? "en" : "fr");

const inviteEmail = (event, url, reminder, lang = "fr") => {
  const en = lang === "en";
  return {
    lang,
    subject: en ? (reminder ? `Reminder: “${event.name}” is tomorrow!` : `You're invited: ${event.name}`) : (reminder ? `Rappel : « ${event.name} », c'est demain !` : `Vous êtes invité·e : ${event.name}`),
    title: en ? (reminder ? "It's tomorrow! 🎉" : "You're invited 💌") : (reminder ? "C'est demain ! 🎉" : "Vous êtes invité·e 💌"),
    body: `<p><b>${esc(event.name)}</b><br>${esc(when(event, lang))}<br>📍 ${esc(event.location)}</p>
    ${emailButton(url, en ? "See the invitation" : "Voir l'invitation")}
    ${event.visibility === "private" ? `<p>${en ? "Access code" : "Code d'accès"} : <b>${esc(event.accessCode)}</b></p>` : ""}`,
  };
};

export async function sendInvites(event, emails, origin) {
  const sent = [];
  for (const email of emails) {
    const token = randomBytes(9).toString("base64url");
    const invite = await addInvite(event.id, email, token);
    await sendEmail({ to: email, ...inviteEmail(event, link(origin, event, token), false, await eventLang(event)) });
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
    if (await sendEmail({ to: i.email, ...inviteEmail(event, link(origin, event, i.token), true, await eventLang(event)) })) n++;
  }
  return n;
}

// Le lendemain de l'événement : lien du replay envoyé automatiquement aux invités (et aux autres adresses fournies).
export async function sendReplay(event, extraEmails = []) {
  const origin = process.env.PUBLIC_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  if (!origin) return 0;
  const url = `${origin}/live?e=${encodeURIComponent(event.slug)}${event.visibility === "private" ? `&code=${event.accessCode}` : ""}`;
  const film = `${origin}/e/${encodeURIComponent(event.slug)}?film=1${event.visibility === "private" ? `&code=${event.accessCode}` : ""}`;
  const emails = new Set([...(await listInvites(event.id)).map((i) => i.email), ...extraEmails].map((e) => String(e).toLowerCase()));
  const en = (await eventLang(event)) === "en";
  let n = 0;
  for (const to of emails) {
    if (await sendEmail({
      to, lang: en ? "en" : "fr",
      subject: en ? `🎞️ Relive “${event.name}”: the replay is available` : `🎞️ Revivez « ${event.name} » : le replay est disponible`,
      title: en ? "The replay is available 🎞️" : "Le replay est disponible 🎞️",
      body: en
        ? `<p>Thank you for sharing this moment! Watch <b>${esc(event.name)}</b> again whenever you like, for 15 days.</p>
        ${emailButton(film, "✨ Relive the event: the memory film")}
        ${emailButton(url, "▶ Watch the replay")}
        ${emailButton(`${url}&zip=1`, "📦 Download the replay (.zip)")}
        ${event.visibility === "private" ? `<p>Access code: <b>${esc(event.accessCode)}</b></p>` : ""}
        <p style="color:#888;font-size:13px">Guests' photos, videos and messages are also waiting for you on the event page.</p>`
        : `<p>Merci d'avoir partagé ce moment ! Revoyez <b>${esc(event.name)}</b> quand vous voulez, pendant 15 jours.</p>
        ${emailButton(film, "✨ Revivez l'événement : le film souvenir")}
        ${emailButton(url, "▶ Voir le replay")}
        ${emailButton(`${url}&zip=1`, "📦 Télécharger le replay (.zip)")}
        ${event.visibility === "private" ? `<p>Code d'accès : <b>${esc(event.accessCode)}</b></p>` : ""}
        <p style="color:#888;font-size:13px">Photos, vidéos et messages des invités vous attendent aussi sur la page de l'événement.</p>`,
    })) n++;
  }
  return n;
}
