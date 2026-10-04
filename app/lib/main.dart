// MaFeliza — application iPhone / Android (Flutter).
// Affiche la plateforme en ligne (mafeliza.com) : toute mise à jour du site est visible
// immédiatement, sans republier sur les stores. Fonctions du téléphone : appareil photo et micro
// (live, stories), bouton retour Android, liens externes (WhatsApp, cagnotte…) ouverts hors de
// l'application, écran hors connexion.
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
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
        onPageFinished: (_) => setState(() => _loading = false),
        onWebResourceError: (e) {
          if (e.isForMainFrame ?? true) setState(() => _offline = true);
        },
        // Liens hors MaFeliza (WhatsApp, SMS, email, cagnotte, Maps…) : ouverts dans l'appli concernée.
        onNavigationRequest: (req) {
          final uri = Uri.parse(req.url);
          final internal = uri.host.endsWith('mafeliza.com') || uri.host.endsWith('livekit.cloud') || uri.host.endsWith('supabase.co');
          if ((uri.scheme == 'http' || uri.scheme == 'https') && internal) return NavigationDecision.navigate;
          launchUrl(uri, mode: LaunchMode.externalApplication);
          return NavigationDecision.prevent;
        },
      ))
      ..loadRequest(Uri.parse(site));

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

  // Bouton retour Android : page précédente du site, sinon fermeture de l'application.
  Future<void> _back(bool didPop, Object? _) async {
    if (didPop) return;
    if (await _web.canGoBack()) {
      _web.goBack();
    } else {
      SystemNavigator.pop();
    }
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
