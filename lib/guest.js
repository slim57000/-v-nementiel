// Identité anonyme et stable d'un invité (cookie signé), utilisée pour la modération :
// l'organisateur peut bloquer « cette personne » sans connaître son identité.
import { randomBytes } from "node:crypto";
import { getSigned, setSigned, codeFingerprint } from "./session.js";

export function guestAuthor(req, res) {
  let gid = getSigned(req, "gid");
  if (!gid) {
    gid = randomBytes(9).toString("base64url");
    setSigned(res, "gid", gid);
  }
  return codeFingerprint(`guest:${gid}`).slice(0, 10);
}
