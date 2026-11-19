// Envoi des photos et vidéos des invités en arrière-plan : choix multiple, envoi qui continue appli fermée
// (iOS : URLSession en arrière-plan ; Android : WorkManager), nouvel essai automatique, notification de progression.
// Le site fournit l'adresse et un jeton d'envoi (24 h) : aucun cookie n'est nécessaire pendant l'envoi.
import 'dart:convert';
import 'dart:io';

import 'package:background_downloader/background_downloader.dart';
import 'package:image_picker/image_picker.dart';

import 'bridge.dart';

const _maxVideo = 50 * 1024 * 1024;
const _types = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp', 'mp4': 'video/mp4', 'm4v': 'video/mp4', 'mov': 'video/quicktime', 'webm': 'video/webm'};

class MediaUploader {
  MediaUploader(this.bridge) {
    FileDownloader().updates.listen(_onUpdate);
    FileDownloader().start();
  }

  final WebBridge bridge;
  int _total = 0, _done = 0, _failed = 0;

  /// Demande du site : { url, token, labels }. Ouvre la galerie (plusieurs photos / vidéos) puis met les envois en file.
  Future<void> pickAndSend(String json) async {
    final data = jsonDecode(json) as Map<String, dynamic>;
    final labels = (data['labels'] ?? {}) as Map<String, dynamic>;
    String t(String k) => (labels[k] ?? k).toString();
    List<XFile> files;
    try {
      // Photos réduites et converties en JPEG par le téléphone (envoi rapide, même en 4G à la fête).
      files = await ImagePicker().pickMultipleMedia(maxWidth: 2048, maxHeight: 2048, imageQuality: 85);
    } catch (_) {
      files = [];
    }
    if (files.isEmpty) return bridge.run('window.mafelizaUploadCanceled && window.mafelizaUploadCanceled()');

    FileDownloader().configureNotificationForGroup('photos',
        running: TaskNotification('MaFeliza', '${t('Envoi des photos')} {numFinished}/{numTotal}'),
        complete: TaskNotification('MaFeliza', t('Photos envoyées ✔')),
        error: TaskNotification('MaFeliza', t("Une photo n'a pas pu être envoyée")),
        progressBar: true,
        groupNotificationId: 'photos');

    var queued = 0, skipped = 0;
    for (final f in files) {
      final ext = f.path.split('.').last.toLowerCase();
      final type = _types[ext];
      final file = File(f.path);
      if (type == null || (type.startsWith('video/') && await file.length() > _maxVideo)) {
        skipped++;
        continue;
      }
      final task = UploadTask.fromFile(
        file: file,
        url: data['url'].toString(),
        urlQueryParameters: {'t': data['token'].toString()},
        httpRequestMethod: 'PUT',
        post: 'binary',
        mimeType: type,
        headers: {'Content-Type': type},
        group: 'photos',
        retries: 5,
        updates: Updates.status,
      );
      if (await FileDownloader().enqueue(task)) queued++;
    }
    _total += queued;
    await bridge.run('window.mafelizaUploadQueued && window.mafelizaUploadQueued(${jsonEncode({'queued': queued, 'skipped': skipped})})');
    if (queued == 0) _finish();
  }

  void _onUpdate(TaskUpdate u) {
    if (u is! TaskStatusUpdate || u.task.group != 'photos' || !u.status.isFinalState) return;
    if (u.status == TaskStatus.complete) {
      _done++;
    } else {
      _failed++;
    }
    bridge.run('window.mafelizaUploadProgress && window.mafelizaUploadProgress(${jsonEncode({'done': _done, 'failed': _failed, 'total': _total})})');
    if (_done + _failed >= _total) _finish();
  }

  void _finish() {
    bridge.run('window.mafelizaUploadFinished && window.mafelizaUploadFinished(${jsonEncode({'done': _done, 'failed': _failed})})');
    _total = _done = _failed = 0;
  }
}
