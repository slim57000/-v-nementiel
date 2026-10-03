#!/usr/bin/env bash
# Mise à jour du site sur le VPS : récupère main, installe les dépendances, redémarre l'application.
set -euo pipefail
cd "${1:-$(dirname "$0")/..}"
git fetch --quiet origin main
git reset --hard --quiet origin/main
npm ci --omit=dev --no-audit --no-fund --silent
# Redémarrage : PM2 si utilisé, sinon service systemd « mafeliza ».
if command -v pm2 >/dev/null && pm2 describe mafeliza >/dev/null 2>&1; then
  pm2 reload mafeliza --update-env
elif systemctl list-unit-files mafeliza.service >/dev/null 2>&1 && systemctl cat mafeliza.service >/dev/null 2>&1; then
  sudo systemctl restart mafeliza
else
  echo "Aucun service « mafeliza » trouvé (PM2 ou systemd) : redémarrez l'application manuellement." >&2
  exit 1
fi
sleep 3
curl -fsS -o /dev/null http://127.0.0.1:3000/ && echo "Déploiement OK ✔ ($(git log -1 --format='%h %s'))"
