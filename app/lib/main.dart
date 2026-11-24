// MaFeliza — application iPhone / Android (Flutter).
// Affiche la plateforme en ligne (mafeliza.com) : toute mise à jour du site est visible
// immédiatement, sans republier sur les stores. Fonctions du téléphone : appareil photo et micro
// (live, stories), bouton retour Android, liens externes (WhatsApp, cagnotte…) ouverts hors de
// l'application, écran hors connexion, connexions Apple (iPhone) et Google natives, notifications push
// (APNs sur iPhone, Firebase sur Android : code natif ajouté par ios-setup.sh et compiler.ps1).
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:app_links/app_links.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:thermal/thermal.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:share_plus/share_plus.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import 'bridge.dart';
import 'reels.dart';
import 'uploads.dart';

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
  late final WebBridge _bridge; // appels au serveur des écrans natifs, avec la session du site
  late final MediaUploader _uploader; // photos et vidéos des invités, envoyées en arrière-plan
  bool _loading = true;
  bool _offline = false;
  // Barre de navigation façon Safari (bas de l'écran) : retour, suivant, accueil, recharger, partager.
  bool _canBack = false, _canForward = false;
  String _url = '';
  Future<void> _navState([String? url]) async {
    final b = await _web.canGoBack(), f = await _web.canGoForward();
    if (!mounted) return;
    setState(() { _canBack = b; _canForward = f; if (url != null) _url = url; });
  }
  // Pages plein écran (live, mur photo, caméraman) : pas de barre, elles ont leurs propres boutons.
  bool get _showNav => !_cameraOn && !RegExp(r'/(live|mur|cameraman|lk)(\?|$|/)').hasMatch(Uri.tryParse(_url)?.path ?? '');

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
        onUrlChange: (change) => _navState(change.url),
        onPageFinished: (url) {
          setState(() => _loading = false);
          _navState(url);
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
          // Fichier agenda (.ics) : ouvert par le navigateur du téléphone, qui propose « Ajouter au calendrier ».
          final ics = uri.path.endsWith('.ics');
          if ((uri.scheme == 'http' || uri.scheme == 'https') && internal && !ics) return NavigationDecision.navigate;
          // .ics : fenêtre Safari intégrée, qui propose « Ajouter au calendrier » (ouvert à part, iOS le prenait
          // pour un abonnement de calendrier).
          launchUrl(uri, mode: ics ? LaunchMode.inAppBrowserView : LaunchMode.externalApplication);
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

    _bridge = WebBridge(_web);
    _uploader = MediaUploader(_bridge);
    // Impression (affiches QR) : la vue web est imprimée par le téléphone (WebView ne gère pas window.print).
    _web.addJavaScriptChannel('MaFelizaPrint', onMessageReceived: (m) => _push.invokeMethod('print', {'title': m.message}).catchError((_) {}));
    // Caméraman en direct : écran toujours allumé (garanti par le téléphone) et niveau de batterie envoyé à la page.
    _web.addJavaScriptChannel('MaFelizaCamera', onMessageReceived: (m) => _cameraMode(m.message));
    // Appli mise en arrière-plan pendant le live (appel, autre appli) : iOS coupe la caméra → rappel immédiat.
    _lifecycle = AppLifecycleListener(onHide: () {
      if (_cameraOn) _push.invokeMethod('localNotify', {'title': _camLabel('Le live est en pause'), 'body': _camLabel('Revenez dans MaFeliza pour reprendre le direct.')}).catchError((_) {});
    });
    // Photos / vidéos des invités : galerie du téléphone (plusieurs à la fois), envoi qui continue appli fermée.
    // Fichiers créés par le site (zip des souvenirs, replay) : reçus par morceaux puis « Enregistrer / Partager ».
    // Version de l'appli demandée par le site (mise à jour obligatoire). ⚠️ À changer avec « version » de pubspec.yaml.
    _web.addJavaScriptChannel('MaFelizaVersion', onMessageReceived: (_) => _web.runJavaScript("window.mafelizaVersion && window.mafelizaVersion('1.0.8')"));
    // Repère pour le site : cette version ouvre les fichiers agenda (.ics) correctement.
    _web.addJavaScriptChannel('MaFelizaCal', onMessageReceived: (_) {});
    _web.addJavaScriptChannel('MaFelizaFile', onMessageReceived: (m) => _receiveFile(m.message));
    // Partage d'un lien / texte : feuille de partage du téléphone (WhatsApp, Messages, AirDrop…).
    _web.addJavaScriptChannel('MaFelizaShare', onMessageReceived: (m) {
      final size = MediaQuery.of(context).size;
      final text = (jsonDecode(m.message) as Map<String, dynamic>)['text']?.toString() ?? '';
      SharePlus.instance.share(ShareParams(text: text, sharePositionOrigin: Rect.fromLTWH(size.width / 2, size.height / 2, 1, 1)));
    });
    _web.addJavaScriptChannel('MaFelizaUpload', onMessageReceived: (m) => _uploader.pickAndSend(m.message));
    // Réels : lecteur natif (défilement fluide) ouvert par le site avec la liste et les textes traduits.
    _web.addJavaScriptChannel('MaFelizaReels', onMessageReceived: (m) => _openReels(m.message));

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

    // Lien mafeliza.com touché (WhatsApp, email, bandeau du site…) : la page s'ouvre directement dans l'appli.
    _linkSub = AppLinks().uriLinkStream.listen((uri) {
      if (uri.host.endsWith('mafeliza.com')) _openPath(uri.path.isEmpty ? '/' : '${uri.path}${uri.hasQuery ? '?${uri.query}' : ''}');
    }, onError: (_) {});

    // Bouton Google du site : fenêtre Google native du téléphone, jeton renvoyé au site.
    _web.addJavaScriptChannel('MaFelizaGoogle', onMessageReceived: (_) => _googleSignIn());

    // Bouton Apple du site (iPhone) : fenêtre système « Se connecter avec Apple », jeton renvoyé au site.
    if (Platform.isIOS) {
      _web.addJavaScriptChannel('MaFelizaApple', onMessageReceived: (_) => _appleSignIn());
    }

    final platform = _web.platform;
    // iPhone : glisser depuis le bord gauche = page précédente (et bord droit = page suivante), comme dans Safari.
    if (platform is WebKitWebViewController) platform.setAllowsBackForwardNavigationGestures(true);
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

  @override
  void dispose() {
    _lifecycle?.dispose();
    _linkSub?.cancel();
    _batteryTimer?.cancel();
    _thermal?.cancel();
    super.dispose();
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

  Timer? _batteryTimer;
  StreamSubscription<ThermalStatus>? _thermal;
  AppLifecycleListener? _lifecycle;
  bool _cameraOn = false;
  StreamSubscription<Uri>? _linkSub;
  Map<String, dynamic> _camLabels = {};
  String _camLabel(String k) => (_camLabels[k] ?? k).toString();

  // Mode caméraman (page du live) : écran allumé, batterie, chaleur du téléphone, rappel si l'appli est quittée,
  // confirmation avant de quitter la page avec le bouton retour.
  IOSink? _fileSink;
  File? _file;
  Future<void> _receiveFile(String json) async {
    final m = jsonDecode(json) as Map<String, dynamic>;
    try {
      switch (m['op']) {
        case 'start':
          final name = m['name'].toString().replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
          final dir = await Directory.systemTemp.createTemp('mafeliza');
          _file = File('${dir.path}/$name');
          _fileSink = _file!.openWrite();
        case 'chunk':
          _fileSink?.add(base64Decode(m['data'].toString()));
        case 'end':
          await _fileSink?.close();
          _fileSink = null;
          final size = MediaQuery.of(context).size;
          if (_file != null) {
            final text = m['text']?.toString() ?? '';
            await SharePlus.instance.share(ShareParams(files: [XFile(_file!.path)], text: text.isEmpty ? null : text, sharePositionOrigin: Rect.fromLTWH(size.width / 2, size.height / 2, 1, 1)));
          }
      }
    } catch (_) {/* fichier incomplet : rien à partager */}
    await _web.runJavaScript('window.mafelizaFileAck && window.mafelizaFileAck()');
  }

  Future<void> _cameraMode(String message) async {
    _batteryTimer?.cancel();
    _batteryTimer = null;
    await _thermal?.cancel();
    _thermal = null;
    setState(() => _cameraOn = message != 'off');
    if (!_cameraOn) return WakelockPlus.disable();
    try {
      _camLabels = ((jsonDecode(message) as Map)['labels'] ?? {}) as Map<String, dynamic>;
    } catch (_) {/* ancien format « on » */}
    await WakelockPlus.enable();
    _thermal = Thermal().onThermalStatusChanged.listen((s) {
      _web.runJavaScript('window.mafelizaThermal && window.mafelizaThermal(${jsonEncode(s.name)})');
    }, onError: (_) {});
    final battery = Battery();
    Future<void> report() async {
      try {
        final level = await battery.batteryLevel;
        final state = await battery.batteryState;
        final charging = state == BatteryState.charging || state == BatteryState.full;
        await _web.runJavaScript('window.mafelizaBattery && window.mafelizaBattery(${jsonEncode({'level': level, 'charging': charging})})');
      } catch (_) {/* batterie indisponible */}
    }
    await report();
    _batteryTimer = Timer.periodic(const Duration(minutes: 1), (_) => report());
  }

  void _openReels(String json) {
    final data = jsonDecode(json) as Map<String, dynamic>;
    final items = (data['items'] as List).cast<Map<String, dynamic>>();
    if (items.isEmpty || !mounted) return;
    Navigator.of(context).push(MaterialPageRoute<void>(
      fullscreenDialog: true,
      builder: (_) => ReelsScreen(
        items: items,
        start: ((data['start'] ?? 0) as num).toInt().clamp(0, items.length - 1),
        labels: (data['labels'] ?? {}) as Map<String, dynamic>,
        bridge: _bridge,
        openPath: _openPath,
      ),
    ));
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
    if (_cameraOn && !await _dialog(_camLabel('Le live est en cours. Quitter cette page arrêtera le direct.'))) return;
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
          bottomNavigationBar: _offline || !_showNav ? null : _navBar(),
        ),
      );

  Widget _navBar() {
    Widget b(IconData icon, String label, VoidCallback? onTap) => Expanded(
          child: IconButton(
            onPressed: onTap,
            tooltip: label,
            icon: Icon(icon, size: 26),
            color: const Color(0xFF3A2F3D),
            disabledColor: const Color(0x553A2F3D),
          ),
        );
    return Container(
      decoration: const BoxDecoration(color: Color(0xFFFAF7FA), border: Border(top: BorderSide(color: Color(0xFFEADFE8)))),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 48,
          child: Row(children: [
            b(Icons.arrow_back_ios_new_rounded, 'Retour', _canBack ? () => _web.goBack() : null),
            b(Icons.arrow_forward_ios_rounded, 'Suivant', _canForward ? () => _web.goForward() : null),
            b(Icons.home_rounded, 'Accueil', () => _web.loadRequest(Uri.parse('$site/dashboard'))),
            b(Icons.refresh_rounded, 'Recharger', () => _web.reload()),
            b(Icons.ios_share_rounded, 'Partager', () {
              final size = MediaQuery.of(context).size;
              final url = _url.isNotEmpty ? _url : site;
              SharePlus.instance.share(ShareParams(text: url, sharePositionOrigin: Rect.fromLTWH(size.width / 2, size.height - 60, 1, 1)));
            }),
          ]),
        ),
      ),
    );
  }
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
