export const EVENT_TYPES = [
  "mariage", "anniversaire", "bapteme", "communion", "fiancailles",
  "baby-shower", "diplome", "retraite", "inauguration", "autre",
];
export const INVITE_STYLES = ["classique", "moderne", "elegant", "fleuri"];

const clean = (v, max) => String(v ?? "").trim().slice(0, max);

// Caméras du live : 6 max, lien YouTube ou Twitch obligatoire. Lève une erreur lisible sinon.
export function parseCameras(list) {
  const cameras = (Array.isArray(list) ? list : [])
    .map((c) => ({ name: clean(c?.name, 40), url: clean(c?.url, 300) }))
    .filter((c) => c.url)
    .slice(0, 6);
  for (const [i, c] of cameras.entries()) {
    if (!/^https:\/\/(([a-z0-9-]+\.)*(youtube\.com|youtu\.be|twitch\.tv))\//i.test(c.url) && !/^lk:ev\d+-[a-f0-9]{8}$/.test(c.url)) {
      throw new Error(`Caméra ${i + 1} : lien YouTube ou Twitch attendu.`);
    }
    c.name ||= `Caméra ${i + 1}`;
  }
  return cameras;
}

// Valide et normalise les champs envoyés par le formulaire. Lève une erreur lisible sinon.
export function parseEventInput(body) {
  const e = {
    name: clean(body.name, 120),
    type: clean(body.type, 30),
    date: clean(body.date, 10),
    time: clean(body.time, 5),
    location: clean(body.location, 200),
    description: clean(body.description, 1000),
    visibility: body.visibility === "private" ? "private" : "public",
    inviteStyle: INVITE_STYLES.includes(body.inviteStyle) ? body.inviteStyle : "classique",
  };
  if (!e.name) throw new Error("Le nom de l'événement est obligatoire.");
  if (!EVENT_TYPES.includes(e.type)) throw new Error("Type d'événement invalide.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) throw new Error("Date invalide.");
  if (!/^\d{2}:\d{2}$/.test(e.time)) throw new Error("Heure invalide.");
  if (!e.location) throw new Error("Le lieu est obligatoire.");

  // Live : jusqu'à 6 caméras (lien YouTube ou Twitch) et lien de cagnotte externe.
  e.cameras = parseCameras(body.cameras);
  e.cameramanNotes = clean(body.cameramanNotes, 1000);
  e.cagnotteUrl = clean(body.cagnotteUrl, 300);
  if (e.cagnotteUrl && !/^https:\/\//i.test(e.cagnotteUrl)) throw new Error("Le lien de cagnotte doit commencer par https://");

  const invite = body.invite || {};
  e.invite = { kicker: clean(invite.kicker, 60), title: clean(invite.title, 150), text: clean(invite.text, 1500), liveText: clean(invite.liveText, 1500), photo: invite.photo };
  return e;
}

// Données exposées publiquement (jamais le code d'accès ni l'organisateur).
export const publicView = (event) => ({
  slug: event.slug,
  name: event.name,
  type: event.type,
  date: event.date,
  time: event.time,
  location: event.location,
  description: event.description,
  cover: event.cover,
  visibility: event.visibility,
  inviteStyle: event.inviteStyle,
  invite: event.invite,
  cameras: event.cameras || [],
  cagnotteUrl: event.cagnotteUrl || "",
});

export const ownerView = (event) => ({
  ...publicView(event),
  id: event.id,
  accessCode: event.accessCode,
  cameramanCode: event.cameramanCode || "",
  cameramanNotes: event.cameramanNotes || "",
  blockedCount: (event.blockedAuthors || []).length,
});
