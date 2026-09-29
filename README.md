# Plateforme événementielle — V0

Prototype web de validation : création d'événement, faire-part (3 styles), page publique avec compte à rebours et partage, accès public / privé par code, espace organisateur.

## Stack

- **Node.js ≥ 20** + **Express**, déployé sur **Vercel** (fonction serverless)
- **Upstash Redis** (ex-Vercel KV) pour les données, **Vercel Blob** pour les images
- Front en HTML / CSS / JS natif, sans build, mobile-first (servi par le CDN Vercel)
- En local sans clés : données en mémoire et images dans `./uploads` (pour tester)

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:3000
```

## Déploiement sur Vercel

1. Importer le dépôt dans Vercel (preset « Other », aucune commande de build).
2. Onglet **Storage** : ajouter **Upstash Redis** (Marketplace) et **Blob**, puis les connecter au projet. Les variables `KV_REST_API_URL` / `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_*`) et `BLOB_READ_WRITE_TOKEN` sont ajoutées automatiquement.
3. **Settings → Environment Variables** : ajouter `SESSION_SECRET` (chaîne aléatoire longue, ex. `openssl rand -hex 32`).
4. Redéployer. Le domaine peut ensuite être branché dans **Settings → Domains**.

| Variable | Rôle |
|---|---|
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Base Upstash Redis |
| `BLOB_READ_WRITE_TOKEN` | Stockage des images |
| `SESSION_SECRET` | Signature des cookies (obligatoire sur Vercel) |

## Structure

```
server.js           Express : API + pages + balises Open Graph de /e/:slug
lib/                store (Redis), uploads (Blob), session (cookies signés), codes, validation
routes/auth.js      Connexion organisateur : email + code à 6 chiffres
routes/events.js    CRUD des événements de l'organisateur
routes/public.js    Page publique + déverrouillage par code
public/             index (connexion), dashboard, edit (création/édition + faire-part), event (page publique)
```

## Fonctionnement de l'accès

- **Organisateur** : à la première connexion, l'email crée le compte et un code à 6 chiffres est affiché ; il est redemandé pour se reconnecter sur un autre appareil. Session par cookie signé (1 an).
- **Événement public** : visible par toute personne ayant le lien (`/e/<slug>`).
- **Événement privé** : l'API ne renvoie que le nom tant que le code n'est pas saisi. Le bon code pose un cookie signé propre à l'événement : l'invité est reconnu aux visites suivantes. Le lien `/e/<slug>?code=XXXXXX` déverrouille directement. Régénérer le code invalide les anciens accès.
