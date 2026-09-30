// Connexion avec Google (OAuth 2.0, flux « code » côté serveur, sans SDK).
// Active si GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET sont définis (console.cloud.google.com → Identifiants).
const ID = process.env.GOOGLE_CLIENT_ID;
const SECRET = process.env.GOOGLE_CLIENT_SECRET;
const AUTH = process.env.GOOGLE_AUTH_BASE || "https://accounts.google.com";   // modifiables pour les tests
const TOKEN = process.env.GOOGLE_TOKEN_BASE || "https://oauth2.googleapis.com";
export const GOOGLE_ENABLED = Boolean(ID && SECRET);

export const googleAuthUrl = (redirectUri, state) => `${AUTH}/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: ID, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, prompt: "select_account",
})}`;

// Échange le code contre l'identité ; l'id_token vient directement de Google (TLS), on lit son contenu.
export async function googleIdentity(code, redirectUri) {
  const res = await fetch(`${TOKEN}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: ID, client_secret: SECRET, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  const data = await res.json();
  if (!res.ok || !data.id_token) throw new Error("Connexion Google refusée.");
  const claims = JSON.parse(Buffer.from(data.id_token.split(".")[1], "base64url").toString());
  if (claims.aud !== ID || !claims.email || claims.email_verified === false) throw new Error("Compte Google non vérifié.");
  return { email: claims.email.toLowerCase(), name: claims.given_name || claims.name || "", avatar: claims.picture || null };
}
