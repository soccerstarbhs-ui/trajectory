// Run with: npx tsx supabase/seed/seed.ts
// Requires .env.local to have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { nodes } from "./nodes";
import { edges } from "./edges";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log(`Seeding ${nodes.length} nodes...`);

  // Insert nodes, drop the local-only "key" field, get real ids back
  const { data: insertedNodes, error: nodeError } = await supabase
    .from("nodes")
    .insert(
      nodes.map(({ key, ...rest }) => rest) // eslint-disable-line @typescript-eslint/no-unused-vars
    )
    .select("id, name");

  if (nodeError) {
    console.error("❌ Failed to insert nodes:", nodeError.message);
    process.exit(1);
  }

  console.log(`✅ Inserted ${insertedNodes!.length} nodes.`);

  // Build a lookup from local key -> real database id, by matching
  // insertion order (Postgres preserves array insert order 1:1 with
  // the returned rows for a single insert statement).
  const keyToId = new Map<string, string>();
  nodes.forEach((n, i) => {
    keyToId.set(n.key, insertedNodes![i].id);
  });

  console.log(`Seeding ${edges.length} edges...`);

  const edgeRows = edges.map((e) => {
    const source_id = keyToId.get(e.source);
    const target_id = keyToId.get(e.target);
    if (!source_id || !target_id) {
      throw new Error(
        `Edge references unknown key: ${e.source} -> ${e.target}`
      );
    }
    return {
      source_id,
      target_id,
      relationship_type: e.relationship_type,
      weight: e.weight,
    };
  });

  const { error: edgeError } = await supabase.from("edges").insert(edgeRows);

  if (edgeError) {
    console.error("❌ Failed to insert edges:", edgeError.message);
    process.exit(1);
  }

  console.log(`✅ Inserted ${edgeRows.length} edges.`);
  console.log("🎉 Seed complete.");
}

main();
