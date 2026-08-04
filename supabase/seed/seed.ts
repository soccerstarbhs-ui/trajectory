// Run with: npx tsx supabase/seed/seed.ts
// Requires .env.local to have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { nodes } from "./nodes";
import { edges } from "./edges";
import evidenceRecords from "./data/evidence-records.json";
import evidenceSources from "./data/evidence-sources.json";
import edgeEvidenceLinks from "./data/edge-evidence-links.json";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log(`Seeding ${nodes.length} nodes...`);

  // Upsert by the stable (type, name) identity so rerunning the seed is safe.
  const { data: insertedNodes, error: nodeError } = await supabase
    .from("nodes")
    .upsert(
      nodes.map(({ key, ...rest }) => rest), // eslint-disable-line @typescript-eslint/no-unused-vars
      { onConflict: "type,name" }
    )
    .select("id, type, name");

  if (nodeError) {
    console.error("❌ Failed to insert nodes:", nodeError.message);
    process.exit(1);
  }

  console.log(`✅ Inserted ${insertedNodes!.length} nodes.`);

  // Build a lookup from local key -> database id without relying on return order.
  const idByIdentity = new Map(
    insertedNodes!.map((node) => [`${node.type}::${node.name}`, node.id])
  );
  const keyToId = new Map<string, string>();
  nodes.forEach((node) => {
    const id = idByIdentity.get(`${node.type}::${node.name}`);
    if (!id) throw new Error(`Missing upserted node: ${node.key}`);
    keyToId.set(node.key, id);
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
    };
  });

  const { error: edgeError } = await supabase.from("edges").upsert(edgeRows, {
    onConflict: "source_id,target_id,relationship_type",
    ignoreDuplicates: true,
  });

  if (edgeError) {
    console.error("❌ Failed to insert edges:", edgeError.message);
    process.exit(1);
  }

  console.log(`✅ Inserted ${edgeRows.length} edges.`);

  console.log(`Seeding ${evidenceSources.length} evidence sources...`);
  const { error: sourceError } = await supabase
    .from("evidence_sources")
    .upsert(evidenceSources, { onConflict: "source_id" });
  if (sourceError) throw new Error(sourceError.message);

  console.log(`Seeding ${evidenceRecords.length} evidence records...`);
  const { error: evidenceError } = await supabase
    .from("evidence_records")
    .upsert(evidenceRecords, { onConflict: "evidence_id" });
  if (evidenceError) throw new Error(evidenceError.message);

  const goalId = keyToId.get("goal_med_school")!;
  const supportEdgeIds = edgeRows
    .filter((edge) => edge.target_id === goalId && edge.relationship_type === "supports")
    .map((edge) => edge.source_id);

  if (supportEdgeIds.length > 0) {
    const { error: defaultBoundaryError } = await supabase
      .from("edges")
      .update({
        evidence_class: "E",
        causal_label: "hypothetical",
        confidence: "low",
        limitations:
          "No retained evidence supports a direct causal admissions effect for this specific node.",
        modeling_rule:
          "Do not score as an admissions boost; use only verified gap, eligibility, or downstream-unlock logic.",
      })
      .eq("target_id", goalId)
      .eq("relationship_type", "supports")
      .in("source_id", supportEdgeIds);
    if (defaultBoundaryError) throw new Error(defaultBoundaryError.message);
  }

  for (const link of edgeEvidenceLinks) {
    const sourceNode = insertedNodes!.find((node) => node.name === link.node_name);
    if (!sourceNode) throw new Error(`Missing evidence-linked node: ${link.node_name}`);

    const { data: linkedEdge, error: linkError } = await supabase
      .from("edges")
      .update({
        evidence_class: link.evidence_class,
        causal_label: link.causal_label,
        confidence: link.confidence,
        population: link.population,
        limitations: link.limitations,
        modeling_rule: link.modeling_rule,
      })
      .eq("source_id", sourceNode.id)
      .eq("target_id", goalId)
      .eq("relationship_type", "supports")
      .select("id")
      .single();
    if (linkError) throw new Error(linkError.message);

    const { error: edgeEvidenceError } = await supabase
      .from("edge_evidence")
      .upsert(
        {
          edge_id: linkedEdge.id,
          evidence_id: link.evidence_id,
          evidence_role: "primary",
        },
        { onConflict: "edge_id,evidence_id" }
      );
    if (edgeEvidenceError) throw new Error(edgeEvidenceError.message);
  }

  console.log("🎉 Seed complete.");
}

main().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
