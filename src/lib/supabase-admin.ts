import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY. Never import this into a client component or anything
 * that ships to the browser — it uses the service_role key, which
 * bypasses Row Level Security entirely.
 *
 * Use this for: the seed script, admin scripts, and server-side API
 * routes that need full database access (e.g. writing computed
 * curated graph and evidence data back to the database).
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
