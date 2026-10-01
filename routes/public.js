import { tooFast } from "../lib/limits.js";
import { isPremium, replayDays, bumpViews } from "../lib/premium.js";
import { autoSeedDemo, upgradeDemoCovers, outdatedDemo, varyDemoCovers } from "../lib/demo.js";
import { Router } from "express";
import { publicView } from "../lib/events.js";
import { listUnlistedIds, listAllUpcoming, withVisibility, findEventBySlug, findEventByAccessCode, listPublicUpcoming, countViewers, addHistory, addFriends, listBlockIds, listFriendIds, clearLimit, findInvite, saveInvite, getSetting } from "../lib/store.js";
import { setSigned, getSigned, codeFingerprint } from "../lib/session.js";
import { currentOrganizer } from "./auth.js";

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
  } catch (err) {
    console.error("Événements publics :", err.message);
    return res.status(500).json({ error: `base de données (${err.message}). Relancez supabase/schema.sql.` });
  }
  const today = new Date().toISOString().slice(0, 10);
  // Événements privés et non répertoriés affichés à tous (cadenas ; le code reste requis pour entrer).
  const hidden = await listUnlistedIds();
  const shown = (await listAllUpcoming(50).catch(() => []))
    .filter((e) => !events.some((x) => x.id === e.id)).map((e) => withVisibility(e, hidden));
  events = [...events, ...shown].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  res.json(await Promise.all(events.map(async (e) => {
    const { invite, inviteStyle, description, ...card } = publicView(e);
    // Privé : ni lieu ni caméras (le direct reste réservé aux invités).
    if (e.visibility === "private") return { ...card, visibility: "private", location: "Sur invitation", cameras: [], viewers: 0 };
    if (e.visibility === "unlisted") card.visibility = "unlisted";
    // Spectateurs en cours pour les directs du jour.
    const viewers = e.date === today && card.cameras.length ? await countViewers(e.id).catch(() => 0) : 0;
    return { ...card, viewers };
  })));
});

// Événement privé non déverrouillé : on ne renvoie que le strict minimum pour l'écran cadenas.
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
  const [program, replayDeleted, replayHidden, pot] = await Promise.all([
    getSetting(`program:${event.id}`).catch(() => null),
    getSetting(`replayoff:${event.id}`).catch(() => null),
    getSetting(`replayhide:${event.id}`).catch(() => null),
    event.cagnotteUrl ? getSetting(`pot:${event.id}`).catch(() => null) : null,
  ]);
  res.json({ locked: false, isOwner, loggedIn: Boolean(me), ...publicView(withVisibility(event, await listUnlistedIds())), id: event.id, premium, replayDays: replayDays(premium), replayDeleted: Boolean(replayDeleted), replayOnline: !replayHidden, program: program || null, pot: pot || null });
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
