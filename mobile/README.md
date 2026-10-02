# Applications iOS et Android — MaFeliza

Les applications sont construites avec **Capacitor 7**. Elles affichent la plateforme en ligne
(`server.url` dans `capacitor.config.json`) : toute mise à jour du site est immédiatement visible
dans les applications, sans republier sur les stores.

## Avant la première compilation

1. Dans `capacitor.config.json`, remplacer `https://evenementieldev.vercel.app` par le domaine
   définitif (dans `server.url` et `server.allowNavigation`).
2. `cd mobile && npm install && npx cap sync`

## Android (Google Play)

Prérequis : [Android Studio](https://developer.android.com/studio) (Windows, Mac ou Linux).

1. `npx cap open android` (ouvre le projet dans Android Studio).
2. **Build → Generate Signed App Bundle** → créer une clé de signature (à conserver précieusement).
3. Envoyer le fichier `.aab` dans la [Google Play Console](https://play.google.com/console)
   (compte développeur : 25 $ une fois).

## iOS (App Store)

Prérequis : un **Mac avec Xcode 16** et un compte **Apple Developer** (99 $/an).
Sans Mac, un service de compilation en ligne comme **Codemagic** permet de compiler et d'envoyer l'application.

1. `npx cap open ios` (ouvre le projet dans Xcode).
2. Cible **App** → *Signing & Capabilities* → choisir l'équipe (Team) du compte Apple Developer.
3. **Product → Archive** puis **Distribute App → App Store Connect**.

## Fiche des stores — éléments à préparer

- Nom : MaFeliza — identifiant : `com.mafeliza.app`
- Politique de confidentialité : `https://<domaine>/confidentialite`
- Suppression de compte : disponible dans l'application (Profil → Supprimer mon compte)
- **Compte de démonstration** pour les équipes de validation (email + code organisateur)
- Captures d'écran (iPhone 6,7" et 6,5", Android) et description

## Contenu

| Dossier / fichier | Rôle |
|---|---|
| `capacitor.config.json` | Nom, identifiant, URL de la plateforme, écran de démarrage |
| `android/` | Projet Android Studio (icônes et écrans de démarrage générés depuis le logo) |
| `ios/` | Projet Xcode (Swift Package Manager, autorisations appareil photo / micro / photos) |
| `www/` | Page affichée si la plateforme est injoignable (hors connexion) |


## Fonctions natives (validation App Store / Google Play)

L'application n'est pas un simple site affiché : elle utilise les fonctions du téléphone
(`public/js/native.js`, actif seulement dans l'application) :

- **Notifications push natives** : messages, réponses, rappels, début des lives. Toucher la notification ouvre la bonne page.
- **Partage natif** : feuille de partage iOS / Android (WhatsApp, SMS, AirDrop…).
- **Bouton retour Android** et **liens profonds** (un lien mafeliza.com s'ouvre dans l'application).
- **Hors connexion** : bandeau « Pas de connexion internet », rechargement automatique au retour du réseau.
- **Vibrations légères** sur les actions (j'aime, réactions, boutons).
- Appareil photo, micro et photos (live, stories, livre d'or) avec textes d'autorisation en français.

### Activer les notifications push

**iPhone (APNs)**
1. Xcode → cible **App** → *Signing & Capabilities* → **+ Capability** → **Push Notifications**
   (et **Background Modes** → cocher *Remote notifications*, déjà déclaré dans Info.plist).
2. [developer.apple.com](https://developer.apple.com/account/resources/authkeys/list) → **Keys** → **+** →
   cocher *Apple Push Notifications service (APNs)* → télécharger le fichier `.p8`.
3. Variables Vercel : `APNS_KEY` (contenu du .p8), `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_TOPIC` = `com.mafeliza.app`.

**Android (Firebase)**
1. [console.firebase.google.com](https://console.firebase.google.com) → créer le projet → ajouter une app Android
   `com.mafeliza.app` → télécharger `google-services.json` dans `mobile/android/app/`.
2. Paramètres du projet → **Comptes de service** → *Générer une clé privée* (fichier JSON).
3. Variable Vercel : `FCM_SERVICE_ACCOUNT` = contenu de ce fichier JSON.

Après chaque modification de `mobile/` : `cd mobile && npm install && npx cap sync`.

### Conseils pour la validation Apple

- Fournir un **compte de démonstration** (email + mot de passe) avec un événement contenant photos et un replay.
- Les achats éventuels (Premium) doivent passer par l'**achat intégré Apple** dans l'application iPhone
  (guideline 3.1.1) : sinon masquer l'offre Premium dans l'application.
- La suppression de compte est disponible (Profil → Mes données → Supprimer mon compte).
