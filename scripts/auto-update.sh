#!/usr/bin/env bash
# Vérifie GitHub chaque minute (minuteur systemd) et met le site à jour s'il y a du nouveau.
set -euo pipefail
cd "${1:-/opt/mafeliza}"
git fetch --quiet origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && exit 0
echo "Nouvelle version : $(git log -1 --format='%h %s' origin/main)"
git reset --hard --quiet origin/main
exec bash scripts/deploy.sh "$(pwd)"
