// Mails de confirmation à chaque action importante (bienvenue, événement créé, réponse d'un invité,
// message au livre d'or, replay enregistré). Envoyés en arrière-plan : une erreur d'envoi ne bloque jamais l'action.
import { sendEmail, emailButton } from "./email.js";
import { findOrganizer, getSetting, setSetting } from "./store.js";
import { eventLang, sendReplay } from "./invites.js";
import { tooFast } from "./limits.js";

const SITE = (process.env.PUBLIC_URL || "https://mafeliza.com").replace(/\/$/, "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const later = (p) => { Promise.resolve().then(p).catch((err) => console.error("Mail de confirmation :", err.message)); };

// Bienvenue après la création du compte.
export const welcomeMail = (email, lang = "fr") => later(() => sendEmail(lang === "en" ? {
  to: email, lang, subject: "Welcome to MaFeliza 💛", title: "Welcome to MaFeliza 💛",
  body: `<p>Your account is ready! Create your event in a few taps: invitation, live for loved ones far away, photos and memories, all in one place.</p>
  ${emailButton(`${SITE}/edit`, "✨ Create my event")}`,
} : {
  to: email, lang, subject: "Bienvenue sur MaFeliza 💛", title: "Bienvenue sur MaFeliza 💛",
  body: `<p>Votre compte est prêt ! Créez votre événement en quelques touches : faire-part, live pour les proches éloignés, photos et souvenirs, tout au même endroit.</p>
  ${emailButton(`${SITE}/edit`, "✨ Créer mon événement")}`,
}));

// Événement créé : récapitulatif avec le lien à partager et les codes.
export const eventCreatedMail = (organizer, event, lang = "fr") => later(() => {
  const url = `${SITE}/e/${encodeURIComponent(event.slug)}`;
  const code = event.visibility === "private";
  return sendEmail(lang === "en" ? {
    to: organizer.email, lang, subject: `🎉 “${event.name}” is created`, title: "Your event is created 🎉",
    body: `<p><b>${esc(event.name)}</b> is online. Share the link with your loved ones:</p>
    <p style="text-align:center"><a href="${url}">${url}</a></p>
    ${code ? `<p>Access code for your guests: <b>${esc(event.accessCode)}</b></p>` : ""}
    <p>Camera operator code (to film the live): <b>${esc(event.cameramanCode)}</b></p>
    ${emailButton(url, "👀 See my event")}`,
  } : {
    to: organizer.email, lang, subject: `🎉 « ${event.name} » est créé`, title: "Votre événement est créé 🎉",
    body: `<p><b>${esc(event.name)}</b> est en ligne. Partagez le lien avec vos proches :</p>
    <p style="text-align:center"><a href="${url}">${url}</a></p>
    ${code ? `<p>Code d'accès pour vos invités : <b>${esc(event.accessCode)}</b></p>` : ""}
    <p>Code caméraman (pour filmer le live) : <b>${esc(event.cameramanCode)}</b></p>
    ${emailButton(url, "👀 Voir mon événement")}`,
  });
});

// Organisateur prévenu (au plus 15 mails par heure et par événement, pour ne jamais saturer sa boîte).
async function toOrganizer(event, fr, en) {
  if (await tooFast(`mailorg:${event.id}`, 15, 3600_000)) return;
  const organizer = await findOrganizer(event.organizerId);
  if (!organizer?.email) return;
  const lang = await eventLang(event);
  await sendEmail({ to: organizer.email, lang, ...(lang === "en" ? en : fr) });
}

export const rsvpMail = (event, name, status, count) => later(() => {
  const url = `${SITE}/e/${encodeURIComponent(event.slug)}`;
  const fr = { yes: "vient", maybe: "viendra peut-être", no: "ne pourra pas venir" }[status];
  const en = { yes: "is coming", maybe: "might come", no: "can't come" }[status];
  return toOrganizer(event, {
    subject: `✅ ${name} ${fr} · ${event.name}`, title: `${esc(name)} ${fr}`,
    body: `<p>Nouvelle réponse pour <b>${esc(event.name)}</b>${count > 1 ? ` : ${count} personnes` : ""}.</p>${emailButton(url, "Voir les réponses")}`,
  }, {
    subject: `✅ ${name} ${en} · ${event.name}`, title: `${esc(name)} ${en}`,
    body: `<p>New reply for <b>${esc(event.name)}</b>${count > 1 ? `: ${count} people` : ""}.</p>${emailButton(url, "See the replies")}`,
  });
});

export const guestbookMail = (event, name, text) => later(() => {
  const url = `${SITE}/e/${encodeURIComponent(event.slug)}#gb-list`;
  const quote = text ? `<blockquote style="margin:16px 0;padding:10px 14px;border-left:3px solid #fd1a85;background:#fff5fa">${esc(text).slice(0, 400)}</blockquote>` : "";
  return toOrganizer(event, {
    subject: `✍️ ${name} a écrit dans votre livre d'or`, title: "Nouveau message au livre d'or ✍️",
    body: `<p><b>${esc(name)}</b> a laissé un souvenir pour <b>${esc(event.name)}</b>.</p>${quote}${emailButton(url, "Lire le livre d'or")}`,
  }, {
    subject: `✍️ ${name} wrote in your guestbook`, title: "New guestbook message ✍️",
    body: `<p><b>${esc(name)}</b> left a memory for <b>${esc(event.name)}</b>.</p>${quote}${emailButton(url, "Read the guestbook")}`,
  });
});

// Premier morceau du replay reçu : l'organisateur sait que le live est bien enregistré (une seule fois).
export const replayRecordedMail = (event) => later(async () => {
  if (await getSetting(`replayrec:${event.id}`).catch(() => null)) return;
  await setSetting(`replayrec:${event.id}`, new Date().toISOString());
  const url = `${SITE}/live?e=${encodeURIComponent(event.slug)}`;
  const organizer = await findOrganizer(event.organizerId);
  if (!organizer?.email) return;
  const lang = await eventLang(event);
  await sendEmail(lang === "en" ? {
    to: organizer.email, lang, subject: `🎬 Your live “${event.name}” is being recorded`, title: "Your live is recorded 🎬",
    body: `<p>Good news: the live of <b>${esc(event.name)}</b> is being saved. The replay will be sent to your guests by email as soon as the live ends.</p>${emailButton(url, "▶ Open the live")}`,
  } : {
    to: organizer.email, lang, subject: `🎬 Votre live « ${event.name} » est enregistré`, title: "Votre live est enregistré 🎬",
    body: `<p>Bonne nouvelle : le live de <b>${esc(event.name)}</b> est bien sauvegardé. Le replay sera envoyé par email à vos invités dès la fin du live.</p>${emailButton(url, "▶ Ouvrir le live")}`,
  });
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
