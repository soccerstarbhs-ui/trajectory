"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import {
  profileToRecommendationProfile,
  rankActions,
  type ApplicantProfileSnapshot,
  type DemoProfile,
  type RubricComponent,
} from "@/lib/recommendation-engine";

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
type PathStatus = "completed" | "active" | "recommended" | "available" | "blocked" | "goal";

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
  recommended: "#fb7185",
  available: "#60a5fa",
  blocked: "#64748b",
  goal: "#fbbf24",
};

const statusLabels: Record<PathStatus, string> = {
  completed: "Completed",
  active: "Active",
  recommended: "Recommended",
  available: "Available",
  blocked: "Blocked",
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
  recommendedNodeId: string,
  completedNodeNames: string[],
  activeNodeNames: string[],
  blockedNodeNames: string[],
  availableNodeIds: Set<string>
): PathStatus {
  if (node.type === "goal") return "goal";
  if (includesApplicantName(completedNodeNames, node.name)) return "completed";
  if (includesApplicantName(activeNodeNames, node.name)) return "active";
  if (node.id === recommendedNodeId) return "recommended";
  if (includesApplicantName(blockedNodeNames, node.name)) return "blocked";
  return availableNodeIds.has(node.id) ? "available" : "blocked";
}

function includesApplicantName(names: string[], candidate: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const candidateNormalized = normalize(candidate);
  return names.some((name) => {
    const normalized = normalize(name);
    return normalized === candidateNormalized
      || (Math.min(normalized.length, candidateNormalized.length) >= 14
        && (normalized.includes(candidateNormalized) || candidateNormalized.includes(normalized)));
  });
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
  activeNodeNames: string[],
  blockedNodeNames: string[],
  availableNodeIds: Set<string>
) {
  const stageConfig = stages.find((item) => item.id === stage)!;
  const nodeById = new Map(records.map((node) => [node.id, node]));
  const selected = new Set([goalId]);
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
        const statePriority = (node: GraphNodeRecord) => includesApplicantName(completedNodeNames, node.name)
          ? 0
          : includesApplicantName(activeNodeNames, node.name) ? 1 : node.id === recommendedNodeId ? 2 : 3;
        const stateOrder = statePriority(left) - statePriority(right);
        if (stateOrder) return stateOrder;
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
          recommendedNodeId,
          completedNodeNames,
          activeNodeNames,
          blockedNodeNames,
          availableNodeIds
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
  const goalId = goals[0]?.id ?? "";
  const [stage, setStage] = useState<Stage>("building");
  const [studentSnapshot, setStudentSnapshot] = useState<ApplicantProfileSnapshot | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [view, setView] = useState<"graph" | "recommendation" | "evidence">("graph");
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [stateMessage, setStateMessage] = useState("");
  const [rerouteScenario, setRerouteScenario] = useState<"none" | "rejection" | "opportunity">("none");
  const [rerouteBefore, setRerouteBefore] = useState("");
  const [rejectedNodeName, setRejectedNodeName] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("trajectory-applicant-profile-v1");
        if (stored) {
          const parsed = JSON.parse(stored) as ApplicantProfileSnapshot;
          setStudentSnapshot(parsed);
          const cycleYear = Number(parsed.basic.applicationCycle.match(/\d{4}/)?.[0]);
          const monthsUntilApplication = Number.isFinite(cycleYear)
            ? (new Date(`${cycleYear}-06-01T00:00:00Z`).getTime() - Date.now()) / (86_400_000 * 30.44)
            : null;
          setStage(monthsUntilApplication !== null && monthsUntilApplication <= 12
            ? "applying"
            : parsed.courses.length > 0 || parsed.activities.length > 0 ? "building" : "exploring");
        }
      } catch {
        window.localStorage.removeItem("trajectory-applicant-profile-v1");
      } finally {
        setProfileLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const baseProfile = useMemo(
    () => studentSnapshot ? profileToRecommendationProfile(studentSnapshot) : null,
    [studentSnapshot]
  );
  const activeNodeNames = useMemo(() => studentSnapshot ? [
    ...studentSnapshot.courses.filter((course) => course.status === "in_progress").map((course) => course.name),
    ...studentSnapshot.activities.filter((activity) => activity.status === "active").map((activity) => activity.name),
  ] : [], [studentSnapshot]);
  const profile = useMemo(
    (): DemoProfile | null => baseProfile ? ({
      ...baseProfile,
      completedNodeNames: [
        ...baseProfile.completedNodeNames,
        ...completedActions,
      ],
      blockedNodeNames: [
        ...baseProfile.blockedNodeNames,
        ...(rerouteScenario === "rejection" && rejectedNodeName ? [rejectedNodeName] : []),
      ],
      urgency: rerouteScenario === "opportunity" ? "deadline" as const : baseProfile.urgency,
      actionOutcomes: rerouteScenario === "rejection" && rejectedNodeName
        ? { ...baseProfile.actionOutcomes, [rejectedNodeName]: "rejected" as const }
        : baseProfile.actionOutcomes,
    }) : null,
    [baseProfile, completedActions, rerouteScenario, rejectedNodeName]
  );
  const rankedActions = useMemo(
    () => profile ? rankActions(profile, graphNodes, graphEdges, rubricComponents) : [],
    [profile, graphNodes, graphEdges, rubricComponents]
  );
  const topAction = rankedActions[0];
  const personalizedNodes: GraphNodeRecord[] = studentSnapshot ? [
    ...studentSnapshot.courses.map((course, index) => ({
      id: `profile-course-${index}`,
      type: "course",
      name: course.name,
      description: [course.term, course.grade && `Grade ${course.grade}`].filter(Boolean).join(" · ") || "Student coursework",
      metadata: { source: "applicant_profile", status: course.status },
    })),
    ...studentSnapshot.activities.map((activity, index) => ({
      id: `profile-activity-${index}`,
      type: activity.category === "research" ? "research_lab" : "extracurricular",
      name: activity.name,
      description: activity.description || [activity.role, activity.hours && `${activity.hours} hours`].filter(Boolean).join(" · "),
      metadata: { source: "applicant_profile", category: activity.category, status: activity.status },
    })),
  ].filter((profileNode) => !graphNodes.some((node) => includesApplicantName([profileNode.name], node.name))) : [];
  const personalizedEdges: GraphEdgeRecord[] = personalizedNodes.map((node) => ({
    id: `profile-edge-${node.id}`,
    source_id: node.id,
    target_id: goalId,
    relationship_type: "supports",
    evidence_class: null,
    confidence: "unknown",
  }));
  const pathwayRecords = [...graphNodes, ...personalizedNodes];
  const pathwayEdges = [...graphEdges, ...personalizedEdges];
  const availableNodeIds = new Set([
    ...rankedActions.map((action) => action.node.id),
    ...personalizedNodes
      .filter((node) => node.metadata?.status === "planned")
      .map((node) => node.id),
  ]);
  const pathway = buildPathway(
    pathwayRecords,
    pathwayEdges,
    goalId,
    stage,
    topAction?.node.id ?? "",
    profile?.completedNodeNames ?? [],
    activeNodeNames,
    profile?.blockedNodeNames ?? [],
    availableNodeIds
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
    if (!profile) return;
    const baseline = rankedActions.find((action) => action.addressedGap === "research") ?? topAction;
    if (!baseline) return;
    setCompletedActions([]);
    setStateMessage("");
    setRerouteBefore(baseline.actionLabel);
    setRejectedNodeName(baseline.node.name);
    setRerouteScenario("rejection");
  }

  function runOpportunityDemo() {
    const baseline = topAction;
    if (!baseline) return;
    setCompletedActions([]);
    setStateMessage("");
    setRerouteBefore(baseline.actionLabel);
    setRejectedNodeName("");
    setRerouteScenario("opportunity");
  }

  function resetRerouteDemo() {
    setRerouteScenario("none");
    setRerouteBefore("");
    setRejectedNodeName("");
  }

  if (!profileLoaded) {
    return (
      <section className="recommendation-empty" role="status">
        <strong>Building your personalized trajectory…</strong>
      </section>
    );
  }

  if (!studentSnapshot || !profile) {
    return (
      <section className="onboarding-shell" aria-labelledby="missing-profile-title">
        <div className="onboarding-copy">
          <p className="trajectory-kicker">TRAJECTORY</p>
          <h1 id="missing-profile-title">Complete your profile first.</h1>
          <p>Your saved academics and activities are needed to calculate node states and recommendations.</p>
          <Link className="journey-primary" href="/profile">Open applicant profile <span>→</span></Link>
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
            This is the strongest eligible move for your current {profile.label.toLowerCase()} profile.
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
        <Link className="trajectory-edit" href="/profile">Edit profile</Link>
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
            <small>HIGHEST IMPACT THIS WEEK · PERSONALIZED PROFILE</small>
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
            <span><i className="legend-gap" />Recommended</span>
            <span><i className="legend-available" />Available</span>
            <span><i className="legend-blocked" />Blocked</span>
            <span><i className="legend-goal" />Goal</span>
          </div>
        </div>
      </section>
    </>
  );
}
