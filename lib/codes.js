// Génération des codes aléatoires (code d'invitation, code caméraman, codes de connexion).
import { randomInt } from "node:crypto";

// Sans 0/O/1/I/L pour éviter les confusions à la saisie sur mobile.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomCode(length = 6, alphabet = ALPHABET) {
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

export const loginCode = () => randomCode(6, "0123456789");

export function slugify(text) {
  const base = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "evenement"}-${randomCode(4, "abcdefghjkmnpqrstuvwxyz23456789")}`;
}
