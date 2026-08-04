import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function TestConnectionPage() {
  const { error } = await supabaseAdmin
    .from("_connection_check")
    .select("*")
    .limit(1);

  // "Table does not exist" is actually a SUCCESS signal here — it means we
  // reached the real database and got a real, specific response back.
  // Any other error (bad key, network failure, etc.) means something's
  // actually wrong. Two possible codes for "table missing" depending on
  // which layer answers: 42P01 (raw Postgres) or PGRST205 (Supabase's
  // PostgREST API layer, which is what you'll normally see).
  const connected =
    !error || error.code === "42P01" || error.code === "PGRST205";

  return (
    <div style={{ padding: 40, fontFamily: "monospace" }}>
      <h1>Supabase Connection Test</h1>
      {connected ? (
        <p style={{ color: "green", fontSize: 20 }}>
          ✅ Connected to Supabase successfully.
          <br />
          The Trajectory data project is reachable.
        </p>
      ) : (
        <div>
          <p style={{ color: "red", fontSize: 20 }}>❌ Connection failed.</p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
          <p>
            Double check .env.local has the correct URL and keys, then
            restart `npm run dev`.
          </p>
        </div>
      )}
    </div>
  );
}
