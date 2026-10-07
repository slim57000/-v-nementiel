# MaFeliza — description technique de la réalisation

Document de passation pour un développeur. MaFeliza est une plateforme d'événements familiaux
(mariage, anniversaire, baptême…) : faire-part, **live depuis un téléphone**, replay, photos/vidéos des invités,
livre d'or, stories, cagnotte, amis et messages. Site web mobile d'abord, bilingue FR/EN, pensé pour les seniors.

Production : **https://mafeliza.com**

---

## 1. Pile technique

| Élément | Choix |
|---|---|
| Serveur | Node.js ≥ 22.13, **Express 5**, modules ES (`"type": "module"`) |
| Front | HTML + CSS + **JavaScript natif (modules ES)**, sans framework ni build |
| Base de données | **Supabase** (Postgres, clé-valeur) si `SUPABASE_URL` + clé définies, sinon **SQLite** local (`DATA_DIR`) |
| Live vidéo | **LiveKit** (WebRTC) : le téléphone du caméraman diffuse, les invités regardent |
| Emails | **Resend** (API HTTP) |
| Notifications | Web Push (VAPID, `web-push`) + push natif APNs / Firebase pour les apps |
| Apps mobiles | **Flutter** (`app/`, WebView du site) ; ancien wrapper Capacitor dans `mobile/` |
| Hébergement | VPS OVH : **Caddy** (HTTPS, reverse proxy) → service systemd `mafeliza` (Node, port 3000) |
| CI | GitHub Actions : build iOS + envoi TestFlight (`.github/workflows/ios-testflight.yml`) |

Dépendances npm volontairement minimales : `express`, `@supabase/supabase-js`, `qrcode`, `web-push`.

---

## 2. Arborescence

```
server.js            Point d'entrée : middlewares, routes, pages HTML, tâche quotidienne, sitemap
routes/
  auth.js            Connexion (email+code/mot de passe, lien magique, Google, Apple), session, admins
  events.js          Espace organisateur /api/events (CRUD, invités, replay, stats, cagnotte)
  public.js          Pages publiques /api/public (liste, événement, déverrouillage par code)
  social.js          /api/public/:slug/* : photos, stories, réactions, livre d'or, RSVP, live LiveKit
  cameraman.js       Espace caméraman (code caméraman, démarrage/arrêt du live, segments du replay)
  me.js              Compte connecté : profil, amis, messages, favoris, notifications
  admin.js           Administration : événements, utilisateurs, signalements, rôles, notifications, audience
lib/
  store.js           Façade base de données → store-supabase.js ou store-sqlite.js (même API)
  config.js          Lecture des variables d'environnement
  email.js           Envoi Resend + gabarit HTML des emails
  confirmations.js   Mails de confirmation (bienvenue, événement créé, RSVP, livre d'or, replay)
  invites.js         Faire-parts par email, rappels, envoi du replay
  livekit.js         Jetons LiveKit, salles, état « en direct »
  push.js / native-push.js   Notifications (cloche, Web Push, APNs/Firebase)
  analytics.js       Statistiques d'audience maison + présence « en ligne maintenant »
  premium.js         Statut Premium (avec durée), durée du replay, statistiques
  demo.js            50 événements de démonstration (photos et dates uniques)
  apple.js, google.js, facebook.js   Connexions sociales (OAuth)
  limits.js          Limitation de débit (anti-abus)
  uploads.js         Images/vidéos envoyées (base64 → fichiers dans uploads/)
public/
  *.html             Une page par écran (index, dashboard, edit, event, live, lk, faire-part, admin…)
  js/                Un module par page + common.js (utilitaires partagés), i18n.js (traductions)
  css/app.css, css/live.css
  img/               Logo, icônes, photos de démonstration (img/demo/)
test/smoke.mjs       Tests de bout en bout (démarre le serveur, appelle l'API)
scripts/deploy.sh    Mise à jour du VPS (git, npm ci, redémarrage)
app/                 Application Flutter (iOS/Android) + scripts de compilation et de signature
supabase/schema.sql  Schéma Supabase
```

---

## 3. Fonctionnement général

### Données
Tout passe par `lib/store.js`. Les objets (organisateurs, événements, photos, livre d'or…) sont stockés en
clé-valeur. Les réglages divers utilisent `getSetting(clé)` / `setSetting(clé, valeur)` : par exemple
`replay:{eventId}` (segments vidéo), `rsvp:{eventId}`, `program:{eventId}`, `pot:{eventId}`,
`evlang:{eventId}` (langue des emails), `analytics:AAAA-MM-JJ`, `magic:{jeton}`.

### Pages et cache
- Les pages HTML sont servies par `server.js` (`versionedPage`), **gardées en mémoire au démarrage** :
  après une mise à jour, il faut **redémarrer** le service.
- Chaque fichier JS/CSS reçoit une empreinte (`?v=hash`) et une **import map** est injectée dans chaque page :
  un téléphone ne garde jamais un ancien script en cache.
- Le nom du site pour Google (`og:site_name` + JSON-LD `WebSite`) est injecté automatiquement.

### Langues (FR/EN)
- Le HTML est écrit en français. `public/js/i18n.js` contient le dictionnaire anglais et traduit la page
  à la volée (MutationObserver, y compris `placeholder`, `aria-label`, `title`).
- Pages légales : blocs `[data-fr]` / `[data-en]`.
- Nouvelle clé : l'ajouter dans le dictionnaire EN de `i18n.js`.
- Côté serveur : `reqLang(req)` (cookie `em-lang`) et `eventLang(event)` pour la langue des emails.

### Sessions et rôles
- Session par cookie signé (`lib/session.js`). Organisateur = compte connecté.
- Administrateurs : `ADMIN_EMAILS` (super-admins) + admins nommés depuis l'interface (avec durée).
- Premium : réglage par organisateur, illimité ou avec date de fin (`lib/premium.js`).

### Live et replay
1. L'organisateur donne le **code caméraman** ; le caméraman ouvre `/cameraman` et diffuse avec LiveKit.
2. Les invités regardent sur `/live?e={slug}` ; le lecteur est `lk.html` (iframe).
3. Le téléphone du caméraman **enregistre le live par morceaux** et les envoie au serveur
   (`/api/cameraman/:slug/replay-file` puis `/replay`), listés dans `replay:{eventId}`.
4. À l'arrêt du live, le **replay part par email** aux invités et à l'organisateur (`replayReadyMail`).
   Il est visible 15 jours (30 jours en Premium), téléchargeable en .zip (archive créée dans le navigateur, `zip.js`).
5. Signature « mafeliza.com » + écran de fin sur le replay et le film souvenir (masqués en Premium).

### Tâche quotidienne
Lancée par le serveur lui-même chaque jour à partir de 9 h (heure de Paris), une seule fois par jour (`cron:daily`).
Elle envoie :
- les notifications « aujourd'hui / demain » ;
- les rappels de la veille aux invités ;
- le rattrapage du replay (3 derniers jours) ;
- le rappel de fin de replay.

Elle est aussi appelable via `GET /api/cron/daily` (protégée par `CRON_SECRET`).

### Autres fonctions notables
- **Faire-part** : 4 styles (classique, moderne, élégant, fleuri), textes préremplis par type d'événement
  (`invitation.js`), carte « invitation à suivre en direct » séparée (`faire-part.js`).
- **Film souvenir** (`film.js`) : diaporama animé généré dans le navigateur (photos, vidéos, livre d'or,
  musique synthétisée en Web Audio), proposé dès le jour J, lien direct `?film=1`.
- **Présence en direct** : chaque page envoie un signal toutes les 30 s (`/api/hit`). L'admin voit qui est en ligne ;
  la page événement affiche « N personnes sont là en ce moment ».
- **Audience** : statistiques maison sans cookie (`analytics.js`), Google Analytics optionnel (`GA_MEASUREMENT_ID`).
- **Mails de confirmation** : bienvenue, événement créé, RSVP, livre d'or, live enregistré, replay
  (`lib/confirmations.js`, limités à 15 par heure et par événement).

---

## 4. Variables d'environnement (`/opt/mafeliza/.env`)

| Variable | Rôle |
|---|---|
| `PORT` | Port du serveur (3000) |
| `PUBLIC_URL` | `https://mafeliza.com` (liens dans les emails — **obligatoire**) |
| `SESSION_SECRET` | Signature des cookies |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Base Supabase (sinon SQLite dans `DATA_DIR`) |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Emails (domaine vérifié dans Resend) |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Live vidéo |
| `ADMIN_EMAILS` | Super-administrateurs (séparés par des virgules) |
| `CRON_SECRET` | Protège `/api/cron/daily` |
| `GOOGLE_CLIENT_ID/SECRET` | Connexion Google |
| `APPLE_SIGNIN_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_SIGNIN_KEY_ID`, `APPLE_SIGNIN_KEY` | Connexion Apple |
| `VAPID_PUBLIC_KEY/PRIVATE_KEY` | Web Push (générées automatiquement si absentes) |
| `APNS_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_TOPIC`, `APNS_SANDBOX`, `FCM_SERVICE_ACCOUNT` | Push natif des applications (iOS / Android) |
| `SUPABASE_BUCKET`, `UPLOAD_DIR`, `DATA_DIR` | Stockage des fichiers envoyés / base SQLite locale |
| `CONTACT_EMAIL` | Adresse qui reçoit le formulaire de contact |
| `SENTRY_DSN` | Suivi des erreurs (facultatif) |
| `FACEBOOK_APP_ID/SECRET` | Ancienne connexion Facebook (remplacée par le lien magique) |
| `GA_MEASUREMENT_ID` | Google Analytics (facultatif) |

Les noms exacts sont lus dans `lib/config.js` et dans chaque module : en cas de doute, chercher `process.env`.
**Ne jamais committer de secrets** (`.env`, clés `.p8`, keystores, `google-services.json` sont ignorés par git).

---

## 5. Développer, tester, déployer

```bash
npm install
npm run dev        # serveur avec rechargement auto sur http://localhost:3000 (SQLite local)
npm test           # tests de bout en bout (test/smoke.mjs)
```

Données de démo : variable `DEMO_EVENTS=on`, ou bouton dans Administration → Réglages.

**Déploiement (VPS)**, sur la branche `main` :
```bash
cd /opt/mafeliza && sudo git pull && sudo systemctl restart mafeliza
# ou : sudo /opt/mafeliza/scripts/deploy.sh
sudo journalctl -u mafeliza -n 50 --no-pager   # journaux
```

**Apps** : `app/LISEZMOI.txt`. Android : `app/compiler.ps1 -Bundle` (AAB signé). iOS : workflow GitHub
« iOS TestFlight » (secrets `APPLE_TEAM_ID`, `IOS_BUNDLE_ID`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_KEY_P8`).

---

## 6. Conventions du code

- Commentaires et textes en **français** ; chaque texte visible a sa traduction dans `i18n.js`.
- Pas de framework ni d'étape de build : un fichier JS par page, utilitaires communs dans `common.js`.
- Toute nouvelle route qui écrit des données : limitation de débit (`tooFast`) et vérification du propriétaire.
- Les tâches secondaires (emails, notifications) ne doivent jamais bloquer la réponse : lancées en arrière-plan.
- Mobile d'abord : tester à 390 px de large (iPhone), le dock du bas ne doit jamais bouger
  (`body.has-tabbar` défile à l'intérieur).
- Avant chaque mise en ligne : `npm test`.

## 7. Points d'attention / pistes

- Redémarrer le service après chaque `git pull` (pages HTML en mémoire).
- Le replay est enregistré par le téléphone du caméraman : si l'application est fermée brutalement,
  les derniers morceaux peuvent manquer, et le mail part alors le lendemain (rattrapage quotidien).
- Pistes : film souvenir exporté en MP4 côté serveur (ffmpeg), cagnotte intégrée via un partenaire,
  voix IA sur les vidéos promotionnelles.
