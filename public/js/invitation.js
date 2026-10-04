// Rendu du faire-part selon le style choisi (classique, élégant, fleuri, moderne).
import { esc, formatDate, EN } from "./common.js";

// Textes préenregistrés par type d'événement : [accroche, texte]. Le premier est proposé par défaut.
export const TEMPLATES = {
  mariage: [
    ["Nous nous marions", "Nous avons la joie de vous convier à notre mariage et serions heureux de partager ce jour si particulier avec vous."],
    ["Ils se disent oui", "Après de belles années main dans la main, nous avons décidé de nous dire oui. Votre présence rendra ce jour encore plus beau."],
    ["Save the date", "Réservez la date ! Nous serions honorés de vous compter parmi nous pour célébrer notre union, dans la joie et l'émotion."],
    ["Un jour inoubliable", "Deux familles, deux cœurs, une seule promesse. Venez célébrer notre mariage et danser avec nous jusqu'au bout de la nuit."],
    ["En petit comité", "Nous avons la joie de vous annoncer notre mariage qui se déroulera en petit comité. Parce que vous comptez pour nous et que nous souhaitons partager ce moment malgré la distance, nous vous invitons à suivre notre cérémonie en direct !"],
  ],
  anniversaire: [
    ["Joyeux anniversaire", "Vous êtes invités à fêter cet anniversaire avec nous ! Venez partager un moment de fête et de bonne humeur."],
    ["Une année de plus !", "Les bougies se multiplient, la joie aussi ! Rejoignez-nous pour souffler les bougies et faire la fête ensemble."],
    ["C'est la fête !", "Musique, gâteau et bonne humeur : tout est prêt, il ne manque plus que vous. On compte sur votre présence !"],
    ["Surprise !", "Chut, c'est une surprise ! Venez fêter cet anniversaire avec nous et gardez le secret jusqu'au grand jour."],
    ["Fêtons ça, même à distance", "Vous êtes invités à fêter cet anniversaire avec nous ! Et si vous ne pouvez pas venir, pas de souci : suivez la fête en direct depuis votre téléphone et envoyez vos vœux en temps réel."],
  ],
  bapteme: [
    ["Baptême", "Nous avons la joie de vous inviter au baptême de notre enfant et serions heureux de vous compter parmi nous."],
    ["Un jour de lumière", "Entouré de sa famille et de ses proches, notre petit trésor recevra le baptême. Partagez ce moment de joie avec nous."],
    ["Bienvenue dans la famille", "Pour célébrer l'arrivée de notre enfant dans la foi, nous serions heureux de vous accueillir à son baptême."],
    ["Avec vous, même de loin", "Nous avons la joie de vous annoncer le baptême de notre enfant. Parce que vous comptez pour nous, même à distance, nous vous invitons à suivre la cérémonie en direct."],
  ],
  communion: [
    ["Communion", "Nous serions heureux de vous accueillir pour célébrer ensemble cette communion."],
    ["Première communion", "C'est avec une grande joie que nous vous invitons à la première communion de notre enfant, suivie d'un moment convivial."],
    ["Un moment de foi et de partage", "Venez partager avec nous ce jour important, dans la joie, la prière et la bonne humeur."],
    ["Unis par la pensée", "Nous serions heureux de partager avec vous la communion de notre enfant. Pour ceux qui ne pourront pas être présents, la cérémonie sera diffusée en direct."],
  ],
  fiancailles: [
    ["Nous nous fiançons", "Nous avons le bonheur de vous annoncer nos fiançailles et de vous inviter à les célébrer avec nous."],
    ["Elle a dit oui !", "La grande question a été posée et la réponse est oui ! Venez fêter nos fiançailles avec nous."],
    ["Premier pas vers le mariage", "Avant le grand jour, nous voulons partager la joie de nos fiançailles avec les personnes qui nous sont chères."],
    ["Partagez notre bonheur", "Nous avons le bonheur de vous annoncer nos fiançailles ! Proches ou éloignés, rejoignez-nous en direct pour célébrer ce moment ensemble."],
  ],
  "baby-shower": [
    ["Baby shower", "Bébé arrive bientôt ! Venez fêter avec nous cette belle nouvelle autour d'un moment tout en douceur."],
    ["Bébé arrive !", "Douceurs, jeux et surprises : venez célébrer avec nous l'arrivée prochaine de notre petit bout."],
    ["Fille ou garçon ?", "Le suspense touche à sa fin ! Rejoignez-nous pour découvrir le secret et fêter bébé avant sa naissance."],
    ["Bébé arrive, connectez-vous !", "Bébé arrive bientôt ! Venez fêter cette belle nouvelle avec nous, sur place ou en direct depuis chez vous."],
  ],
  diplome: [
    ["Remise de diplôme", "Le travail a payé ! Venez célébrer cette réussite avec nous."],
    ["Diplômé !", "Des années d'efforts récompensées : venez fêter ce diplôme et cette belle réussite avec nous."],
    ["Chapeau bas !", "Le chapeau va voler ! Partagez avec nous la fierté de cette remise de diplôme, suivie d'un moment festif."],
    ["Applaudissez en direct", "Le grand jour approche ! Suivez la remise de diplôme en direct et envoyez vos félicitations en temps réel."],
  ],
  retraite: [
    ["Départ en retraite", "Une nouvelle vie commence ! Venez partager ce moment pour fêter ce départ en retraite."],
    ["Place au temps libre", "Après une belle carrière, l'heure est venue de profiter. Venez célébrer ce départ en retraite avec nous."],
    ["Merci pour tout", "Pour dire merci et au revoir dans la bonne humeur, nous vous invitons à fêter ce départ en retraite."],
    ["Une fête pour tous", "Pour fêter ce départ en retraite, nous vous attendons nombreux ! Vous êtes loin ? Suivez la fête en direct et laissez un petit mot."],
  ],
  inauguration: [
    ["Inauguration", "Nous avons le plaisir de vous convier à notre inauguration. Votre présence nous ferait grand plaisir."],
    ["Ouverture officielle", "Les portes s'ouvrent enfin ! Venez découvrir notre nouveau lieu et partager un moment convivial avec nous."],
    ["Coupons le ruban ensemble", "Pour marquer ce grand jour, nous serions ravis de vous accueillir à notre inauguration."],
    ["Coupons le ruban en direct", "Nous avons le plaisir de vous convier à notre inauguration. Ne pouvant accueillir tout le monde, nous diffuserons l'événement en direct."],
  ],
  autre: [
    ["Vous êtes invités", "Nous avons le plaisir de vous inviter à notre événement. Nous espérons vous y voir nombreux !"],
    ["On vous attend !", "Un moment à partager, des sourires et de bons souvenirs : rejoignez-nous, votre présence compte beaucoup."],
    ["Save the date", "Notez la date ! Nous serions heureux de vous retrouver pour ce moment spécial."],
    ["Ensemble, même à distance", "Nous serions heureux de partager ce moment avec vous. Où que vous soyez, suivez-le en direct et envoyez-nous vos messages."],
  ],
};

// Textes proposés en anglais (site affiché en anglais).
export const TEMPLATES_EN = {
  mariage: [
    ["We're getting married", "We are delighted to invite you to our wedding and would be so happy to share this special day with you."],
    ["Save the date", "Save the date! We would be honoured to have you with us to celebrate our union."],
    ["An unforgettable day", "Two families, two hearts, one promise. Come celebrate our wedding and dance with us all night long."],
    ["An intimate wedding", "We are delighted to announce our wedding, which will take place in an intimate setting. Because you matter to us and we want to share this moment despite the distance, we invite you to watch our ceremony live!"],
  ],
  fiancailles: [["We're engaged!", "We are thrilled to share the news of our engagement and would love to celebrate it with you."], ["Save the date", "Join us to celebrate our engagement surrounded by the people we love."], ["Share our joy", "We're thrilled to announce our engagement! Near or far, join us live to celebrate this moment together."]],
  anniversaire: [
    ["Happy birthday", "You're invited to celebrate this birthday with us! Come and share a joyful party."],
    ["One more year!", "More candles, more joy! Join us to blow out the candles and party together."],
    ["Surprise!", "Shhh, it's a surprise! Come celebrate this birthday with us and keep the secret until the big day."],
    ["Let's celebrate, even from afar", "You're invited to celebrate this birthday with us! Can't make it? No worries: watch the party live on your phone and send your wishes in real time."],
  ],
  bapteme: [["Baptism", "We are delighted to invite you to our child's baptism and would be happy to have you with us."], ["A day of light", "Surrounded by family and friends, our little treasure will be baptised. Share this joyful moment with us."], ["With you, even from afar", "We are delighted to announce our child's baptism. Because you matter to us, even at a distance, we invite you to follow the ceremony live."]],
  communion: [["First Communion", "We are happy to invite you to celebrate our child's First Communion with us."], ["A special day", "Join us for this important day of faith and family."], ["Together in thought", "We would be happy to share our child's communion with you. For those who can't attend, the ceremony will be streamed live."]],
  "baby-shower": [["Baby shower", "A little one is on the way! Join us for a sweet celebration before baby arrives."], ["Oh baby!", "Come share games, treats and lots of love to welcome our baby."], ["Baby is coming, tune in!", "Baby is coming soon! Celebrate this wonderful news with us, in person or live from home."]],
  diplome: [["Graduation", "Hard work pays off! Join us to celebrate this graduation."], ["Congratulations!", "Let's celebrate this success together — your presence would mean a lot."], ["Cheer live", "The big day is coming! Watch the graduation live and send your congratulations in real time."]],
  retraite: [["Happy retirement", "After many wonderful years, a new chapter begins. Come celebrate this retirement with us."], ["A party for everyone", "To celebrate this retirement, we hope to see many of you! Far away? Watch the party live and leave a little note."]],
  inauguration: [["Grand opening", "We are proud to invite you to the grand opening of our new space."], ["Cut the ribbon live", "We are pleased to invite you to our opening. As we can't welcome everyone, the event will be streamed live."]],
  autre: [["You're invited", "We would be delighted to have you with us for this special occasion."], ["Save the date", "Mark your calendar! We look forward to celebrating with you."], ["Together, even from afar", "We would be happy to share this moment with you. Wherever you are, watch it live and send us your messages."]],
};

export const templatesFor = (type) => (EN ? TEMPLATES_EN[type] || TEMPLATES_EN.autre : TEMPLATES[type] || TEMPLATES.autre);

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
