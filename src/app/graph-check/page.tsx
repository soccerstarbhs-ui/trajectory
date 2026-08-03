import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function GraphCheckPage() {
  // 1. Find the goal node
  const { data: goal, error: goalError } = await supabaseAdmin
    .from("nodes")
    .select("id, name")
    .eq("type", "goal")
    .single();

  if (goalError || !goal) {
    return (
      <div style={{ padding: 40, fontFamily: "monospace" }}>
        <p style={{ color: "red" }}>
          Could not find a goal node. Did the seed script run?
        </p>
        <pre>{JSON.stringify(goalError, null, 2)}</pre>
      </div>
    );
  }

  // 2. Find every edge that touches the goal node, in either direction
  const { data: edges, error: edgeError } = await supabaseAdmin
    .from("edges")
    .select("id, source_id, target_id, relationship_type, weight")
    .or(`source_id.eq.${goal.id},target_id.eq.${goal.id}`);

  if (edgeError) {
    return (
      <div style={{ padding: 40, fontFamily: "monospace" }}>
        <p style={{ color: "red" }}>Error querying edges.</p>
        <pre>{JSON.stringify(edgeError, null, 2)}</pre>
      </div>
    );
  }

  // 3. Look up the actual names of everything on the other end of those edges
  const otherIds = (edges ?? []).map((e) =>
    e.source_id === goal.id ? e.target_id : e.source_id
  );

  const { data: connectedNodes } = await supabaseAdmin
    .from("nodes")
    .select("id, name, type, probability_impact")
    .in("id", otherIds.length > 0 ? otherIds : ["00000000-0000-0000-0000-000000000000"]);

  const nodeById = new Map((connectedNodes ?? []).map((n) => [n.id, n]));

  const rows = (edges ?? []).map((e) => {
    const otherId = e.source_id === goal.id ? e.target_id : e.source_id;
    const other = nodeById.get(otherId);
    return {
      name: other?.name ?? "(unknown)",
      type: other?.type ?? "?",
      relationship: e.relationship_type,
      weight: e.weight,
      impact: other?.probability_impact ?? 0,
    };
  });

  rows.sort((a, b) => b.weight - a.weight);

  const totalWeight = rows
    .filter((r) => r.relationship === "increases_probability")
    .reduce((sum, r) => sum + r.weight, 0);

  return (
    <div style={{ padding: 40, fontFamily: "monospace", maxWidth: 900 }}>
      <h1>Everything connected to: {goal.name}</h1>
      <p>
        Found <b>{rows.length}</b> direct connections.
      </p>
      <p>
        Sum of &quot;increases_probability&quot; edge weights directly on the
        goal: <b>{totalWeight}</b> (this is a rough preview number — the real
        probability engine with proper math comes in Phase 2, this is just to
        confirm the data is wired up correctly)
      </p>

      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 20 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid black", textAlign: "left" }}>
            <th style={{ padding: 6 }}>Connected Node</th>
            <th style={{ padding: 6 }}>Type</th>
            <th style={{ padding: 6 }}>Relationship</th>
            <th style={{ padding: 6 }}>Weight</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #ccc" }}>
              <td style={{ padding: 6 }}>{r.name}</td>
              <td style={{ padding: 6 }}>{r.type}</td>
              <td style={{ padding: 6 }}>{r.relationship}</td>
              <td style={{ padding: 6 }}>{r.weight}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
