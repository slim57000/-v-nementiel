// Test de fumée : démarre le serveur (SQLite temporaire) et vérifie les parcours principaux via l'API.
// Lancement : npm test
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

const PORT = 3999, B = `http://localhost:${PORT}`;
// Clés LiveKit factices : elles suffisent à activer le direct depuis le téléphone (aucun appel réseau
// n'est fait — le serveur se contente de signer un jeton), ce qui permet de tester le multicaméra.
const server = spawn(process.execPath, ["--no-warnings", "server.js"], {
  env: { ...process.env, PORT, DATA_DIR: mkdtempSync(`${tmpdir()}/em-`), DEMO_EVENTS: "on",
         LIVEKIT_URL: "wss://test.livekit.cloud", LIVEKIT_API_KEY: "test-key", LIVEKIT_API_SECRET: "test-secret" },
  stdio: "inherit",
});
const stop = (code) => { server.kill(); process.exit(code); };
process.on("uncaughtException", (e) => { console.error("❌", e.message); stop(1); });

for (let i = 0; i < 50; i++) { try { await fetch(`${B}/api/config`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }

let cookie = "";
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(B + path, { method, headers: { "Content-Type": "application/json", cookie }, body: body && JSON.stringify(body) });
  const set = res.headers.getSetCookie?.() || [];
  if (set.length) cookie = [...new Map([...cookie.split("; ").filter(Boolean), ...set.map((c) => c.split(";")[0])].map((c) => [c.split("=")[0], c])).values()].join("; ");
  return { status: res.status, data: await res.json().catch(() => null) };
}
const ok = (label) => console.log("✔", label);

for (const page of ["/", "/connexion", "/decouvrir", "/cgu", "/manifest.webmanifest"]) {
  assert.equal((await fetch(B + page)).status, 200, page);
}
ok("pages statiques");
assert.equal((await fetch(`${B}/page-inexistante`)).status, 404); ok("page 404");

const pub = await api("/api/public?limit=50");
assert.ok(pub.data.length >= 30, "événements de démonstration créés"); ok(`${pub.data.length} événements publics`);

const ORG_EMAIL = `ci${Date.now()}@example.com`;
const login = await api("/api/auth/login", { method: "POST", body: { email: ORG_EMAIL, password: "motdepasse123" } });
assert.equal(login.data.created, true); ok("création de compte");

const ev = await api("/api/events", { method: "POST", body: { name: "Mariage CI", type: "mariage", date: "2030-06-01", time: "15:00", location: "Lyon", visibility: "private", invite: { photo: "none" } } });
assert.equal(ev.status, 201); ok("création d'événement privé");

const slug = ev.data.slug;
cookie = cookie.split("; ").filter((c) => !c.startsWith("org=")).join("; "); // invité anonyme
assert.equal((await api(`/api/public/${slug}/guestbook`)).status, 403); ok("événement privé verrouillé");
assert.equal((await api(`/api/public/${slug}/unlock`, { method: "POST", body: { code: ev.data.accessCode } })).status, 200); ok("déverrouillage par code");

assert.equal((await api(`/api/public/${slug}/messages`, { method: "POST", body: { name: "Awa", text: "Bravo !" } })).status, 201); ok("message du chat");
const gb = await api(`/api/public/${slug}/guestbook`, { method: "POST", body: { name: "Awa", text: "Tous nos vœux" } });
assert.equal(gb.status, 201);
assert.equal((await api(`/api/public/${slug}/guestbook/${gb.data.id}/replies`, { method: "POST", body: { name: "Moussa", text: "Merci" } })).data.replies.length, 1);
ok("livre d'or et réponse");

// Un client séparé = un autre appareil (biscuitisolé), pour l'espace caméraman.
function device() {
  let jar = "";
  return async (path, { method = "GET", body } = {}) => {
    const res = await fetch(B + path, { method, headers: { "Content-Type": "application/json", cookie: jar }, body: body && JSON.stringify(body) });
    const set = res.headers.getSetCookie?.() || [];
    if (set.length) jar = [...new Map([...jar.split("; ").filter(Boolean), ...set.map((c) => c.split(";")[0])].map((c) => [c.split("=")[0], c])).values()].join("; ");
    return { status: res.status, data: await res.json().catch(() => null) };
  };
}
const account = async (email) => {
  const call = device();
  await call("/api/auth/login", { method: "POST", body: { email, password: "motdepasse123" } });
  return call;
};

// Espace caméraman : le caméraman saisit son code avant d'avoir un compte, puis se connecte.
// L'amitié et la participation doivent alors être enregistrées malgré tout.
const cam = device();
assert.equal((await cam("/api/cameraman/login", { method: "POST", body: { code: ev.data.cameramanCode } })).status, 200); ok("espace caméraman ouvert sans compte");
await cam("/api/auth/login", { method: "POST", body: { email: `cam${Date.now()}@example.com`, password: "motdepasse123" } });
assert.equal((await cam(`/api/cameraman/${slug}`)).status, 200); ok("espace caméraman avec le compte");
assert.equal((await cam("/api/me/friends")).data.length, 1, "le caméraman devient ami de l'organisateur");
assert.equal((await cam("/api/me/history")).data.length, 1, "l'événement compte dans ses participations");
ok("ajout automatique à la liste d'amis malgré une connexion tardive");

// N'importe quel compte peut utiliser l'espace caméraman de l'événement.
const autre = await account(`autre${Date.now()}@example.com`);
assert.equal((await autre("/api/cameraman/login", { method: "POST", body: { code: ev.data.cameramanCode } })).status, 200);
assert.equal((await autre(`/api/cameraman/${slug}`)).status, 200); ok("espace caméraman avec un autre compte");

// Des codes erronés ne doivent jamais empêcher d'entrer avec le bon code.
const flood = device();
for (const code of ["AAAAAA", "BBBBBB", "CCCCCC", "DDDDDD", "EEEEEE", "FFFFFF", "GGGGGG", "HHHHHH", "KKKKKK", "MMMMMM", "NNNNNN", "PPPPPP"]) {
  await flood("/api/cameraman/login", { method: "POST", body: { code } });
}
assert.equal((await flood("/api/cameraman/login", { method: "POST", body: { code: ev.data.cameramanCode } })).status, 200);
ok("le bon code fonctionne malgré les essais ratés");

// Live multicaméra : deux caméras « téléphone », une seule en direct. L'invité doit savoir
// laquelle est réellement diffusée (le lecteur ouvre dessus et affiche une pastille).
const camA = await device();
await camA("/api/cameraman/login", { method: "POST", body: { code: ev.data.cameramanCode } });
const a = (await camA(`/api/cameraman/${slug}/go-live`, { method: "POST", body: { name: "Caméra A" } })).data;
const b = (await camA(`/api/cameraman/${slug}/go-live`, { method: "POST", body: { name: "Caméra B" } })).data;
assert.ok(a?.room && b?.room && a.room !== b.room, "deux caméras « téléphone » ont deux rooms distinctes");
await camA(`/api/cameraman/${slug}/stop-live`, { method: "POST", body: { room: a.room } });
// L'invité doit d'abord entrer le code de l'événement (rien n'est renvoyé avant).
const invitee = await device();
assert.deepEqual((await invitee(`/api/public/${slug}`)).data.cameras, undefined, "rien n'est exposé avant le code");
await invitee(`/api/public/${slug}/unlock`, { method: "POST", body: { code: ev.data.accessCode } });
const seen = (await invitee(`/api/public/${slug}`)).data.cameras.filter((c) => c.url.startsWith("lk:"));
assert.equal(seen.find((c) => c.live)?.url, `lk:${b.room}`, "l'invité voit quelle caméra est en direct");
assert.equal(Math.max(0, seen.findIndex((c) => c.live)), 1, "le lecteur ouvre sur la caméra en direct");
assert.ok(!seen.find((c) => c.url === `lk:${a.room}`)?.live, "une caméra arrêtée n'est pas annoncée en direct");
ok("live multicaméra : angle en direct identifiable");

// Un événement privé n'apparaît jamais en clair sur l'accueil (accessible par code seulement).
const listing = (await api("/api/public?limit=50")).data.find((e) => e.slug === slug);
assert.equal(listing.name, "Événement privé"); assert.equal(listing.location, ""); // la photo et la date restent visibles (choix produit)
assert.equal(listing.cameras.length, 0); assert.equal(listing.date, "");
ok("événement privé masqué sur l'accueil public");

// Sécurité : on ne peut pas s'abonner (favori) à un événement privé que l'on n'a pas ouvert.
// Avant, un identifiant numérique suffisait à faire remonter photos et livre d'or dans le fil.
const spy = await device();
await spy("/api/auth/login", { method: "POST", body: { email: `spy${Date.now()}@example.com`, password: "motdepasse123" } });
assert.equal((await spy(`/api/me/favorites/${ev.data.id}`, { method: "POST" })).status, 403, "favori refusé sans accès");
assert.deepEqual((await spy("/api/me/favorites")).data, [], "aucun favori fuite vers le compte attaquant");
const owner = await device();
await owner("/api/auth/login", { method: "POST", body: { email: ORG_EMAIL, password: "motdepasse123" } });
assert.equal((await owner(`/api/me/favorites/${ev.data.id}`, { method: "POST" })).status, 200, "l'organisateur peut mettre son événement en favori");
ok("pas d'IDOR sur les favoris d'événements privés");

console.log("\nTous les tests sont passés ✅");
stop(0);
