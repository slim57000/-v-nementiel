// Invitations par email (Resend) : envoi avec lien de suivi, et rappel la veille de l'événement.
import { randomBytes } from "node:crypto";
import { addInvite, listInvites, getSetting } from "./store.js";
import { sendEmail, emailButton } from "./email.js";
import { mailText } from "./email-texts.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const link = (origin, event, token) =>
  `${origin}/e/${event.slug}?inv=${token}${event.visibility === "private" ? `&code=${event.accessCode}` : ""}`;
const when = (event, lang) => new Date(`${event.date}T${event.time || "12:00"}`).toLocaleDateString(lang === "fr" ? "fr-FR" : lang === "en" ? "en-GB" : lang, { weekday: "long", day: "numeric", month: "long" }) + (lang === "fr" ? ` à ${event.time}` : lang === "en" ? ` at ${event.time}` : ` · ${event.time}`);
// Langue des emails d'un événement : celle de son organisateur (réglage « evlang:{id} »).
export const eventLang = async (event) => (await getSetting(`evlang:${event.id}`).catch(() => null)) || "fr";

const inviteEmail = (event, url, reminder, lang = "fr") => {
  const t = mailText(lang);
  return {
    lang, native: true,
    subject: t(reminder ? "remSubj" : "invSubj", { name: event.name }, false),
    title: t(reminder ? "remTitle" : "invTitle"),
    body: `<p><b>${esc(event.name)}</b><br>${esc(when(event, lang))}<br>📍 ${esc(event.location)}</p>
    ${emailButton(url, t("invBtn"))}
    ${event.visibility === "private" ? `<p>${t("accessCode")} <b>${esc(event.accessCode)}</b></p>` : ""}`,
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
  const L = await eventLang(event), t = mailText(L);
  let n = 0;
  for (const to of emails) {
    if (await sendEmail({
      to, lang: L, native: true,
      subject: t("repSubj", { name: event.name }, false), title: t("repTitle"),
      body: `<p>${t("repBody", { name: event.name })}</p>
        ${emailButton(film, t("repFilm"))}
        ${emailButton(url, t("repWatch"))}
        ${emailButton(`${url}&zip=1`, t("repZip"))}
        ${event.visibility === "private" ? `<p>${t("accessCode")} <b>${esc(event.accessCode)}</b></p>` : ""}
        <p style="color:#888;font-size:13px">${t("repFoot")}</p>`,
    })) n++;
  }
  return n;
}

// 1 h avant le live : « Ça commence bientôt ! » aux invités (lien direct vers le live, mode simple).
export async function liveSoonInvites(event) {
  const origin = process.env.PUBLIC_URL || "";
  if (!origin) return 0;
  const L = await eventLang(event), t = mailText(L);
  const url = `${origin}/simple?e=${encodeURIComponent(event.slug)}${event.visibility === "private" ? `&code=${event.accessCode}` : ""}`;
  let n = 0;
  for (const i of await listInvites(event.id)) {
    if (await sendEmail({
      to: i.email, lang: L, native: true,
      subject: t("soonSubj", { name: event.name }, false), title: t("soonTitle"),
      body: `<p>${t("soonBody", { name: event.name, time: L === "fr" ? event.time.replace(":", "h") : event.time })}</p>
      ${emailButton(url, t("soonBtn"))}`,
    })) n++;
  }
  return n;
}
