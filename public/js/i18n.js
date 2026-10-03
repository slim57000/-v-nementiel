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
  "Recevoir un code de connexion par email": "Get a login code by email", "Accéder à mes missions": "Open my assignments", "Enregistrer les liens": "Save links",
  "Envoyer une photo": "Send a photo", "● Ouvrir le live": "● Open the live",
  "Les événements publics à venir.": "Upcoming public events.", "Aucun événement public à venir pour le moment.": "No upcoming public events yet.",
  "À découvrir": "Discover", "Gratuit": "Free", "Merci pour votre cadeau 💝": "Thank you for your gift 💝", "Page introuvable": "Page not found",
  "Retour à l'accueil": "Back to home",
  "Découvrir les événements": "Discover events",
  "Ce lien n'existe pas ou l'événement a été supprimé. Vérifiez le lien reçu ou saisissez votre code d'invitation.": "This link doesn't exist or the event was deleted. Check the link you received or enter your invitation code.",
  "Vidéos": "Videos", "Mes vidéos": "My videos",
  "💬 Répondre": "💬 Reply",
  "Votre réponse…": "Your reply…",
  "Envoyer": "Send",
  "Fil": "Feed",
  "Fil d'actualité": "News feed",
  "Les derniers moments partagés dans vos événements et ceux de vos proches.": "The latest moments shared in your events and your friends' events.",
  "📦 Télécharger les souvenirs": "📦 Download memories",
  "✉️ Inviter": "✉️ Invite",
  "📊 Statistiques": "📊 Statistics",
  "📖 Album souvenir": "📖 Memory album",
  "🖨️ Imprimer / PDF": "🖨️ Print / PDF",
  "📱 Inviter par SMS": "📱 Invite by SMS",
  "Envoyer les invitations": "Send invitations",
  "Notifications": "Notifications",
  "🔔 Activer les notifications": "🔔 Enable notifications",
  "Vues de la page": "Page views",
  "Pic de spectateurs": "Peak viewers",
  "Messages du chat": "Chat messages",
  "Photos & vidéos": "Photos & videos",
  "Mots du livre d'or": "Guestbook notes",
  "Invitations": "Invitations",
  "Ont rejoint": "Joined",
  "Le premier réseau social": "The first social network", "dédié à tous vos événements.": "dedicated to all your events.",
  "Partagez l'émotion avant, pendant, après.": "Share the emotion before, during and after.",
  "＋ Ajouter une story": "＋ Add a story",
  "Stories": "Stories",
  "Story publiée pour 24 h ✨": "Story posted for 24 h ✨",
  "Aucune story pour l'instant. Partagez la première !": "No stories yet. Share the first one!",
  "📱 Filmer avec ce téléphone": "📱 Film with this phone", "📤 Partager le live aux invités": "📤 Share the live with guests",
  "⏹ Arrêter": "⏹ Stop",
  "🔄 Retourner": "🔄 Flip",
  "Nom de la caméra": "Camera name",
  "Un seul appui : la vidéo part en direct chez les invités et elle est enregistrée pour le replay.": "One tap: the video goes live for guests and is recorded for the replay.",
  "Partager & inviter": "Share & invite",
  "Souvenirs": "Memories",
  "📤 Partager": "📤 Share",
  "🔗 Copier le lien": "🔗 Copy link",
  "🎥 Caméraman": "🎥 Camera operator",
  "🔑 Copier le code": "🔑 Copy code",
  "🔓 Lien + code": "🔓 Link + code",
  "📖 Album": "📖 Album",
  "📦 Télécharger (zip)": "📦 Download (zip)",
  "✏️ Modifier": "✏️ Edit",
  "Serez-vous présent·e ?": "Will you attend?",
  "✅ Je viens": "✅ I'm coming",
  "🤔 Peut-être": "🤔 Maybe",
  "❌ Je ne viens pas": "❌ I can't come",
  "📅 Ajouter à mon calendrier": "📅 Add to my calendar",
  "Google Agenda": "Google Calendar",
  "Soyez le premier à répondre !": "Be the first to reply!",
  "Réponses (visibles par vous seul)": "Replies (only visible to you)",
  "🗓️ Programme": "🗓️ Schedule",
  "ℹ️ Infos pratiques": "ℹ️ Practical info",
  "+ Ajouter une étape": "+ Add a step",
  "✨ Programme type": "✨ Sample schedule",
  "Infos pratiques": "Practical info",
  "Connexion / Inscription": "Log in / Sign up",
  "Mot de passe": "Password",
  "Mot de passe oublié ?": "Forgot password?",
  "Nouveau mot de passe": "New password",
  "Enregistrer et me connecter": "Save and log in",
  "Enregistrer le mot de passe": "Save password",
  "🔒 Mot de passe": "🔒 Password",
  "Pas encore de compte ? Il est créé automatiquement avec votre email et le mot de passe de votre choix.": "No account yet? It is created automatically with your email and the password of your choice.",
  "Joyeux anniversaire": "Happy birthday",
  "Départ en retraite": "Retirement",
};

const LANG_KEY = "em-lang";
const THEME_KEY = "em-theme";
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignoré */ } };

// Textes ajoutés depuis (simplification, cagnotte, contact, caméraman…).
Object.assign(EN, {
 "Ou votre ancien code organisateur (6 chiffres)": "Or your former organizer code (6 digits)",
 "Voici votre": "Here is your",
 ". Notez-le : il vous sera demandé pour vous reconnecter depuis un autre appareil.": ". Write it down: you'll need it to sign in on another device.",
 "vous@exemple.fr": "you@example.com",
 "8 caractères minimum": "8 characters minimum",
 "Trouvez un événement public, ou entrez le code reçu pour un événement privé.": "Find a public event, or enter the code you received for a private event.",
 "Accéder": "Open",
 "Aucun événement ne correspond à votre recherche.": "No event matches your search.",
 "Nous contacter": "Contact us",
 "Une question, un souci, une idée ? Écrivez-nous, nous répondons par email.": "A question, a problem, an idea? Write to us, we reply by email.",
 "Votre nom": "Your name",
 "Votre email": "Your email",
 "Sujet": "Subject",
 "Message": "Message",
 "✉️ Envoyer": "✉️ Send",
 "Ou par email :": "Or by email:",
 "Créer": "Create",
 "▶ Voir le live": "▶ Watch the live",
 "Voir le live": "Watch the live",
 "🔴 Lancer le live": "🔴 Start the live",
 "Événements à venir": "Upcoming events",
 "Aucun événement dans cette catégorie.": "No events in this category.",
 "Bienvenue sur MaFeliza 👋": "Welcome to MaFeliza 👋",
 "✨ Créez votre événement": "✨ Create your event",
 "Touchez le bouton rose « + » en bas : nom, date, lieu. Le faire-part se crée tout seul.": "Tap the pink “+” button at the bottom: name, date, place. The invitation creates itself.",
 "💌 Partagez-le": "💌 Share it",
 "Envoyez le lien à vos proches par WhatsApp, SMS ou email.": "Send the link to your loved ones by WhatsApp, text or email.",
 "🔴 Le jour J, lancez le live": "🔴 On the big day, start the live",
 "Ouvrez votre événement et touchez « Lancer le live » : vos proches vous regardent en direct.": "Open your event and tap “Start the live”: your loved ones watch you live.",
 "C'est parti !": "Let's go!",
 "Tout": "All",
 "🔴 En direct": "🔴 Live",
 "Fil": "Feed",
 "C'EST AUJOURD'HUI": "IT'S TODAY",
 "Espace caméraman": "Camera operator space",
 "Ouvrir ›": "Open ›",
 "🎥 Espace caméraman": "🎥 Camera operator space",
 "👥 Mes amis": "👥 My friends",
 "Pas encore d'amis. Touchez « + » et envoyez votre lien à vos proches.": "No friends yet. Tap “+” and send your link to your loved ones.",
 "Ajoutez des événements en favoris avec le ♡ sur leur page.": "Add events to your favorites with the ♡ on their page.",
 "Pour changer votre mot de passe, saisissez l'actuel puis le nouveau.": "To change your password, enter the current one then the new one.",
 "Messages, réponses, rappels et début des lives.": "Messages, replies, reminders and live starts.",
 "Taille du texte": "Text size",
 "Normale": "Normal",
 "Grande": "Large",
 "Français": "French",
 "🚪 Se déconnecter": "🚪 Sign out",
 "La suppression de votre compte efface définitivement vos événements, leurs photos, messages et livre d'or.": "Deleting your account permanently erases your events, their photos, messages and guestbook.",
 "Mot de passe actuel": "Current password",
 "Nouveau mot de passe (8 caractères min.)": "New password (8 characters min.)",
 "← Mes événements": "← My events",
 "1. Votre événement": "1. Your event",
 "2. Qui peut le voir ?": "2. Who can see it?",
 "Tout le monde": "Everyone",
 "Avec le lien": "With the link",
 "Avec un code": "With a code",
 "Générer un nouveau code (l'ancien ne fonctionnera plus)": "Generate a new code (the old one will stop working)",
 "personne(s) bloquée(s)": "blocked person(s)",
 "3. Votre faire-part": "3. Your invitation",
 "Il est déjà rempli pour vous : choisissez simplement un style.": "It's already filled in for you: just pick a style.",
 "Personnaliser le titre et la photo": "Customize the title and photo",
 "4. Cagnotte": "4. Money pot",
 "🎁 Créez une cagnotte, vos proches adorent participer !": "🎁 Create a money pot, your loved ones love to chip in!",
 "Un bouton « Participer à la cagnotte » s'affiche sur votre faire-part et pendant le live : les invités, même éloignés, offrent un cadeau en un clic.": "A “Contribute to the money pot” button appears on your invitation and during the live: guests, even far away, give a gift in one tap.",
 "Collez le lien de votre cagnotte ci-dessous 👇": "Paste your money pot link below 👇",
 "Collecté (€)": "Collected (€)",
 "Objectif (€)": "Goal (€)",
 "📋 Coller": "📋 Paste",
 "✅ Cagnotte ajoutée": "✅ Money pot added",
 "⚙️ Plus d'options": "⚙️ More options",
 "(facultatif)": "(optional)",
 "Live": "Live",
 "Programme & infos pratiques": "Schedule & practical info",
 "🔴 Le live, simplement": "🔴 The live, made simple",
 "Le jour J, ouvrez la page de votre événement et appuyez sur": "On the big day, open your event page and tap",
 "« 🎥 Lancer le live »": "“🎥 Start the live”",
 ": votre téléphone filme, vos invités regardent. Vous pouvez aussi envoyer le": ": your phone films, your guests watch. You can also send the",
 "lien caméraman": "camera operator link",
 "à un proche qui filmera pour vous.": "to someone who will film for you.",
 "Options avancées : diffuser via YouTube ou Twitch": "Advanced: stream via YouTube or Twitch",
 "Collez le lien YouTube Live ou Twitch de chaque caméra. Les invités pourront changer d'angle pendant le direct.": "Paste the YouTube Live or Twitch link of each camera. Guests can switch angles during the live.",
 "Consignes pour le(s) caméraman(s)": "Instructions for the camera operator(s)",
 "Le plus simple : bouton": "The easiest: the",
 "du tableau de bord, qui envoie un lien déjà connecté.": "button on the home page, which sends a ready-to-use link.",
 "Générer un nouveau code caméraman": "Generate a new camera operator code",
 "Le déroulé de la journée, visible par les invités sur la page de l'événement.": "The day's schedule, visible to guests on the event page.",
 "✅ Enregistrer mon événement": "✅ Save my event",
 "Ex. Mariage de Julie & Karim": "E.g. Julie & Karim's wedding",
 "Collez le lien de la cagnotte": "Paste the money pot link",
 "Horaires, moments à filmer, emplacements des caméras…": "Times, moments to film, camera positions…",
 "Dress code, parking, hébergement, contact le jour J…": "Dress code, parking, accommodation, contact on the day…",
 "Ajouter un ami": "Add a friend",
 "Vous n'avez pas encore d'amis.": "You don't have any friends yet.",
 "Touchez « Ajouter un ami » et envoyez votre lien à vos proches : un clic et vous êtes amis. Les invités de vos événements privés deviennent aussi vos amis automatiquement.": "Tap “Add a friend” and send your link to your loved ones: one tap and you're friends. Guests of your private events automatically become your friends too.",
 "Pas encore d'amis.": "No friends yet.",
 "Touchez « Ajouter un ami » et envoyez votre lien à vos proches. Les invités de vos événements privés deviennent aussi vos amis.": "Tap “Add a friend” and send your link to your loved ones. Guests of your private events become your friends too.",
 "Voir l'événement": "View the event",
 "💡 Le code est dans le message ou l'email d'invitation (6 lettres et chiffres).": "💡 The code is in the invitation message or email (6 letters and digits).",
 ", le réseau social de vos événements : faire-part, live, photos et replay.": ", the social network for your events: invitations, live, photos and replay.",
 "Découvrir MaFeliza →": "Discover MaFeliza →",
 "🔴 C'est le grand jour !": "🔴 It's the big day!",
 "🎥 Lancer le live": "🎥 Start the live",
 "● Rejoindre le live": "● Join the live",
 "🎥 Vous ne pouvez pas être là ? Suivez l'événement": "🎥 Can't be there? Follow the event",
 "ici le jour J, et revivez-le en replay le lendemain.": "here on the day, and relive it in replay the next day.",
 "pour voir les stories": "to see the stories",
 "Serez-vous là ?": "Will you be there?",
 "Créé avec MaFeliza": "Made with MaFeliza",
 "Faire-part, live, photos des invités et replay : réunissez tous vos proches autour de vos plus beaux moments.": "Invitations, live, guest photos and replay: bring all your loved ones together for your most beautiful moments.",
 "✨ Créer mon événement gratuitement": "✨ Create my event for free",
 "🎬 Vidéo": "🎬 Video",
 "Rechercher dans les messages…": "Search messages…",
 "🚩 Signaler cet événement": "🚩 Report this event",
 "✨ Créer le mien": "✨ Create mine",
 "👋 Bienvenue sur MaFeliza !": "👋 Welcome to MaFeliza!",
 "💌 Voir le faire-part et le livre d'or": "💌 See the invitation and guestbook",
 "Faire-part, live, photos et replay pour vos événements.": "Invitations, live, photos and replay for your events.",
 "Créer le mien": "Create mine",
 "📦 Télécharger le replay (.zip)": "📦 Download the replay (.zip)",
 "Caméraman": "Camera operator",
 "Saisissez le code caméraman transmis par l'organisateur.": "Enter the camera operator code given by the organizer.",
 "Un seul appui : la vidéo part en direct chez les invités. Gardez l'écran allumé pendant le direct.": "One tap: the video goes live to your guests. Keep the screen on during the live.",
 "🔴 Démarrer le live": "🔴 Start the live",
 "📋 Consignes de l'organisateur": "📋 Organizer's instructions",
 "Aucune consigne particulière pour le moment.": "No particular instructions for now.",
 "🎥 Mes caméras": "🎥 My cameras",
 "Pour chaque caméra, collez le lien de votre direct YouTube Live ou Twitch. Les invités pourront passer d'un angle à l'autre.": "For each camera, paste the link of your YouTube Live or Twitch stream. Guests can switch from one angle to another.",
 "Comment faire un live YouTube ?": "How to go live on YouTube?",
 "Passer au direct": "Go live",
 "Choisissez la visibilité": "Choose the visibility",
 "Non répertoriée": "Unlisted",
 "📋 Coller le lien copié": "📋 Paste the copied link",
 "📷 Partager des images": "📷 Share pictures",
 "Les images apparaissent dans « Photos des invités » et dans les stories.": "Pictures appear in “Guest photos” and in the stories.",
 "Caméra 1": "Camera 1"
});

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
// Taille du texte : « grande » pour les seniors (réglage du Profil, mémorisé sur l'appareil).
export const bigText = () => read("em-big-text") === "1";
export function setBigText(on) { write("em-big-text", on ? "1" : "0"); document.documentElement.classList.toggle("big-text", on); }
document.documentElement.classList.toggle("big-text", bigText());
function applyTheme() {
  const pref = themePref();
  const dark = pref === "dark" || (pref === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  // Collage de l'accueil : version à fond sombre quand le thème sombre est choisi à la main.
  document.querySelectorAll("source[data-dark]").forEach((el) => { el.media = dark ? "all" : "not all"; });
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

// Bouton jour / nuit sur l'accueil public et la connexion (le réglage complet est dans le Profil).
if (["/", "/connexion"].includes(location.pathname)) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "theme-toggle";
  const paint = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    btn.textContent = dark ? "☀️" : "🌙";
    btn.setAttribute("aria-label", dark ? "Passer en mode jour" : "Passer en mode nuit");
  };
  btn.addEventListener("click", () => { setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"); paint(); });
  paint();
  const add = () => document.body.append(btn);
  document.body ? add() : document.addEventListener("DOMContentLoaded", add);
}
