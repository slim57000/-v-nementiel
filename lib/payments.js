// Réactions payantes du live via Stripe Checkout (API REST, sans SDK).
// Actif uniquement si STRIPE_SECRET_KEY est défini ; sinon toutes les réactions restent gratuites.
import { getSetting, setSetting } from "./store.js";

const KEY = process.env.STRIPE_SECRET_KEY;
const API = process.env.STRIPE_API_BASE || "https://api.stripe.com"; // modifiable pour les tests
export const PAYMENTS_ENABLED = Boolean(KEY);

// Prix en centimes (❤️ reste gratuit), comme sur la maquette.
export const PAID_REACTIONS = {
  "👏": { label: "Applaudir", amount: 100 },
  "😍": { label: "Cœur", amount: 200 },
  "🎆": { label: "Feu d'artifice", amount: 500 },
  "🍾": { label: "Champagne", amount: 1000 },
};

async function stripe(path, params) {
  const res = await fetch(`${API}/v1/${path}`, {
    method: params ? "POST" : "GET",
    headers: { Authorization: `Bearer ${KEY}`, ...(params && { "Content-Type": "application/x-www-form-urlencoded" }) },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Paiement indisponible.");
  return data;
}

export async function createCheckout({ event, emoji, name, origin }) {
  const r = PAID_REACTIONS[emoji];
  const back = `${origin}/live?e=${encodeURIComponent(event.slug)}`;
  const session = await stripe("checkout/sessions", {
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(r.amount),
    "line_items[0][price_data][product_data][name]": `${emoji} ${r.label} — ${event.name}`.slice(0, 250),
    success_url: `${back}&paid={CHECKOUT_SESSION_ID}`,
    cancel_url: back,
    "metadata[slug]": event.slug,
    "metadata[emoji]": emoji,
    "metadata[name]": name,
  });
  return session.url;
}

// Vérifie un paiement de retour de Stripe ; renvoie la réaction une seule fois par paiement.
export async function claimPayment(sessionId, event) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new Error("Paiement introuvable.");
  const s = await stripe(`checkout/sessions/${sessionId}`);
  if (s.payment_status !== "paid" || s.metadata?.slug !== event.slug) throw new Error("Paiement non confirmé.");
  if (await getSetting(`paid:${sessionId}`)) return null; // déjà affichée
  await setSetting(`paid:${sessionId}`, true);
  return { emoji: s.metadata.emoji, name: s.metadata.name || "Invité", amount: s.amount_total };
}
