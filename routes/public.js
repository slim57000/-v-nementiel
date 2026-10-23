// API /api/public : pages vues par les invités (événement, code d'accès, réponses, livre d'or, Découvrir).
import { tooFast } from "../lib/limits.js";
import { translateTexts } from "../lib/translate.js";
import { isPremium, replayDays, bumpViews } from "../lib/premium.js";
import { autoSeedDemo, upgradeDemoCovers, outdatedDemo, varyDemoCovers, rollDemoDates } from "../lib/demo.js";
import { Router } from "express";
import { publicView } from "../lib/events.js";
import { dataVersion, listHistoryIds, listPendingIds, listUnlistedIds, listAllUpcoming, findEventsByIds, withVisibility, findEventBySlug, findEventByAccessCode, listPublicUpcoming, countViewers, addHistory,  listFriendIds, clearLimit, findInvite, saveInvite, getSetting } from "../lib/store.js";
import { setSigned, getSigned, codeFingerprint } from "../lib/session.js";
import { currentOrganizer, isAdmin } from "./auth.js";
import { camerasWithLive } from "../lib/livekit.js";

const router = Router();

export const hasAccess = async (req, event) =>
  event.visibility === "public" ||
  getSigned(req, `ev${event.id}`) === codeFingerprint(event.accessCode) ||
  (event.cameramanCode && getSigned(req, `cam${event.id}`) === codeFingerprint(`cam:${event.cameramanCode}`)) ||
  await ownerOrFriend(req, event);

// Le créateur et ses amis (proches de confiance) accèdent à ses événements privés sans code.
async function ownerOrFriend(req, event) {
  const me = await currentOrganizer(req).catch(() => null);
  if (!me) return false;
  if (me.id === event.organizerId) return true;
  if (await isAdmin(me).catch(() => false)) return true; // administration : accès à tous les événements (modération)
  return (await listFriendIds(me.id).catch(() => [])).includes(event.organizerId);
}

// Événements publics à venir : cartes de la page d'accueil et de « Découvrir ».
// La liste (identique pour tous) est gardée 15 s en mémoire ; seule la mise en forme dépend de la personne.
const listCache = new Map();
async function upcomingList(limit) {
  const c = listCache.get(limit);
  if (c && c.version === dataVersion) {
    // Liste un peu ancienne : renvoyée tout de suite, et recalculée en arrière-plan pour le visiteur suivant.
    if (Date.now() - c.at >= 15_000 && !c.refreshing) {
      c.refreshing = true;
      buildList(limit).catch(() => { c.refreshing = false; });
    }
    return c.list;
  }
  return buildList(limit);
}
async function buildList(limit) {
  const version = dataVersion;
  let events = await listPublicUpcoming(limit);
  if (!events.length && await autoSeedDemo()) events = await listPublicUpcoming(limit);
  else if (events.some(outdatedDemo)) {
    await upgradeDemoCovers().catch((err) => console.error("Photos démo :", err.message));
    events = await listPublicUpcoming(limit);
  }
  if (events.length && await varyDemoCovers().catch(() => false)) events = await listPublicUpcoming(limit);
  if (await rollDemoDates().catch(() => false)) events = await listPublicUpcoming(limit);
  const today = new Date().toISOString().slice(0, 10);
  // Privés (requête dédiée) + non répertoriés (publics en base, masqués de la liste publique), lus en parallèle.
  const hidden = await listUnlistedIds();
  const [priv, unl, pending] = await Promise.all([listAllUpcoming(50).catch(() => []), findEventsByIds([...hidden]).catch(() => []), listPendingIds()]);
  const shown = [...priv, ...unl.filter((e) => e && !e.suspended && e.date >= today)]
    .filter((e) => !pending.has(e.id))
    .filter((e, i, arr) => !events.some((x) => x.id === e.id) && arr.findIndex((x) => x.id === e.id) === i)
    .map((e) => withVisibility(e, hidden));
  // Publics et privés en alternance (chacun par date) : jamais une liste faite que de privés.
  const byDate = (a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`);
  const pub = [...events].sort(byDate), other = [...shown].sort(byDate), list = [];
  while (pub.length || other.length) { if (pub.length) list.push(pub.shift()); if (other.length) list.push(other.shift()); }
  listCache.set(limit, { at: Date.now(), version, list });
  return list;
}
const COUNTRIES = /^(france|belgique|belgium|suisse|switzerland|uk|united kingdom|england|ireland|deutschland|germany|österreich|austria|españa|spain|italia|italy|portugal|nederland|netherlands|usa|united states|canada|maroc|morocco|algérie|algeria|tunisie|tunisia|sénégal|senegal|türkiye|turkey)$/i;
router.get("/", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const limit = Math.min(Number(req.query.limit) || 12, 50);
  // Liste et personne connectée lues en même temps.
  let events, viewer;
  try {
    [events, viewer] = await Promise.all([upcomingList(limit), currentOrganizer(req).catch(() => null)]);
  } catch (err) {
    console.error("Événements publics :", err.message);
    return res.status(500).json({ error: `base de données (${err.message}). Relancez supabase/schema.sql.` });
  }
  // Qui a déjà accès aux événements « avec le lien » (organisateur, ou lien déjà ouvert) : carte en clair.
  const opened = new Set(viewer ? (await listHistoryIds(viewer.id).catch(() => [])).map(Number) : []);
  res.json(await Promise.all(events.map(async (e) => {
    const { invite, inviteStyle, description, ...card } = publicView(e);
    // Privé : la carte montre la photo, la date et le nom (« Mariage de Léa & Tom »), mais ni l'adresse
    // (ville seule), ni les caméras. Le clic mène à l'écran « entrez votre code » : l'accès passe par le code.
    const city = String(e.location || "").split(",").map((x) => x.trim()).filter((x) => x && !COUNTRIES.test(x)).pop()?.replace(/\b[A-Z]{0,2}\d[\dA-Z -]*\b/g, "").replace(/\s+/g, " ").trim() || null;
    if (e.visibility === "private") return { ...card, city, time: "", location: "", cameras: [], viewers: 0 };
    // Non répertorié : affiché comme un privé, et sans son lien (seul le lien reçu par SMS / WhatsApp y donne accès).
    if (e.visibility === "unlisted" && (String(e.organizerId) === String(viewer?.id) || opened.has(Number(e.id)))) card.visibility = "unlisted";
    else if (e.visibility === "unlisted") {
      const { slug, ...rest } = card;
      return { ...rest, slug: null, ref: String(e.id), visibility: "unlisted", city, time: "", location: "", cameras: [], viewers: 0 };
    }
    // Spectateurs en cours pour les directs du jour.
    const viewers = e.date === today && card.cameras.length ? await countViewers(e.id).catch(() => 0) : 0;
    return { ...card, city, viewers };
  })));
});

// Événement privé non déverrouillé : on ne renvoie que le strict minimum pour l'écran cadenas.
// Vérification d'une adresse de cagnotte quelconque (création d'une cagnotte depuis le site).
router.get("/pot-check", async (req, res) => res.json({ embeddable: await embeddable(String(req.query.url || "")) }));
// Contenu d'un événement pour la page publique : utilisé par l'API et intégré directement dans la page /e/…
// (affichage instantané, sans écran « Chargement… »). null = introuvable.
export async function eventPayload(req, slug) {
  const event = await findEventBySlug(slug);
  if (!event || event.suspended) return null;
  if (!(await hasAccess(req, event))) return { locked: true, name: event.name, type: event.type, visibility: "private" };
  const me = await currentOrganizer(req);
  const isOwner = me?.id === event.organizerId;
  // Écritures sans attendre (la page s'affiche tout de suite) : participation mémorisée, compteur de vues.
  if (me && !isOwner) addHistory(me.id, event.id).catch(() => {});
  if (!isOwner) bumpViews(event.id).catch(() => {});
  // Lectures en parallèle plutôt qu'à la suite (chaque aller-retour vers la base compte).
  const [premium, program, replayDeleted, replayHidden, pot, reactions, unlisted, cameras] = await Promise.all([
    isPremium(event.organizerId),
    getSetting(`program:${event.id}`).catch(() => null),
    getSetting(`replayoff:${event.id}`).catch(() => null),
    getSetting(`replayhide:${event.id}`).catch(() => null),
    event.cagnotteUrl ? getSetting(`pot:${event.id}`).catch(() => null) : null,
    getSetting(`evreact:${event.id}`).catch(() => null),
    listUnlistedIds(),
    camerasWithLive(event.cameras),
  ]);
  const view = publicView(withVisibility(event, unlisted));
  return { locked: false, isOwner, loggedIn: Boolean(me), ...view, cameras, id: event.id, premium, replayDays: replayDays(premium), replayDeleted: Boolean(replayDeleted), replayOnline: !replayHidden, program: program || null, pot: pot || null, reactions: reactions || {} };
}
router.get("/:slug", async (req, res) => {
  const t0 = Date.now();
  const data = await eventPayload(req, req.params.slug);
  if (!data) return res.status(404).json({ error: "Événement introuvable." });
  res.set("Server-Timing", `total;dur=${Date.now() - t0}`).json(data);
});


// Anti-bruteforce partagé (base de données) : 10 essais par IP (et événement) toutes les 15 minutes.
const tooManyTries = (key) => tooFast(`try:${key}`, 10, 15 * 60 * 1000);

// « J'ai reçu une invitation » : le code seul suffit à retrouver l'événement.
// Traduction de textes générés par le site (invitation au live…) dans la langue du visiteur.
router.post("/translate", async (req, res) => {
  const lang = /^[a-z]{2}$/.test(req.body?.lang) ? req.body.lang : "fr";
  const texts = (Array.isArray(req.body?.texts) ? req.body.texts : []).slice(0, 20).map((t) => String(t).slice(0, 2000));
  if (lang === "fr" || !texts.length || tooFast(`tr:${req.ip}`, 60, 60 * 1000)) return res.json({ texts });
  res.json({ texts: await translateTexts(texts, lang) });
});

router.post("/join", async (req, res) => {
  const key = `${req.ip}:join`;
  if (await tooManyTries(key)) return res.status(429).json({ error: "Trop d'essais, réessayez dans 15 minutes." });
  const code = String(req.body?.code || "").trim().toUpperCase();
  const event = /^[A-Z0-9]{6}$/.test(code) ? await findEventByAccessCode(code) : null;
  if (!event) {
    return res.status(404).json({ error: "Aucun événement ne correspond à ce code." });
  }
  await clearLimit(`try:${key}`).catch(() => {});
  setSigned(res, `ev${event.id}`, codeFingerprint(event.accessCode));
  res.json({ slug: event.slug });
});

// Cagnotte affichée DANS le site : vérifie si le service (Leetchi, Lydia…) accepte d'être intégré
// (en-têtes X-Frame-Options / CSP frame-ancestors). Seuls les services de cagnotte connus sont testés.
const POT_HOSTS = /(^|\.)(leetchi\.com|lepotcommun\.fr|onparticipe\.fr|helloasso\.com|lydia-app\.com|lydia\.me|sumeria\.eu|paypal\.com|paypal\.me|gofundme\.com|ulule\.com|kisskissbankbank\.com)$/i;
const frameCache = new Map();
async function embeddable(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== "https:" || !POT_HOSTS.test(u.hostname)) return false;
  const hit = frameCache.get(url);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.ok;
  let ok = false;
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(5000), headers: { "User-Agent": "Mozilla/5.0 MaFeliza" } });
    const xfo = (res.headers.get("x-frame-options") || "").toLowerCase();
    const fa = ((res.headers.get("content-security-policy") || "").match(/frame-ancestors([^;]*)/i) || [])[1] || "";
    ok = !xfo && (!fa || /\*|mafeliza\.com/i.test(fa)) && res.ok;
  } catch { ok = false; }
  frameCache.set(url, { ok, at: Date.now() });
  return ok;
}
router.get("/:slug/pot-frame", async (req, res) => {
  const event = await findEventBySlug(req.params.slug);
  if (!event?.cagnotteUrl) return res.json({ embeddable: false });
  res.json({ embeddable: await embeddable(event.cagnotteUrl), url: event.cagnotteUrl });
});

router.post("/:slug/unlock", async (req, res) => {
  const event = await findEventBySlug(req.params.slug);
  if (!event) return res.status(404).json({ error: "Événement introuvable." });

  const key = `${req.ip}:${event.id}`;
  if (await tooManyTries(key)) return res.status(429).json({ error: "Trop d'essais, réessayez dans 15 minutes." });

  const code = String(req.body?.code || "").trim().toUpperCase();
  if (code !== event.accessCode) {
    return res.status(401).json({ error: "Code incorrect." });
  }
  await clearLimit(`try:${key}`).catch(() => {});
  setSigned(res, `ev${event.id}`, codeFingerprint(event.accessCode));
  res.json({ ok: true });
});

// Suivi des invitations envoyées par email : « vue » à l'ouverture, « a rejoint » une fois l'accès obtenu.
router.post("/:slug/seen", async (req, res) => {
  const invite = await findInvite(String(req.body?.inv || "")).catch(() => null);
  const event = invite && await findEventBySlug(req.params.slug);
  if (!event || invite.eventId !== event.id) return res.json({ ok: false });
  const now = new Date().toISOString();
  const joined = (await hasAccess(req, event)) && (event.visibility === "private" || Boolean(await currentOrganizer(req)));
  await saveInvite({ ...invite, seenAt: invite.seenAt || now, joinedAt: invite.joinedAt || (joined ? now : null) });
  res.json({ ok: true });
});

export default router;
