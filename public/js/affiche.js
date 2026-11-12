// Affiche à imprimer pour la salle : QR « photos » (album + mur photo) et QR « livre d'or ».
import { api, $, qrUrl, goLogin, formatDate, EVENT_TYPES } from "./common.js";
import { t } from "./i18n.js";

const id = new URLSearchParams(location.search).get("id");
let ev;
try { ev = await api(`/api/events/${encodeURIComponent(id)}`); }
catch (err) { if (err.status === 401) goLogin(); else document.body.textContent = err.message; throw err; }
const base = `${location.origin}/e/${encodeURIComponent(ev.slug)}${ev.visibility === "private" ? `?code=${encodeURIComponent(ev.accessCode)}` : ""}`;
document.title = `${t("Affiche QR")} — ${ev.name}`;
$("#p-kicker").textContent = t(EVENT_TYPES[ev.type]?.label || "Événement").toUpperCase();
$("#p-name").textContent = ev.invite?.title || ev.name;
$("#p-date").textContent = formatDate(ev.date, ev.time || "").split(" à")[0];
$("#p-qr1").src = qrUrl(`${base}#photos`);
$("#p-qr2").src = qrUrl(`${base}#livre-dor`);
$("#p-t1").textContent = `📸 ${t("Partagez vos photos")}`;
$("#p-s1").textContent = t("Elles s'affichent en direct sur le mur photo");
$("#p-t2").textContent = `✍️ ${t("Signez le livre d'or")}`;
$("#p-s2").textContent = t(ev.type === "mariage" ? "Laissez un mot aux mariés" : "Laissez un mot à vos hôtes");
$("#p-steps").textContent = t("Ouvrez l'appareil photo de votre téléphone et visez le QR code. Aucune application à installer.");
$("#p-print").textContent = `🖨️ ${t("Imprimer")}`;
$("#p-print").onclick = () => print();
$("#p-back").href = `/dashboard`;
