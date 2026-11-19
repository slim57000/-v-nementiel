// Pont entre les écrans natifs et le site : les appels au serveur passent par la page web (fetch), qui porte la
// session de la personne (cookies httpOnly). Les écrans natifs agissent ainsi exactement comme le site.
import 'dart:async';
import 'dart:convert';

import 'package:webview_flutter/webview_flutter.dart';

class WebApiError implements Exception {
  WebApiError(this.status, this.message);
  final int status;
  final String message;
  @override
  String toString() => message;
}

class WebBridge {
  WebBridge(this.web) {
    web.addJavaScriptChannel('MaFelizaBridge', onMessageReceived: (m) {
      final data = jsonDecode(m.message) as Map<String, dynamic>;
      _pending.remove(data['id'])?.complete(data);
    });
  }

  final WebViewController web;
  final _pending = <String, Completer<Map<String, dynamic>>>{};
  int _seq = 0;

  /// Appel JSON au serveur (ex. api('GET', '/api/reels/abc/comments')). Erreur WebApiError si statut ≥ 400.
  Future<dynamic> api(String method, String path, [Object? body]) async {
    final id = 'b${++_seq}';
    final done = Completer<Map<String, dynamic>>();
    _pending[id] = done;
    final opts = jsonEncode({
      'method': method,
      'credentials': 'include',
      'headers': {'Content-Type': 'application/json'},
      if (body != null) 'body': jsonEncode(body),
    });
    await web.runJavaScript('fetch(${jsonEncode(path)},$opts)'
        '.then(function(r){return r.text().then(function(t){MaFelizaBridge.postMessage(JSON.stringify({id:${jsonEncode(id)},status:r.status,body:t}))})})'
        '.catch(function(e){MaFelizaBridge.postMessage(JSON.stringify({id:${jsonEncode(id)},status:0,body:String(e)}))});');
    final res = await done.future.timeout(const Duration(seconds: 30), onTimeout: () {
      _pending.remove(id);
      return {'status': 0, 'body': ''};
    });
    final status = res['status'] as int;
    dynamic json;
    try {
      json = jsonDecode(res['body'] as String);
    } catch (_) {
      json = null;
    }
    if (status == 0 || status >= 400) {
      final msg = json is Map && json['error'] is String ? json['error'] as String : 'Connexion impossible, réessayez.';
      throw WebApiError(status, msg);
    }
    return json;
  }

  /// Exécute du JavaScript dans la page (mise à jour d'un compteur, d'un réglage local…).
  Future<void> run(String js) => web.runJavaScript(js);
}
