import { esc, formatDate } from "./common.js";

// Textes proposés automatiquement selon le type d'événement.
const TEMPLATES = {
  mariage: ["Nous nous marions", "Nous avons la joie de vous convier à notre mariage et serions heureux de partager ce jour si particulier avec vous."],
  anniversaire: ["Joyeux anniversaire", "Vous êtes invités à fêter cet anniversaire avec nous ! Venez partager un moment de fête et de bonne humeur."],
  bapteme: ["Baptême", "Nous avons la joie de vous inviter au baptême de notre enfant et serions heureux de vous compter parmi nous."],
  communion: ["Communion", "Nous serions heureux de vous accueillir pour célébrer ensemble cette communion."],
  fiancailles: ["Nous nous fiançons", "Nous avons le bonheur de vous annoncer nos fiançailles et de vous inviter à les célébrer avec nous."],
  "baby-shower": ["Baby shower", "Bébé arrive bientôt ! Venez fêter avec nous cette belle nouvelle autour d'un moment tout en douceur."],
  diplome: ["Remise de diplôme", "Le travail a payé ! Venez célébrer cette réussite avec nous."],
  retraite: ["Départ en retraite", "Une nouvelle vie commence ! Venez partager ce moment pour fêter ce départ en retraite."],
  inauguration: ["Inauguration", "Nous avons le plaisir de vous convier à notre inauguration. Votre présence nous ferait grand plaisir."],
  autre: ["Vous êtes invités", "Nous avons le plaisir de vous inviter à notre événement. Nous espérons vous y voir nombreux !"],
};

export function defaultInvite(event) {
  const [kicker, text] = TEMPLATES[event.type] || TEMPLATES.autre;
  return { kicker, title: event.name || "", text, photo: "cover" };
}

// Rend le faire-part dans `container`. `photoUrl` est l'image finale à afficher (ou null).
export function renderInvite(container, event, invite, style, photoUrl) {
  const when = event.date && event.time ? formatDate(event.date, event.time) : "";
  container.className = `invite ${style}`;
  container.innerHTML = `
    ${style === "moderne" && photoUrl ? `<img class="invite-photo" src="${esc(photoUrl)}" alt="">` : ""}
    <div class="invite-kicker">${esc(invite.kicker)}</div>
    ${style === "classique" && photoUrl ? `<img class="invite-photo" src="${esc(photoUrl)}" alt="">` : ""}
    <h2 class="invite-title">${esc(invite.title || event.name)}</h2>
    ${style === "elegant" && photoUrl ? `<img class="invite-photo" src="${esc(photoUrl)}" alt="">` : ""}
    <hr>
    <p class="invite-text">${esc(invite.text)}</p>
    ${when ? `<div class="invite-when">${esc(when)}</div>` : ""}
    ${event.location ? `<div class="invite-where">${esc(event.location)}</div>` : ""}`;
}

// Résout l'image du faire-part à partir du choix enregistré.
export const invitePhotoUrl = (invite, coverUrl) =>
  invite.photo === "none" ? null : invite.photo === "cover" || !invite.photo ? coverUrl : invite.photo;
