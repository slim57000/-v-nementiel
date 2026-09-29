// Langue (français / anglais) et thème (clair / sombre / automatique).
// La traduction se fait à partir des textes français de l'interface : chaque texte ou attribut
// dont la valeur exacte figure dans le dictionnaire est remplacé, y compris le contenu ajouté
// dynamiquement (observateur de mutations). Les pages légales restent en français.

const EN = {
  // Navigation et commun
  "Accueil": "Home", "Découvrir": "Discover", "Messages": "Messages", "Profil": "Profile",
  "Créer un événement": "Create an event", "Partager": "Share", "Copier le lien": "Copy link", "Fermer": "Close",
  "Annuler": "Cancel", "Valider": "Confirm", "Modifier": "Edit", "Supprimer": "Delete", "Voir": "View",
  "Continuer": "Continue", "Publier": "Post", "Enregistrer l'événement": "Save event", "Voir tout": "See all",
  "Mentions légales": "Legal notice", "CGU": "Terms", "Confidentialité": "Privacy", "Gérer les cookies": "Manage cookies",
  "Refuser": "Decline", "Accepter": "Accept", "Lien copié !": "Link copied!", "Copié !": "Copied!",
  "🎥 Espace caméraman": "🎥 Camera operator area", "Plus…": "More…", "Instagram": "Instagram", "Email": "Email",
  // Accueil public
  "Live multicaméra": "Multi-camera live", "Cadeaux & Cagnotte": "Gifts & Money pot", "Album photo collaboratif": "Shared photo album",
  "Créer mon événement gratuitement": "Create my event for free", "J'ai reçu une invitation": "I received an invitation",
  "ou continuer avec": "or continue with", "Déjà inscrit ?": "Already registered?", "Se connecter": "Log in",
  "En direct actuellement": "Live now", "Exemple": "Example", "Accéder à l'événement": "Open the event",
  "Saisissez le code à 6 caractères reçu avec votre faire-part, ou ouvrez directement le lien reçu.": "Enter the 6-character code from your invitation, or simply open the link you received.",
  // Connexion
  "Votre espace organisateur": "Your organizer space", "Votre adresse email": "Your email address",
  "Entrez votre email : votre espace est créé automatiquement à la première visite.": "Enter your email: your space is created automatically on your first visit.",
  "Votre code organisateur (6 chiffres)": "Your organizer code (6 digits)", "Votre espace est prêt 🎉": "Your space is ready 🎉",
  "J'ai noté mon code, continuer": "I saved my code, continue", "Code incorrect.": "Incorrect code.",
  // Accueil organisateur
  "Pour vous": "For you", "En direct": "Live", "À venir": "Upcoming", "Passés": "Past",
  "Voir la page de l'événement": "View event page", "Rejoindre le Live": "Join the Live", "LIVE EN COURS": "LIVE NOW",
  "Lieu": "Venue", "Date": "Date", "Code d'accès invités": "Guest access code", "Code caméraman": "Camera operator code",
  "💌 Mes faire-part": "💌 My invitations", "Copier le code": "Copy code", "Lien + code": "Link + code",
  "Accès caméraman": "Camera operator access", "Cagnotte": "Money pot", "Voir la cagnotte": "View money pot",
  "Plateforme externe": "External platform", "🔒 Privé": "🔒 Private", "🔓 Public": "🔓 Public", "Aujourd'hui": "Today", "Passé": "Past",
  "+ Créer un événement": "+ Create an event", "Événement enregistré ✔": "Event saved ✔", "Événement supprimé": "Event deleted",
  // Formulaire
  "Nouvel événement": "New event", "Modifier l'événement": "Edit event", "1. L'événement": "1. The event",
  "Type d'événement": "Event type", "Nom de l'événement": "Event name", "Heure": "Time", "Description courte": "Short description",
  "Photo de couverture": "Cover photo", "Retirer la photo": "Remove photo", "2. Accès": "2. Access", "3. Faire-part": "3. Invitation",
  "Style": "Style", "Aperçu": "Preview", "Accroche": "Tagline", "Titre": "Title", "Texte": "Text",
  "↺ Texte proposé automatiquement": "↺ Suggested text", "Photo du faire-part": "Invitation photo", "Autre photo": "Other photo",
  "✨ Générer un texte": "✨ Generate a text", "📚 Textes prêts": "📚 Ready-made texts",
  "Sans photo": "No photo", "+ Ajouter une caméra": "+ Add a camera", "Tout débloquer": "Unblock all",
  "Classique": "Classic", "Moderne": "Modern", "Élégant": "Elegant", "Fleuri": "Floral",
  "Mariage": "Wedding", "Anniversaire": "Birthday", "Baptême": "Baptism", "Communion": "Communion", "Fiançailles": "Engagement",
  "Baby shower": "Baby shower", "Remise de diplôme": "Graduation", "Retraite": "Retirement", "Inauguration": "Opening", "Autre": "Other",
  "Toute personne ayant le lien": "Anyone with the link", "Accès avec un code": "Access with a code",
  // Page événement
  "Aperçu des stories": "Stories preview", "● Rejoindre le live": "● Join the live", "🎁 Participer à la cagnotte": "🎁 Contribute to the money pot",
  "Ouvrir dans Maps": "Open in Maps", "Le faire-part": "The invitation", "Livre d'or": "Guestbook",
  "✍️ Écrire dans le livre d'or": "✍️ Write in the guestbook", "Tous": "All", "Photos": "Photos", "Vocaux": "Voice", "À la une": "Featured",
  "📷 Ajouter une photo": "📷 Add a photo", "Accéder à l'événement ": "Open the event",
  "Cet événement est privé. Saisissez le code reçu avec votre invitation.": "This event is private. Enter the code you received with your invitation.",
  "jours": "days", "heures": "hours", "min": "min", "sec": "sec",
  "se marient": "are getting married", "se fiancent": "are getting engaged",
  "Un mot pour le livre d'or": "A note for the guestbook", "📷 Photo": "📷 Photo", "🎙️ Message vocal": "🎙️ Voice message",
  "Soyez le premier à laisser un mot ✍️": "Be the first to leave a note ✍️", "Merci pour votre message 💛": "Thank you for your message 💛",
  // Live
  "Écrire un message…": "Write a message…", "J'aime": "Like", "Applaudir": "Applaud", "Cœur": "Love", "Feu d'artifice": "Fireworks",
  "Champagne": "Champagne", "Changer de caméra": "Switch camera", "Photos des invités": "Guest photos", "Chat": "Chat",
  "Réactions": "Reactions", "Caméras": "Cameras", "Le direct n'a pas encore commencé.": "The live stream hasn't started yet.",
  "Soyez le premier à écrire un message 💬": "Be the first to write a message 💬", "Participer ›": "Contribute ›",
  // Menus
  "🚩 Signaler ce contenu": "🚩 Report this content", "🙈 Masquer cette personne": "🙈 Hide this person",
  "🗑️ Supprimer": "🗑️ Delete", "⛔ Bloquer cette personne": "⛔ Block this person", "👋 Retirer de mes amis": "👋 Remove from friends",
  "Votre prénom": "Your first name", "Il s'affichera à côté de vos messages et de vos photos.": "It will be shown next to your messages and photos.",
  // Profil, messages
  "Mon profil": "My profile", "✏️ Modifier mon nom": "✏️ Edit my name", "Événements": "Events", "Participations": "Participations",
  "Amis": "Friends", "💬 Mes messages": "💬 My messages", "Favoris": "Favorites", "Mes cadeaux": "My gifts",
  "Code organisateur": "Organizer code", "Voir mes événements": "View my events", "Se déconnecter": "Log out",
  "Mes données": "My data", "Supprimer mon compte": "Delete my account", "🛠️ Administration": "🛠️ Admin",
  "Personnes bloquées": "Blocked people", "Débloquer": "Unblock", "Dites bonjour 👋": "Say hello 👋",
  "Apparence": "Appearance", "Langue": "Language", "Automatique": "Automatic", "Clair": "Light", "Sombre": "Dark",
  "Mes faire-part": "My invitations", "Faire-part": "Invitation", "Invitation au live": "Live invitation", "Imprimer / PDF": "Print / PDF",
  "Espace caméraman": "Camera operator area", "▶ Voir le replay": "▶ Watch the replay",
  "Code oublié ? Le recevoir par email": "Forgot your code? Get it by email", "Accéder à mes missions": "Open my assignments", "Enregistrer les liens": "Save links",
  "Envoyer une photo": "Send a photo", "● Ouvrir le live": "● Open the live",
  "Les événements publics à venir.": "Upcoming public events.", "Aucun événement public à venir pour le moment.": "No upcoming public events yet.",
};

const LANG_KEY = "em-lang";
const THEME_KEY = "em-theme";
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignoré */ } };

export const lang = read(LANG_KEY) || (navigator.language?.startsWith("en") ? "en" : "fr");
export const t = (fr) => (lang === "en" && EN[fr]) || fr;

// Traduit un nœud et ses descendants (textes et attributs usuels).
function translate(root) {
  if (lang !== "en") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const key = n.nodeValue.trim();
    if (key && EN[key]) n.nodeValue = n.nodeValue.replace(key, EN[key]);
  }
  const els = root.querySelectorAll ? root.querySelectorAll("[placeholder],[aria-label],[title]") : [];
  for (const el of els) {
    for (const attr of ["placeholder", "aria-label", "title"]) {
      const v = el.getAttribute(attr);
      if (v && EN[v]) el.setAttribute(attr, EN[v]);
    }
  }
}

if (lang === "en") {
  document.documentElement.lang = "en";
  const start = () => {
    translate(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) for (const node of m.addedNodes) {
        if (node.nodeType === 1) translate(node);
        else if (node.nodeType === 3 && EN[node.nodeValue.trim()]) node.nodeValue = EN[node.nodeValue.trim()];
      }
    }).observe(document.body, { childList: true, subtree: true });
  };
  document.body ? start() : addEventListener("DOMContentLoaded", start);
}

export function setLang(value) {
  write(LANG_KEY, value);
  location.reload();
}

// Thème : « auto » suit le réglage du téléphone.
export const themePref = () => read(THEME_KEY) || "auto";
function applyTheme() {
  const pref = themePref();
  const dark = pref === "dark" || (pref === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
applyTheme();
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);

// Liens « FR · EN » (pied de page) : [data-setlang].
document.addEventListener("click", (e) => {
  const el = e.target.closest?.("[data-setlang]");
  if (!el) return;
  e.preventDefault();
  if (el.dataset.setlang !== lang) setLang(el.dataset.setlang);
});
addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(`[data-setlang="${lang}"]`).forEach((a) => { a.style.fontWeight = "800"; a.style.color = "var(--primary)"; });
});

export function setTheme(value) {
  write(THEME_KEY, value);
  applyTheme();
}

// Safari iOS ignore « user-scalable=no » : on bloque le zoom au pincement comme dans une application.
for (const type of ["gesturestart", "gesturechange"]) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
