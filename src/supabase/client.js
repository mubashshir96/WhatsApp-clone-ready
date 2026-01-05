import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * 🚨 HARD GUARD
 * Env missing ho to app turant clear error de
 */
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "❌ Supabase ENV missing. Check VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY"
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
