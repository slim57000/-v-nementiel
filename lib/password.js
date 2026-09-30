// Mots de passe : empreinte scrypt salée (jamais stockés en clair), dans les réglages (pw:{id}).
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { getSetting, setSetting } from "./store.js";

const derive = (password, salt) => new Promise((ok, ko) => scrypt(password, salt, 64, (err, key) => (err ? ko(err) : ok(key))));

export async function setPassword(organizerId, password) {
  const salt = randomBytes(16).toString("hex");
  await setSetting(`pw:${organizerId}`, `${salt}:${(await derive(password, salt)).toString("hex")}`);
}
export const hasPassword = async (organizerId) => Boolean(await getSetting(`pw:${organizerId}`).catch(() => null));
export async function checkPassword(organizerId, password) {
  const stored = await getSetting(`pw:${organizerId}`).catch(() => null);
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  const given = await derive(password, salt);
  return timingSafeEqual(given, Buffer.from(hash, "hex"));
}
export const passwordError = (p) => (typeof p !== "string" || p.length < 8 ? "Le mot de passe doit contenir au moins 8 caractères."
  : p.length > 200 ? "Mot de passe trop long." : null);
