// Lecteur de réels natif : défilement vertical fluide, lecture automatique, double-tap pour aimer,
// commentaires, partage. La liste et les textes traduits viennent du site (openVideoReels).
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import 'bridge.dart';

const _site = 'https://mafeliza.com';

class ReelsScreen extends StatefulWidget {
  const ReelsScreen({super.key, required this.items, required this.start, required this.labels, required this.bridge, required this.openPath});
  final List<Map<String, dynamic>> items;
  final int start;
  final Map<String, dynamic> labels;
  final WebBridge bridge;
  final void Function(String path) openPath;

  @override
  State<ReelsScreen> createState() => _ReelsScreenState();
}

class _ReelsScreenState extends State<ReelsScreen> {
  late final PageController _page = PageController(initialPage: widget.start);
  final _players = <int, VideoPlayerController>{};
  late int _current = widget.start;
  bool _muted = true;
  bool _paused = false;
  bool _heart = false;
  Timer? _viewTimer;
  final _viewed = <String>{};

  String t(String k) => (widget.labels[k] ?? k).toString();
  Map<String, dynamic> get _it => widget.items[_current];

  @override
  void initState() {
    super.initState();
    _prepare(_current);
  }

  @override
  void dispose() {
    _viewTimer?.cancel();
    for (final p in _players.values) {
      p.dispose();
    }
    _page.dispose();
    super.dispose();
  }

  String _abs(String u) => u.startsWith('/') ? '$_site$u' : u;

  // Lecteur de la vidéo affichée + préchargement de la suivante ; les autres sont libérés (mémoire).
  void _prepare(int i) {
    for (final k in _players.keys.toList()) {
      if ((k - i).abs() > 1) _players.remove(k)?.dispose();
    }
    for (final k in [i, i + 1, i - 1]) {
      if (k < 0 || k >= widget.items.length || _players.containsKey(k)) continue;
      final src = (widget.items[k]['src'] ?? '').toString();
      if (src.isEmpty) continue;
      final p = VideoPlayerController.networkUrl(Uri.parse(_abs(src)));
      _players[k] = p;
      p.initialize().then((_) {
        if (!mounted || _players[k] != p) return;
        p
          ..setLooping(true)
          ..setVolume(_muted ? 0 : 1);
        if (k == _current && !_paused) p.play();
        setState(() {});
      }).catchError((_) {});
    }
    _paused = false;
    _players[i]?.play();
    _countView(i);
  }

  // Vue comptée après 2 s sur le même réel (une seule fois par réel), comme sur le site.
  void _countView(int i) {
    _viewTimer?.cancel();
    final id = widget.items[i]['id'].toString();
    if (_viewed.contains(id)) return;
    _viewTimer = Timer(const Duration(seconds: 2), () {
      _viewed.add(id);
      widget.bridge.api('POST', '/api/public/reels/${Uri.encodeComponent(id)}/view').catchError((_) {});
    });
  }

  void _onPage(int i) {
    _players[_current]?.pause();
    setState(() => _current = i);
    _prepare(i);
  }

  void _togglePause() {
    final p = _players[_current];
    if (p == null) return;
    setState(() => _paused = !_paused);
    _paused ? p.pause() : p.play();
  }

  void _toggleSound() {
    setState(() => _muted = !_muted);
    for (final p in _players.values) {
      p.setVolume(_muted ? 0 : 1);
    }
  }

  Future<void> _like({bool fromDoubleTap = false}) async {
    final it = _it;
    if (fromDoubleTap) {
      setState(() => _heart = true);
      Future.delayed(const Duration(milliseconds: 700), () => mounted ? setState(() => _heart = false) : null);
    }
    if (it['liked'] == true) return;
    setState(() {
      it['liked'] = true;
      it['likes'] = ((it['likes'] ?? 0) as num) + 1;
    });
    final id = jsonEncode(it['id'].toString());
    widget.bridge.run("try{var s=new Set(JSON.parse(localStorage.getItem('em-reellikes')||'[]'));s.add($id);"
        "localStorage.setItem('em-reellikes',JSON.stringify([...s]))}catch(e){}");
    widget.bridge.api('POST', '/api/public/reels/${Uri.encodeComponent(it['id'].toString())}/like').catchError((_) {});
  }

  void _share() {
    final it = _it;
    final ev = it['event'] is Map ? it['event'] as Map : null;
    final url = ev?['slug'] != null ? '$_site/e/${ev!['slug']}' : _site;
    final text = ev?['name'] != null ? '🎉 ${ev!['name']}' : t('Créez le vôtre');
    SharePlus.instance.share(ShareParams(text: '$text\n$url'));
  }

  void _openEvent(String slug) {
    Navigator.of(context).pop();
    widget.openPath('/e/$slug');
  }

  String _views(num n) {
    final s = n >= 10000 ? '${(n / 1000).toStringAsFixed(n >= 100000 ? 0 : 1).replaceAll('.0', '')} k' : '$n';
    return '$s ${t(n > 1 ? 'vues' : 'vue')}';
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.black,
        body: Stack(children: [
          PageView.builder(
            controller: _page,
            scrollDirection: Axis.vertical,
            itemCount: widget.items.length,
            onPageChanged: _onPage,
            itemBuilder: (_, i) => _reel(i),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(children: [
                _round(Icons.close, () => Navigator.of(context).pop(), t('Fermer')),
                const Spacer(),
                _round(_muted ? Icons.volume_off : Icons.volume_up, _toggleSound, 'Son'),
              ]),
            ),
          ),
        ]),
      );

  Widget _round(IconData icon, VoidCallback onTap, String label) => Semantics(
        label: label,
        button: true,
        child: Material(
          color: Colors.black38,
          shape: const CircleBorder(),
          child: IconButton(icon: Icon(icon, color: Colors.white), onPressed: onTap),
        ),
      );

  Widget _reel(int i) {
    final it = widget.items[i];
    final p = _players[i];
    final ready = p != null && p.value.isInitialized;
    final portrait = it['portrait'] != false;
    final ev = it['event'] is Map ? it['event'] as Map : null;
    return GestureDetector(
      onTap: _togglePause,
      onDoubleTap: () => _like(fromDoubleTap: true),
      child: Stack(fit: StackFit.expand, children: [
        if ((it['thumb'] ?? '').toString().isNotEmpty && !ready)
          Image.network(_abs(it['thumb'].toString()), fit: portrait ? BoxFit.cover : BoxFit.contain, errorBuilder: (_, __, ___) => const SizedBox()),
        if (ready)
          FittedBox(
            fit: portrait ? BoxFit.cover : BoxFit.contain,
            child: SizedBox(width: p.value.size.width, height: p.value.size.height, child: VideoPlayer(p)),
          ),
        if (!ready) const Center(child: CircularProgressIndicator(color: Colors.white54)),
        if (i == _current && _paused) const Center(child: Icon(Icons.play_arrow_rounded, size: 84, color: Colors.white70)),
        if (i == _current && _heart) const Center(child: Icon(Icons.favorite, size: 110, color: Colors.white)),
        // Dégradé bas pour la lisibilité du texte
        const Positioned(left: 0, right: 0, bottom: 0, height: 240,
            child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [Colors.black87, Colors.transparent])))),
        Positioned(
          right: 8,
          bottom: 110,
          child: Column(children: [
            _act(it['liked'] == true ? Icons.favorite : Icons.favorite_border, '${it['likes'] ?? ''}'.replaceAll(RegExp(r'^0$'), ''), _like,
                color: it['liked'] == true ? const Color(0xFFFF3B6B) : Colors.white),
            if (it['reel'] != null) _act(Icons.chat_bubble_outline, '${it['nc'] ?? ''}'.replaceAll(RegExp(r'^0$'), ''), () => _comments(it)),
            _act(Icons.reply, t('Partager'), _share, flip: true),
            if (ev?['slug'] != null) _act(Icons.celebration_outlined, t('Événement'), () => _openEvent(ev!['slug'].toString())),
            if ((ev?['cagnotteUrl'] ?? '').toString().isNotEmpty)
              _act(Icons.card_giftcard, t('Cagnotte'), () => launchUrl(Uri.parse(ev!['cagnotteUrl'].toString()), mode: LaunchMode.externalApplication)),
          ]),
        ),
        Positioned(
          left: 16,
          right: 90,
          bottom: 40,
          child: SafeArea(
            top: false,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              if ((it['title'] ?? '').toString().isNotEmpty)
                Text(it['title'].toString(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 4),
              Text('👁 ${_views((it['views'] ?? 0) as num)}', style: const TextStyle(color: Colors.white70, fontSize: 13)),
              if ((it['channel'] ?? '').toString().isNotEmpty)
                Text('👤 ${it['channel']}', style: const TextStyle(color: Colors.white70, fontSize: 13)),
            ]),
          ),
        ),
      ]),
    );
  }

  Widget _act(IconData icon, String label, VoidCallback onTap, {Color color = Colors.white, bool flip = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: InkResponse(
          onTap: onTap,
          child: Column(children: [
            Transform.flip(flipX: flip, child: Icon(icon, color: color, size: 32, shadows: const [Shadow(blurRadius: 8)])),
            if (label.isNotEmpty) Text(label, style: const TextStyle(color: Colors.white, fontSize: 12, shadows: [Shadow(blurRadius: 6)])),
          ]),
        ),
      );

  // Commentaires d'un réel de membre : lecture libre, écriture avec un compte (via le site).
  Future<void> _comments(Map<String, dynamic> it) async {
    final reel = Uri.encodeComponent(it['reel'].toString());
    final field = TextEditingController();
    List<dynamic>? items;
    String? error;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) {
        if (items == null && error == null) {
          widget.bridge.api('GET', '/api/reels/$reel/comments').then((v) => setSheet(() => items = v as List<dynamic>),
              onError: (e) => setSheet(() => error = e.toString()));
        }
        Future<void> send() async {
          final text = field.text.trim();
          if (text.isEmpty) return;
          try {
            final c = await widget.bridge.api('POST', '/api/reels/$reel/comments', {'text': text});
            field.clear();
            setSheet(() => items = [...?items, c]);
            setState(() => it['nc'] = items!.length);
          } on WebApiError catch (e) {
            if (!ctx.mounted) return;
            ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(e.status == 401 ? t('Connectez-vous pour commenter.') : e.message)));
          }
        }

        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: SizedBox(
            height: MediaQuery.of(ctx).size.height * .6,
            child: Column(children: [
              const SizedBox(height: 10),
              Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(4))),
              Padding(padding: const EdgeInsets.all(12), child: Text(t('Commentaires'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
              Expanded(
                child: error != null
                    ? Center(child: Text(error!))
                    : items == null
                        ? const Center(child: CircularProgressIndicator())
                        : items!.isEmpty
                            ? Center(child: Text(t('Soyez le premier à commenter.'), style: const TextStyle(color: Colors.black54)))
                            : ListView(
                                children: [
                                  for (final c in items!)
                                    ListTile(
                                      title: Text((c['name'] ?? '').toString(), style: const TextStyle(fontWeight: FontWeight.w700)),
                                      subtitle: Text((c['text'] ?? '').toString()),
                                    ),
                                ],
                              ),
              ),
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 4, 8, 8),
                  child: Row(children: [
                    Expanded(
                      child: TextField(
                        controller: field,
                        maxLength: 300,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => send(),
                        decoration: InputDecoration(hintText: t('Ajouter un commentaire…'), counterText: '', border: const OutlineInputBorder()),
                      ),
                    ),
                    IconButton(icon: const Icon(Icons.send, color: Color(0xFFE8137A)), onPressed: send),
                  ]),
                ),
              ),
            ]),
          ),
        );
      }),
    );
    field.dispose();
  }
}
