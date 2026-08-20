"use client";

import { useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { demoProfiles } from "@/lib/demo-profiles";
import {
  rankActions,
  type RubricComponent,
} from "@/lib/recommendation-engine";
import { CheckpointProof } from "@/components/checkpoint-proof";

export type GraphNodeRecord = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
};

export type GraphEdgeRecord = {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: string;
  evidence_class: string | null;
  confidence: string | null;
};

export type EvidenceLinkRecord = {
  edge_id: string;
  evidence_id: string;
  evidence_role: string;
};

export type EvidenceRecord = {
  evidence_id: string;
  atomic_claim: string;
  claim_class: string;
  source_id: string;
  source_tier: string | null;
  sourceTitle: string;
  population: string | null;
  correlation_or_causation: string;
  limitations: string;
  relevance_to_trajectory: string | null;
  source_url: string;
  verification_status: string;
  access_date: string | null;
};

type Stage = "exploring" | "building" | "applying";
type PathStatus = "completed" | "active" | "available" | "blocked" | "gap" | "goal";

type TrajectoryNodeData = {
  eyebrow: string;
  title: string;
  detail: string;
  status: PathStatus;
  nodeType: string;
};

type TrajectoryNode = Node<TrajectoryNodeData, "trajectory">;

const stages: Array<{ id: Stage; title: string; detail: string; depth: number }> = [
  {
    id: "exploring",
    title: "Exploring my path",
    detail: "I’m building my academic foundation.",
    depth: 3,
  },
  {
    id: "building",
    title: "Building my profile",
    detail: "Coursework and experiences are underway.",
    depth: 2,
  },
  {
    id: "applying",
    title: "Preparing to apply",
    detail: "I’m focused on closing final gaps.",
    depth: 1,
  },
];

const statusColors: Record<PathStatus, string> = {
  completed: "#34d399",
  active: "#a78bfa",
  available: "#60a5fa",
  blocked: "#64748b",
  gap: "#fb7185",
  goal: "#fbbf24",
};

const statusLabels: Record<PathStatus, string> = {
  completed: "Completed",
  active: "Active",
  available: "Available",
  blocked: "Blocked",
  gap: "Gap",
  goal: "Goal",
};

const typeColors: Record<string, string> = {
  course: "#38bdf8",
  research_lab: "#c084fc",
  professor: "#f472b6",
  extracurricular: "#2dd4bf",
  internship: "#fb923c",
  scholarship: "#facc15",
  club: "#a3e635",
  goal: "#fbbf24",
  current: "#a78bfa",
};

const typeLabels: Record<string, string> = {
  club: "Student organization",
  course: "Course",
  extracurricular: "Experience",
  goal: "Destination",
  internship: "Program",
  professor: "Mentor",
  research_lab: "Research",
  scholarship: "Funding",
};

const impactLabels: Record<string, string> = {
  gap_reduction: "Closes your largest gap",
  downstream_value: "Preserves downstream options",
  evidence_strength: "Strength of supporting evidence",
  mission_relevance: "Fits the selected pathway",
  feasibility: "Feasible from your current state",
  time_utility: "Useful at this point in your timeline",
  uncertainty: "Uncertainty penalty",
  diminishing_returns: "Diminishing-returns penalty",
  recovery_route: "Recovery-route priority",
};

const priorityByStage: Record<Stage, string[]> = {
  exploring: ["course", "professor", "club", "extracurricular", "research_lab", "internship", "scholarship"],
  building: ["research_lab", "internship", "extracurricular", "course", "professor", "club", "scholarship"],
  applying: ["extracurricular", "research_lab", "internship", "professor", "course", "club", "scholarship"],
};

function statusForNode(
  node: GraphNodeRecord,
  level: number,
  index: number,
  maxDepth: number,
  recommendedNodeId: string,
  completedNodeNames: Set<string>,
  blockedNodeNames: Set<string>
): PathStatus {
  if (node.type === "goal") return "goal";
  if (completedNodeNames.has(node.name)) return "completed";
  if (blockedNodeNames.has(node.name)) return "blocked";
  if (node.id === recommendedNodeId) return "active";
  if (level === 1 && index === 0) return "gap";
  if (level === 1 && index === 1) return "blocked";
  if (level === maxDepth && (index === 2 || index === 3)) return "completed";
  return "available";
}

function detailForNode(node: GraphNodeRecord) {
  const metadata = node.metadata ?? {};
  const detail =
    node.description ??
    metadata.focus ??
    metadata.deadline ??
    metadata.dept ??
    metadata.note ??
    "Part of your evidence-backed pathway";

  return String(detail).length > 78
    ? `${String(detail).slice(0, 75)}…`
    : String(detail);
}

function TrajectoryNodeCard({ data, selected }: NodeProps<TrajectoryNode>) {
  const color = statusColors[data.status];
  const typeColor = typeColors[data.nodeType] ?? "#94a3b8";

  return (
    <div
      className="trajectory-node"
      data-selected={selected}
      data-status={data.status}
      style={{ "--node-accent": color, "--type-accent": typeColor } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Left} />
      <span className="trajectory-node__topline">
        <span className="trajectory-node__eyebrow">{data.eyebrow}</span>
        <span className="trajectory-node__status">{statusLabels[data.status]}</span>
      </span>
      <strong>{data.title}</strong>
      <span className="trajectory-node__detail">{data.detail}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { trajectory: TrajectoryNodeCard };

function buildPathway(
  records: GraphNodeRecord[],
  edgeRecords: GraphEdgeRecord[],
  goalId: string,
  stage: Stage,
  recommendedNodeId: string,
  completedNodeNames: string[],
  blockedNodeNames: string[]
) {
  const stageConfig = stages.find((item) => item.id === stage)!;
  const nodeById = new Map(records.map((node) => [node.id, node]));
  const selected = new Set([goalId]);
  const completed = new Set(completedNodeNames);
  const blocked = new Set(blockedNodeNames);
  const distance = new Map([[goalId, 0]]);
  let frontier = [goalId];

  for (let level = 1; level <= stageConfig.depth; level += 1) {
    const candidates = new Set<string>();
    for (const targetId of frontier) {
      for (const edge of edgeRecords) {
        if (edge.target_id === targetId && nodeById.has(edge.source_id)) {
          candidates.add(edge.source_id);
        }
      }
    }

    const priority = priorityByStage[stage];
    frontier = [...candidates]
      .filter((id) => !selected.has(id))
      .sort((a, b) => {
        const left = nodeById.get(a)!;
        const right = nodeById.get(b)!;
        const typeOrder = priority.indexOf(left.type) - priority.indexOf(right.type);
        return typeOrder || left.name.localeCompare(right.name);
      })
      .slice(0, 9);

    frontier.forEach((id) => {
      selected.add(id);
      distance.set(id, level);
    });
  }

  const visibleRecords = [...selected]
    .map((id) => nodeById.get(id))
    .filter((node): node is GraphNodeRecord => Boolean(node));

  const grouped = new Map<number, GraphNodeRecord[]>();
  for (const node of visibleRecords) {
    const level = distance.get(node.id) ?? 0;
    grouped.set(level, [...(grouped.get(level) ?? []), node]);
  }

  const nodes: TrajectoryNode[] = visibleRecords.map((node) => {
    const level = distance.get(node.id) ?? 0;
    const siblings = grouped.get(level) ?? [];
    const index = siblings.findIndex((item) => item.id === node.id);
    return {
      id: node.id,
      type: "trajectory",
      position: {
        x: (stageConfig.depth - level + 1) * 340,
        y: (index - (siblings.length - 1) / 2) * 138 + 420,
      },
      data: {
        eyebrow: typeLabels[node.type] ?? node.type,
        title: node.name,
        detail: detailForNode(node),
        status: statusForNode(
          node,
          level,
          index,
          stageConfig.depth,
          recommendedNodeId,
          completed,
          blocked
        ),
        nodeType: node.type,
      },
    };
  });

  nodes.push({
    id: "current-position",
    type: "trajectory",
    position: { x: 0, y: 420 },
    data: {
      eyebrow: "Current position",
      title: stageConfig.title,
      detail: stageConfig.detail,
      status: "active",
      nodeType: "current",
    },
  });

  const edges: Edge[] = edgeRecords
    .filter((edge) => selected.has(edge.source_id) && selected.has(edge.target_id))
    .map((edge) => ({
      id: edge.id,
      source: edge.source_id,
      target: edge.target_id,
      type: "smoothstep",
      animated: edge.relationship_type === "supports",
      markerEnd: { type: MarkerType.ArrowClosed },
      label: edge.relationship_type.replaceAll("_", " "),
      style: {
        stroke: edge.relationship_type === "supports" ? "#34d399" : "#64748b",
        strokeWidth: edge.relationship_type === "supports" ? 2.2 : 1.5,
      },
    }));

  const entryNodes = visibleRecords.filter(
    (node) => distance.get(node.id) === stageConfig.depth
  );
  for (const node of entryNodes) {
    edges.push({
      id: `current-${node.id}`,
      source: "current-position",
      target: node.id,
      type: "smoothstep",
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#a78bfa", strokeWidth: 2 },
    });
  }

  return { nodes, edges };
}

export function TrajectoryGraph({
  graphNodes,
  graphEdges,
  rubricComponents,
  evidenceLinks,
  evidenceRecords,
}: {
  graphNodes: GraphNodeRecord[];
  graphEdges: GraphEdgeRecord[];
  rubricComponents: RubricComponent[];
  evidenceLinks: EvidenceLinkRecord[];
  evidenceRecords: EvidenceRecord[];
}) {
  const goals = graphNodes.filter((node) => node.type === "goal");
  const [goalId, setGoalId] = useState(goals[0]?.id ?? "");
  const [stage, setStage] = useState<Stage>("building");
  const [profileId, setProfileId] = useState(demoProfiles[0].id);
  const [started, setStarted] = useState(false);
  const [view, setView] = useState<"graph" | "recommendation" | "evidence">("graph");
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [stateMessage, setStateMessage] = useState("");
  const [rerouteScenario, setRerouteScenario] = useState<"none" | "rejection" | "opportunity">("none");
  const [rerouteBefore, setRerouteBefore] = useState("");
  const [rejectedNodeName, setRejectedNodeName] = useState("");
  const [organicChemistryWhatIf, setOrganicChemistryWhatIf] = useState(false);
  const baseProfile = demoProfiles.find((profile) => profile.id === profileId) ?? demoProfiles[0];
  const profile = useMemo(
    () => ({
      ...baseProfile,
      gaps: organicChemistryWhatIf
        ? { ...baseProfile.gaps, academic: 1, research: 0.45, planning: 0.75 }
        : baseProfile.gaps,
      completedNodeNames: [
        ...baseProfile.completedNodeNames.filter(
          (name) => !organicChemistryWhatIf || name !== "CHEM UN2443 Organic Chemistry I"
        ),
        ...completedActions,
      ],
      blockedNodeNames:
        organicChemistryWhatIf
          ? [
              ...baseProfile.blockedNodeNames,
              "CHEM UN2444 Organic Chemistry II",
              "CHEM UN2493/2494 Organic Chemistry Laboratory",
              "BIOC UN3300 Biochemistry",
            ]
          : rerouteScenario === "opportunity"
          ? baseProfile.blockedNodeNames.filter(
              (name) => name !== "Columbia SURF (Summer Undergraduate Research Fellowship)"
            )
          : [
              ...baseProfile.blockedNodeNames,
              ...(rerouteScenario === "rejection" && rejectedNodeName ? [rejectedNodeName] : []),
            ],
      urgency: rerouteScenario === "opportunity" ? "deadline" as const : baseProfile.urgency,
      actionOutcomes: rerouteScenario === "rejection" && rejectedNodeName
        ? { ...baseProfile.actionOutcomes, [rejectedNodeName]: "rejected" as const }
        : baseProfile.actionOutcomes,
      priorityNodeName: organicChemistryWhatIf
        ? "CHEM UN2443 Organic Chemistry I"
        : undefined,
    }),
    [baseProfile, completedActions, rerouteScenario, rejectedNodeName, organicChemistryWhatIf]
  );
  const rankedActions = useMemo(
    () => rankActions(profile, graphNodes, graphEdges, rubricComponents),
    [profile, graphNodes, graphEdges, rubricComponents]
  );
  const topAction = rankedActions[0];
  const whatIfBaseline = useMemo(
    () => rankActions(demoProfiles[0], graphNodes, graphEdges, rubricComponents)[0],
    [graphNodes, graphEdges, rubricComponents]
  );
  const pathway = useMemo(
    () => buildPathway(
      graphNodes,
      graphEdges,
      goalId,
      stage,
      topAction?.node.id ?? "",
      profile.completedNodeNames,
      profile.blockedNodeNames
    ),
    [graphNodes, graphEdges, goalId, stage, topAction?.node.id, profile]
  );

  const supportingEvidence = useMemo(() => {
    if (!topAction) return [];
    const edgeIds = new Set(
      graphEdges
        .filter((edge) => edge.source_id === topAction.node.id)
        .map((edge) => edge.id)
    );
    const evidenceIds = new Set(
      evidenceLinks
        .filter((link) => edgeIds.has(link.edge_id))
        .map((link) => link.evidence_id)
    );
    return evidenceRecords.filter((record) => evidenceIds.has(record.evidence_id)).slice(0, 3);
  }, [topAction, graphEdges, evidenceLinks, evidenceRecords]);

  function completeTopAction() {
    if (!topAction) return;
    const completedLabel = topAction.actionLabel;
    setCompletedActions((current) => [...current, topAction.node.name]);
    setStateMessage(`${completedLabel} marked complete. Your next action has been recalculated.`);
    setView("recommendation");
  }

  function runRejectionDemo() {
    const researchProfile = demoProfiles[0];
    const baseline = rankActions(researchProfile, graphNodes, graphEdges, rubricComponents)[0];
    if (!baseline) return;
    setProfileId(researchProfile.id);
    setCompletedActions([]);
    setStateMessage("");
    setRerouteBefore(baseline.actionLabel);
    setRejectedNodeName(baseline.node.name);
    setRerouteScenario("rejection");
    setOrganicChemistryWhatIf(false);
  }

  function runOpportunityDemo() {
    const researchProfile = demoProfiles[0];
    const baseline = rankActions(researchProfile, graphNodes, graphEdges, rubricComponents)[0];
    if (!baseline) return;
    setProfileId(researchProfile.id);
    setCompletedActions([]);
    setStateMessage("");
    setRerouteBefore(baseline.actionLabel);
    setRejectedNodeName("");
    setRerouteScenario("opportunity");
    setOrganicChemistryWhatIf(false);
  }

  function resetRerouteDemo() {
    setRerouteScenario("none");
    setRerouteBefore("");
    setRejectedNodeName("");
  }

  function runOrganicChemistryWhatIf() {
    setProfileId(demoProfiles[0].id);
    setCompletedActions([]);
    setStateMessage("");
    setRerouteScenario("none");
    setRerouteBefore("");
    setRejectedNodeName("");
    setOrganicChemistryWhatIf(true);
  }

  if (!started) {
    return (
      <section className="onboarding-shell" aria-labelledby="onboarding-title">
        <div className="onboarding-copy">
          <p className="trajectory-kicker">TRAJECTORY</p>
          <h1 id="onboarding-title">Where do you want to go?</h1>
          <p>
            Tell us your destination and where you are now. We&apos;ll map the
            real courses and opportunities between them.
          </p>
        </div>

        <div className="onboarding-panel">
          <fieldset>
            <legend>01 · Choose your destination</legend>
            <label className="destination-card">
              <input
                type="radio"
                name="destination"
                value={goalId}
                checked
                onChange={() => setGoalId(goals[0]?.id ?? "")}
              />
              <span>
                <small>HEALTHCARE</small>
                <strong>{goals[0]?.name ?? "Medical School"}</strong>
                <em>U.S. MD or DO pathway</em>
              </span>
              <i>✓</i>
            </label>
          </fieldset>

          <fieldset>
            <legend>02 · Where are you now?</legend>
            <div className="stage-grid">
              {stages.map((item) => (
                <label key={item.id} className="stage-card" data-active={stage === item.id}>
                  <input
                    type="radio"
                    name="stage"
                    value={item.id}
                    checked={stage === item.id}
                    onChange={() => setStage(item.id)}
                  />
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>03 · Choose a demo profile</legend>
            <div className="onboarding-profile-grid">
              {demoProfiles.map((item) => (
                <label key={item.id} className="onboarding-profile" data-active={profileId === item.id}>
                  <input
                    type="radio"
                    name="profile"
                    value={item.id}
                    checked={profileId === item.id}
                    onChange={() => setProfileId(item.id)}
                  />
                  <strong>{item.label}</strong>
                  <span>{item.summary}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            onClick={() => {
              setCompletedActions([]);
              setStateMessage("");
              setRerouteScenario("none");
              setRerouteBefore("");
              setRejectedNodeName("");
              setOrganicChemistryWhatIf(false);
              setView("graph");
              setStarted(true);
            }}
            disabled={!goalId}
          >
            Map my trajectory <span>→</span>
          </button>
        </div>
      </section>
    );
  }

  const goal = goals.find((item) => item.id === goalId);

  if (view === "recommendation" && topAction) {
    return (
      <section className="journey-detail" aria-labelledby="recommendation-title">
        <div className="journey-progress" aria-label="Demo progress">
          <span data-complete="true">Onboarding</span>
          <span data-complete="true">Graph</span>
          <span data-active="true">Highest-impact action</span>
          <span>Evidence</span>
          <span>State change</span>
        </div>
        <button className="journey-back" type="button" onClick={() => setView("graph")}>
          ← Back to graph
        </button>
        {stateMessage ? <p className="state-update-message">{stateMessage}</p> : null}
        <div className="journey-action-card">
          <p className="trajectory-kicker">HIGHEST IMPACT THIS WEEK</p>
          <div className="journey-action-card__heading">
            <h1 id="recommendation-title">{topAction.actionLabel}</h1>
            <strong>{topAction.score}</strong>
          </div>
          <p>
            This is the strongest eligible move for the {baseProfile.label.toLowerCase()} profile.
            It addresses the <strong>{topAction.addressedGap}</strong> gap and unlocks or supports {topAction.unlockCount} downstream pathway connection{topAction.unlockCount === 1 ? "" : "s"}.
          </p>
          <div className="journey-metrics">
            <span><strong>{topAction.impact}</strong> impact</span>
            <span><strong>Class {topAction.evidenceClass}</strong> evidence</span>
            <span><strong>{topAction.confidence}</strong> confidence</span>
          </div>
          <div className="journey-breakdown">
            {Object.entries(topAction.breakdown).map(([key, points]) => (
              <div key={key}>
                <span>{impactLabels[key] ?? key}</span>
                <strong>{key === "uncertainty" || key === "diminishing_returns" ? "−" : "+"}{points}</strong>
              </div>
            ))}
          </div>
          <small>Action Impact is a transparent relative-ranking heuristic, not an acceptance probability.</small>
          <button className="journey-primary" type="button" onClick={() => setView("evidence")}>
            Review supporting evidence <span>→</span>
          </button>
        </div>
      </section>
    );
  }

  if (view === "evidence" && topAction) {
    return (
      <section className="journey-detail" aria-labelledby="evidence-title">
        <div className="journey-progress" aria-label="Demo progress">
          <span data-complete="true">Onboarding</span>
          <span data-complete="true">Graph</span>
          <span data-complete="true">Highest-impact action</span>
          <span data-active="true">Evidence</span>
          <span>State change</span>
        </div>
        <button className="journey-back" type="button" onClick={() => setView("recommendation")}>
          ← Back to recommendation
        </button>
        <div className="evidence-panel">
          <p className="trajectory-kicker">WHY THIS RECOMMENDATION</p>
          <h1 id="evidence-title">Evidence, boundaries, and confidence.</h1>
          <p>
            The recommendation combines your current gap, eligibility, timing, downstream value,
            and the evidence attached to this action&apos;s graph relationships.
          </p>
          <div className="evidence-list">
            {supportingEvidence.length > 0 ? supportingEvidence.map((record) => (
              <article key={record.evidence_id}>
                <div><span>Claim class {record.claim_class}</span><i>{record.evidence_id}</i></div>
                <h2>{record.atomic_claim}</h2>
                <h3>{record.sourceTitle}</h3>
                <dl className="evidence-metadata">
                  <div><dt>Evidence type</dt><dd>{record.source_tier ?? `Class ${record.claim_class}`}</dd></div>
                  <div><dt>Population</dt><dd>{record.population ?? "Not specified"}</dd></div>
                  <div><dt>Confidence</dt><dd>{topAction.confidence}</dd></div>
                  <div><dt>Causal label</dt><dd>{record.correlation_or_causation}</dd></div>
                  <div><dt>Last checked</dt><dd>{record.access_date ?? "Not recorded"}</dd></div>
                  <div><dt>Verification</dt><dd>{record.verification_status}</dd></div>
                </dl>
                {record.relevance_to_trajectory ? <p>{record.relevance_to_trajectory}</p> : null}
                <small><strong>Limitation:</strong> {record.limitations}</small>
                <a href={record.source_url} target="_blank" rel="noreferrer">Open source ↗</a>
              </article>
            )) : (
              <article>
                <div><span>Class {topAction.evidenceClass}</span><i>Graph evidence</i></div>
                <h2>This action is supported by an evidence-labeled pathway relationship.</h2>
                <p>Confidence is {topAction.confidence}; no linked atomic claim is available for this specific edge.</p>
                <small><strong>Limitation:</strong> The ranking should be treated as directional guidance.</small>
              </article>
            )}
          </div>
          <button className="journey-primary" type="button" onClick={completeTopAction}>
            Mark action complete and recalculate <span>→</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <header className="trajectory-header">
        <div>
          <p className="trajectory-kicker">TRAJECTORY</p>
          <h1>Your future, mapped.</h1>
          <p className="trajectory-subtitle">
            A focused path from where you are now to {goal?.name ?? "your goal"}.
          </p>
        </div>
        <button className="trajectory-edit" type="button" onClick={() => setStarted(false)}>
          Edit path
        </button>
      </header>

      <div className="journey-progress journey-progress--graph" aria-label="Demo progress">
        <span data-complete="true">Onboarding</span>
        <span data-active="true">Graph</span>
        <span>Highest-impact action</span>
        <span>Evidence</span>
        <span>State change</span>
      </div>

      {topAction ? (
        <button className="highest-impact-strip" type="button" onClick={() => setView("recommendation")}>
          <span>
            <small>HIGHEST IMPACT THIS WEEK · {baseProfile.label.toUpperCase()}</small>
            <strong>{topAction.actionLabel}</strong>
          </span>
          <i>{topAction.score} points →</i>
        </button>
      ) : (
        <section className="recommendation-empty" role="status">
          <strong>No eligible action is available yet.</strong>
          <span>Review blocked prerequisites or edit the student profile to reopen the route.</span>
        </section>
      )}

      <section className="reroute-demo" aria-labelledby="reroute-demo-title">
        <div>
          <small>CURATED REROUTING DEMOS</small>
          <strong id="reroute-demo-title">Change the facts. Watch the route adapt.</strong>
        </div>
        <div className="reroute-demo__controls">
          <button type="button" data-active={rerouteScenario === "rejection"} onClick={runRejectionDemo}>
            Simulate research rejection
          </button>
          <button type="button" data-active={rerouteScenario === "opportunity"} onClick={runOpportunityDemo}>
            Announce Columbia fellowship
          </button>
          {rerouteScenario !== "none" ? (
            <button className="reroute-reset" type="button" onClick={resetRerouteDemo}>Reset</button>
          ) : null}
        </div>
        {rerouteScenario !== "none" && topAction ? (
          <div className="reroute-result" aria-live="polite">
            <span>
              <small>BEFORE</small>
              <strong>{rerouteBefore}</strong>
            </span>
            <i>→</i>
            <span>
              <small>{rerouteScenario === "rejection" ? "BEST AVAILABLE ALTERNATIVE" : "NEW ROUTE · 11/12 ELIGIBILITY VERIFIED"}</small>
              <strong>{topAction.actionLabel}</strong>
            </span>
          </div>
        ) : null}
      </section>

      <section className="what-if-demo" aria-labelledby="what-if-title">
        <div className="what-if-demo__heading">
          <span>
            <small>WHAT IF?</small>
            <strong id="what-if-title">What happens if I don&apos;t take Organic Chemistry I?</strong>
          </span>
          <button type="button" onClick={organicChemistryWhatIf ? () => setOrganicChemistryWhatIf(false) : runOrganicChemistryWhatIf}>
            {organicChemistryWhatIf ? "Restore original plan" : "Skip Organic Chemistry I"}
          </button>
        </div>
        {organicChemistryWhatIf && topAction ? (
          <div className="what-if-comparison" aria-live="polite">
            <article>
              <small>BEFORE</small>
              <strong>Academic foundation on track</strong>
              <p>Organic Chemistry II, Organic Chemistry Laboratory, and Biochemistry remain reachable in sequence.</p>
              <span>{whatIfBaseline?.actionLabel ?? "Original recommendation preserved"}</span>
            </article>
            <article data-changed="true">
              <small>AFTER SKIPPING</small>
              <strong>Three downstream courses become blocked</strong>
              <p>The sequence pauses until Organic Chemistry I is completed. The shortest recovery route is the next available term or summer offering.</p>
              <span>New recommendation: {topAction.actionLabel}</span>
            </article>
          </div>
        ) : (
          <p>Test the downstream effects and best recovery route without changing the saved pathway.</p>
        )}
      </section>

      <section className="trajectory-graph-frame" aria-label="Trajectory graph">
        <div className="trajectory-graph-frame__topline">
          <span>{goal?.name.toUpperCase()} PATHWAY</span>
          <span>STAGE-BASED STATUS PREVIEW · {pathway.nodes.length - 1} LIVE NODES</span>
        </div>
        <div className="trajectory-canvas">
          <ReactFlow
            key={`${goalId}-${stage}`}
            nodes={pathway.nodes}
            edges={pathway.edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.16 }}
            minZoom={0.3}
            maxZoom={1.65}
            nodesConnectable={false}
            deleteKeyCode={null}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1.15}
              color="rgba(148, 163, 184, 0.2)"
            />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => statusColors[(node.data as TrajectoryNodeData).status]}
            />
            <Controls showInteractive={false} />
          </ReactFlow>
          <div className="trajectory-canvas__legend">
            <span><i className="legend-completed" />Completed</span>
            <span><i className="legend-active" />Active</span>
            <span><i className="legend-available" />Available</span>
            <span><i className="legend-blocked" />Blocked</span>
            <span><i className="legend-gap" />Gap</span>
            <span><i className="legend-goal" />Goal</span>
          </div>
        </div>
      </section>
      <CheckpointProof />
    </>
  );
}
