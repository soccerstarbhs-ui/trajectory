import { RecommendationDemo } from "@/components/recommendation-demo";
import type {
  EngineEdge,
  EngineNode,
  RubricComponent,
} from "@/lib/recommendation-engine";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function RecommendationCheckPage() {
  const [nodesResult, edgesResult, versionsResult] = await Promise.all([
    supabaseAdmin.from("nodes").select("id, type, name, description, metadata"),
    supabaseAdmin
      .from("edges")
      .select("id, source_id, target_id, relationship_type, evidence_class, confidence"),
    supabaseAdmin
      .from("rubric_versions")
      .select("id")
      .eq("rubric_key", "action_impact")
      .eq("is_active", true)
      .single(),
  ]);

  if (nodesResult.error || edgesResult.error || versionsResult.error) {
    return <main className="recommendation-shell">Unable to load the recommendation foundation.</main>;
  }

  const componentsResult = await supabaseAdmin
    .from("rubric_components")
    .select("component_key, direction, max_points")
    .eq("rubric_version_id", versionsResult.data.id);

  if (componentsResult.error) {
    return <main className="recommendation-shell">Unable to load the Action Impact rubric.</main>;
  }

  return (
    <RecommendationDemo
      nodes={(nodesResult.data ?? []) as EngineNode[]}
      edges={(edgesResult.data ?? []) as EngineEdge[]}
      components={(componentsResult.data ?? []).map((component) => ({
        ...component,
        max_points: Number(component.max_points),
      })) as RubricComponent[]}
    />
  );
}
