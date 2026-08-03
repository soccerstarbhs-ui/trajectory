import { createClient } from "@supabase/supabase-js";

/**
 * Use this client in the browser / client components.
 * It uses the public "anon" key, which respects Row Level Security (RLS).
 * Safe to use in code that ships to the browser.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
