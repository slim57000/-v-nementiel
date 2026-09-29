import { esc, formatDate } from "./common.js";

// Textes préenregistrés par type d'événement : [accroche, texte]. Le premier est proposé par défaut.
export const TEMPLATES = {
  mariage: [
    ["Nous nous marions", "Nous avons la joie de vous convier à notre mariage et serions heureux de partager ce jour si particulier avec vous."],
    ["Ils se disent oui", "Après de belles années main dans la main, nous avons décidé de nous dire oui. Votre présence rendra ce jour encore plus beau."],
    ["Save the date", "Réservez la date ! Nous serions honorés de vous compter parmi nous pour célébrer notre union, dans la joie et l'émotion."],
    ["Un jour inoubliable", "Deux familles, deux cœurs, une seule promesse. Venez célébrer notre mariage et danser avec nous jusqu'au bout de la nuit."],
  ],
  anniversaire: [
    ["Joyeux anniversaire", "Vous êtes invités à fêter cet anniversaire avec nous ! Venez partager un moment de fête et de bonne humeur."],
    ["Une année de plus !", "Les bougies se multiplient, la joie aussi ! Rejoignez-nous pour souffler les bougies et faire la fête ensemble."],
    ["C'est la fête !", "Musique, gâteau et bonne humeur : tout est prêt, il ne manque plus que vous. On compte sur votre présence !"],
    ["Surprise !", "Chut, c'est une surprise ! Venez fêter cet anniversaire avec nous et gardez le secret jusqu'au grand jour."],
  ],
  bapteme: [
    ["Baptême", "Nous avons la joie de vous inviter au baptême de notre enfant et serions heureux de vous compter parmi nous."],
    ["Un jour de lumière", "Entouré de sa famille et de ses proches, notre petit trésor recevra le baptême. Partagez ce moment de joie avec nous."],
    ["Bienvenue dans la famille", "Pour célébrer l'arrivée de notre enfant dans la foi, nous serions heureux de vous accueillir à son baptême."],
  ],
  communion: [
    ["Communion", "Nous serions heureux de vous accueillir pour célébrer ensemble cette communion."],
    ["Première communion", "C'est avec une grande joie que nous vous invitons à la première communion de notre enfant, suivie d'un moment convivial."],
    ["Un moment de foi et de partage", "Venez partager avec nous ce jour important, dans la joie, la prière et la bonne humeur."],
  ],
  fiancailles: [
    ["Nous nous fiançons", "Nous avons le bonheur de vous annoncer nos fiançailles et de vous inviter à les célébrer avec nous."],
    ["Elle a dit oui !", "La grande question a été posée et la réponse est oui ! Venez fêter nos fiançailles avec nous."],
    ["Premier pas vers le mariage", "Avant le grand jour, nous voulons partager la joie de nos fiançailles avec les personnes qui nous sont chères."],
  ],
  "baby-shower": [
    ["Baby shower", "Bébé arrive bientôt ! Venez fêter avec nous cette belle nouvelle autour d'un moment tout en douceur."],
    ["Bébé arrive !", "Douceurs, jeux et surprises : venez célébrer avec nous l'arrivée prochaine de notre petit bout."],
    ["Fille ou garçon ?", "Le suspense touche à sa fin ! Rejoignez-nous pour découvrir le secret et fêter bébé avant sa naissance."],
  ],
  diplome: [
    ["Remise de diplôme", "Le travail a payé ! Venez célébrer cette réussite avec nous."],
    ["Diplômé !", "Des années d'efforts récompensées : venez fêter ce diplôme et cette belle réussite avec nous."],
    ["Chapeau bas !", "Le chapeau va voler ! Partagez avec nous la fierté de cette remise de diplôme, suivie d'un moment festif."],
  ],
  retraite: [
    ["Départ en retraite", "Une nouvelle vie commence ! Venez partager ce moment pour fêter ce départ en retraite."],
    ["Place au temps libre", "Après une belle carrière, l'heure est venue de profiter. Venez célébrer ce départ en retraite avec nous."],
    ["Merci pour tout", "Pour dire merci et au revoir dans la bonne humeur, nous vous invitons à fêter ce départ en retraite."],
  ],
  inauguration: [
    ["Inauguration", "Nous avons le plaisir de vous convier à notre inauguration. Votre présence nous ferait grand plaisir."],
    ["Ouverture officielle", "Les portes s'ouvrent enfin ! Venez découvrir notre nouveau lieu et partager un moment convivial avec nous."],
    ["Coupons le ruban ensemble", "Pour marquer ce grand jour, nous serions ravis de vous accueillir à notre inauguration."],
  ],
  autre: [
    ["Vous êtes invités", "Nous avons le plaisir de vous inviter à notre événement. Nous espérons vous y voir nombreux !"],
    ["On vous attend !", "Un moment à partager, des sourires et de bons souvenirs : rejoignez-nous, votre présence compte beaucoup."],
    ["Save the date", "Notez la date ! Nous serions heureux de vous retrouver pour ce moment spécial."],
  ],
};

export const templatesFor = (type) => TEMPLATES[type] || TEMPLATES.autre;

export function defaultInvite(event) {
  const [kicker, text] = templatesFor(event.type)[0];
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
    ${(style === "elegant" || style === "fleuri") && photoUrl ? `<img class="invite-photo" src="${esc(photoUrl)}" alt="">` : ""}
    <hr>
    <p class="invite-text">${esc(invite.text)}</p>
    ${when ? `<div class="invite-when">${esc(when)}</div>` : ""}
    ${event.location ? `<div class="invite-where">${esc(event.location)}</div>` : ""}`;
}

// Résout l'image du faire-part à partir du choix enregistré.
export const invitePhotoUrl = (invite, coverUrl) =>
  invite.photo === "none" ? null : invite.photo === "cover" || !invite.photo ? coverUrl : invite.photo;
