import {
  TrajectoryGraph,
  type GraphEdgeRecord,
  type GraphNodeRecord,
} from "@/components/trajectory-graph";
import type { RubricComponent } from "@/lib/recommendation-engine";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [
    { data: nodes, error: nodeError },
    { data: edges, error: edgeError },
    { data: rubricVersion, error: versionError },
    { data: evidenceLinks, error: linkError },
    { data: evidenceRecords, error: evidenceError },
  ] =
    await Promise.all([
      supabaseAdmin
        .from("nodes")
        .select("id, type, name, description, metadata"),
      supabaseAdmin
        .from("edges")
        .select("id, source_id, target_id, relationship_type, evidence_class, confidence"),
      supabaseAdmin
        .from("rubric_versions")
        .select("id")
        .eq("rubric_key", "action_impact")
        .eq("is_active", true)
        .single(),
      supabaseAdmin
        .from("edge_evidence")
        .select("edge_id, evidence_id, evidence_role"),
      supabaseAdmin
        .from("evidence_records")
        .select("evidence_id, atomic_claim, claim_class, limitations, relevance_to_trajectory, source_url"),
    ]);

  if (nodeError || edgeError || versionError || linkError || evidenceError) {
    return (
      <main className="trajectory-shell trajectory-error">
        <p className="trajectory-kicker">TRAJECTORY</p>
        <h1>We couldn&apos;t load your path.</h1>
        <p>Please refresh to reconnect to the pathway data.</p>
      </main>
    );
  }

  const { data: rubricComponents, error: componentError } = await supabaseAdmin
    .from("rubric_components")
    .select("component_key, direction, max_points")
    .eq("rubric_version_id", rubricVersion.id);

  if (componentError) {
    return (
      <main className="trajectory-shell trajectory-error">
        <p className="trajectory-kicker">TRAJECTORY</p>
        <h1>We couldn&apos;t load the ranking rubric.</h1>
        <p>Please refresh to reconnect to the recommendation data.</p>
      </main>
    );
  }

  return (
    <main className="trajectory-shell">
      <TrajectoryGraph
        graphNodes={(nodes ?? []) as GraphNodeRecord[]}
        graphEdges={(edges ?? []) as GraphEdgeRecord[]}
        rubricComponents={(rubricComponents ?? []).map((component) => ({
          ...component,
          max_points: Number(component.max_points),
        })) as RubricComponent[]}
        evidenceLinks={evidenceLinks ?? []}
        evidenceRecords={evidenceRecords ?? []}
      />
    </main>
  );
}
