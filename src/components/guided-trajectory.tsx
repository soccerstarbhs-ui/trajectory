"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  profileToRecommendationProfile,
  rankActions,
  type ActionOutcome,
  type ApplicantProfileSnapshot,
  type DemoProfile,
  type RankedAction,
  type ReadinessDimension,
  type RubricComponent,
} from "@/lib/recommendation-engine";
import type {
  EvidenceLinkRecord,
  EvidenceRecord,
  GraphEdgeRecord,
  GraphNodeRecord,
} from "@/components/trajectory-graph";

type MilestoneId = "foundation" | "experience" | "depth" | "differentiation" | "application";
type VisualStatus = "completed" | "active" | "recommended" | "available" | "blocked" | "goal";
type GuidedNodeKind = "current" | "milestone" | "activity" | "collapse" | "goal";

type GuidedNodeData = {
  kind: GuidedNodeKind;
  eyebrow: string;
  title: string;
  detail: string;
  status: VisualStatus;
  milestone?: MilestoneId;
  actionName?: string;
  source?: "profile" | "graph";
};

type GuidedNode = Node<GuidedNodeData, "guided">;

type ProfileItem = {
  id: string;
  name: string;
  detail: string;
  milestone: MilestoneId;
  status: VisualStatus;
};

const storageKey = "trajectory-applicant-profile-v1";

const milestoneDefinitions: Array<{
  id: MilestoneId;
  number: string;
  title: string;
  detail: string;
  x: number;
  y: number;
  gap: ReadinessDimension;
}> = [
  { id: "foundation", number: "01", title: "Foundation", detail: "Coursework and prerequisites", x: 130, y: 555, gap: "academic" },
  { id: "experience", number: "02", title: "Experience", detail: "Clinical exposure and service", x: 355, y: 445, gap: "clinical" },
  { id: "depth", number: "03", title: "Depth", detail: "Sustained work and contribution", x: 580, y: 340, gap: "research" },
  { id: "differentiation", number: "04", title: "Differentiation", detail: "Leadership and meaningful impact", x: 805, y: 240, gap: "leadership" },
  { id: "application", number: "05", title: "Application", detail: "Timing, materials, and final review", x: 1030, y: 145, gap: "planning" },
];

const statusLabels: Record<VisualStatus, string> = {
  completed: "Completed",
  active: "Current",
  recommended: "Recommended",
  available: "Available",
  blocked: "Blocked",
  goal: "Goal",
};

const statusColors: Record<VisualStatus, string> = {
  completed: "#45daa9",
  active: "#61dff2",
  recommended: "#62e6b8",
  available: "#7690ab",
  blocked: "#66717e",
  goal: "#f5c452",
};

const gapLabels: Array<{ key: ReadinessDimension; label: string; icon: string }> = [
  { key: "academic", label: "Coursework", icon: "▤" },
  { key: "clinical", label: "Clinical", icon: "⌁" },
  { key: "research", label: "Research", icon: "⌕" },
  { key: "service", label: "Service", icon: "♡" },
  { key: "leadership", label: "Leadership", icon: "⚑" },
];

const impactLabels: Record<string, string> = {
  gap_reduction: "Closes your largest gap",
  downstream_value: "Preserves downstream options",
  evidence_strength: "Strength of supporting evidence",
  mission_relevance: "Fits the medical-school pathway",
  feasibility: "Feasible from your current state",
  time_utility: "Useful in your application timeline",
  uncertainty: "Uncertainty penalty",
  diminishing_returns: "Diminishing-returns penalty",
  recovery_route: "Recovery-route priority",
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function namesMatch(first: string, second: string) {
  const left = normalize(first);
  const right = normalize(second);
  return left === right || (Math.min(left.length, right.length) >= 14 && (left.includes(right) || right.includes(left)));
}

function milestoneForGraphNode(node: GraphNodeRecord): MilestoneId {
  const text = `${node.name} ${JSON.stringify(node.metadata ?? {})}`.toLowerCase();
  if (node.type === "course") return "foundation";
  if (node.type === "research_lab" || node.type === "internship" || /research|laboratory|\blab\b|surf|publication/.test(text)) return "depth";
  if (node.type === "scholarship" || /lead|president|founder|mentor|award|fellowship/.test(text)) return "differentiation";
  if (node.type === "professor" || /mcat|application|letter|interview|advisor|deadline/.test(text)) return "application";
  return "experience";
}

function milestoneForProfileActivity(category: ApplicantProfileSnapshot["activities"][number]["category"]): MilestoneId {
  if (category === "research") return "depth";
  if (category === "leadership") return "differentiation";
  return "experience";
}

function visualStatusForProfile(status: "planned" | "in_progress" | "active" | "completed"): VisualStatus {
  if (status === "completed") return "completed";
  if (status === "in_progress" || status === "active") return "active";
  return "available";
}

function estimatedHours(action: RankedAction) {
  const value = action.node.metadata?.weekly_hours ?? action.node.metadata?.weeklyHours;
  const hours = Number(value);
  if (Number.isFinite(hours) && hours > 0) return `${hours} hrs/week`;
  return action.node.type === "research_lab" || action.node.type === "internship" ? "6–10 hrs/week" : "2–4 hrs/week";
}

function readinessLabel(gap: number) {
  const readiness = 1 - gap;
  if (readiness >= 0.72) return "Strong";
  if (readiness >= 0.42) return "Developing";
  return "Needs attention";
}

function readinessEvidence(snapshot: ApplicantProfileSnapshot, dimension: ReadinessDimension) {
  const relevant = dimension === "clinical" ? ["clinical"]
    : dimension === "research" ? ["research"]
      : dimension === "service" ? ["volunteering"]
        : dimension === "leadership" ? ["leadership"] : [];
  if (dimension === "academic") {
    const completed = snapshot.courses.filter((course) => course.status === "completed").length;
    return `${completed} completed courses and GPA ${snapshot.basic.gpa || "not entered"} are included.`;
  }
  if (dimension === "planning") return `Application cycle ${snapshot.basic.applicationCycle || "not entered"} and graduation ${snapshot.basic.graduationDate || "not entered"} are included.`;
  const activities = snapshot.activities.filter((activity) => relevant.includes(activity.category) && activity.status !== "planned");
  const hours = activities.reduce((total, activity) => total + (Number(activity.hours) || 0), 0);
  return `${activities.length} active or completed record${activities.length === 1 ? "" : "s"} and ${hours} documented hours are included.`;
}

function GuidedNodeCard({ data, selected }: NodeProps<GuidedNode>) {
  const color = statusColors[data.status];

  if (data.kind === "current") {
    return (
      <div className="guided-node guided-rocket-node" data-kind="current" data-status={data.status}>
        <span className="guided-rocket-node__hint">Click to launch</span>
        <RocketGraphic />
        <Handle type="source" position={Position.Right} />
      </div>
    );
  }

  if (data.kind === "goal") {
    return (
      <div
        className="guided-node guided-goal-node"
        data-kind="goal"
        data-status={data.status}
        data-selected={selected}
        style={{ "--guided-accent": color } as React.CSSProperties}
      >
        <Handle type="target" position={Position.Left} />
        <div className="guided-goal-orbit guided-goal-orbit--one"><i /></div>
        <div className="guided-goal-orbit guided-goal-orbit--two"><i /></div>
        <div className="guided-goal-orbit guided-goal-orbit--three"><i /></div>
        <div className="guided-goal-planet">
          <svg viewBox="0 0 42 42" aria-hidden="true">
            <path d="M10 16h22M13 16v16m5-16v16m6-16v16m5-16v16M9 32h24M21 8l13 7H8l13-7Z" />
          </svg>
        </div>
        <span className="guided-goal-node__label"><small>DESTINATION</small><strong>Medical School</strong></span>
      </div>
    );
  }

  return (
    <div
      className="guided-node"
      data-kind={data.kind}
      data-status={data.status}
      data-selected={selected}
      style={{ "--guided-accent": color } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Left} />
      <span className="guided-node__eyebrow">
        <i>{data.eyebrow}</i>
        {data.kind !== "collapse" ? <b>{statusLabels[data.status]}</b> : null}
      </span>
      <strong>{data.title}</strong>
      {data.detail ? <small>{data.detail}</small> : null}
      {data.kind !== "collapse" ? <Handle type="source" position={Position.Right} /> : null}
    </div>
  );
}

function RocketGraphic({ moving = false }: { moving?: boolean }) {
  return (
    <span className="guided-rocket" data-moving={moving} aria-hidden="true">
      <svg viewBox="0 0 72 108">
        <path className="guided-rocket__body" d="M36 5C51 18 57 36 54 62L43 76H29L18 62C15 36 21 18 36 5Z" />
        <path className="guided-rocket__window" d="M36 24a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z" />
        <path className="guided-rocket__fin" d="M19 51 7 72l21-8m25-13 12 21-21-8" />
        <path className="guided-rocket__line" d="M29 76h14" />
      </svg>
      <i className="guided-rocket__flame" />
    </span>
  );
}

const nodeTypes = { guided: GuidedNodeCard };

function buildProfileItems(snapshot: ApplicantProfileSnapshot): ProfileItem[] {
  return [
    ...snapshot.courses.map((course, index) => ({
      id: `profile-course-${index}`,
      name: course.name,
      detail: [course.term, course.grade && `Grade ${course.grade}`].filter(Boolean).join(" · ") || "Coursework",
      milestone: "foundation" as const,
      status: visualStatusForProfile(course.status),
    })),
    ...snapshot.activities.map((activity, index) => ({
      id: `profile-activity-${index}`,
      name: activity.name,
      detail: [activity.role, activity.hours && `${activity.hours} hours`].filter(Boolean).join(" · ") || activity.description,
      milestone: milestoneForProfileActivity(activity.category),
      status: visualStatusForProfile(activity.status),
    })),
  ];
}

function buildGuidedGraph({
  snapshot,
  profile,
  ranked,
  graphNodes,
  expanded,
}: {
  snapshot: ApplicantProfileSnapshot;
  profile: DemoProfile;
  ranked: RankedAction[];
  graphNodes: GraphNodeRecord[];
  expanded: MilestoneId[];
}) {
  const profileItems = buildProfileItems(snapshot);
  const topAction = ranked[0];
  const recommendedMilestone = topAction ? milestoneForGraphNode(topAction.node) : null;
  const monthsUntilApplication = profile.applicationDate
    ? (new Date(`${profile.applicationDate}T00:00:00Z`).getTime() - Date.now()) / (86_400_000 * 30.44)
    : null;
  const activeResearch = snapshot.activities.some((activity) => activity.category === "research" && activity.status === "active");
  const currentIndex = monthsUntilApplication !== null && monthsUntilApplication <= 12
    ? 4
    : profile.gaps.leadership < 0.4 ? 3 : activeResearch || profile.gaps.research < 0.45 ? 2 : snapshot.activities.length > 0 ? 1 : 0;

  const nodes: GuidedNode[] = [
    {
      id: "current-position",
      type: "guided",
      position: { x: -95, y: 675 },
      data: {
        kind: "current",
        eyebrow: "Launch",
        title: "Rocket",
        detail: "Decorative trajectory preview",
        status: "active",
      },
    },
  ];

  const edges: Edge[] = [];
  let priorId = "current-position";

  for (const [index, milestone] of milestoneDefinitions.entries()) {
    const gap = profile.gaps[milestone.gap];
    let status: VisualStatus = index < currentIndex ? "completed" : index === currentIndex ? "active" : "available";
    if (gap <= 0.22 && index <= currentIndex) status = "completed";
    if (recommendedMilestone === milestone.id) status = "recommended";

    nodes.push({
      id: `milestone-${milestone.id}`,
      type: "guided",
      position: { x: milestone.x, y: milestone.y },
      data: {
        kind: "milestone",
        eyebrow: milestone.number,
        title: milestone.title,
        detail: milestone.detail,
        status,
        milestone: milestone.id,
      },
    });
    edges.push({
      id: `spine-${priorId}-${milestone.id}`,
      source: priorId,
      target: `milestone-${milestone.id}`,
      type: "bezier",
      animated: status === "active" || status === "recommended",
      markerEnd: { type: MarkerType.ArrowClosed },
      className: "guided-spine-edge",
      style: { stroke: "#5ce0b5", strokeWidth: status === "recommended" ? 3.4 : 2.7 },
    });
    priorId = `milestone-${milestone.id}`;

    const actionItems = ranked
      .filter((action) => milestoneForGraphNode(action.node) === milestone.id)
      .map((action) => ({
        id: `action-${action.node.id}`,
        name: action.node.name,
        detail: action === topAction ? `${action.impact} impact · ${estimatedHours(action)}` : `${action.impact} impact`,
        milestone: milestone.id,
        status: action === topAction ? "recommended" as const : "available" as const,
        actionName: action.node.name,
        source: "graph" as const,
      }));
    const actualItems = profileItems
      .filter((item) => item.milestone === milestone.id)
      .map((item) => ({ ...item, source: "profile" as const }));
    const usedNames = new Set<string>();
    const combined: Array<ProfileItem & { actionName?: string; source: "profile" | "graph" }> = [...actualItems.sort((a, b) => {
      const order: Record<VisualStatus, number> = { active: 0, completed: 1, recommended: 2, available: 3, blocked: 4, goal: 5 };
      return order[a.status] - order[b.status];
    }), ...actionItems].filter((item) => {
      const key = normalize(item.name);
      if ([...usedNames].some((name) => namesMatch(name, key))) return false;
      usedNames.add(key);
      return true;
    });

    const adverseNames = Object.entries(profile.actionOutcomes ?? {})
      .filter(([, outcome]) => outcome !== "completed")
      .map(([name]) => name);
    const blockedCandidate = graphNodes.find((node) =>
      node.type !== "goal"
      && milestoneForGraphNode(node) === milestone.id
      && !combined.some((item) => namesMatch(item.name, node.name))
      && (adverseNames.some((name) => namesMatch(name, node.name)) || !ranked.some((action) => action.node.id === node.id))
    );
    if (blockedCandidate) {
      combined.push({
        id: `blocked-${blockedCandidate.id}`,
        name: blockedCandidate.name,
        detail: "Unavailable from your current state",
        milestone: milestone.id,
        status: "blocked",
        actionName: blockedCandidate.name,
        source: "graph",
      });
    }

    const visibleLimit = expanded.includes(milestone.id) ? 8 : 3;
    const visible = combined.slice(0, visibleLimit);
    visible.forEach((item, itemIndex) => {
      const nodeId = `branch-${milestone.id}-${item.id}`;
      nodes.push({
        id: nodeId,
        type: "guided",
        position: { x: milestone.x + 32, y: milestone.y + 155 + itemIndex * 76 },
        data: {
          kind: "activity",
          eyebrow: item.source === "profile" ? "Your profile" : milestone.title,
          title: item.name,
          detail: item.detail,
          status: item.status,
          milestone: milestone.id,
          actionName: item.actionName,
          source: item.source,
        },
      });
      edges.push({
        id: `branch-edge-${nodeId}`,
        source: `milestone-${milestone.id}`,
        target: nodeId,
        type: "smoothstep",
        animated: item.status === "active" || item.status === "recommended",
        className: "guided-branch-edge",
        style: { stroke: statusColors[item.status], strokeWidth: item.status === "recommended" ? 2 : 1.2, opacity: 0.75 },
      });
    });

    const hidden = combined.length - visible.length;
    if (hidden > 0 || expanded.includes(milestone.id)) {
      const collapseId = `collapse-${milestone.id}`;
      nodes.push({
        id: collapseId,
        type: "guided",
        position: { x: milestone.x + 32, y: milestone.y + 155 + visible.length * 76 },
        data: {
          kind: "collapse",
          eyebrow: expanded.includes(milestone.id) ? "Collapse" : "Expand",
          title: expanded.includes(milestone.id) ? "Show less" : `+${hidden} more`,
          detail: "",
          status: "available",
          milestone: milestone.id,
        },
      });
    }
  }

  nodes.push({
    id: "medical-school-goal",
    type: "guided",
    position: { x: 1280, y: 55 },
    data: {
      kind: "goal",
      eyebrow: "Destination",
      title: "Medical School",
      detail: profile.timeline,
      status: "goal",
    },
  });
  edges.push({
    id: "spine-application-goal",
    source: "milestone-application",
    target: "medical-school-goal",
    type: "bezier",
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    className: "guided-spine-edge guided-spine-edge--goal",
    style: { stroke: statusColors.goal, strokeWidth: 3 },
  });

  return { nodes, edges };
}

export function GuidedTrajectory({
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
  const [snapshot, setSnapshot] = useState<ApplicantProfileSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expandedMilestones, setExpandedMilestones] = useState<MilestoneId[]>([]);
  const [selectedNode, setSelectedNode] = useState<GuidedNode | null>(null);
  const [selectedGap, setSelectedGap] = useState<ReadinessDimension | null>(null);
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, ActionOutcome>>({});
  const [view, setView] = useState<"graph" | "recommendation" | "evidence">("graph");
  const [stateMessage, setStateMessage] = useState("");
  const [launchPhase, setLaunchPhase] = useState<"idle" | "launching" | "celebrating">("idle");
  const [launchCount, setLaunchCount] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored) setSnapshot(JSON.parse(stored) as ApplicantProfileSnapshot);
      } catch {
        window.localStorage.removeItem(storageKey);
      } finally {
        setLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (launchPhase === "idle") return;
    const timer = window.setTimeout(() => {
      setLaunchPhase(launchPhase === "launching" ? "celebrating" : "idle");
    }, launchPhase === "launching" ? 2300 : 1250);
    return () => window.clearTimeout(timer);
  }, [launchPhase]);

  const baseProfile = useMemo(() => snapshot ? profileToRecommendationProfile(snapshot) : null, [snapshot]);
  const profile = useMemo((): DemoProfile | null => baseProfile ? ({
    ...baseProfile,
    completedNodeNames: [...baseProfile.completedNodeNames, ...completedActions],
    actionOutcomes: outcomes,
    blockedNodeNames: [
      ...baseProfile.blockedNodeNames,
      ...Object.entries(outcomes).filter(([, outcome]) => outcome !== "completed").map(([name]) => name),
    ],
  }) : null, [baseProfile, completedActions, outcomes]);
  const ranked = useMemo(
    () => profile ? rankActions(profile, graphNodes, graphEdges, rubricComponents) : [],
    [profile, graphNodes, graphEdges, rubricComponents]
  );
  const topAction = ranked[0];
  const guidedGraph = snapshot && profile
    ? buildGuidedGraph({ snapshot, profile, ranked, graphNodes, expanded: expandedMilestones })
    : { nodes: [] as GuidedNode[], edges: [] as Edge[] };

  const supportingEvidence = useMemo(() => {
    if (!topAction) return [];
    const edgeIds = new Set(graphEdges.filter((edge) => edge.source_id === topAction.node.id).map((edge) => edge.id));
    const evidenceIds = new Set(evidenceLinks.filter((link) => edgeIds.has(link.edge_id)).map((link) => link.evidence_id));
    return evidenceRecords.filter((record) => evidenceIds.has(record.evidence_id)).slice(0, 3);
  }, [topAction, graphEdges, evidenceLinks, evidenceRecords]);

  const nav = (
    <nav className="trajectory-nav">
      <Link href="/" className="orbit-brand" aria-label="Return to destinations">
        <span className="orbit-brand__mark" aria-hidden="true"><i /></span>
        TRAJECTORY
      </Link>
      <span>MEDICAL SCHOOL · PERSONALIZED TRAJECTORY</span>
    </nav>
  );

  function toggleMilestone(milestone?: MilestoneId) {
    if (!milestone) return;
    setExpandedMilestones((current) => current.includes(milestone)
      ? current.filter((item) => item !== milestone)
      : [...current, milestone]);
  }

  function recordOutcome(actionName: string, outcome: ActionOutcome | null) {
    setOutcomes((current) => {
      const next = { ...current };
      if (outcome) next[actionName] = outcome;
      else delete next[actionName];
      return next;
    });
    setCompletedActions((current) => outcome === "completed"
      ? [...new Set([...current, actionName])]
      : current.filter((name) => !namesMatch(name, actionName)));
    setStateMessage(outcome
      ? `${actionName} marked ${outcome}. Your route has been recalculated.`
      : `${actionName} returned to consideration.`);
    setSelectedNode(null);
  }

  if (!loaded) return <section className="recommendation-empty"><strong>Building your guided trajectory…</strong></section>;
  if (!snapshot || !profile) {
    return (
      <section className="guided-missing-profile">
        <p>TRAJECTORY</p><h1>Complete your profile first.</h1>
        <Link href="/profile">Open applicant profile →</Link>
      </section>
    );
  }

  if (view === "recommendation" && topAction) {
    return (
      <>{nav}<section className="journey-detail guided-detail">
        <button className="journey-back" type="button" onClick={() => setView("graph")}>← Back to trajectory</button>
        <div className="journey-action-card">
          <p className="trajectory-kicker">HIGHEST IMPACT THIS WEEK</p>
          <div className="journey-action-card__heading"><h1>{topAction.actionLabel}</h1><strong>{topAction.score}</strong></div>
          <p>{topAction.reasons.join(" ")}</p>
          <div className="journey-metrics">
            <span><strong>{topAction.impact}</strong> impact</span>
            <span><strong>{estimatedHours(topAction)}</strong></span>
            <span><strong>{topAction.addressedGap}</strong> gap</span>
            <span><strong>{topAction.confidence}</strong> confidence</span>
          </div>
          <div className="journey-breakdown">
            {Object.entries(topAction.breakdown).map(([key, points]) => (
              <div key={key}><span>{impactLabels[key] ?? key}</span><strong>{key === "uncertainty" || key === "diminishing_returns" ? "−" : "+"}{points}</strong></div>
            ))}
          </div>
          <small>Relative recommendation heuristic—not an acceptance probability.</small>
          <button className="journey-primary" type="button" onClick={() => setView("evidence")}>Review supporting evidence <span>→</span></button>
        </div>
      </section></>
    );
  }

  if (view === "evidence" && topAction) {
    return (
      <>{nav}<section className="journey-detail guided-detail">
        <button className="journey-back" type="button" onClick={() => setView("recommendation")}>← Back to recommendation</button>
        <div className="evidence-panel">
          <p className="trajectory-kicker">WHY THIS RECOMMENDATION</p>
          <h1>Evidence and boundaries.</h1>
          <div className="evidence-list">
            {supportingEvidence.length > 0 ? supportingEvidence.map((record) => (
              <article key={record.evidence_id}>
                <div><span>Claim class {record.claim_class}</span><i>{record.evidence_id}</i></div>
                <h2>{record.atomic_claim}</h2><h3>{record.sourceTitle}</h3>
                <p>{record.relevance_to_trajectory}</p>
                <small><strong>Limitation:</strong> {record.limitations}</small>
                <a href={record.source_url} target="_blank" rel="noreferrer">Open source ↗</a>
              </article>
            )) : <article><h2>No linked atomic claim is available for this edge.</h2><p>Treat the ranking as directional guidance.</p></article>}
          </div>
          <button className="journey-primary" type="button" onClick={() => { recordOutcome(topAction.node.name, "completed"); setView("graph"); }}>Mark complete and recalculate <span>→</span></button>
        </div>
      </section></>
    );
  }

  return (
    <>{nav}<header className="guided-header">
      <div><p>YOUR PERSONALIZED PATH</p><h1>The clearest path forward.</h1><span>A focused route from your current position to Medical School.</span></div>
      <Link href="/profile">Edit profile</Link>
    </header>
    {stateMessage ? <p className="guided-state-message" role="status">{stateMessage}</p> : null}

    <section className="guided-workspace" data-launch-phase={launchPhase}>
      <aside className="guided-readiness">
        <small>READINESS</small>
        <h2>Your profile</h2>
        <div className="guided-readiness__list">
          {gapLabels.map(({ key, label, icon }) => {
            const gap = profile.gaps[key];
            const readiness = Math.round((1 - gap) * 100);
            return (
              <button type="button" key={key} data-selected={selectedGap === key} onClick={() => setSelectedGap(selectedGap === key ? null : key)}>
                <i>{icon}</i><span><strong>{label}</strong><b>{readinessLabel(gap)}</b><em><u style={{ width: `${readiness}%` }} /></em></span>
              </button>
            );
          })}
        </div>
        {selectedGap ? <div className="guided-readiness__explanation"><strong>{Math.round(profile.gaps[selectedGap] * 100)}% gap remaining</strong><span>{readinessEvidence(snapshot, selectedGap)} This is readiness guidance, not an admission probability.</span></div> : null}
        <button className="guided-readiness__method" type="button" onClick={() => setSelectedGap(selectedGap ? null : "academic")}>How readiness is calculated →</button>
      </aside>

      <div className="guided-canvas-shell">
        <div className="guided-canvas">
          <ReactFlow
            nodes={guidedGraph.nodes}
            edges={guidedGraph.edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.08, minZoom: 0.48, maxZoom: 0.9 }}
            minZoom={0.42}
            maxZoom={1.25}
            nodesConnectable={false}
            nodesDraggable={false}
            deleteKeyCode={null}
            onNodeClick={(_, node) => {
              const guided = node as GuidedNode;
              if (guided.data.kind === "current") {
                if (launchPhase === "idle") {
                  setLaunchCount((count) => count + 1);
                  setLaunchPhase("launching");
                  setSelectedNode(null);
                }
              } else if (guided.data.kind === "collapse") toggleMilestone(guided.data.milestone);
              else setSelectedNode(guided);
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(117, 148, 164, 0.18)" />
            <Controls showInteractive={false} />
          </ReactFlow>

          {launchPhase === "launching" ? (
            <div className="guided-flight-path" key={launchCount} aria-hidden="true">
              <RocketGraphic moving />
            </div>
          ) : null}
          {launchPhase === "celebrating" ? (
            <div className="guided-celebration" aria-hidden="true">
              {Array.from({ length: 16 }, (_, index) => <i key={index} style={{ "--confetti-index": index } as React.CSSProperties} />)}
              <strong>TRAJECTORY COMPLETE</strong>
            </div>
          ) : null}

          {selectedNode ? (
            <aside className="guided-node-panel">
              <button type="button" aria-label="Close details" onClick={() => setSelectedNode(null)}>×</button>
              <small>{selectedNode.data.eyebrow} · {statusLabels[selectedNode.data.status]}</small>
              <h2>{selectedNode.data.title}</h2><p>{selectedNode.data.detail}</p>
              {selectedNode.data.kind === "goal" ? (
                <div className="guided-goal-summary">
                  <span>Application cycle</span><strong>{snapshot.basic.applicationCycle}</strong>
                  <span>Largest remaining gaps</span>
                  {Object.entries(profile.gaps).sort(([, left], [, right]) => right - left).slice(0, 3).map(([key, gap]) => <strong key={key}>{key} · {Math.round(gap * 100)}%</strong>)}
                  <em>Recommendations account for your application date and recorded deadlines.</em>
                </div>
              ) : null}
              {selectedNode.data.actionName && selectedNode.data.source === "graph" ? (
                <div className="guided-outcomes">
                  <span>Update this route</span>
                  <button type="button" onClick={() => recordOutcome(selectedNode.data.actionName!, "completed")}>Completed</button>
                  <button type="button" onClick={() => recordOutcome(selectedNode.data.actionName!, "rejected")}>Rejected</button>
                  <button type="button" onClick={() => recordOutcome(selectedNode.data.actionName!, "conflict")}>Schedule conflict</button>
                  <button type="button" onClick={() => recordOutcome(selectedNode.data.actionName!, "ineligible")}>Ineligible</button>
                  <button type="button" onClick={() => recordOutcome(selectedNode.data.actionName!, null)}>Still considering</button>
                </div>
              ) : null}
              {selectedNode.data.kind === "milestone" ? <button className="guided-expand" type="button" onClick={() => { toggleMilestone(selectedNode.data.milestone); setSelectedNode(null); }}>Expand this milestone</button> : null}
            </aside>
          ) : null}
        </div>
        <div className="guided-legend">
          {(Object.keys(statusLabels) as VisualStatus[]).map((status) => <span key={status}><i style={{ background: statusColors[status] }} />{statusLabels[status]}</span>)}
          <em>Solid line · primary route</em><em>Thin line · related activity</em>
        </div>
      </div>

      <aside className="guided-impact">
        <small>HIGHEST IMPACT THIS WEEK</small>
        {topAction ? <>
          <span className="guided-impact__icon">★</span>
          <h2>{topAction.actionLabel}</h2>
          <div className="guided-impact__metrics"><span>◷ {estimatedHours(topAction)}</span><span>↗ {topAction.impact} impact</span></div>
          <h3>Why this matters</h3>
          <p>{topAction.reasons[0]} {topAction.reasons[1]}</p>
          <button type="button" onClick={() => setView("recommendation")}>View action plan <span>→</span></button>
        </> : <><h2>No eligible action yet</h2><p>Review blocked prerequisites or update your profile.</p></>}
      </aside>
    </section></>
  );
}
