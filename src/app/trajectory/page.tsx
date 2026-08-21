import { GuidedTrajectory } from "@/components/guided-trajectory";
import type { EvidenceRecord, GraphEdgeRecord, GraphNodeRecord } from "@/components/trajectory-graph";
import type { RubricComponent } from "@/lib/recommendation-engine";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function PersonalizedTrajectoryPage() {
  const [nodesResult, edgesResult, rubricResult, linksResult, evidenceResult, sourcesResult] = await Promise.all([
    supabaseAdmin.from("nodes").select("id, type, name, description, metadata"),
    supabaseAdmin.from("edges").select("id, source_id, target_id, relationship_type, evidence_class, confidence"),
    supabaseAdmin.from("rubric_components").select("component_key, direction, max_points"),
    supabaseAdmin.from("edge_evidence").select("edge_id, evidence_id, evidence_role"),
    supabaseAdmin.from("evidence_records").select("evidence_id, atomic_claim, claim_class, source_id, source_tier, population, correlation_or_causation, limitations, relevance_to_trajectory, source_url, verification_status, access_date"),
    supabaseAdmin.from("evidence_sources").select("source_id, title"),
  ]);

  const firstError = [nodesResult.error, edgesResult.error, rubricResult.error, linksResult.error, evidenceResult.error, sourcesResult.error].find(Boolean);
  if (firstError) {
    return (
      <main className="onboarding-shell">
        <section className="recommendation-empty" role="alert">
          <strong>Trajectory could not load the pathway data.</strong>
          <span>Please refresh once. If the problem continues, verify the Supabase environment variables.</span>
        </section>
      </main>
    );
  }

  const sourceTitles = new Map((sourcesResult.data ?? []).map((source) => [source.source_id, source.title]));
  const evidenceRecords: EvidenceRecord[] = (evidenceResult.data ?? []).map((record) => ({
    ...record,
    sourceTitle: sourceTitles.get(record.source_id) ?? "Supporting source",
    access_date: record.access_date ?? null,
    population: record.population ?? null,
    source_tier: record.source_tier ?? null,
    relevance_to_trajectory: record.relevance_to_trajectory ?? null,
  }));

  return (
    <main className="trajectory-shell">
      <GuidedTrajectory
        graphNodes={(nodesResult.data ?? []) as GraphNodeRecord[]}
        graphEdges={(edgesResult.data ?? []) as GraphEdgeRecord[]}
        rubricComponents={(rubricResult.data ?? []) as RubricComponent[]}
        evidenceLinks={linksResult.data ?? []}
        evidenceRecords={evidenceRecords}
      />
    </main>
  );
}
