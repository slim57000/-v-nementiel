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
