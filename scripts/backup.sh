#!/usr/bin/env bash
# Sauvegarde de MaFeliza (à lancer chaque nuit par cron) : base SQLite (copie cohérente), fichiers envoyés
# (photos, vidéos, replays) et réglages .env. Garde les 14 dernières sauvegardes dans /opt/mafeliza-backups.
# Installation (une seule fois) :  sudo crontab -e   puis ajouter la ligne :
#   30 3 * * * /opt/mafeliza/scripts/backup.sh >> /var/log/mafeliza-backup.log 2>&1
set -euo pipefail
APP=${APP:-$(cd "$(dirname "$0")/.." && pwd)}
DEST=${BACKUP_DIR:-/opt/mafeliza-backups}
KEEP=${BACKUP_KEEP:-14}
STAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p "$DEST" && chmod 700 "$DEST"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cd "$APP"
DATA_DIR=$(grep -E '^DATA_DIR=' .env 2>/dev/null | cut -d= -f2- || true); DATA_DIR=${DATA_DIR:-./data}
UPLOAD_DIR=$(grep -E '^UPLOAD_DIR=' .env 2>/dev/null | cut -d= -f2- || true); UPLOAD_DIR=${UPLOAD_DIR:-./uploads}
# Base SQLite : copie à chaud cohérente (API de sauvegarde de SQLite).
if [ -f "$DATA_DIR/app.db" ]; then
  python3 -c "import sqlite3,sys; s=sqlite3.connect(sys.argv[1]); d=sqlite3.connect(sys.argv[2]); s.backup(d); d.close(); s.close()" "$DATA_DIR/app.db" "$TMP/app.db"
fi
[ -f .env ] && cp .env "$TMP/env"
ARCHIVE="$DEST/mafeliza-$STAMP.tar.gz"
tar -czf "$ARCHIVE" -C "$TMP" . $( [ -d "$UPLOAD_DIR" ] && echo "-C $APP $UPLOAD_DIR" )
chmod 600 "$ARCHIVE"
# Rotation : on ne garde que les $KEEP plus récentes.
ls -1t "$DEST"/mafeliza-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "$(date '+%F %T') Sauvegarde OK : $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
