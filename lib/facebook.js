// Connexion avec Facebook (OAuth 2.0, flux « code » côté serveur, sans SDK).
// Active si FACEBOOK_APP_ID et FACEBOOK_APP_SECRET sont définis (developers.facebook.com → Mes apps).
const ID = process.env.FACEBOOK_APP_ID;
const SECRET = process.env.FACEBOOK_APP_SECRET;
const WWW = process.env.FACEBOOK_WWW_BASE || "https://www.facebook.com";      // modifiables pour les tests
const GRAPH = process.env.FACEBOOK_GRAPH_BASE || "https://graph.facebook.com";
export const FACEBOOK_ENABLED = Boolean(ID && SECRET);

export const facebookAuthUrl = (redirectUri, state) => `${WWW}/v19.0/dialog/oauth?${new URLSearchParams({
  client_id: ID, redirect_uri: redirectUri, state, scope: "email,public_profile", response_type: "code",
})}`;

export async function facebookIdentity(code, redirectUri) {
  const tok = await fetch(`${GRAPH}/v19.0/oauth/access_token?${new URLSearchParams({ client_id: ID, client_secret: SECRET, redirect_uri: redirectUri, code })}`);
  const { access_token: token } = await tok.json();
  if (!tok.ok || !token) throw new Error("Connexion Facebook refusée.");
  const me = await (await fetch(`${GRAPH}/v19.0/me?${new URLSearchParams({ fields: "id,first_name,name,email,picture.width(256).height(256)", access_token: token })}`)).json();
  if (!me.email) throw new Error("Votre compte Facebook ne partage pas d'adresse email.");
  return { email: me.email.toLowerCase(), name: me.first_name || me.name || "", avatar: me.picture?.data?.is_silhouette ? null : me.picture?.data?.url || null };
}
