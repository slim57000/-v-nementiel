# Journal des modifications — MaFeliza

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
