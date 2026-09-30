// Limite de débit partagée (base de données) : vrai si `key` dépasse `max` actions sur `windowMs`.
// En cas d'indisponibilité de la base, repli sur un compteur en mémoire (par instance).
import { bumpLimit } from "./store.js";

const memory = new Map();
function memoryHit(key, windowMs) {
  const now = Date.now();
  const recent = (memory.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  memory.set(key, recent);
  return recent.length;
}

export async function tooFast(key, max, windowMs) {
  let n;
  try { n = await bumpLimit(key, windowMs); } catch { n = memoryHit(key, windowMs); }
  return n > max;
}
