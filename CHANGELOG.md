# Journal des modifications — MaFeliza

## Version 1.8 — Corrections
- **Espace caméraman et liste d'amis** : le caméraman qui saisit son code avant de se connecter (ou qui crée son compte ensuite) apparaît enfin dans les amis de l'organisateur, et l'événement compte dans ses participations.
- **Espace caméraman accessible à tout le monde** : un code erronné saisi à la main n'était pas décompté du quota, ce qui bloquait ensuite le bon code pendant 15 minutes pour toute la maison (même adresse IP) ; le quota ne compte plus que les échecs et reste partagé entre les instances.

## Version 1.7 — Partager et revivre
- **Replay du live téléphone** : le direct est enregistré automatiquement (morceaux de 4 min envoyés au fur et à mesure) ; dès l'arrêt, les invités le revoient sur la page du live pendant 15 jours.
- **Devenir amis simplement** : « ➕ Ajouter un ami » dans Messages, un lien personnel à envoyer (un clic et c'est fait) ou un code ami à 6 caractères.
- **Republier** : bouton « ↗ Partager » sur chaque publication du fil, « ▶ Revoir le live » sur les événements passés.

## Version 1.6 — Rapidité
- Chargement plus rapide : préchargement des scripts communs, cache navigateur des photos, CSS et bibliothèques, photos allégées (-30 %).
- Recherche d'événements (nom, ville, type), filtres et accès par code dans Découvrir.
- Rappel des codes d'invitation et caméraman juste après la création d'un événement.
- Images des événements variées (26 couvertures différentes).
- Bouton ‹ Retour sur toutes les pages secondaires.

## Version 1.5 — Simplicité
- Live : bouton « 🔴 Lancer le live » sur le tableau de bord, mode d'emploi YouTube pas à pas et bouton « 📋 Coller le lien » ; live en un clic depuis le téléphone via LiveKit (offre gratuite) à la place de Cloudflare ; YouTube / Twitch restent possibles.
- Bouton + : « Que voulez-vous créer ? » (story ou événement).
- Cloche 🔔 de notifications dans le site, notifications push sans configuration.
- ❤️ Mes favoris en haut de l'accueil.
- Faire-part : texte modifiable, texte « En petit comité », textes et dates en anglais.
- Connexion par email et mot de passe (mémorisable par le téléphone), mot de passe oublié.

## Version 1.4 — Live et marque
- **Nouvelle identité MaFeliza** : logo, couleurs (rose, orange, violet), nom avec « i » en dégradé, slogan en page d'accueil, icônes et écrans de démarrage des applications (`com.mafeliza.app`).
- **Partage du live** par le caméraman aux invités (lien, et code si l'événement est privé).
- **Cartes des lives** : image tirée du direct en cours, aperçu vidéo en restant appuyé.
- **Stories temporaires** façon Instagram (photo ou vidéo + légende, 24 h, lecteur plein écran).
- **Aucun paiement sur le site** : réactions gratuites, l'argent passe uniquement par la cagnotte externe.
- **Connexion Facebook** (en plus de Google).
- Mentions légales (éditeur anonyme), dates des pages légales, contact@mafeliza.com.
- Tableau de bord : boutons d'un événement regroupés (Partager & inviter, Souvenirs, Modifier / Supprimer).

## Version 1.3 — Administration et sécurité
- Nommer / retirer des administrateurs (réservé aux administrateurs principaux), journal des actions, limite d'actions.
- En-têtes de sécurité HTTP, API sans cache, anti-bruteforce partagé en base, code de connexion temporaire par email.
- Messages privés et chat sans doublons (envoi unique, 1 message / seconde).
- Outils de test dans l'administration : messages privés, faire-part et album souvenir de test.
- Vercel Web Analytics (sans cookie).

## Version 1.2 — Fonctionnalités avancées
- Notifications push (messages, livre d'or, réponses, live du jour, veille de l'événement).
- Temps réel pour le chat du live et les messages privés (Supabase Realtime).
- Invitations par email et SMS avec suivi (envoyée / vue / a rejoint), rappel aux invités la veille.
- Statistiques par événement, offre Premium (replay 30 jours, sans marque), album souvenir imprimable / PDF.
- Fil d'actualité façon Instagram, onglet « Mes vidéos », export zip des souvenirs.
- Livre d'or : filtres Vidéos et Favoris, réponses aux messages.
- Photos en WebP, accessibilité, tests automatiques (GitHub Actions), suivi des erreurs (Sentry).

## Version 1.1 — Finitions
- Connexion avec Google.
- Événements de démonstration (création automatique, suppression en un clic).
- Photos haute définition par type d'événement, badges LIVE, page 404, application installable (PWA).
- Nombreux ajustements de mise en page mobile (centrage, débordements, mode sombre).

## Version 1.0 — Plateforme
- Création d'événement (10 types), faire-part en 4 styles (dont celui du live), QR code, codes invités et caméraman.
- Page événement : compte à rebours, cagnotte, livre d'or multimédia, favoris, accès public / privé.
- Live multicaméra (YouTube / Twitch), chat, réactions, spectateurs, replay 15 jours.
- Espace caméraman, profil, amis, messages privés, blocage, Découvrir.
- Administration, pages légales, cookies, français / anglais, mode sombre.
- Applications iOS et Android (Capacitor).
