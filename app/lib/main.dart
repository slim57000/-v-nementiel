// MaFeliza — application iPhone / Android (Flutter).
// Affiche la plateforme en ligne (mafeliza.com) : toute mise à jour du site est visible
// immédiatement, sans republier sur les stores. Fonctions du téléphone : appareil photo et micro
// (live, stories), bouton retour Android, liens externes (WhatsApp, cagnotte…) ouverts hors de
// l'application, écran hors connexion, connexions Apple (iPhone) et Google natives, notifications push
// (APNs sur iPhone, Firebase sur Android : code natif ajouté par ios-setup.sh et compiler.ps1).
import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

const site = 'https://mafeliza.com';
const pink = Color(0xFFE8137A);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);
  runApp(const MaFelizaApp());
}

class MaFelizaApp extends StatelessWidget {
  const MaFelizaApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'MaFeliza',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorSchemeSeed: pink, useMaterial3: true),
        home: const HomePage(),
      );
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late final WebViewController _web;
  bool _loading = true;
  bool _offline = false;

  // Notifications push : canal vers le code natif (jeton de l'appareil, notification touchée).
  static const _push = MethodChannel('mafeliza/push');
  String? _pushToken;
  DateTime _pushSent = DateTime(2000);

  @override
  void initState() {
    super.initState();
    // Paramètres propres à iOS : vidéo dans la page (live) et lecture sans geste.
    final params = WebViewPlatform.instance is WebKitWebViewPlatform
        ? WebKitWebViewControllerCreationParams(allowsInlineMediaPlayback: true, mediaTypesRequiringUserAction: const {})
        : const PlatformWebViewControllerCreationParams();

    _web = WebViewController.fromPlatformCreationParams(
      params,
      // Le site demande la caméra / le micro (live, livre d'or vocal) : on accorde après autorisation du système.
      onPermissionRequest: (request) async {
        await [Permission.camera, Permission.microphone].request();
        request.grant();
      },
    )
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (_) => setState(() => _loading = true),
        onPageFinished: (url) {
          setState(() => _loading = false);
          // Jeton envoyé au site (lié au compte connecté) ; tout de suite après une connexion (tableau de bord).
          _sendPushToken(force: url.contains('/dashboard'));
        },
        // Écran « Pas de connexion » seulement pour une vraie coupure réseau de la page principale.
        // (Une image, une vidéo intégrée ou un lien annulé qui échoue ne doit jamais bloquer l'app.)
        onWebResourceError: (e) {
          if (e.isForMainFrame != true) return;
          if (e.errorType == WebResourceErrorType.webContentProcessTerminated) { _web.reload(); return; }
          const iosNetwork = {-1001, -1003, -1004, -1005, -1009, -1018, -1020};
          final network = iosNetwork.contains(e.errorCode) || const {
            WebResourceErrorType.hostLookup, WebResourceErrorType.connect, WebResourceErrorType.timeout,
          }.contains(e.errorType);
          if (network) setState(() => _offline = true);
        },
        // Liens hors MaFeliza (WhatsApp, SMS, email, cagnotte, Maps…) : ouverts dans l'appli concernée.
        // Les cadres intégrés à la page (lecteur vidéo, YouTube…) se chargent normalement dans la page.
        onNavigationRequest: (req) {
          if (!req.isMainFrame) return NavigationDecision.navigate;
          final uri = Uri.parse(req.url);
          if (uri.scheme == 'about' || uri.scheme == 'blob' || uri.scheme == 'data') return NavigationDecision.navigate;
          final internal = uri.host.endsWith('mafeliza.com') || uri.host.endsWith('livekit.cloud') || uri.host.endsWith('supabase.co');
          if ((uri.scheme == 'http' || uri.scheme == 'https') && internal) return NavigationDecision.navigate;
          launchUrl(uri, mode: LaunchMode.externalApplication);
          return NavigationDecision.prevent;
        },
      ))
      ..loadRequest(Uri.parse(site));

    // Fenêtres alert / confirm / prompt du site : affichées en fenêtres natives (sinon WKWebView les ignore
    // et les boutons qui demandent une confirmation ne font rien).
    _web.setOnJavaScriptAlertDialog((req) => _dialog(req.message, cancel: false));
    _web.setOnJavaScriptConfirmDialog((req) => _dialog(req.message));
    _web.setOnJavaScriptTextInputDialog((req) async {
      final field = TextEditingController(text: req.defaultText ?? '');
      final ok = await _dialog(req.message, input: field);
      return ok ? field.text : '';
    });

    // Notifications : bouton « Activer les notifications » du site, jeton reçu, notification touchée.
    _web.addJavaScriptChannel('MaFelizaPush', onMessageReceived: (_) => _registerPush(settings: true));
    _push.setMethodCallHandler((call) async {
      if (call.method == 'token' && call.arguments is String) {
        _pushToken = call.arguments as String;
        _sendPushToken(force: true);
      } else if (call.method == 'open' && call.arguments is String) {
        _openPath(call.arguments as String);
      }
    });
    _registerPush();

    // Bouton Google du site : fenêtre Google native du téléphone, jeton renvoyé au site.
    _web.addJavaScriptChannel('MaFelizaGoogle', onMessageReceived: (_) => _googleSignIn());

    // Bouton Apple du site (iPhone) : fenêtre système « Se connecter avec Apple », jeton renvoyé au site.
    if (Platform.isIOS) {
      _web.addJavaScriptChannel('MaFelizaApple', onMessageReceived: (_) => _appleSignIn());
    }

    final platform = _web.platform;
    if (platform is AndroidWebViewController) {
      platform.setMediaPlaybackRequiresUserGesture(false);
      // Choix de photos / vidéos (stories, couverture, livre d'or).
      platform.setOnShowFileSelector((params) async {
        final res = await FilePicker.platform.pickFiles(
          allowMultiple: params.mode == FileSelectorMode.openMultiple,
          type: FileType.media,
        );
        return res?.files.where((f) => f.path != null).map((f) => Uri.file(f.path!).toString()).toList() ?? [];
      });
    }

    // Retour du réseau : rechargement automatique.
    Connectivity().onConnectivityChanged.listen((r) {
      final online = !r.contains(ConnectivityResult.none);
      if (online && _offline) {
        setState(() => _offline = false);
        _web.reload();
      } else if (!online) {
        setState(() => _offline = true);
      }
    });
  }

  Future<void> _appleSignIn() async {
    try {
      final c = await SignInWithApple.getAppleIDCredential(
        scopes: [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
      );
      final data = jsonEncode({'identityToken': c.identityToken, 'name': c.givenName ?? ''});
      await _web.runJavaScript('window.mafelizaAppleDone && window.mafelizaAppleDone($data)');
    } on SignInWithAppleAuthorizationException catch (e) {
      final msg = e.code == AuthorizationErrorCode.canceled ? 'canceled' : e.message;
      await _web.runJavaScript('window.mafelizaAppleError && window.mafelizaAppleError(${jsonEncode(msg)})');
    } catch (e) {
      await _web.runJavaScript('window.mafelizaAppleError && window.mafelizaAppleError(${jsonEncode(e.toString())})');
    }
  }

  // Demande l'autorisation (Android 13+ : permission du système ; iPhone : fenêtre d'iOS dans le code natif).
  // settings : depuis le bouton du site, ouvre les réglages du téléphone si les notifications ont été refusées.
  Future<void> _registerPush({bool settings = false}) async {
    try {
      if (Platform.isAndroid) {
        final st = await Permission.notification.request();
        if (st.isPermanentlyDenied && settings) await openAppSettings();
      }
      final initial = await _push.invokeMethod<String>('register', {'settings': settings});
      if (initial != null) _openPath(initial); // application ouverte en touchant une notification
    } catch (_) {/* code natif absent (ancienne compilation) : rien à faire */}
  }

  void _openPath(String path) {
    if (path.startsWith('/')) _web.loadRequest(Uri.parse('$site$path'));
  }

  // Page chargée : le site sait que les notifications sont actives ; le jeton est renvoyé au plus toutes les
  // 10 min (et aussitôt après une connexion), pour le rattacher au compte connecté.
  void _sendPushToken({bool force = false}) {
    final t = _pushToken;
    if (t == null || _loading) return;
    var js = "window.mafelizaPushOn=true;dispatchEvent(new Event('mafeliza-push'));";
    if (force || DateTime.now().difference(_pushSent).inMinutes >= 10) {
      _pushSent = DateTime.now();
      final body = jsonEncode({'token': t, 'platform': Platform.isIOS ? 'ios' : 'android'});
      js += "fetch('/api/push/native',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:${jsonEncode(body)}}).catch(function(){});";
    }
    _web.runJavaScript(js);
  }

  // Connexion Google native. Identifiant « Web » lu sur le site (/api/config, serverClientId) ; sur iPhone, identifiant
  // « iOS » fixé à la compilation (--dart-define), le même que celui déclaré dans Info.plist par ios-setup.sh.
  static const _googleIos = String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');
  Future<void>? _googleReady;
  Future<void> _initGoogle() async {
    final client = HttpClient();
    try {
      final res = await (await client.getUrl(Uri.parse('$site/api/config'))).close();
      final cfg = jsonDecode(await res.transform(utf8.decoder).join()) as Map<String, dynamic>;
      final web = (cfg['googleWebClientId'] ?? '') as String;
      if (web.isEmpty || (Platform.isIOS && _googleIos.isEmpty)) throw 'unavailable';
      await GoogleSignIn.instance.initialize(clientId: Platform.isIOS ? _googleIos : null, serverClientId: web);
    } finally {
      client.close();
    }
  }

  Future<void> _googleSignIn() async {
    try {
      _googleReady ??= _initGoogle();
      await _googleReady;
      final account = await GoogleSignIn.instance.authenticate();
      final token = account.authentication.idToken;
      if (token == null) throw 'unavailable';
      await _web.runJavaScript('window.mafelizaGoogleDone && window.mafelizaGoogleDone(${jsonEncode({'idToken': token})})');
    } on GoogleSignInException catch (e) {
      final msg = e.code == GoogleSignInExceptionCode.canceled ? 'canceled' : (e.description ?? e.code.name);
      await _web.runJavaScript('window.mafelizaGoogleError && window.mafelizaGoogleError(${jsonEncode(msg)})');
    } catch (e) {
      _googleReady = null; // nouvel essai possible (réseau)
      final msg = e == 'unavailable' ? 'unavailable' : e.toString();
      await _web.runJavaScript('window.mafelizaGoogleError && window.mafelizaGoogleError(${jsonEncode(msg)})');
    }
  }

  // Bouton retour Android : page précédente du site, sinon fermeture de l'application.
  Future<void> _back(bool didPop, Object? _) async {
    if (didPop) return;
    if (await _web.canGoBack()) {
      _web.goBack();
    } else {
      SystemNavigator.pop();
    }
  }

  Future<bool> _dialog(String message, {bool cancel = true, TextEditingController? input}) async {
    if (!mounted) return false;
    final ok = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(message),
          if (input != null) TextField(controller: input, autofocus: true),
        ]),
        actions: [
          if (cancel) TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), style: FilledButton.styleFrom(backgroundColor: pink), child: const Text('OK')),
        ],
      ),
    );
    return ok ?? false;
  }

  @override
  Widget build(BuildContext context) => PopScope(
        canPop: false,
        onPopInvokedWithResult: _back,
        child: Scaffold(
          backgroundColor: Colors.white,
          body: SafeArea(
            child: _offline
                ? _OfflineScreen(onRetry: () {
                    setState(() => _offline = false);
                    _web.reload();
                  })
                : Stack(children: [
                    WebViewWidget(controller: _web),
                    if (_loading) const LinearProgressIndicator(color: pink, minHeight: 3),
                  ]),
          ),
        ),
      );
}

class _OfflineScreen extends StatelessWidget {
  const _OfflineScreen({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Image.asset('assets/icon.png', width: 96),
            const SizedBox(height: 20),
            const Text('Pas de connexion internet', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            const Text('Vérifiez le Wi-Fi ou les données mobiles.', textAlign: TextAlign.center),
            const SizedBox(height: 24),
            FilledButton(onPressed: onRetry, style: FilledButton.styleFrom(backgroundColor: pink), child: const Text('Réessayer')),
          ]),
        ),
      );
}
