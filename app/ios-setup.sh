#!/bin/bash
# Prépare le projet iPhone (sur le Mac de GitHub) : création, identifiant, équipe Apple, autorisations, icônes.
# Variables attendues : IOS_BUNDLE_ID, APPLE_TEAM_ID.
set -euo pipefail
[ -d ios ] || flutter create --org fr.mafeliza --project-name mafeliza --platforms ios .

# Identifiant de l'app et équipe Apple (signature automatique)
PBX=ios/Runner.xcodeproj/project.pbxproj
sed -i '' "s/PRODUCT_BUNDLE_IDENTIFIER = fr\.mafeliza\.mafeliza;/PRODUCT_BUNDLE_IDENTIFIER = ${IOS_BUNDLE_ID}; DEVELOPMENT_TEAM = ${APPLE_TEAM_ID}; CODE_SIGN_STYLE = Automatic;/g" "$PBX"

# Textes des autorisations, nom affiché, pas de chiffrement spécial (évite la question d'export à chaque build)
PL=ios/Runner/Info.plist
set_plist() { /usr/libexec/PlistBuddy -c "Delete :$1" "$PL" 2>/dev/null || true; /usr/libexec/PlistBuddy -c "Add :$1 $2 $3" "$PL"; }
set_plist NSCameraUsageDescription string "MaFeliza utilise l'appareil photo pour le live et les photos de l'événement."
set_plist NSMicrophoneUsageDescription string "MaFeliza utilise le micro pour le live et les messages vocaux."
set_plist NSPhotoLibraryUsageDescription string "MaFeliza accède à vos photos pour les partager avec les invités."
set_plist NSPhotoLibraryAddUsageDescription string "MaFeliza enregistre les photos et vidéos de l'événement dans votre galerie."
# Textes exigés par Apple car le module d'autorisations référence ces fonctions (non utilisées par MaFeliza)
set_plist NSLocationWhenInUseUsageDescription string "MaFeliza n'utilise votre position que si vous choisissez d'ouvrir l'itinéraire vers le lieu de l'événement."
set_plist NSLocationAlwaysAndWhenInUseUsageDescription string "MaFeliza n'utilise pas votre position en arrière-plan."
set_plist NSContactsUsageDescription string "MaFeliza peut vous proposer d'inviter vos contacts à un événement."
set_plist NSCalendarsUsageDescription string "MaFeliza peut ajouter la date de l'événement à votre calendrier."
set_plist NSCalendarsFullAccessUsageDescription string "MaFeliza peut ajouter la date de l'événement à votre calendrier."
set_plist NSRemindersUsageDescription string "MaFeliza peut créer un rappel pour l'événement."
set_plist NSBluetoothAlwaysUsageDescription string "MaFeliza peut utiliser un micro ou des écouteurs Bluetooth pendant le live."
set_plist NSSpeechRecognitionUsageDescription string "MaFeliza n'utilise pas la reconnaissance vocale."
set_plist NSMotionUsageDescription string "MaFeliza n'utilise pas les capteurs de mouvement."
set_plist NSAppleMusicUsageDescription string "MaFeliza n'accède pas à votre bibliothèque musicale."
set_plist CFBundleDisplayName string "MaFeliza"
set_plist ITSAppUsesNonExemptEncryption bool false

flutter pub get
# Icône et écran de démarrage pour iPhone seulement (le dossier android/ n'existe pas sur ce Mac)
cat > /tmp/icons-ios.yaml <<YAML
flutter_launcher_icons:
  android: false
  ios: true
  image_path: "assets/icon.png"
  remove_alpha_ios: true
YAML
cat > /tmp/splash-ios.yaml <<YAML
flutter_native_splash:
  color: "#ffffff"
  image: assets/icon.png
  android: false
  ios: true
  web: false
YAML
dart run flutter_launcher_icons -f /tmp/icons-ios.yaml
dart run flutter_native_splash:create --path=/tmp/splash-ios.yaml

# Les modules iPhone passent par Swift Package Manager (Flutter récent) : pas de Podfile à créer ni modifier.
flutter build ios --config-only --release
