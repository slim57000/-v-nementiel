// Connexion avec Apple (« Sign in with Apple », flux web « code » côté serveur, sans SDK).
// Active si APPLE_SIGNIN_CLIENT_ID (Services ID), APPLE_TEAM_ID, APPLE_SIGNIN_KEY_ID et APPLE_SIGNIN_KEY
// (contenu du fichier .p8 d'une clé « Sign in with Apple ») sont définis.
import crypto from "node:crypto";

const CLIENT = process.env.APPLE_SIGNIN_CLIENT_ID;
const TEAM = process.env.APPLE_TEAM_ID;
const KEY_ID = process.env.APPLE_SIGNIN_KEY_ID;
const KEY = (process.env.APPLE_SIGNIN_KEY || "").replace(/\\n/g, "\n");
export const APPLE_ENABLED = Boolean(CLIENT && TEAM && KEY_ID && KEY);

const b64 = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");

// Apple renvoie le résultat en POST (form_post) : il faut le scope « email » et ce mode de réponse.
export const appleAuthUrl = (redirectUri, state) => `https://appleid.apple.com/auth/authorize?${new URLSearchParams({
  client_id: CLIENT, redirect_uri: redirectUri, response_type: "code", scope: "name email", response_mode: "form_post", state,
})}`;

// « client_secret » : jeton ES256 signé avec la clé Apple (valable 5 minutes, recréé à chaque connexion).
function clientSecret() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: "ES256", kid: KEY_ID })}.${b64({ iss: TEAM, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: CLIENT })}`;
  const sig = crypto.sign("sha256", Buffer.from(unsigned), { key: KEY, dsaEncoding: "ieee-p1363" });
  return `${unsigned}.${sig.toString("base64url")}`;
}

// Échange le code contre l'identité ; l'id_token vient directement d'Apple (TLS), on lit son contenu.
// `user` (JSON, seulement à la 1re connexion) contient le prénom choisi par la personne.
export async function appleIdentity(code, redirectUri, user) {
  const res = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT, client_secret: clientSecret(), code, grant_type: "authorization_code", redirect_uri: redirectUri }),
  });
  const data = await res.json();
  if (!res.ok || !data.id_token) throw new Error(`Connexion Apple refusée (${data.error || res.status}).`);
  const claims = JSON.parse(Buffer.from(data.id_token.split(".")[1], "base64url").toString());
  if (claims.aud !== CLIENT || claims.iss !== "https://appleid.apple.com" || !claims.email) throw new Error("Identité Apple invalide.");
  let name = "";
  try { name = JSON.parse(user || "{}").name?.firstName || ""; } catch { /* prénom facultatif */ }
  return { email: String(claims.email).toLowerCase(), name, avatar: null };
}
