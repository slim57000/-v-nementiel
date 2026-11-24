#!/bin/bash
# Mise à jour automatique de MaFeliza : lancé toutes les 2 minutes par le minuteur systemd « mafeliza-update ».
# Si GitHub (branche main) a une nouvelle version : elle est installée, vérifiée, puis le site redémarre.
# Journal : journalctl -u mafeliza-update -n 50
set -euo pipefail
cd /opt/mafeliza
git fetch -q origin main
NEW=$(git rev-parse FETCH_HEAD); OLD=$(git rev-parse HEAD)
[ "$NEW" = "$OLD" ] && exit 0
echo "Nouvelle version : $(git log -1 --format='%h %s' FETCH_HEAD)"
CHANGED=$(git diff --name-only "$OLD" "$NEW")
git reset -q --hard "$NEW"
# Dépendances modifiées : réinstallation.
if echo "$CHANGED" | grep -qE '^package(-lock)?\.json$'; then npm ci --omit=dev --no-audit --no-fund; fi
# Vérification avant de redémarrer : si le serveur ne se lit même pas, on revient à l'ancienne version.
if ! node --check server.js; then
  echo "Erreur dans la nouvelle version : retour à $OLD"; git reset -q --hard "$OLD"; exit 1
fi
systemctl restart mafeliza
sleep 5
if ! systemctl is-active --quiet mafeliza; then
  echo "Le site ne démarre pas : retour à $OLD"; git reset -q --hard "$OLD"; systemctl restart mafeliza; exit 1
fi
echo "Installée et en ligne : $(git log -1 --format='%h %s')"
