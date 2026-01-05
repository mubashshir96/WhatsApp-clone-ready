import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * 🚨 HARD GUARD (VERY IMPORTANT)
 * Agar env missing ho → clear error throw ho
 * blank string kabhi mat bhejo
 */
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "❌ Supabase ENV missing. Check VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY in Vercel."
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
