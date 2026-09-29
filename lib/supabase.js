import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

// Client serveur (clé service_role) : ne jamais l'exposer côté navigateur.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Renvoie les données ou lève une erreur lisible.
export function unwrap({ data, error }) {
  if (error) throw new Error(`Base de données : ${error.message}`);
  return data;
}
