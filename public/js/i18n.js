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
  "✍️ Écrire dans le livre d'or": "✍️ Write in the guestbook", "Tous": "All",
  "🟢 En ligne maintenant": "🟢 Online now", "Personnes sur le site": "People on the site", "Utilisateurs connectés": "Logged-in users", "Visiteurs non connectés": "Guests (not logged in)", "Actualiser": "Refresh", "Actifs sur les 2 dernières minutes · mis à jour toutes les 5 s": "Active in the last 2 minutes · updated every 5 s", "En direct sur MaFeliza": "Live on MaFeliza", "↻ Actualiser": "↻ Refresh", "personnes sur le site en ce moment": "people on the site right now", "personne sur le site en ce moment": "person on the site right now", "Où sont-ils ?": "Where are they?", "Qui est là ?": "Who's here?", "Visiteur": "Visitor", "Mis à jour ✔": "Updated ✔", "personnes sont là en ce moment": "people are here right now", "Mon compte": "My account", "Les événements en direct et à venir": "Live and upcoming events", "Mon profil": "My profile", "Mes likes": "My likes", "❤️ Mes likes": "❤️ My likes", "🔔 Notifications": "🔔 Notifications", "Créer": "Create", "✨ Tout": "✨ All", "📰 Fil": "📰 Feed", "Touchez une option : vous pourrez la changer plus tard.": "Tap an option: you can change it later.", "Visible par tous, dans « Découvrir »": "Visible to everyone, in “Discover”", "Seules les personnes à qui vous envoyez le lien": "Only the people you send the link to", "Le lien + un code secret : le plus privé": "The link + a secret code: the most private", "Il est déjà rempli pour vous : touchez un style pour changer son apparence 👇": "It's already filled in for you: tap a style to change its look 👇", "Choisissez un style": "Choose a style", "Deux cartes à envoyer à vos proches : choisissez laquelle afficher.": "Two cards to send to your loved ones: choose which one to show.", "Invitation à suivre en direct": "Invitation to watch live", "Pour annoncer l'événement et inviter vos proches à venir": "To announce the event and invite your loved ones to come", "Pour ceux qui ne peuvent pas venir : ils regardent depuis chez eux": "For those who can't come: they watch from home", "📧 Envoyer aux invités": "📧 Send to guests", "✨ Revivez l'événement": "✨ Relive the event", "facultatif": "optional", "Programme, tenue, infos pratiques…": "Schedule, dress code, practical info…", "Retour": "Back", "Actions rapides": "Quick actions", "Spectateurs": "Viewers", "Plus d'actions": "More actions", "Commentaire": "Comment", "Story suivante": "Next story", "Story précédente": "Previous story", "Sommaire": "Contents", "Direct": "Live", "awa@exemple.fr\nmoussa@exemple.fr": "awa@example.com\nmoussa@example.com", "Continuer avec Apple": "Continue with Apple", "Continuer avec Google": "Continue with Google", "🔍 Rechercher un ami": "🔍 Search for a friend", "Rechercher un ami": "Search for a friend", "Rechercher": "Search", "Recevoir un lien de connexion par email": "Get a sign-in link by email", "Adresse ou nom du lieu": "Address or venue name", "Vos vœux, un souvenir, un message…": "Your wishes, a memory, a message…", "Sections du live": "Live sections", "Ex. Sophie": "E.g. Sophie", "Supprimer la story": "Delete the story", "Cérémonie, cocktail, dîner…": "Ceremony, cocktail, dinner…", "Étape": "Step", "Code d'un ami": "A friend's code", "Ex. Mariage de Julie & Karim": "E.g. Julie & Karim's wedding", "Réagir": "React", "Commentaires": "Comments", "Fermer": "Close", "Connexion Apple interrompue : rouvrez mafeliza.com puis réessayez.": "Apple sign-in interrupted: reopen mafeliza.com and try again.", "Connexion Apple annulée.": "Apple sign-in cancelled.", "Apple a refusé la connexion (configuration du serveur). Utilisez l'email en attendant.": "Apple refused the sign-in (server configuration). Use your email meanwhile.", "Ce lien de connexion a expiré ou a déjà servi : demandez-en un nouveau avec l'enveloppe ✉️.": "This sign-in link has expired or was already used: request a new one with the envelope ✉️.", "Votre adresse email : nous vous envoyons un lien de connexion.": "Your email address: we'll send you a sign-in link.", "📧 Lien envoyé ! Ouvrez l'email et touchez « Me connecter ».": "📧 Link sent! Open the email and tap “Sign me in”.", "Entrez votre email puis touchez l'enveloppe ✉️ pour recevoir un lien de connexion.": "Enter your email then tap the envelope ✉️ to receive a sign-in link.", "✨ Autre texte proposé": "✨ Another suggested text", "📱 Le direct depuis le téléphone n'est pas encore activé sur MaFeliza. En attendant, collez ci-dessous le lien d'un direct YouTube ou Twitch.": "📱 Live from the phone is not enabled on MaFeliza yet. Meanwhile, paste the link of a YouTube or Twitch live below.", "📺 Regarder le live": "📺 Watch the live", "🎁 Une cagnotte est ouverte !": "🎁 A money pot is open!", "Plus elle est partagée, plus elle grandit 😄 Faites-la tourner autour de vous !": "The more it's shared, the bigger it grows 😄 Pass it around!", "Participer": "Contribute", "🔁 La partager": "🔁 Share it", "🔁 Plus elle est partagée, plus elle grandit 😄": "🔁 The more it's shared, the bigger it grows 😄", "Envoyez le lien à vos proches par WhatsApp, SMS ou email. Plus vous le partagez, plus il y a de monde au rendez-vous !": "Send the link to your loved ones by WhatsApp, text or email. The more you share it, the more people join in!", "🎁 Ajoutez une cagnotte": "🎁 Add a money pot", "Vos proches, même éloignés, offrent un cadeau en un clic. Plus elle est partagée, plus elle grandit 😄": "Your loved ones, even far away, give a gift in one tap. The more it's shared, the bigger it grows 😄", "Commenter": "Comment", "Écrire un commentaire…": "Write a comment…", "Envoyer": "Send", "Fermer": "Close", "Réagir à l'événement": "React to the event", "⏳ Enregistrement…": "⏳ Saving…", "Le réseau est lent : l'enregistrement n'a pas abouti. Réessayez.": "The network is slow: saving did not complete. Please try again.", "Visibilité": "Visibility", "Faire-part": "Invitation", "Étapes": "Steps", "Enregistrement du replay… gardez cette page ouverte.": "Recording the replay… keep this page open.", "Envoi de la photo…": "Uploading the photo…", "Lien copié !": "Link copied!", "Mot de passe oublié": "Forgot password", "Mot de passe oublié ?": "Forgot password?", "Coupure du ruban": "Ribbon cutting", "Remplacer le programme actuel par un programme type ?": "Replace the current schedule with a template?", "Partagez la première !": "Share the first one!", "✨ Créer mon événement": "✨ Create my event", "L'événement a eu lieu. Merci à tous ! 💛": "The event has taken place. Thank you all! 💛", "une vidéo": "a video", "une photo": "a photo", "Aucun message ne correspond.": "No matching messages.", "· ⭐ À la une": "· ⭐ Featured", "Retirer de la une": "Remove from featured", "Supprimer ce message du livre d'or ?": "Delete this message from the guestbook?", "🎙️ Refaire le vocal": "🎙️ Re-record the voice message", "Vous :": "You:", "Les événements auxquels vous participez apparaîtront ici.": "The events you take part in will appear here.", "❤️ Mes favoris": "❤️ My favorites", "Mes favoris": "My favorites", "Le livre d'or": "The guestbook", "📧 Code envoyé ! Regardez vos emails (et les spams).": "📧 Code sent! Check your emails (and spam).", "Code reçu (6 chiffres)": "Code received (6 digits)", "Recevoir mon code": "Get my code", "Par email (une adresse par ligne)": "By email (one address per line)", "Textes prêts": "Ready-made texts", "Suivez cet événement, puis découvrez ceux de vos proches ou créez le vôtre : faire-part, live, photos et souvenirs au même endroit.": "Follow this event, then discover your loved ones' events or create your own: invitations, live, photos and memories in one place.", "🔎 Découvrir": "🔎 Discover", "🎉 Votre événement est créé !": "🎉 Your event has been created!", "Notez bien ces codes, vous les retrouverez aussi sur votre tableau de bord.": "Write these codes down, you will also find them on your dashboard.", "J'ai noté mes codes": "I've noted my codes", "▶ Revoir le live": "▶ Watch the live again", "Le replay a été supprimé par l'organisateur.": "The replay was deleted by the organizer.", "Le replay n'est plus disponible.": "The replay is no longer available.", "Merci d'avoir partagé ce moment !": "Thank you for sharing this moment!", "retiré": "removed", "en ligne": "online", "Envoyez votre lien : la personne l'ouvre et vous êtes amis.": "Send your link: the person opens it and you're friends.", "Mon code ami": "My friend code", "À donner de vive voix": "To share in person", "Participer à la cagnotte": "Contribute to the money pot", "Pas encore d'amis. Touchez « + » et envoyez votre lien à vos proches.": "No friends yet. Tap “+” and send your link to your loved ones.", "Préparation de l'album…": "Preparing the album…", "Nous vous répondons très vite par email.": "We'll reply to you very quickly by email.", "Événement": "Event", "🔊 Activer le son": "🔊 Turn on sound", "Choisissez un mot de passe pour vous connecter depuis n'importe quel appareil.": "Choose a password to sign in from any device.", "Confirmez le mot de passe": "Confirm the password", "en direct": "live", "Agenda": "Calendar", "Itinéraire": "Directions", "Cagnotte": "Money pot", "＋ Google Agenda": "+ Google Calendar", "C'est aujourd'hui ! 🎉": "It's today! 🎉", "Lieu": "Venue", "Photos": "Photos", "Vocaux": "Voice", "À la une": "Featured",
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
 "Touchez le bouton rose « ➕ Créer » en haut de l'accueil : nom, date, lieu. Le faire-part se crée tout seul.": "Tap the pink “➕ Create” button at the top of the home page: name, date, place. The invitation creates itself.",
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
 "Nouveau mot de passe (8 caractères min.)": "New password (8+ chars)",
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

// Textes des messages, confirmations et partages.
Object.assign(EN, {
 "Les photos et messages de vos invités apparaîtront ici.": "Your guests' photos and messages will appear here.",
 "Écrire à": "Write to",
 "Vous êtes maintenant amis 🎉": "You are now friends 🎉",
 "Retirer cette personne de vos amis ?": "Remove this person from your friends?",
 "Ami retiré": "Friend removed",
 "6 caméras maximum": "6 cameras maximum",
 "Caméra": "Camera",
 "Démarrage du direct…": "Starting the live…",
 "Liens enregistrés ✔": "Links saved ✔",
 "Image partagée ✔": "Picture shared ✔",
 "Un morceau du replay n'a pas pu être enregistré.": "Part of the replay could not be saved.",
 "Ce navigateur ne permet pas de filmer. Utilisez Safari ou Chrome à jour.": "This browser cannot film. Use an up-to-date Safari or Chrome.",
 "Accès à la caméra…": "Accessing the camera…",
 "⚠️ Réseau instable, reconnexion…": "⚠️ Unstable network, reconnecting…",
 "Les invités vous voient. Gardez cet écran ouvert.": "Guests can see you. Keep this screen open.",
 "⚠️ Connexion perdue : vérifiez le réseau puis relancez.": "⚠️ Connection lost: check the network then restart.",
 "Autorisez la caméra et le micro dans les réglages du navigateur.": "Allow the camera and microphone in your browser settings.",
 "Direct arrêté. Le replay est disponible pour les invités.": "Live stopped. The replay is available to guests.",
 "Direct arrêté": "Live stopped",
 "Impossible de changer de caméra.": "Unable to switch camera.",
 "Lien collé ✓ Pensez à enregistrer.": "Link pasted ✓ Remember to save.",
 "Une erreur est survenue.": "Something went wrong.",
 "Merci de choisir une image.": "Please choose an image.",
 "Ajouté à vos favoris ❤️": "Added to your favorites ❤️",
 "Retiré des favoris": "Removed from favorites",
 "Ajouter aux favoris": "Add to favorites",
 "Créez d'abord un événement pour y publier une story.": "Create an event first to post a story to it.",
 "Sur quel événement ?": "On which event?",
 "Aucune notification pour le moment.": "No notifications yet.",
 "Pourquoi signalez-vous ce contenu ? (facultatif)": "Why are you reporting this content? (optional)",
 "Merci, le signalement a été transmis.": "Thank you, your report has been sent.",
 "Vous ne verrez plus les contenus de cette personne.": "You won't see this person's content anymore.",
 "Bloquer cette personne ? Ses contenus seront masqués et elle ne pourra plus publier.": "Block this person? Their content will be hidden and they won't be able to post.",
 "Personne bloquée.": "Person blocked.",
 "Vidéo illisible.": "Unreadable video.",
 "Envoi de la vidéo impossible, réessayez.": "Video upload failed, try again.",
 "Vidéo trop lourde (4 Mo maximum).": "Video too large (4 MB maximum).",
 "Envoi de la vidéo…": "Uploading the video…",
 "Ajouter une légende ? (facultatif)": "Add a caption? (optional)",
 "Message copié : collez-le dans Instagram": "Message copied: paste it in Instagram",
 "Les notifications ne sont pas encore activées sur la plateforme.": "Notifications are not enabled on the platform yet.",
 "Notifications indisponibles ici. Sur iPhone : Partager → « Sur l'écran d'accueil », puis ouvrez MaFeliza depuis l'icône.": "Notifications unavailable here. On iPhone: Share → “Add to Home Screen”, then open MaFeliza from the icon.",
 "Notifications refusées dans les réglages du téléphone.": "Notifications are blocked in your phone settings.",
 "Story précédente": "Previous story",
 "Nouveau compte : choisissez un mot de passe (8 caractères minimum).": "New account: choose a password (8 characters minimum).",
 "Saisissez votre mot de passe.": "Enter your password.",
 "📧 Si un compte existe pour cette adresse, un code valable 15 minutes vient d'y être envoyé.": "📧 If an account exists for this address, a code valid for 15 minutes has just been sent to it.",
 "Connexion Google interrompue : rouvrez mafeliza.com (sans « www ») puis réessayez.": "Google sign-in interrupted: reopen mafeliza.com (without “www”) and try again.",
 "Connexion Google annulée.": "Google sign-in cancelled.",
 "Google a refusé la connexion (configuration du serveur). Utilisez l'email en attendant.": "Google refused the sign-in (server configuration). Use email in the meantime.",
 "Touchez ♡ sur la page d'un événement pour le retrouver ici.": "Tap ♡ on an event page to find it here.",
 "🔗 Non répertorié": "🔗 Unlisted",
 "🔒 Privé": "🔒 Private",
 "🔓 Public": "🔓 Public",
 "Vous n'avez pas encore d'événement.": "You don't have any events yet.",
 "Créez le premier en quelques minutes !": "Create your first one in a few minutes!",
 "Code copié !": "Code copied!",
 "Lien avec code copié !": "Link with code copied!",
 "📨 Envoyée": "📨 Sent",
 "Choisissez la photo du faire-part ou une autre option.": "Choose the invitation photo or another option.",
 "Toutes les personnes ont été débloquées": "Everyone has been unblocked",
 "12 étapes maximum": "12 steps maximum",
 "Cérémonie à la mairie": "Civil ceremony",
 "Cérémonie religieuse": "Religious ceremony",
 "Vin d'honneur": "Reception drinks",
 "Dîner": "Dinner",
 "Soirée dansante": "Dancing party",
 "Accueil des invités": "Guests welcome",
 "Demande officielle": "Official proposal",
 "Soirée": "Party",
 "Accueil et apéritif": "Welcome and drinks",
 "Gâteau et bougies": "Cake and candles",
 "Cérémonie": "Ceremony",
 "Déjeuner": "Lunch",
 "Goûter": "Afternoon snack",
 "Apéritif": "Drinks",
 "Ouverture des cadeaux": "Opening the gifts",
 "Remise des diplômes": "Graduation ceremony",
 "Dîner de célébration": "Celebration dinner",
 "Copiez d'abord le lien de votre cagnotte, puis touchez « Coller ».": "First copy your money pot link, then tap “Paste”.",
 "déjà collectés": "already collected",
 "Aucune story pour l'instant.": "No stories yet.",
 "Pourquoi signalez-vous cet événement ?": "Why are you reporting this event?",
 "Merci, l'équipe MaFeliza va vérifier 🙏": "Thank you, the MaFeliza team will check 🙏",
 "❌ Ne vient pas": "❌ Not coming",
 "Super, à bientôt ! 🎉": "Great, see you soon! 🎉",
 "Réponse enregistrée": "Answer saved",
 "Dommage ! Réponse enregistrée": "Too bad! Answer saved",
 "À donner à vos invités pour entrer": "Give it to your guests to get in",
 "Permet de retrouver l'événement (Découvrir → code)": "Lets guests find the event (Discover → code)",
 "🎥 Code caméraman": "🎥 Camera operator code",
 "Pour la personne qui filme le live": "For the person filming the live",
 "Scannez pour suivre le live": "Scan to watch the live",
 "Scannez pour ouvrir l'événement": "Scan to open the event",
 "Texte enregistré ✓": "Text saved ✓",
 "Événement introuvable.": "Event not found.",
 "a partagé": "shared",
 "a écrit dans le livre d'or": "wrote in the guestbook",
 "Répondre": "Reply",
 "Votre réponse": "Your reply",
 "Enregistrement vocal non disponible sur ce navigateur.": "Voice recording isn't available on this browser.",
 "Micro refusé : autorisez-le pour enregistrer un vocal.": "Microphone blocked: allow it to record a voice message.",
 "Écrivez un message, ajoutez une photo, une vidéo ou un vocal.": "Write a message, add a photo, a video or a voice message.",
 "Événement privé": "Private event",
 "Accès par code": "Access by code",
 "Le replay n'est pas disponible pour le moment.": "The replay isn't available yet.",
 "Le replay a été supprimé par l'organisateur.": "The replay was deleted by the organizer.",
 "Le replay n'est plus disponible.": "The replay is no longer available.",
 "Merci d'avoir partagé ce moment !": "Thank you for sharing this moment!",
 "⏳ Préparation du zip…": "⏳ Preparing the zip…",
 "Replay téléchargé ✔": "Replay downloaded ✔",
 "Replay indisponible pour le moment": "Replay unavailable for now",
 "Replay retiré : vous seul le voyez": "Replay hidden: only you can see it",
 "Supprimer définitivement le replay ? Une copie (.zip) va d'abord être téléchargée sur votre appareil.": "Permanently delete the replay? A copy (.zip) will first be downloaded to your device.",
 "Impossible de préparer le zip du replay. Supprimer quand même ?": "Unable to prepare the replay zip. Delete anyway?",
 "Replay supprimé": "Replay deleted",
 "Quitter le plein écran": "Exit full screen",
 "Plein écran": "Full screen",
 "Invité": "Guest",
 "Une seule caméra pour ce direct 🎥": "Only one camera for this live 🎥",
 "Aucune caméra pour le moment": "No camera yet",
 "Ajoute-moi sur MaFeliza": "Add me on MaFeliza",
 "Personne débloquée": "Person unblocked",
 "Supprimer ce message ? Il disparaîtra aussi chez votre ami.": "Delete this message? It will also disappear for your friend.",
 "Message supprimé": "Message deleted",
 "Supprimer toute la conversation de votre côté ?": "Delete the whole conversation on your side?",
 "Conversation supprimée": "Conversation deleted",
 "Bloquer cette personne ? Elle ne pourra plus vous écrire.": "Block this person? They won't be able to write to you anymore.",
 "Profil momentanément indisponible, réessayez plus tard.": "Profile temporarily unavailable, try again later.",
 "Votre nom (affiché à vos amis) :": "Your name (shown to your friends):",
 "Nom enregistré": "Name saved",
 "Photo de profil mise à jour": "Profile photo updated",
 "Les cagnottes des événements que vous suivez apparaîtront ici.": "Money pots of the events you follow will appear here.",
 "Les vidéos partagées dans vos événements apparaîtront ici.": "Videos shared in your events will appear here.",
 "Cette action est définitive. Tapez SUPPRIMER pour confirmer.": "This action is final. Type SUPPRIMER to confirm.",
 "🔔 Notifications activées ✔": "🔔 Notifications enabled ✔",
 "Notifications activées 🔔": "Notifications enabled 🔔",
 "Mot de passe enregistré 🔒": "Password saved 🔒",
 "Mes cadeaux": "My gifts",
 "Mes vidéos": "My videos",
 "Favoris": "Favorites",
 "Participations": "Participations",
 "Événements": "Events",
 "Amis": "Friends"
});
// Morceaux de phrases contenant un nom ou un code (« Vous êtes invité·e à « X » ! »…), traduits sur place.
const FRAG = Object.entries({
 "🎁 Participez à la cagnotte de «": "🎁 Chip in to the money pot for “", "» ! Plus on est nombreux, plus le cadeau est beau 😄": "”! The more of us, the better the gift 😄",
 "Écrire à ": "Message ", " de mes amis": " from my friends", "Retirer ": "Remove ", "Vidéo de ": "Video by ",
 "💌 Vous êtes invité·e à «": "💌 You're invited to “",
 "Vous êtes invité·e à «": "You're invited to “",
 "» ! Code d'accès :": "”! Access code:",
 "Code d'accès :": "Access code:",
 "📺 Suivez «": "📺 Watch “",
 "🔴 Suivez «": "🔴 Watch “",
 "» en direct sur MaFeliza !": "” live on MaFeliza!",
 "» en direct ! Code d'accès :": "” live! Access code:",
 "» en direct !": "” live!",
 "🎥 Vous filmez «": "🎥 You're filming “",
 "» ! Ouvrez ce lien puis appuyez sur « Démarrer le live » (code :": "”! Open this link then tap “Start the live” (code:",
 "📸 Un beau moment de «": "📸 A lovely moment from “",
 "» sur MaFeliza": "” on MaFeliza",
 "Supprimer définitivement «": "Permanently delete “",
 "👋 Ajoute-moi en ami sur MaFeliza pour partager nos événements :": "👋 Add me as a friend on MaFeliza to share our events:",
 "Vidéo trop longue (": "Video too long (",
 "Archive créée (": "Archive created (",
 "Archive créée :": "Archive created:",
 "⏹ Arrêter (": "⏹ Stop (",
 "invitation(s) envoyée(s) ✉️": "invitation(s) sent ✉️",
 "· c'est aujourd'hui !": "· it's today!",
 "Caméraman —": "Camera operator —",
 "Vidéo de": "Video by",
 "Replay <b>en ligne</b>": "Replay <b>online</b>",
 ": vos invités peuvent le voir.": ": your guests can see it.",
 ": vous seul le voyez.": ": only you can see it.",
 "» !": "”!",
 "» ?": "”?"
}).sort((a, b) => b[0].length - a[0].length);

// Types d'événements, fenêtres et libellés restants.
Object.assign(EN, {"Mariage": "Wedding", "Anniversaire": "Birthday", "Baptême": "Baptism", "Communion": "Communion", "Fiançailles": "Engagement", "Baby shower": "Baby shower", "Remise de diplôme": "Graduation", "Retraite": "Retirement", "Inauguration": "Opening", "Autre": "Other", "💍 Mariage": "💍 Wedding", "🎂 Anniversaire": "🎂 Birthday", "🕊️ Baptême": "🕊️ Baptism", "🕯️ Communion": "🕯️ Communion", "💞 Fiançailles": "💞 Engagement", "🎓 Remise de diplôme": "🎓 Graduation", "🌴 Retraite": "🌴 Retirement", "🎀 Inauguration": "🎀 Opening", "🎉 Autre": "🎉 Other", "Texte proposé": "Suggested text", "✏️ Modifier le texte": "✏️ Edit the text", "🎁 Cagnotte": "🎁 Money pot", "Ouvrir à part ↗": "Open separately ↗", "Sur invitation": "By invitation", "🔒 Sur invitation": "🔒 By invitation", "📧 Une copie de ce code vient de vous être envoyée par email.": "📧 A copy of this code has just been emailed to you.", "Afficher le mot de passe": "Show password", "Rechercher un événement": "Search for an event", "Changer la photo": "Change photo", "Rien pour l'instant. Rejoignez un événement ou créez le vôtre !": "Nothing yet. Join an event or create your own!", "Code d'accès": "Access code", "Créer votre compte": "Create your account", "Nombre de personnes (vous compris)": "Number of people (including you)", "Ajouter une photo": "Add a photo", "Un code sera généré automatiquement à l'enregistrement.": "A code will be generated automatically when you save.", "Code caméraman :": "Camera operator code:", "Lien de la cagnotte": "Money pot link", "Que voulez-vous créer ?": "What do you want to create?", "Une story": "A story", "Un événement": "An event"});
Object.assign(EN, {"🔍 Rechercher : nom, ville, type…": "🔍 Search: name, city, type…", "Code d'invitation": "Invitation code", "● En direct": "● Live", "En direct": "Live", "Tous": "All", "— Nous utilisons des cookies indispensables au fonctionnement du site (connexion, accès aux événements privés) et, avec votre accord, des cookies de mesure d'audience.": "— We use cookies that are essential for the site to work (sign-in, access to private events) and, with your consent, audience measurement cookies.", "En savoir plus": "Learn more"});

Object.assign(EN, {"🎁 Créer ma cagnotte":"🎁 Create my money pot","Choisissez le service de cagnotte. Une fois la cagnotte créée,":"Choose the money pot service. Once the pot is created,","copiez son lien":"copy its link","puis touchez":"then tap",": il sera ajouté à votre événement.":": it will be added to your event.","Copiez le lien de votre cagnotte puis touchez « 📋 Coller ».":"Copy your money pot link then tap “📋 Paste”."});

export const lang = read(LANG_KEY) || (navigator.language?.startsWith("en") ? "en" : "fr");
// Le serveur lit la langue (emails dans la langue de l'utilisateur).
try { document.cookie = `em-lang=${lang}; path=/; max-age=31536000; SameSite=Lax`; } catch { /* cookies bloqués */ }
export const t = (fr) => (lang === "en" && EN[fr]) || fr;
// Traduction d'une phrase complète : exacte si possible, sinon morceau par morceau.
// Noms d'événements courants (« Mariage de Awa & Samuel », « Les 30 ans de Léo »…) : traduits par motif.
const NAME_RULES = [
  [/^Mariage de (.+)$/, "$1's wedding"], [/^Les (\d+) ans de (.+)$/, "$2's $1th birthday"], [/^Anniversaire de (.+)$/, "$1's birthday"],
  [/^Baptême de (.+)$/, "$1's baptism"], [/^Communion de (.+)$/, "$1's communion"], [/^Fiançailles de (.+)$/, "$1's engagement"],
  [/^Baby shower de (.+)$/, "$1's baby shower"], [/^Remise de diplôme de (.+)$/, "$1's graduation"], [/^Pot de retraite de (.+)$/, "$1's retirement party"],
  [/^Soirée de gala chez (.+)$/, "Gala evening at $1's"], [/^Inauguration (.+)$/, "$1 grand opening"], [/^Anniversaire de test \(album\)$/, "Test birthday (album)"],
];
Object.assign(EN, {"Ils se disent oui": "They're saying yes", "Joyeux anniversaire": "Happy birthday", "Un jour béni": "A blessed day", "Première communion": "First communion", "Ils se fiancent": "They're getting engaged", "Bébé arrive !": "Baby is coming!", "Félicitations !": "Congratulations!", "Bonne retraite !": "Happy retirement!", "Grande ouverture": "Grand opening", "Nous avons la joie de vous convier à notre mariage.": "We are delighted to invite you to our wedding.", "Venez fêter cette belle année avec nous !": "Come and celebrate this wonderful year with us!", "Nous serons heureux de vous accueillir pour le baptême.": "We will be happy to welcome you to the baptism.", "Partagez avec nous ce moment de foi.": "Share this moment of faith with us.", "Nous célébrons nos fiançailles.": "We are celebrating our engagement.", "Une douce fête pour accueillir bébé.": "A sweet party to welcome baby.", "Célébrons ensemble cette réussite.": "Let's celebrate this success together.", "Une nouvelle vie commence.": "A new life begins.", "Découvrez notre nouvel espace.": "Discover our new space.", "Une soirée inoubliable vous attend.": "An unforgettable evening awaits you.", "Nous avons la joie de vous convier à notre mariage, suivi d'un dîner et d'une soirée dansante.": "We are delighted to invite you to our wedding, followed by dinner and a dance party.", "Une belle soirée entre amis.": "A lovely evening with friends."});

export function tr(text) {
  if (lang !== "en" || !text) return text;
  const s = String(text);
  if (EN[s.trim()]) return s.replace(s.trim(), EN[s.trim()]);
  for (const [re, en] of NAME_RULES) if (re.test(s.trim())) return s.replace(s.trim(), s.trim().replace(re, en));
  let out = s;
  for (const [fr, en] of FRAG) if (out.includes(fr)) out = out.split(fr).join(en);
  return out.replace(/“\s+/g, "“").replace(/\s+”/g, "”"); // guillemets anglais sans espaces
}

// Traduit un nœud et ses descendants (textes et attributs usuels).
function translate(root) {
  if (lang !== "en") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const key = n.nodeValue.trim();
    if (key && EN[key]) n.nodeValue = n.nodeValue.replace(key, EN[key]);
    else if (key) { const v = tr(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
  }
  const els = root.querySelectorAll ? [...(root.matches?.("[placeholder],[aria-label],[title]") ? [root] : []), ...root.querySelectorAll("[placeholder],[aria-label],[title]")] : [];
  for (const el of els) {
    for (const attr of ["placeholder", "aria-label", "title"]) {
      const v = el.getAttribute(attr);
      const t = v && (EN[v.trim()] || tr(v));
      if (t && t !== v) el.setAttribute(attr, t);
    }
  }
}

if (lang === "en") {
  document.documentElement.lang = "en";
  // Pages rédigées dans les deux langues (pages légales) : on affiche la version anglaise.
  const swap = () => {
    document.querySelectorAll("[data-fr]").forEach((el) => { el.hidden = true; });
    document.querySelectorAll("[data-en]").forEach((el) => { el.hidden = false; });
  };
  document.body ? swap() : addEventListener("DOMContentLoaded", swap);
  // Fenêtres du navigateur (confirmations, questions) : traduites elles aussi.
  for (const fn of ["confirm", "alert", "prompt"]) {
    const orig = window[fn].bind(window);
    window[fn] = (msg, ...rest) => orig(tr(msg), ...rest);
  }
  const start = () => {
    translate(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) for (const node of m.addedNodes) {
        if (node.nodeType === 1) translate(node);
        else if (node.nodeType === 3) { const v = tr(node.nodeValue); if (v !== node.nodeValue) node.nodeValue = v; }
      }
      // Textes d'aide modifiés après coup (placeholder, aria-label, title) : traduits eux aussi.
      for (const m of muts) if (m.type === "attributes" && m.target.nodeType === 1) {
        const v = m.target.getAttribute(m.attributeName);
        const t = v && (EN[v.trim()] || tr(v));
        if (t && t !== v) m.target.setAttribute(m.attributeName, t);
      }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
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
