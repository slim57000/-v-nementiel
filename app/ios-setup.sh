#!/bin/bash
# Prépare le projet iPhone (sur le Mac de GitHub) : création, identifiant, équipe Apple, autorisations, icônes.
# Variables attendues : IOS_BUNDLE_ID, APPLE_TEAM_ID.
set -euo pipefail
[ -d ios ] || flutter create --org fr.mafeliza --project-name mafeliza --platforms ios .

# Identifiant de l'app et équipe Apple (signature automatique)
PBX=ios/Runner.xcodeproj/project.pbxproj
sed -i '' "s/PRODUCT_BUNDLE_IDENTIFIER = fr\.mafeliza\.mafeliza;/PRODUCT_BUNDLE_IDENTIFIER = ${IOS_BUNDLE_ID}; DEVELOPMENT_TEAM = ${APPLE_TEAM_ID}; CODE_SIGN_STYLE = Automatic; CODE_SIGN_ENTITLEMENTS = Runner\/Runner.entitlements;/g" "$PBX"

# iOS 15 minimum (modules d'envoi en arrière-plan, connexion Google)
sed -i '' -E 's/IPHONEOS_DEPLOYMENT_TARGET = 1[0-4]\.[0-9]+;/IPHONEOS_DEPLOYMENT_TARGET = 15.0;/g' "$PBX"

# Autorisations « Sign in with Apple » et notifications push (activées sur l'identifiant de l'app par asc_signing.py)
cat > ios/Runner/Runner.entitlements <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.developer.applesignin</key>
  <array><string>Default</string></array>
  <key>aps-environment</key>
  <string>production</string>
  <key>com.apple.developer.associated-domains</key>
  <array><string>applinks:mafeliza.com</string></array>
</dict>
</plist>
XML

# Notifications push (APNs) : code natif ajouté à AppDelegate.swift (une seule fois). Canal « mafeliza/push » :
#   register → demande l'autorisation, renvoie l'adresse d'une notification touchée au lancement ;
#   token / open → envoyés à l'appli Flutter (jeton de l'appareil, notification touchée).
AD=ios/Runner/AppDelegate.swift
if ! grep -q "MaFelizaPush" "$AD"; then
  # Enregistrement à côté des modules Flutter (style classique « with: self » ou moteur implicite récent).
  sed -i '' -E 's/^([[:space:]]*)GeneratedPluginRegistrant\.register\(with: ([A-Za-z.]+)\)/&\
\1MaFelizaPush.register(with: \2.registrar(forPlugin: "MaFelizaPush")!)/' "$AD"
  grep -q 'MaFelizaPush.register' "$AD" || { echo "AppDelegate.swift : enregistrement des notifications impossible"; cat "$AD"; exit 1; }
  sed -i '' '1s/^/import UserNotifications\
import WebKit\
/' "$AD"
  cat >> "$AD" <<'SWIFT'

// Notifications push MaFeliza (APNs). Le jeton de l'appareil est transmis au site par l'appli Flutter.
class MaFelizaPush: NSObject, FlutterPlugin, UNUserNotificationCenterDelegate {
  static let shared = MaFelizaPush()
  static var channel: FlutterMethodChannel?
  static var ready = false
  static var pendingUrl: String?

  static func register(with registrar: FlutterPluginRegistrar) {
    let ch = FlutterMethodChannel(name: "mafeliza/push", binaryMessenger: registrar.messenger())
    channel = ch
    registrar.addMethodCallDelegate(shared, channel: ch)
    registrar.addApplicationDelegate(shared)
    UNUserNotificationCenter.current().delegate = shared
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    // Notification locale immédiate (ex. caméraman : « le live est en pause, revenez dans MaFeliza »).
    if call.method == "localNotify", let a = call.arguments as? [String: Any] {
      let c = UNMutableNotificationContent()
      c.title = a["title"] as? String ?? "MaFeliza"
      c.body = a["body"] as? String ?? ""
      c.sound = .default
      UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "mafeliza-local", content: c, trigger: nil))
      return result(nil)
    }
    // Impression de la page affichée (affiches QR) : fenêtre d'impression iOS (AirPrint, PDF).
    if call.method == "print" {
      func find(_ v: UIView) -> WKWebView? { if let w = v as? WKWebView { return w }; for s in v.subviews { if let w = find(s) { return w } }; return nil }
      let root = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first
      if let web = root.flatMap({ find($0) }) {
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .general
        info.jobName = ((call.arguments as? [String: Any])?["title"] as? String) ?? "MaFeliza"
        let pc = UIPrintInteractionController.shared
        pc.printInfo = info
        pc.printFormatter = web.viewPrintFormatter()
        pc.present(animated: true)
      }
      return result(nil)
    }
    guard call.method == "register" else { return result(FlutterMethodNotImplemented) }
    MaFelizaPush.ready = true
    let openSettings = ((call.arguments as? [String: Any])?["settings"] as? Bool) ?? false
    let center = UNUserNotificationCenter.current()
    center.getNotificationSettings { settings in
      if settings.authorizationStatus == .denied {
        if openSettings, let url = URL(string: UIApplication.openSettingsURLString) {
          DispatchQueue.main.async { UIApplication.shared.open(url) }
        }
        return
      }
      center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
        if granted { DispatchQueue.main.async { UIApplication.shared.registerForRemoteNotifications() } }
      }
    }
    result(MaFelizaPush.pendingUrl)
    MaFelizaPush.pendingUrl = nil
  }

  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    MaFelizaPush.channel?.invokeMethod("token", arguments: deviceToken.map { String(format: "%02x", $0) }.joined())
  }

  // Application ouverte : la notification s'affiche quand même en bannière.
  func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                              withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    completionHandler([.banner, .list, .sound])
  }

  // Notification touchée : ouvre la page concernée (message, événement, live…).
  func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                              withCompletionHandler completionHandler: @escaping () -> Void) {
    if let url = response.notification.request.content.userInfo["url"] as? String {
      if MaFelizaPush.ready, let ch = MaFelizaPush.channel { ch.invokeMethod("open", arguments: url) }
      else { MaFelizaPush.pendingUrl = url }
    }
    completionHandler()
  }
}
SWIFT
fi

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
# Liens mafeliza.com ouverts dans l'appli : reçus par le module app_links (pas par le routage de Flutter)
set_plist FlutterDeepLinkingEnabled bool false
# Langues de l'appli (affichées sur l'App Store) : les 15 langues du site, français par défaut.
set_plist CFBundleDevelopmentRegion string "fr"
/usr/libexec/PlistBuddy -c "Delete :CFBundleLocalizations" "$PL" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations array" "$PL"
for L in fr en de es it pt nl pl ro ru uk tr ar hi zh-Hans; do
  /usr/libexec/PlistBuddy -c "Add :CFBundleLocalizations: string $L" "$PL"
done
# Connexion Google native : identifiant OAuth « iOS » (variable GitHub GOOGLE_IOS_CLIENT_ID) et son adresse de retour.
# Sans cette variable, l'appli garde la connexion Google par le navigateur.
if [ -n "${GOOGLE_IOS_CLIENT_ID:-}" ]; then
  set_plist GIDClientID string "$GOOGLE_IOS_CLIENT_ID"
  REV="com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID%.apps.googleusercontent.com}"
  /usr/libexec/PlistBuddy -c "Delete :CFBundleURLTypes" "$PL" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" -c "Add :CFBundleURLTypes:0 dict" \
    -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $REV" "$PL"
fi
set_plist ITSAppUsesNonExemptEncryption bool false

# Dossiers de langue (fr.lproj, de.lproj…) : c'est ce que l'App Store lit pour afficher les 15 langues de la fiche.
LANGS="fr en de es it pt nl pl ro ru uk tr ar hi zh-Hans"
for L in $LANGS; do mkdir -p "ios/Runner/$L.lproj"; printf '"CFBundleDisplayName" = "MaFeliza";\n' > "ios/Runner/$L.lproj/InfoPlist.strings"; done
cat > /tmp/lproj.rb <<'RUBY'
require "xcodeproj"
langs = ARGV
p = Xcodeproj::Project.open("ios/Runner.xcodeproj")
t = p.targets.find { |x| x.name == "Runner" }
g = p.main_group["Runner"]
unless g.children.any? { |c| c.display_name == "InfoPlist.strings" }
  vg = g.new_variant_group("InfoPlist.strings")
  langs.each { |l| r = vg.new_reference("#{l}.lproj/InfoPlist.strings"); r.name = l; r.last_known_file_type = "text.plist.strings" }
  t.resources_build_phase.add_file_reference(vg)
end
p.root_object.known_regions = (p.root_object.known_regions + langs).uniq
p.save
puts "Langues de l'appli : #{langs.join(', ')}"
RUBY
gem list -i xcodeproj >/dev/null 2>&1 || gem install xcodeproj --user-install --no-document || true
ruby /tmp/lproj.rb $LANGS || echo "Langues : étape ignorée (xcodeproj indisponible)"

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
