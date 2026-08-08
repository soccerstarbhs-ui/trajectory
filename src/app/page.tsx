import {
  TrajectoryGraph,
  type GraphEdgeRecord,
  type GraphNodeRecord,
} from "@/components/trajectory-graph";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ data: nodes, error: nodeError }, { data: edges, error: edgeError }] =
    await Promise.all([
      supabaseAdmin
        .from("nodes")
        .select("id, type, name, description, metadata"),
      supabaseAdmin
        .from("edges")
        .select("id, source_id, target_id, relationship_type, confidence"),
    ]);

  if (nodeError || edgeError) {
    return (
      <main className="trajectory-shell trajectory-error">
        <p className="trajectory-kicker">TRAJECTORY</p>
        <h1>We couldn&apos;t load your path.</h1>
        <p>Please refresh to reconnect to the pathway data.</p>
      </main>
    );
  }

  return (
    <main className="trajectory-shell">
      <TrajectoryGraph
        graphNodes={(nodes ?? []) as GraphNodeRecord[]}
        graphEdges={(edges ?? []) as GraphEdgeRecord[]}
      />
    </main>
  );
}
