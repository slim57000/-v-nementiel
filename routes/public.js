// API /api/public : pages vues par les invités (événement, code d'accès, réponses, livre d'or, Découvrir).
import { tooFast } from "../lib/limits.js";
import { isPremium, replayDays, bumpViews } from "../lib/premium.js";
import { autoSeedDemo, upgradeDemoCovers, outdatedDemo, varyDemoCovers, rollDemoDates } from "../lib/demo.js";
import { Router } from "express";
import { publicView } from "../lib/events.js";
import { listUnlistedIds, listAllUpcoming, findEventsByIds, withVisibility, findEventBySlug, findEventByAccessCode, listPublicUpcoming, countViewers, addHistory, addFriends, listBlockIds, listFriendIds, clearLimit, findInvite, saveInvite, getSetting } from "../lib/store.js";
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
router.get("/", async (req, res) => {
  let events;
  try {
    const limit = Math.min(Number(req.query.limit) || 12, 50);
    events = await listPublicUpcoming(limit);
    if (!events.length && await autoSeedDemo()) events = await listPublicUpcoming(limit);
    else if (events.some(outdatedDemo)) {
      await upgradeDemoCovers().catch((err) => console.error("Photos démo :", err.message));
      events = await listPublicUpcoming(limit);
    }
    if (events.length && await varyDemoCovers().catch(() => false)) events = await listPublicUpcoming(limit);
    if (await rollDemoDates().catch(() => false)) events = await listPublicUpcoming(limit);
  } catch (err) {
    console.error("Événements publics :", err.message);
    return res.status(500).json({ error: `base de données (${err.message}). Relancez supabase/schema.sql.` });
  }
  const today = new Date().toISOString().slice(0, 10);
  // Événements privés et non répertoriés affichés à tous (cadenas ; le code reste requis pour entrer).
  const hidden = await listUnlistedIds();
  // Privés (requête dédiée) + non répertoriés (publics en base, masqués de la liste publique).
  const [priv, unl] = await Promise.all([listAllUpcoming(50).catch(() => []), findEventsByIds([...hidden]).catch(() => [])]);
  const shown = [...priv, ...unl.filter((e) => e && !e.suspended && e.date >= today)]
    .filter((e, i, arr) => !events.some((x) => x.id === e.id) && arr.findIndex((x) => x.id === e.id) === i)
    .map((e) => withVisibility(e, hidden));
  // Privés / non répertoriés en tête (sinon noyés parmi les nombreux événements démo), puis par date.
  events = [...shown, ...events].sort((a, b) => (shown.includes(b) - shown.includes(a)) || `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  res.json(await Promise.all(events.map(async (e) => {
    const { invite, inviteStyle, description, ...card } = publicView(e);
    // Privé : la carte montre la photo et la date (badge « J-10 » juste), mais ni le nom, ni le lieu,
    // ni les caméras. Le clic mène à l'écran « entrez votre code » : l'accès passe par le code.
    if (e.visibility === "private") return { ...card, name: "Événement privé", time: "", location: "", cameras: [], viewers: 0 };
    if (e.visibility === "unlisted") card.visibility = "unlisted";
    // Spectateurs en cours pour les directs du jour.
    const viewers = e.date === today && card.cameras.length ? await countViewers(e.id).catch(() => 0) : 0;
    return { ...card, viewers };
  })));
});

// Événement privé non déverrouillé : on ne renvoie que le strict minimum pour l'écran cadenas.
// Vérification d'une adresse de cagnotte quelconque (création d'une cagnotte depuis le site).
router.get("/pot-check", async (req, res) => res.json({ embeddable: await embeddable(String(req.query.url || "")) }));
router.get("/:slug", async (req, res) => {
  const event = await findEventBySlug(req.params.slug);
  if (!event || event.suspended) return res.status(404).json({ error: "Événement introuvable." });
  if (!(await hasAccess(req, event))) {
    return res.json({ locked: true, name: event.name, type: event.type, visibility: "private" });
  }
  const me = await currentOrganizer(req);
  const isOwner = me?.id === event.organizerId;
  if (me && !isOwner) {
    // Participation mémorisée ; entrer dans un événement privé (code / QR) rend ami avec l'organisateur.
    await addHistory(me.id, event.id);
    if (event.visibility === "private") {
      const [mine, theirs] = await Promise.all([listBlockIds(me.id), listBlockIds(event.organizerId)]);
      if (!mine.includes(event.organizerId) && !theirs.includes(me.id)) await addFriends(me.id, event.organizerId);
    }
  }
  if (!isOwner) await bumpViews(event.id);
  const premium = await isPremium(event.organizerId);
  const [program, replayDeleted, replayHidden, pot, reactions] = await Promise.all([
    getSetting(`program:${event.id}`).catch(() => null),
    getSetting(`replayoff:${event.id}`).catch(() => null),
    getSetting(`replayhide:${event.id}`).catch(() => null),
    event.cagnotteUrl ? getSetting(`pot:${event.id}`).catch(() => null) : null,
    getSetting(`evreact:${event.id}`).catch(() => null),
  ]);
  const view = publicView(withVisibility(event, await listUnlistedIds()));
  res.json({ locked: false, isOwner, loggedIn: Boolean(me), ...view, cameras: await camerasWithLive(view.cameras), id: event.id, premium, replayDays: replayDays(premium), replayDeleted: Boolean(replayDeleted), replayOnline: !replayHidden, program: program || null, pot: pot || null, reactions: reactions || {} });
});

// Anti-bruteforce partagé (base de données) : 10 essais par IP (et événement) toutes les 15 minutes.
const tooManyTries = (key) => tooFast(`try:${key}`, 10, 15 * 60 * 1000);

// Saisir le code d'invitation d'un événement = devenir ami avec son organisateur (si connecté, sauf blocage).
async function befriendOrganizer(req, event) {
  const me = await currentOrganizer(req).catch(() => null);
  if (!me || me.id === event.organizerId) return;
  const [mine, theirs] = await Promise.all([listBlockIds(me.id), listBlockIds(event.organizerId)]);
  if (!mine.includes(event.organizerId) && !theirs.includes(me.id)) await addFriends(me.id, event.organizerId);
}

// « J'ai reçu une invitation » : le code seul suffit à retrouver l'événement.
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
  await befriendOrganizer(req, event).catch(() => {});
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
  await befriendOrganizer(req, event).catch(() => {});
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
