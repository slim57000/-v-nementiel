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
set_plist CFBundleDisplayName string "MaFeliza"
set_plist ITSAppUsesNonExemptEncryption bool false

flutter pub get
dart run flutter_launcher_icons
dart run flutter_native_splash:create

# Podfile : iOS 13 minimum et autorisations activées pour permission_handler
flutter build ios --config-only --release
POD=ios/Podfile
sed -i '' "s/^# *platform :ios.*/platform :ios, '13.0'/" "$POD"
grep -q "PERMISSION_CAMERA" "$POD" || perl -0pi -e "s/flutter_additional_ios_build_settings\(target\)/flutter_additional_ios_build_settings(target)\n    target.build_configurations.each do |config|\n      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['\\\$(inherited)', 'PERMISSION_CAMERA=1', 'PERMISSION_MICROPHONE=1', 'PERMISSION_PHOTOS=1', 'PERMISSION_NOTIFICATIONS=1']\n    end/" "$POD"
