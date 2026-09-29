// Événements de démonstration : créés sous un compte dédié pour pouvoir tous les supprimer d'un coup.
import { randomCode, slugify, loginCode } from "./codes.js";
import { findOrganizerByEmail, createOrganizer, createEvent, listEvents } from "./store.js";

export const DEMO_EMAIL = "demo@evermoments.app";

const FIRST = ["Awa", "Moussa", "Fatou", "Ibrahim", "Aïcha", "Kofi", "Mariam", "Yannick", "Nadia", "Samuel", "Grâce", "Cheikh", "Inès", "Jordan", "Kadi", "Olivier", "Salimata", "Thomas", "Binta", "Julien"];
const CITIES = ["Paris", "Lyon", "Marseille", "Bordeaux", "Lille", "Toulouse", "Nantes", "Strasbourg", "Metz", "Nice", "Montpellier", "Rennes", "Dakar", "Abidjan", "Bruxelles"];
const VENUES = ["Château de la Roseraie", "Domaine des Lys", "Salle Les Lumières", "Villa Belle Rive", "Le Pavillon d'Or", "Mas des Oliviers", "Loft Saint-Martin", "Orangerie du Parc"];
// Photo cohérente avec le type d'événement.
const img = (...names) => names.map((n) => `/img/maquette/${n}.jpg`);
const COUPLE = img("couple", "exemple-mariage", "story1", "story2", "story3");
const PARTY = img("salle", "dj", "drone", "story4");
const COVERS = { mariage: COUPLE, fiancailles: COUPLE, diplome: img("exemple-diplome") };
const TYPES = {
  mariage: (a, b) => [`Mariage de ${a} & ${b}`, "Ils se disent oui", "Nous avons la joie de vous convier à notre mariage."],
  anniversaire: (a) => [`Les 30 ans de ${a}`, "Joyeux anniversaire", "Venez fêter cette belle année avec nous !"],
  bapteme: (a) => [`Baptême de ${a}`, "Un jour béni", "Nous serons heureux de vous accueillir pour le baptême."],
  communion: (a) => [`Communion de ${a}`, "Première communion", "Partagez avec nous ce moment de foi."],
  fiancailles: (a, b) => [`Fiançailles de ${a} & ${b}`, "Ils se fiancent", "Nous célébrons nos fiançailles."],
  "baby-shower": (a) => [`Baby shower de ${a}`, "Bébé arrive !", "Une douce fête pour accueillir bébé."],
  diplome: (a) => [`Remise de diplôme de ${a}`, "Félicitations !", "Célébrons ensemble cette réussite."],
  retraite: (a) => [`Pot de retraite de ${a}`, "Bonne retraite !", "Une nouvelle vie commence."],
  inauguration: (_, __, c) => [`Inauguration Studio ${c}`, "Grande ouverture", "Découvrez notre nouvel espace."],
  autre: (a) => [`Soirée de gala chez ${a}`, "Save the date", "Une soirée inoubliable vous attend."],
};
const STYLES = ["classique", "moderne", "elegant", "fleuri"];
const pick = (list, i) => list[i % list.length];
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

async function demoOrganizer() {
  return (await findOrganizerByEmail(DEMO_EMAIL)) || createOrganizer(DEMO_EMAIL, loginCode());
}

export async function seedDemo(count = 50) {
  const org = await demoOrganizer();
  const types = Object.keys(TYPES);
  for (let i = 0; i < count; i++) {
    const type = pick(types, i);
    const a = pick(FIRST, i * 3), b = pick(FIRST, i * 7 + 1), city = pick(CITIES, i * 7);
    const [name, kicker, text] = TYPES[type](a, b, city);
    // 1 sur 10 le jour même (en direct), les autres réparties sur 3 mois.
    const offset = i % 10 === 0 ? 0 : 1 + ((i * 11) % 90);
    await createEvent({
      organizerId: org.id, slug: slugify(name), accessCode: randomCode(), cameramanCode: randomCode(),
      name, type, date: day(offset), time: `${String(10 + (i % 11)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
      location: `${pick(VENUES, i)}, ${city}`, description: text,
      cover: pick(COVERS[type] || PARTY, i), visibility: i % 8 === 7 ? "private" : "public", inviteStyle: pick(STYLES, i),
      invite: { kicker, title: name, text, photo: "cover" },
      cameras: i % 3 === 0 ? [{ name: "Caméra 1", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk" }] : [],
      cagnotteUrl: i % 4 === 0 ? "https://www.leetchi.com/" : "",
    });
  }
  return count;
}

export async function demoEvents() {
  const org = await findOrganizerByEmail(DEMO_EMAIL);
  return org ? listEvents(org.id) : [];
}
