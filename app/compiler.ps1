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

# 5. Firebase (notifications Android) : google-services.json du projet Firebase, copié à la main dans ce dossier
if (-not (Test-Path "google-services.json") -and (Test-Path "$HOME\Desktop\mafeliza-app\google-services.json")) {
  Copy-Item "$HOME\Desktop\mafeliza-app\google-services.json" "google-services.json"
}
if (Test-Path "google-services.json") {
  Copy-Item google-services.json android/app/google-services.json -Force

  # 5 bis. Module Firebase Messaging (Gradle) : déclaré une seule fois (repère « MaFeliza-push »)
  $settings = "android/settings.gradle.kts"
  if ((Test-Path $settings) -and ((Get-Content $settings -Raw) -notmatch "google-services")) {
    $t = Get-Content $settings -Raw
    $t = [regex]::Replace($t, '(?m)^plugins \{', "plugins {`n    id(`"com.google.gms.google-services`") version `"4.4.2`" apply false")
    Set-Content $settings $t -Encoding UTF8
  }
  $app = "android/app/build.gradle.kts"
  if ((Test-Path $app) -and ((Get-Content $app -Raw) -notmatch "MaFeliza-push")) {
    $t = Get-Content $app -Raw
    $t = [regex]::Replace($t, '(?m)^plugins \{', "plugins {`n    id(`"com.google.gms.google-services`")")
    $t += @"

// MaFeliza-push : notifications Firebase
dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")
}
"@
    Set-Content $app $t -Encoding UTF8
  }

  # 5 ter. Code natif : MainActivity (canal « mafeliza/push ») + service de réception des notifications
  $main = Get-ChildItem android/app/src/main -Recurse -Filter MainActivity.kt | Select-Object -First 1
  $pkg = ([regex]::Match((Get-Content $main.FullName -Raw), 'package\s+([\w.]+)')).Groups[1].Value
  @"
package $pkg

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import com.google.firebase.messaging.FirebaseMessaging
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

// Notifications push MaFeliza : jeton Firebase envoyé à l'appli Flutter, notification touchée -> page du site.
class MainActivity : FlutterActivity() {
    companion object {
        var channel: MethodChannel? = null
        var ready = false
        var pendingUrl: String? = null
        fun createChannel(ctx: android.content.Context) {
            if (Build.VERSION.SDK_INT >= 26) {
                ctx.getSystemService(NotificationManager::class.java)
                    .createNotificationChannel(NotificationChannel("mafeliza", "MaFeliza", NotificationManager.IMPORTANCE_HIGH))
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createChannel(this)
        intent?.getStringExtra("url")?.let { pendingUrl = it }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val ch = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "mafeliza/push")
        channel = ch
        ch.setMethodCallHandler { call, result ->
            if (call.method == "register") {
                ready = true
                FirebaseMessaging.getInstance().token.addOnSuccessListener { t -> ch.invokeMethod("token", t) }
                result.success(pendingUrl)
                pendingUrl = null
            } else result.notImplemented()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val url = intent.getStringExtra("url") ?: return
        if (ready) channel?.invokeMethod("open", url) else pendingUrl = url
    }
}
"@ | Set-Content $main.FullName -Encoding UTF8
  @"
package $pkg

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

// Notification reçue appli ouverte (sinon Android l'affiche lui-même) et nouveau jeton Firebase.
class PushService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        Handler(Looper.getMainLooper()).post { MainActivity.channel?.invokeMethod("token", token) }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val n = message.notification ?: return
        val url = message.data["url"] ?: "/"
        MainActivity.createChannel(this)
        val open = Intent(this, MainActivity::class.java).putExtra("url", url)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = PendingIntent.getActivity(this, url.hashCode(), open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        @Suppress("DEPRECATION")
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "mafeliza") else Notification.Builder(this)
        b.setSmallIcon(applicationInfo.icon).setContentTitle(n.title).setContentText(n.body)
            .setStyle(Notification.BigTextStyle().bigText(n.body)).setAutoCancel(true).setContentIntent(pi)
        getSystemService(NotificationManager::class.java).notify(url.hashCode(), b.build())
    }
}
"@ | Set-Content (Join-Path $main.DirectoryName "PushService.kt") -Encoding UTF8

  # Service déclaré dans le manifeste + canal par défaut des notifications Firebase
  $m = "android/app/src/main/AndroidManifest.xml"
  $x = Get-Content $m -Raw
  if ($x -notmatch "PushService") {
    $svc = @"
        <service android:name=".PushService" android:exported="false">
            <intent-filter><action android:name="com.google.firebase.MESSAGING_EVENT"/></intent-filter>
        </service>
        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="mafeliza"/>
    </application>
"@
    $x = $x -replace '</application>', $svc
    Set-Content $m $x -Encoding UTF8
  }
}

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
