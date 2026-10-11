// Pages d'atterrissage (référencement) : bannière cookies, statistiques et bouton « Créer » adapté si déjà connecté.
import { api } from "./common.js";

api("/api/auth/me").then(() => document.querySelectorAll('a[href="/connexion?next=/edit"]').forEach((a) => { a.href = "/edit"; })).catch(() => {});
