// Test de fumée : démarre le serveur (SQLite temporaire) et vérifie les parcours principaux via l'API.
// Lancement : npm test
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

const PORT = 3999, B = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ["--no-warnings", "server.js"], {
  env: { ...process.env, PORT, DATA_DIR: mkdtempSync(`${tmpdir()}/em-`), DEMO_EVENTS: "on" }, stdio: "inherit",
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

const login = await api("/api/auth/login", { method: "POST", body: { email: `ci${Date.now()}@example.com`, password: "motdepasse123" } });
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

console.log("\nTous les tests sont passés ✅");
stop(0);
