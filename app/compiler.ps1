# Compile l'application Android MaFeliza (Flutter) — à lancer dans ce dossier :
#   powershell -ExecutionPolicy Bypass -File .\compiler.ps1
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
flutter build apk --release

Write-Host ""
Write-Host "Application prete : build\app\outputs\flutter-apk\app-release.apk" -ForegroundColor Green
