// API /api/public : pages vues par les invités (événement, code d'accès, réponses, livre d'or, Découvrir).
import { tooFast } from "../lib/limits.js";
import { translateTexts, reqLangFull } from "../lib/translate.js";
import { inspirations } from "../lib/inspirations.js";
import { isPremium, replayDays, bumpViews } from "../lib/premium.js";
import { autoSeedDemo, upgradeDemoCovers, outdatedDemo, varyDemoCovers, rollDemoDates } from "../lib/demo.js";
import express, { Router } from "express";
import { saveRawFile, MAX_VIDEO_BYTES, UPLOAD_DIR, SAFE_NAME, isOwnUpload } from "../lib/uploads.js";
import { addPhoto, findEvent, listFriendIds, addEventGuest } from "../lib/store.js";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { publicView } from "../lib/events.js";
import { listRecentPhotos, getSetting as readSetting, setSetting as writeSetting, dataVersion, listHistoryIds, listPendingIds, listUnlistedIds, listAllUpcoming, findEventsByIds, withVisibility, findEventBySlug, findEventByAccessCode, listPublicUpcoming, countViewers, addHistory,  clearLimit, findInvite, saveInvite, getSetting } from "../lib/store.js";
import { setSigned, getSigned, codeFingerprint, readToken } from "../lib/session.js";
import { currentOrganizer, isAdmin } from "./auth.js";
import { listUserReels } from "./reels.js";
import { camerasWithLive } from "../lib/livekit.js";

const router = Router();

export const hasAccess = async (req, event) =>
  event.visibility === "public" ||
  getSigned(req, `ev${event.id}`) === codeFingerprint(event.accessCode) ||
  (event.cameramanCode && getSigned(req, `cam${event.id}`) === codeFingerprint(`cam:${event.cameramanCode}`)) ||
  await ownerOrFriend(req, event);

// Le créateur (et l'administration) accède à ses événements privés sans code. Les amis passent par le code :
// un code ami s'ajoute sans l'accord de l'autre, il ne doit donc pas ouvrir ses événements privés.
async function ownerOrFriend(req, event) {
  const me = await currentOrganizer(req).catch(() => null);
  if (!me) return false;
  if (String(me.id) === String(event.organizerId)) return true;
  return isAdmin(me).catch(() => false); // administration : accès à tous les événements (modération)
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
  const shown = [...priv, ...unl.filter((e) => e && !e.suspended && !e.archived && e.date >= today)]
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
    // Photo de couverture d'un événement privé : seulement pour son organisateur ou qui l'a déjà ouvert (emoji sinon).
    // Flou = pas d'accès : quiconque peut ouvrir l'événement (code déjà saisi, admin…) le voit en clair, et inversement.
    if (e.visibility === "private") return { ...card, ...(!(String(e.organizerId) === String(viewer?.id) || opened.has(Number(e.id)) || await hasAccess(req, e).catch(() => false)) && { cover: blurredCover(e) }), city, time: "", location: "", cameras: [], viewers: 0 };
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
// Inspirations : YouTube Shorts de fêtes dans la langue du visiteur (vide sans clé YOUTUBE_API_KEY).
router.get("/inspirations", async (req, res) => {
  res.set("Cache-Control", "private, max-age=1800"); // dépend de la langue (cookie)
  res.json(await inspirations(reqLangFull(req)));
});
// Fil « Réels » : vidéos publiées par les membres sur les événements publics (les plus récentes d'abord),
// mêlées aux vidéos d'inspiration (Pexels / YouTube). Chaque vidéo : j'aime, partage, lien vers l'événement, cagnotte.
const isVideoFile = (url) => /\.(mp4|mov|webm)(\?|$)/i.test(url || "");
let memberReels = { at: 0, list: [] };
async function listMemberReels() {
  if (Date.now() - memberReels.at < 60_000) return memberReels.list; // 1 min
  const [events, hidden] = await Promise.all([listPublicUpcoming(50).catch(() => []), listUnlistedIds().catch(() => new Set())]);
  const pub = events.filter((e) => e.visibility === "public" && !hidden.has(e.id) && !e.suspended && !e.archived);
  const byId = new Map(pub.map((e) => [e.id, e]));
  const photos = await listRecentPhotos([...byId.keys()], 200).catch(() => []);
  const list = photos.filter((p) => !p.story && isVideoFile(p.url)).slice(0, 60).map((p) => {
    const e = byId.get(p.eventId);
    return { id: `m${p.id}`, src: p.url, thumb: e.cover || "", channel: p.name || e.name, title: e.name, member: true,
      event: { slug: e.slug, name: e.name, cagnotteUrl: e.cagnotteUrl || "" } };
  });
  memberReels = { at: Date.now(), list };
  return list;
}
router.get("/reels", async (req, res) => {
  const [members, insp, likes, users, viewer] = await Promise.all([listMemberReels(), inspirations(reqLangFull(req)).catch(() => []), readSetting("reellikes").catch(() => null), listUserReels(), currentOrganizer(req).catch(() => null)]);
  const friends = new Set(viewer ? await listFriendIds(viewer.id).catch(() => []) : []);
  // Réels publiés par les membres (bouton « Créer → Un réel ») : les plus récents d'abord, masqués après 3 signalements.
  const mine = [...users.filter((r) => (r.reports || 0) < 3 && !r.private).slice(0, 200).map((r) => ({ id: `u${r.id}`, reel: r.id, by: r.by, src: r.src, thumb: r.thumb,
    channel: r.name, title: r.caption, member: true, nc: r.nc || 0, event: r.event || undefined })), ...members];
  // Une vidéo de membre toutes les 3 vidéos d'inspiration (les membres d'abord tant qu'il y en a peu).
  // Ordre mélangé à chaque chargement (verticales toujours avant horizontales) : actualiser = nouvelles vidéos en tête.
  const shuffle = (a) => { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
  // Réels de mes amis en premier (les plus récents d'abord), puis le mélange habituel.
  const out = mine.filter((v) => friends.has(Number(v.by))), m = mine.filter((v) => !friends.has(Number(v.by)));
  const i = [...shuffle(insp.filter((v) => v.portrait !== false)), ...shuffle(insp.filter((v) => v.portrait === false))];
  while (m.length || i.length) { if (m.length) out.push(m.shift()); for (let k = 0; k < 3 && i.length; k++) out.push(i.shift()); }
  res.set("Cache-Control", "no-store");
  const views = (await readSetting("reelviews").catch(() => null)) || {};
  res.json(out.map((v) => ({ ...v, likes: (likes || {})[v.id] || 0, views: (views[v.id] || 0) + (pendingViews.get(v.id) || 0) })));
});
// 👁 Vues des réels : une par personne et par réel toutes les 6 h (après 2 s de visionnage, côté appli).
// Regroupées en mémoire puis enregistrées toutes les 15 s (pas une écriture en base par vue).
const pendingViews = new Map();
setInterval(async () => {
  if (!pendingViews.size) return;
  const batch = new Map(pendingViews); pendingViews.clear();
  const views = (await readSetting("reelviews").catch(() => null)) || {};
  for (const [id, n] of batch) views[id] = (views[id] || 0) + n;
  await writeSetting("reelviews", views).catch(() => { for (const [id, n] of batch) pendingViews.set(id, (pendingViews.get(id) || 0) + n); });
}, 15_000).unref();
router.post("/reels/:id/view", async (req, res) => {
  const id = String(req.params.id).slice(0, 40);
  if (/^[\w-]+$/.test(id) && !(await tooFast(`reelview:${req.ip}:${req.get("user-agent")?.slice(0, 60)}:${id}`, 1, 6 * 3600 * 1000))) pendingViews.set(id, (pendingViews.get(id) || 0) + 1);
  res.json({ ok: true });
});
router.post("/reels/:id/like", async (req, res) => {
  const id = String(req.params.id).slice(0, 40);
  if (!/^[\w-]+$/.test(id) || await tooFast(`reellike:${req.ip}:${id}`, 1, 24 * 3600 * 1000)) return res.json({ ok: false });
  const likes = (await readSetting("reellikes").catch(() => null)) || {};
  likes[id] = (likes[id] || 0) + 1;
  await writeSetting("reellikes", likes);
  res.json({ ok: true, likes: likes[id] });
});

// Application : photo ou vidéo envoyée en arrière-plan (même appli fermée), sans cookie, avec le jeton délivré par
// /upload-token (événement, invité et prénom signés, 24 h). Mêmes limites que l'envoi depuis la page.
router.put("/:slug/media", express.raw({ type: () => true, limit: MAX_VIDEO_BYTES }), async (req, res) => {
  const tok = readToken(req.query.t);
  const event = tok && await findEventBySlug(req.params.slug);
  if (!event || event.suspended || event.id !== tok.e) return res.status(403).json({ error: "Envoi expiré : rouvrez l'événement dans l'application." });
  if (((await getSetting("bannedAuthors").catch(() => null)) || []).includes(tok.a)) return res.status(403).json({ error: "Envoi impossible." });
  const video = String(req.get("content-type") || "").startsWith("video/");
  if (await tooFast(`${tok.a}:photo`, 150, 3_600_000) || await tooFast(`${req.ip}:photoall`, 3000, 3_600_000)
    || (video && (await tooFast(`${tok.a}:videofile`, 20, 3_600_000) || await tooFast(`videofile:${event.id}`, 300, 24 * 3_600_000)))) {
    return res.status(429).json({ error: "Limite de photos atteinte, réessayez plus tard." });
  }
  try {
    const url = await saveRawFile(Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0), req.get("content-type"));
    res.status(201).json(await addPhoto(event.id, { name: String(tok.n).slice(0, 30), url, author: tok.a }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Photo de couverture floutée (événement privé, pour qui n'y a pas accès) : fabriquée ici, en tout petit puis floutée,
// pour que la vraie photo ne soit jamais envoyée. Gardée en mémoire (recalculée si la couverture change).
// Sans couverture, la photo du faire-part sert (comme pour la carte de partage).
const photoSrc = (e) => e.cover || (e.invite?.photo && !["none", "cover"].includes(e.invite.photo) && !String(e.invite.photo).startsWith("data:") ? e.invite.photo : "");
export const blurredCover = (e) => (photoSrc(e) ? `/api/public/cover-blur/${e.id}.jpg?v=${createHash("sha1").update(photoSrc(e)).digest("hex").slice(0, 8)}` : null);
const blurCache = new Map();
const sharpLib = import("sharp").then((m) => m.default).catch(() => null);
const PUBLIC_DIR = new URL("../public", import.meta.url).pathname;
async function coverBytes(cover) {
  if (cover.startsWith("/uploads/") && SAFE_NAME.test(cover.slice(9))) return readFile(`${UPLOAD_DIR}/${cover.slice(9)}`);
  if (/^\/img\/[\w/.-]+$/.test(cover) && !cover.includes("..")) return readFile(`${PUBLIC_DIR}${cover}`);
  if (/^https:\/\//.test(cover) && isOwnUpload(cover)) return Buffer.from(await (await fetch(cover, { signal: AbortSignal.timeout(8000) })).arrayBuffer());
  return null;
}
router.get("/cover-blur/:file", async (req, res) => {
  const event = await findEvent(Number(String(req.params.file).replace(/\.jpg$/, ""))).catch(() => null);
  const sharp = await sharpLib;
  const photo = event && photoSrc(event);
  if (!photo || event.suspended || !sharp) return res.status(404).end();
  const key = `${event.id}:${photo}`;
  let out = blurCache.get(key);
  if (!out) {
    try {
      const src = await coverBytes(photo);
      if (!src) return res.status(404).end();
      out = await sharp(src).rotate().resize(40, 40, { fit: "cover" }).blur(2.5).jpeg({ quality: 60 }).toBuffer();
      if (blurCache.size > 2000) blurCache.clear();
      blurCache.set(key, out);
    } catch { return res.status(404).end(); }
  }
  res.type("jpg").set("Cache-Control", "public, max-age=604800, immutable").send(out);
});

router.get("/pot-check", async (req, res) => res.json({ embeddable: await embeddable(String(req.query.url || "")) }));
// Contenu d'un événement pour la page publique : utilisé par l'API et intégré directement dans la page /e/…
// (affichage instantané, sans écran « Chargement… »). null = introuvable.
export async function eventPayload(req, slug) {
  const event = await findEventBySlug(slug);
  if (!event || event.suspended) return null;
  if (!(await hasAccess(req, event))) return { locked: true, name: event.name, type: event.type, visibility: "private" };
  const me = await currentOrganizer(req);
  const isOwner = Boolean(me) && String(me.id) === String(event.organizerId);
  // Écritures sans attendre (la page s'affiche tout de suite) : participation mémorisée, compteur de vues.
  if (me && !isOwner) {
    addHistory(me.id, event.id).catch(() => {});
    addEventGuest?.(event.id, `org:${me.id}`).catch?.(() => {}); // prévenu quand le live commence (notification du compte)
  }
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
  return { locked: false, isOwner, isAdmin: Boolean(me && !isOwner && await isAdmin(me).catch(() => false)), loggedIn: Boolean(me), ...view, cameras, id: event.id, premium, replayDays: replayDays(premium), replayDeleted: Boolean(replayDeleted), replayOnline: !replayHidden, program: program || null, pot: pot || null, reactions: reactions || {} };
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
  // any : messages écrits par les invités (chat du live), à traduire même vers le français.
  if ((lang === "fr" && !req.body?.any) || !texts.length || await tooFast(`tr:${req.ip}`, 60, 60 * 1000)) return res.json({ texts });
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
