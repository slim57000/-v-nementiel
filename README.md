# Plateforme événementielle — V0

Prototype web de validation : création d'événement, faire-part (3 styles), page publique avec compte à rebours et partage, accès public / privé par code, espace organisateur.

## Stack

- **Node.js ≥ 22.13** + **Express** — le même code tourne sur **Vercel** ou sur un serveur classique (**Render**, Railway, VPS)
- Front en HTML / CSS / JS natif, sans build, mobile-first

Le stockage est choisi automatiquement selon les variables d'environnement :

| | Supabase configuré (Vercel, production) | Sans Supabase (Render / serveur / local) |
|---|---|---|
| Données | Postgres Supabase | SQLite dans `DATA_DIR` |
| Images | Supabase Storage (bucket `evenements`) | Disque dans `UPLOAD_DIR` |

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:3000
```

## Déploiement sur Vercel + Supabase

1. **Supabase** : créer un projet sur supabase.com, puis **SQL Editor → New query**, coller le contenu de `supabase/schema.sql` et cliquer **Run** (tables + bucket photos).
2. **Vercel** : importer le dépôt (preset Express, aucune commande de build).
3. **Settings → Environment Variables** :

| Variable | Où la trouver |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → clé `service_role` (secrète) |
| `SESSION_SECRET` | chaîne aléatoire longue, ex. `openssl rand -hex 32` |
| `RESEND_API_KEY` | facultatif : envoi d'emails (code organisateur, code oublié, rappel de fin de replay) via resend.com |
| `STRIPE_SECRET_KEY` | facultatif : réactions payantes du live (Applaudir 1 €, Cœur 2 €, Feu d'artifice 5 €, Champagne 10 €) via Stripe Checkout ; sans elle, toutes les réactions sont gratuites |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | facultatif : connexion avec Google (console.cloud.google.com → Identifiants → ID client OAuth « Application Web », URI de redirection `https://<domaine>/api/auth/google/callback`) |
| `DEMO_EVENTS` | `off` pour ne pas créer les 50 événements de démonstration automatiques |
| `EMAIL_FROM` | facultatif : expéditeur, ex. `EverMoments <contact@votre-domaine.fr>` (domaine vérifié chez Resend) |
| `CRON_SECRET` | facultatif : protège la tâche quotidienne de rappel (Vercel Cron) |
| `ADMIN_EMAILS` | emails des administrateurs, séparés par des virgules (accès à /admin) |
| `GA_MEASUREMENT_ID` | facultatif : identifiant Google Analytics 4 (`G-XXXXXXX`), chargé seulement après accord cookies |

4. Redéployer. Tant qu'une variable manque, le site affiche la liste de ce qui manque.

## Déploiement sur Render (ou autre serveur)

1. Nouveau **Web Service** à partir du dépôt — Build : `npm install` — Start : `npm start`.
2. Ajouter un **disque persistant** monté sur `/var/data`.
3. Variables : `DATA_DIR=/var/data/db`, `UPLOAD_DIR=/var/data/uploads`, `SESSION_SECRET` (chaîne aléatoire longue), `NODE_ENV=production`.

## Applications mobiles

Les applications iOS et Android se trouvent dans `mobile/` (Capacitor) : voir `mobile/README.md`.

## Structure

```
server.js           Express : API + pages + balises Open Graph de /e/:slug
lib/                store (Supabase ou SQLite), uploads (Supabase Storage ou disque), session, codes, validation
supabase/schema.sql Tables et bucket à créer dans Supabase
routes/auth.js      Connexion organisateur : email + code à 6 chiffres
routes/events.js    CRUD des événements de l'organisateur
routes/public.js    Page publique + déverrouillage par code
public/             index (connexion), dashboard, edit (création/édition + faire-part), event (page publique)
```

## Fonctionnement de l'accès

- **Organisateur** : à la première connexion, l'email crée le compte et un code à 6 chiffres est affiché ; il est redemandé pour se reconnecter sur un autre appareil. Session par cookie signé (1 an).
- **Événement public** : visible par toute personne ayant le lien (`/e/<slug>`).
- **Événement privé** : l'API ne renvoie que le nom tant que le code n'est pas saisi. Le bon code pose un cookie signé propre à l'événement : l'invité est reconnu aux visites suivantes. Le lien `/e/<slug>?code=XXXXXX` déverrouille directement. Régénérer le code invalide les anciens accès.
