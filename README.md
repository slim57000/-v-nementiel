# Plateforme événementielle — V0

Prototype web de validation : création d'événement, faire-part (3 styles), page publique avec compte à rebours et partage, accès public / privé par code, espace organisateur.

## Stack

- **Node.js ≥ 22.13** + **Express** (seule dépendance)
- **SQLite** via le module intégré `node:sqlite` (aucune compilation native)
- Front en HTML / CSS / JS natif, sans build, mobile-first
- Images redimensionnées dans le navigateur puis stockées sur disque (`uploads/`)

## Lancer en local

```bash
cd -v-nementiel
npm install
npm run dev        # http://localhost:3000
```

## Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port HTTP | `3000` |
| `DATA_DIR` | Dossier de la base SQLite (+ secret de session) | `./data` |
| `UPLOAD_DIR` | Dossier des images | `./uploads` |
| `SESSION_SECRET` | Clé de signature des cookies | générée dans `DATA_DIR/secret` |
| `NODE_ENV` | `production` active les cookies `Secure` | — |

## Déploiement (Render / Railway)

1. Nouveau service web à partir du dépôt, dossier racine du dépôt.
2. Build : `npm install` — Start : `npm start`.
3. Ajouter un **disque persistant** monté par ex. sur `/var/data`, puis `DATA_DIR=/var/data/db` et `UPLOAD_DIR=/var/data/uploads`.
4. Définir `NODE_ENV=production` et `SESSION_SECRET` (chaîne aléatoire longue).

## Structure

```
server.js           Express : API + pages + balises Open Graph de /e/:slug
db.js               Connexion SQLite et schéma
lib/                codes (slug, codes), session (cookies signés), uploads, validation événements
routes/auth.js      Connexion organisateur : email + code à 6 chiffres
routes/events.js    CRUD des événements de l'organisateur
routes/public.js    Page publique + déverrouillage par code
public/             index (connexion), dashboard, edit (création/édition + faire-part), event (page publique)
```

## Fonctionnement de l'accès

- **Organisateur** : à la première connexion, l'email crée le compte et un code à 6 chiffres est affiché ; il est redemandé pour se reconnecter sur un autre appareil. Session par cookie signé (1 an).
- **Événement public** : visible par toute personne ayant le lien (`/e/<slug>`).
- **Événement privé** : l'API ne renvoie que le nom tant que le code n'est pas saisi. Le bon code pose un cookie signé propre à l'événement : l'invité est reconnu aux visites suivantes. Le lien `/e/<slug>?code=XXXXXX` déverrouille directement. Régénérer le code invalide les anciens accès.
