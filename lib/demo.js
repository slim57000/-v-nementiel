// Événements de démonstration : créés sous un compte dédié pour pouvoir tous les supprimer d'un coup.
import { randomCode, slugify, loginCode } from "./codes.js";
import { getSetting, setSetting, findOrganizerByEmail, createOrganizer, createEvent, listEvents, saveEvent, saveOrganizer, addFriends, addDirectMessage, addHistory, addPhoto, addGuestbookEntry, updateGuestbookEntry } from "./store.js";

export const DEMO_EMAIL = "demo@evermoments.app";
// Vidéo YouTube intégrable et durable (film libre de la fondation Blender) pour les directs de démonstration.
const DEMO_VIDEO = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";
const OLD_VIDEO = "jfKfPfyJRdk";
// Événement démo créé par une version précédente (anciennes vignettes ou vidéo indisponible).
export const outdatedDemo = (e) => e.cover?.startsWith("/img/maquette/") || e.cameras?.some((c) => c.url.includes(OLD_VIDEO));

const FIRST = ["Awa", "Moussa", "Fatou", "Ibrahim", "Aïcha", "Kofi", "Mariam", "Yannick", "Nadia", "Samuel", "Grâce", "Cheikh", "Inès", "Jordan", "Kadi", "Olivier", "Salimata", "Thomas", "Binta", "Julien"];
const CITIES = ["Paris", "Lyon", "Marseille", "Bordeaux", "Lille", "Toulouse", "Nantes", "Strasbourg", "Metz", "Nice", "Montpellier", "Rennes", "Dakar", "Abidjan", "Bruxelles"];
const VENUES = ["Château de la Roseraie", "Domaine des Lys", "Salle Les Lumières", "Villa Belle Rive", "Le Pavillon d'Or", "Mas des Oliviers", "Loft Saint-Martin", "Orangerie du Parc"];
const pick = (list, i) => list[i % list.length];

// Photos haute définition, cohérentes avec le type d'événement.
const img = (...names) => names.map((n) => `/img/demo/${n}.jpg`);
// Chaque photo existe en plusieurs variantes (miroir, recadrage, tons) : « nom », « nom-2 », « nom-3 »…
const variants = (name, n) => [name, ...Array.from({ length: n - 1 }, (_, i) => `${name}-${i + 2}`)];
const WEDDING = img(...variants("live-mariage", 5), "mariage-b", ...variants("mariage", 4));
const BABY = img(...variants("bebe", 4));
const KIDS = img(...variants("enfants", 4));
const PARTY = img("anniversaire-f", ...variants("anniversaire", 4), ...variants("enfants", 4));
const COVERS = {
  mariage: WEDDING, fiancailles: [...WEDDING].reverse(),
  bapteme: BABY, "baby-shower": [...BABY, ...KIDS], communion: img("communion-f", ...variants("costume", 4)),
  anniversaire: PARTY, diplome: img("diplome-f", ...variants("diplome", 4)), autre: [...WEDDING, ...PARTY],
};
export const coverFor = (type, i) => pick(COVERS[type] || PARTY, i);
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
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

async function demoOrganizer() {
  return (await findOrganizerByEmail(DEMO_EMAIL)) || createOrganizer(DEMO_EMAIL, loginCode());
}

// Remplissage automatique : une seule fois, quand la plateforme n'a encore aucun événement public
// (désactivable avec DEMO_EVENTS=off). Le compte démo sert de verrou : s'il existe déjà, on ne refait rien.
let autoDone = process.env.DEMO_EVENTS === "off";
export async function autoSeedDemo() {
  if (autoDone) return false;
  autoDone = true;
  if (await findOrganizerByEmail(DEMO_EMAIL)) return false;
  let org;
  try { org = await createOrganizer(DEMO_EMAIL, loginCode()); } catch { return false; } // créé par une autre instance
  await seedDemo(50, org);
  return true;
}

export async function seedDemo(count = 50, owner = null) {
  const org = owner || await demoOrganizer();
  const types = Object.keys(TYPES);
  // En parallèle : la première visite ne doit pas attendre 50 écritures successives.
  await Promise.all(Array.from({ length: count }, async (_, i) => {
    const type = pick(types, i);
    const a = pick(FIRST, i * 7), b = pick(FIRST, i * 7 + 9), city = pick(CITIES, i * 7);
    const [name, kicker, text] = TYPES[type](a, b, city);
    // 1 sur 10 le jour même (en direct), les autres réparties sur 3 mois.
    const offset = i % 10 === Math.floor(i / 10) * 2 ? 0 : 1 + ((i * 11) % 90);
    await createEvent({
      organizerId: org.id, slug: slugify(name), accessCode: randomCode(), cameramanCode: randomCode(),
      name, type, date: day(offset), time: `${String(10 + (i % 11)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
      location: `${pick(VENUES, i)}, ${city}`, description: text,
      cover: coverFor(type, i + Math.floor(i / 10)), visibility: i % 8 === 7 ? "private" : "public", inviteStyle: pick(STYLES, i),
      invite: { kicker, title: name, text, photo: "cover" },
      cameras: i % 3 === 0 ? [{ name: "Caméra 1", url: DEMO_VIDEO }] : [],
      cagnotteUrl: i % 4 === 0 ? "https://www.leetchi.com/" : "",
    });
  }));
  return count;
}

// Événements démo créés avant les photos HD : on remplace leurs anciennes vignettes (une fois par instance).
let upgraded = false;
export async function upgradeDemoCovers() {
  if (upgraded) return;
  upgraded = true;
  const list = (await demoEvents()).filter(outdatedDemo);
  await Promise.all(list.map((e, i) => saveEvent({
    ...e,
    cover: e.cover?.startsWith("/img/maquette/") ? coverFor(e.type, i) : e.cover,
    cameras: (e.cameras || []).map((c) => (c.url.includes(OLD_VIDEO) ? { ...c, url: DEMO_VIDEO } : c)),
  })));
}

// Couvertures variées (v3) : redistribue une fois les photos des événements démo déjà créés.
let varied = false;
export async function varyDemoCovers() {
  if (varied) return false;
  varied = true;
  if ((await getSetting("demoCovers")) >= 5) return false;
  const list = await demoEvents();
  const seen = {};
  await Promise.all(list.map((e) => {
    const i = seen[e.type] = (seen[e.type] ?? -1) + 1;
    return e.cover?.startsWith("/img/demo/") ? saveEvent({ ...e, cover: coverFor(e.type, i) }) : null;
  }));
  await setSetting("demoCovers", 5);
  return true;
}

export async function demoEvents() {
  const org = await findOrganizerByEmail(DEMO_EMAIL);
  return org ? listEvents(org.id) : [];
}

// Messages privés de test : le compte démo devient ami avec `me` et lui écrit une petite conversation.
export async function sendDemoMessages(me) {
  let demo = await demoOrganizer();
  if (!demo.displayName) demo = await saveOrganizer({ ...demo, displayName: "Awa (démo)", avatar: "/img/demo/mariage.jpg" });
  await addFriends(demo.id, me.id);
  const texts = [
    "Coucou ! 👋 Merci pour l'invitation au mariage, j'ai hâte d'y être !",
    "Est-ce qu'on peut venir avec les enfants ?",
    "J'ai mis quelques photos dans l'album, dis-moi si elles te plaisent 📸",
    "Et pour la cagnotte, le lien est bien celui du faire-part ? 🎁",
  ];
  for (const t of texts) await addDirectMessage(demo.id, me.id, t);
  return { from: demo.displayName, count: texts.length };
}

// Faire-part de test : Awa (démo) crée son mariage (privé) et l'envoie en message privé avec le lien et le code.
export async function sendDemoInvitation(me, origin) {
  let demo = await demoOrganizer();
  if (!demo.displayName) demo = await saveOrganizer({ ...demo, displayName: "Awa (démo)", avatar: "/img/demo/mariage.jpg" });
  const name = "Mariage de Awa & Samuel";
  const ev = await createEvent({
    organizerId: demo.id, slug: slugify(name), accessCode: randomCode(), cameramanCode: randomCode(),
    name, type: "mariage", date: day(30), time: "15:00", location: "Château de la Roseraie, Paris",
    description: "Nous avons la joie de vous convier à notre mariage.", cover: "/img/demo/live-mariage.jpg",
    visibility: "private", inviteStyle: "fleuri",
    invite: { kicker: "Ils se disent oui", title: name, text: "Nous avons la joie de vous convier à notre mariage, suivi d'un dîner et d'une soirée dansante.", photo: "cover" },
    cameras: [{ name: "Caméra 1", url: DEMO_VIDEO }], cagnotteUrl: "https://www.leetchi.com/",
  });
  await addFriends(demo.id, me.id);
  await addHistory(me.id, ev.id);
  const link = `${origin}/e/${ev.slug}?code=${ev.accessCode}`;
  await addDirectMessage(demo.id, me.id, `💌 Voici notre faire-part ! ${link}`);
  await addDirectMessage(demo.id, me.id, `Le code d'accès est ${ev.accessCode}. On compte sur toi 💍`);
  return { slug: ev.slug, code: ev.accessCode };
}

// Album souvenir de test : un événement à `me`, rempli de photos et de mots du livre d'or.
export async function createDemoAlbum(me) {
  const name = "Anniversaire de test (album)";
  const ev = await createEvent({
    organizerId: me.id, slug: slugify(name), accessCode: randomCode(), cameramanCode: randomCode(),
    name, type: "anniversaire", date: day(-2), time: "19:00", location: "Salle Les Lumières, Lyon",
    description: "Une belle soirée entre amis.", cover: "/img/demo/anniversaire.jpg",
    visibility: "public", inviteStyle: "moderne", invite: { photo: "cover" }, cameras: [],
  });
  const photos = [["Awa", "anniversaire"], ["Moussa", "enfants"], ["Fatou", "bebe"], ["Kofi", "mariage"], ["Grâce", "costume"], ["Ibrahim", "diplome"]];
  for (const [who, img] of photos) await addPhoto(ev.id, { name: who, url: `/img/demo/${img}.jpg`, author: null });
  const words = [
    ["Fatou", "Quelle soirée magnifique, merci pour tout ! 🎉", null, [["Toi", "Merci d'être venue ❤️"]]],
    ["Moussa", "Le gâteau était incroyable 🎂", "/img/demo/anniversaire.jpg", []],
    ["Grâce", "Joyeux anniversaire ! Que cette nouvelle année t'apporte tout le bonheur du monde.", null, []],
    ["Kofi", "Encore bravo pour l'organisation, on s'en souviendra longtemps.", null, [["Awa", "Totalement d'accord !"]]],
  ];
  for (const [who, text, photoUrl, replies] of words) {
    const entry = await addGuestbookEntry(ev.id, { name: who, text, photoUrl, audioUrl: null, author: null });
    if (replies.length) await updateGuestbookEntry(entry, { replies: replies.map(([n, t]) => ({ name: n, text: t, author: null, at: new Date().toISOString() })) });
  }
  return { id: ev.id };
}
