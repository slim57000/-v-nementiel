# Compile l'application Android MaFeliza (Flutter) — à lancer dans ce dossier :
#   powershell -ExecutionPolicy Bypass -File .\compiler.ps1           -> APK à installer sur un téléphone
#   powershell -ExecutionPolicy Bypass -File .\compiler.ps1 -Bundle   -> fichier .aab signé pour le Play Store
param([switch]$Bundle)
$ErrorActionPreference = "Stop"

# 1. Dossiers Android / iOS (une seule fois)
if (-not (Test-Path "android")) {
  flutter create --org fr.mafeliza --project-name mafeliza --platforms android,ios .
}

# 2. Identifiant de l'application : fr.mafeliza.app (celui du projet Firebase)
foreach ($f in @("android/app/build.gradle.kts", "android/app/build.gradle")) {
  if (Test-Path $f) {
    (Get-Content $f -Raw) -replace 'applicationId\s*=?\s*"fr\.mafeliza\.mafeliza"', 'applicationId = "fr.mafeliza.app"' -replace 'minSdk\s*=\s*flutter\.minSdkVersion', 'minSdk = 23' | Set-Content $f -Encoding UTF8
  }
}

# 2 bis. SDK Android 36 pour l'application et tous les modules (file_picker était compilé en 34)
foreach ($f in @("android/app/build.gradle.kts", "android/app/build.gradle")) {
  if (Test-Path $f) {
    (Get-Content $f -Raw) -replace 'compileSdk\s*=\s*flutter\.compileSdkVersion', 'compileSdk = 36' -replace 'compileSdkVersion\s+flutter\.compileSdkVersion', 'compileSdkVersion 36' | Set-Content $f -Encoding UTF8
  }
}
# Nettoyage : anciens blocs « MaFeliza-SDK36 » retirés (refusés par Gradle). file_picker 10 suit désormais
# le SDK de Flutter, plus besoin de forcer les modules.
foreach ($root in @("android/build.gradle.kts", "android/build.gradle")) {
  if (Test-Path $root) {
    $t = Get-Content $root -Raw
    $t = [regex]::Replace($t, '(?s)\r?\n// MaFeliza-SDK36b? .*?\r?\n}\r?\n', "`n")
    Set-Content $root $t -Encoding UTF8
  }
}

# 3. Autorisations Android (internet, caméra, micro, notifications) et nom affiché
$m = "android/app/src/main/AndroidManifest.xml"
$x = Get-Content $m -Raw
if ($x -notmatch "android.permission.CAMERA") {
  $perms = @"
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.CAMERA"/>
    <uses-permission android:name="android.permission.RECORD_AUDIO"/>
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
    <application
"@
  $x = $x -replace '<application', $perms
  $x = $x -replace 'android:label="mafeliza"', 'android:label="MaFeliza"'
  Set-Content $m $x -Encoding UTF8
}

# 4. Autorisations iPhone (textes affichés par iOS)
$p = "ios/Runner/Info.plist"
$y = Get-Content $p -Raw
if ($y -notmatch "NSCameraUsageDescription") {
  $keys = @"
<dict>
	<key>NSCameraUsageDescription</key>
	<string>MaFeliza utilise l'appareil photo pour le live et les photos de l'événement.</string>
	<key>NSMicrophoneUsageDescription</key>
	<string>MaFeliza utilise le micro pour le live et les messages vocaux.</string>
	<key>NSPhotoLibraryUsageDescription</key>
	<string>MaFeliza accède à vos photos pour les partager avec les invités.</string>
"@
  $y = $y -replace '<dict>', $keys
  $y = $y -replace '<string>Mafeliza</string>', '<string>MaFeliza</string>'
  Set-Content $p $y -Encoding UTF8
}

# 5. Firebase (notifications Android)
# (facultatif pour l'instant : les notifications Firebase ne sont pas encore branchées dans l'app)
if (-not (Test-Path "google-services.json") -and (Test-Path "$HOME\Desktop\mafeliza-app\google-services.json")) {
  Copy-Item "$HOME\Desktop\mafeliza-app\google-services.json" "google-services.json"
}
if (Test-Path "google-services.json") { Copy-Item google-services.json android/app/google-services.json -Force }

# 6. Dépendances, icône, écran de démarrage, compilation
flutter pub get
dart run flutter_launcher_icons
dart run flutter_native_splash:create
if (-not $Bundle) {
  flutter build apk --release
  Write-Host ""
  Write-Host "Application prete : build\app\outputs\flutter-apk\app-release.apk" -ForegroundColor Green
  exit 0
}

# 7. Play Store : clé de signature (« upload key »), créée une seule fois et gardée HORS du projet.
$ks = "$HOME\mafeliza-upload.jks"
$props = "android/key.properties"
if (-not (Test-Path $props)) {
  $keytool = (Get-Command keytool -ErrorAction SilentlyContinue).Source
  if (-not $keytool) { $keytool = @("$env:JAVA_HOME\bin\keytool.exe", "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1 }
  if (-not $keytool) { throw "keytool introuvable : installez Android Studio." }
  $pw = Read-Host "Choisissez un mot de passe pour la cle Play Store (6 caracteres min., a NOTER)"
  if (-not (Test-Path $ks)) {
    & $keytool -genkeypair -v -keystore $ks -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 -alias upload `
      -storepass $pw -keypass $pw -dname "CN=MaFeliza, O=MaFeliza, C=FR"
  }
  @"
storePassword=$pw
keyPassword=$pw
keyAlias=upload
storeFile=$($ks -replace '\\','/')
"@ | Set-Content $props -Encoding ASCII
}

# Signature « release » branchée sur cette clé (au lieu de la clé de débogage refusée par Google)
$g = "android/app/build.gradle.kts"
$t = Get-Content $g -Raw
if ($t -notmatch "keystoreProperties") {
  $t = @"
import java.util.Properties
import java.io.FileInputStream

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) keystoreProperties.load(FileInputStream(keystorePropertiesFile))

"@ + $t
  $t = $t -replace '(\n\s*)buildTypes \{', @"
`$1signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
        }
    }
`$1buildTypes {
"@
  $t = $t -replace 'signingConfig = signingConfigs\.getByName\("debug"\)', 'signingConfig = signingConfigs.getByName("release")'
  Set-Content $g $t -Encoding UTF8
}

flutter build appbundle --release
Write-Host ""
Write-Host "Fichier Play Store pret : build\app\outputs\bundle\release\app-release.aab" -ForegroundColor Green
Write-Host "IMPORTANT : sauvegardez $ks et son mot de passe (necessaires pour chaque mise a jour)." -ForegroundColor Yellow
