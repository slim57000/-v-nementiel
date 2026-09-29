// Détection de l'environnement et vérification de la configuration.
export const ON_VERCEL = Boolean(process.env.VERCEL);

export const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
export const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export const USE_REDIS = Boolean(REDIS_URL && REDIS_TOKEN);
export const USE_BLOB = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

// Sur Vercel, le disque n'est pas utilisable : Redis, Blob et SESSION_SECRET sont obligatoires.
export const missingConfig = ON_VERCEL
  ? [
      !process.env.SESSION_SECRET && "SESSION_SECRET",
      !USE_REDIS && "KV_REST_API_URL + KV_REST_API_TOKEN (Storage → Upstash Redis)",
      !USE_BLOB && "BLOB_READ_WRITE_TOKEN (Storage → Blob)",
    ].filter(Boolean)
  : [];
