// Mails de confirmation à chaque action importante (bienvenue, événement créé, réponse d'un invité,
// message au livre d'or, replay enregistré). Envoyés en arrière-plan : une erreur d'envoi ne bloque jamais l'action.
import { sendEmail, emailButton } from "./email.js";
import { findOrganizer, getSetting, setSetting } from "./store.js";
import { eventLang, sendReplay } from "./invites.js";
import { tooFast } from "./limits.js";
import { mailText } from "./email-texts.js";

const SITE = (process.env.PUBLIC_URL || "https://mafeliza.com").replace(/\/$/, "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const later = (p) => { Promise.resolve().then(p).catch((err) => console.error("Mail de confirmation :", err.message)); };

// Bienvenue après la création du compte.
export const welcomeMail = (email, lang = "fr") => later(() => {
  const t = mailText(lang);
  return sendEmail({ to: email, lang, native: true, subject: t("welcomeSubj", {}, false), title: t("welcomeSubj"),
    body: `<p>${t("welcomeBody")}</p>${emailButton(`${SITE}/edit`, t("welcomeBtn"))}` });
});

// Événement créé : récapitulatif avec le lien à partager et les codes.
export const eventCreatedMail = (organizer, event, lang = "fr") => later(() => {
  const url = `${SITE}/e/${encodeURIComponent(event.slug)}`, t = mailText(lang);
  return sendEmail({
    to: organizer.email, lang, native: true, subject: t("createdSubj", { name: event.name }, false), title: t("createdTitle"),
    body: `<p>${t("createdBody", { name: event.name })}</p>
    <p style="text-align:center"><a href="${url}">${url}</a></p>
    ${event.visibility === "private" ? `<p>${t("createdCode")} <b>${esc(event.accessCode)}</b></p>` : ""}
    <p>${t("createdCam")} <b>${esc(event.cameramanCode)}</b></p>
    ${emailButton(url, t("createdBtn"))}`,
  });
});

// Organisateur prévenu (au plus 15 mails par heure et par événement, pour ne jamais saturer sa boîte).
async function toOrganizer(event, build) {
  if (await tooFast(`mailorg:${event.id}`, 15, 3600_000)) return;
  const organizer = await findOrganizer(event.organizerId);
  if (!organizer?.email) return;
  const lang = await eventLang(event);
  await sendEmail({ to: organizer.email, lang, native: true, ...build(mailText(lang)) });
}

export const rsvpMail = (event, name, status, count) => later(() => {
  const url = `${SITE}/e/${encodeURIComponent(event.slug)}`;
  const k = { yes: "rsvpYes", maybe: "rsvpMaybe", no: "rsvpNo" }[status] || "rsvpYes";
  return toOrganizer(event, (t) => ({
    subject: `✅ ${t(k, { who: name }, false)} · ${event.name}`, title: t(k, { who: name }),
    body: `<p>${t("rsvpBody", { name: event.name })}${count > 1 ? ` · ${t("rsvpPeople", { n: count })}` : ""}</p>${emailButton(url, t("rsvpBtn"))}`,
  }));
});

export const guestbookMail = (event, name, text) => later(() => {
  const url = `${SITE}/e/${encodeURIComponent(event.slug)}#gb-list`;
  const quote = text ? `<blockquote style="margin:16px 0;padding:10px 14px;border-left:3px solid #fd1a85;background:#fff5fa">${esc(text).slice(0, 400)}</blockquote>` : "";
  return toOrganizer(event, (t) => ({
    subject: t("gbSubj", { who: name }, false), title: t("gbTitle"),
    body: `<p>${t("gbBody", { who: name, name: event.name })}</p>${quote}${emailButton(url, t("gbBtn"))}`,
  }));
});

// Premier morceau du replay reçu : l'organisateur sait que le live est bien enregistré (une seule fois).
export const replayRecordedMail = (event) => later(async () => {
  if (await getSetting(`replayrec:${event.id}`).catch(() => null)) return;
  await setSetting(`replayrec:${event.id}`, new Date().toISOString());
  const url = `${SITE}/live?e=${encodeURIComponent(event.slug)}`;
  const organizer = await findOrganizer(event.organizerId);
  if (!organizer?.email) return;
  const lang = await eventLang(event), t = mailText(lang);
  await sendEmail({ to: organizer.email, lang, native: true, subject: t("recSubj", { name: event.name }, false), title: t("recTitle"),
    body: `<p>${t("recBody", { name: event.name })}</p>${emailButton(url, t("recBtn"))}` });
});

// Fin du live : le replay part tout de suite par email aux invités et à l'organisateur (une seule fois par événement,
// sauf replay retiré ou supprimé). La tâche quotidienne ne le renvoie pas ensuite.
export const replayReadyMail = (event) => later(async () => {
  if (!((await getSetting(`replay:${event.id}`).catch(() => null)) || []).length) return;
  const [off, hide, done] = await Promise.all([`replayoff:${event.id}`, `replayhide:${event.id}`, `replaysent:${event.id}`].map((k) => getSetting(k).catch(() => null)));
  if (off || hide || done) return;
  await setSetting(`replaysent:${event.id}`, new Date().toISOString());
  const organizer = await findOrganizer(event.organizerId);
  await sendReplay(event, organizer?.email ? [organizer.email] : []);
});
