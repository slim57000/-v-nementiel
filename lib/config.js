// Détection de l'environnement et vérification de la configuration.
export const ON_VERCEL = Boolean(process.env.VERCEL);

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);
export const STORAGE_BUCKET = process.env.SUPABASE_BUCKET || "evenements";

// Sur Vercel, le disque n'est pas utilisable : Supabase et SESSION_SECRET sont obligatoires.
export const missingConfig = ON_VERCEL
  ? [
      !process.env.SESSION_SECRET && "SESSION_SECRET",
      !SUPABASE_URL && "SUPABASE_URL",
      !SUPABASE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean)
  : [];
