"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  buildPersonalizedActionNodes,
  deriveReadinessGaps,
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
  { key: "testing", label: "MCAT", icon: "◎" },
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
  personalization: "Matches your selected goal",
  uncertainty: "Uncertainty penalty",
  diminishing_returns: "Diminishing-returns penalty",
  recovery_route: "Recovery-route priority",
};

type EvidenceType = NonNullable<RankedAction["evidenceType"]>;
type AdvisorQuestion = "why" | "month_plan" | "alternative";

const advisorPrompts: Array<{ id: AdvisorQuestion; label: string }> = [
  { id: "why", label: "Why is this my highest-impact focus?" },
  { id: "month_plan", label: "Build my plan for this month" },
  { id: "alternative", label: "What if I choose the alternative?" },
];

const evidenceLabels: Record<EvidenceType, { badge: string; heading: string }> = {
  school_data: { badge: "Admissions benchmark", heading: "Admissions benchmark evidence" },
  self_reported: { badge: "Self-reported data", heading: "Self-reported applicant evidence" },
  research: { badge: "Research evidence", heading: "Research evidence" },
  institutional: { badge: "Institutional guidance", heading: "Institutional guidance" },
  heuristic: { badge: "Planning methodology", heading: "Planning methodology" },
  mixed: { badge: "Combined evidence", heading: "Combined evidence" },
};

function evidenceLabel(type: RankedAction["evidenceType"], context: "badge" | "heading") {
  return evidenceLabels[type ?? "heuristic"][context];
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function namesMatch(first: string, second: string) {
  const left = normalize(first);
  const right = normalize(second);
  return left === right || (Math.min(left.length, right.length) >= 14 && (left.includes(right) || right.includes(left)));
}

function milestoneForGraphNode(node: GraphNodeRecord): MilestoneId {
  const explicit = node.metadata?.readiness_dimension;
  if (explicit === "academic") return "foundation";
  if (explicit === "testing" || explicit === "planning") return "application";
  if (explicit === "clinical" || explicit === "service" || explicit === "exploration") return "experience";
  if (explicit === "research" || explicit === "mentorship") return "depth";
  if (explicit === "leadership") return "differentiation";
  const text = `${node.name} ${JSON.stringify(node.metadata ?? {})}`.toLowerCase();
  if (node.type === "course") return "foundation";
  if (node.type === "research_lab" || node.type === "internship" || /research|laboratory|\blab\b|surf|publication/.test(text)) return "depth";
  if (/resident advis(?:or|er)|resident assistant/.test(text)) return "differentiation";
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
  if (dimension === "testing") return snapshot.basic.mcatScore ? `MCAT ${snapshot.basic.mcatScore} is compared with the selected target tier.` : `No MCAT score is recorded; Trajectory uses the selected tier to set a planning goal.`;
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

  if (data.kind === "milestone") {
    return (
      <div
        className="guided-node guided-milestone-node"
        data-kind="milestone"
        data-status={data.status}
        data-selected={selected}
        style={{ "--guided-accent": color } as React.CSSProperties}
      >
        <Handle type="target" position={Position.Left} />
        <span className="guided-node__eyebrow"><i>{data.eyebrow}</i><b>{statusLabels[data.status]}</b></span>
        <strong>{data.title}</strong>
        <MilestoneIcon milestone={data.milestone!} />
        <small>{data.detail}</small>
        <span className="guided-milestone-node__footer">Click for details <b>→</b></span>
        <Handle type="source" position={Position.Right} />
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

function MilestoneIcon({ milestone }: { milestone: MilestoneId }) {
  const paths: Record<MilestoneId, React.ReactNode> = {
    foundation: <><rect x="8" y="25" width="9" height="9" /><rect x="20" y="25" width="9" height="9" /><rect x="32" y="25" width="9" height="9" /><rect x="14" y="14" width="9" height="9" /><rect x="26" y="14" width="9" height="9" /><rect x="20" y="3" width="9" height="9" /></>,
    experience: <><path d="M25 38V22" /><path d="M13 7v8a8 8 0 0 0 16 0V7" /><path d="M9 7h8m8 0h8" /><circle cx="25" cy="41" r="4" /></>,
    depth: <><path d="M16 8h12m-9 0v11l-8 16a5 5 0 0 0 5 7h18a5 5 0 0 0 5-7l-8-16V8" /><path d="M15 31h20" /><circle cx="21" cy="35" r="2" /><circle cx="29" cy="38" r="2" /></>,
    differentiation: <><circle cx="25" cy="18" r="10" /><path d="m17 26-3 16 11-6 11 6-3-16" /><path d="m25 11 2 4 5 .7-3.5 3.4.8 4.9-4.3-2.3-4.3 2.3.8-4.9-3.5-3.4 5-.7 2-4Z" /></>,
    application: <><path d="M12 4h20l7 7v32H12Z" /><path d="M32 4v9h8M18 21h15M18 27h15M18 33h8" /><circle cx="36" cy="37" r="7" /><path d="m33 37 2 2 4-5" /></>,
  };
  return <svg className="guided-milestone-icon" viewBox="0 0 50 50" aria-hidden="true">{paths[milestone]}</svg>;
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

function FlightRocket({ onComplete }: { onComplete: () => void }) {
  const motionRef = useRef<SVGAnimationElement | null>(null);

  useEffect(() => {
    const motion = motionRef.current;
    if (!motion) return;
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      onComplete();
    };
    const restartFrame = window.requestAnimationFrame(() => {
      motion.ownerSVGElement?.setCurrentTime(0);
      motion.beginElement();
    });
    motion.addEventListener("endEvent", finish);
    const fallback = window.setTimeout(finish, 4200);
    return () => {
      completed = true;
      window.cancelAnimationFrame(restartFrame);
      window.clearTimeout(fallback);
      motion.removeEventListener("endEvent", finish);
    };
  }, [onComplete]);

  return (
    <svg className="guided-flight-svg" viewBox="0 0 1600 830" preserveAspectRatio="none" aria-hidden="true">
      <g>
        <animateMotion
          ref={motionRef}
          begin="indefinite"
          dur="3.85s"
          path="M 130 720 C 260 510 390 400 560 400 C 735 400 900 425 1000 335 C 1090 285 1080 165 970 170 C 860 175 865 320 965 335 C 1065 350 1070 210 1135 180 C 1190 155 1240 185 1294 210"
          keyPoints="0;1"
          keyTimes="0;1"
          keySplines=".26 .08 .24 1"
          calcMode="spline"
          rotate="auto"
          fill="freeze"
        />
        <g transform="rotate(90) translate(-36 -54)">
          <path className="guided-rocket__body" d="M36 5C51 18 57 36 54 62L43 76H29L18 62C15 36 21 18 36 5Z" />
          <path className="guided-rocket__window" d="M36 24a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z" />
          <path className="guided-rocket__fin" d="M19 51 7 72l21-8m25-13 12 21-21-8" />
          <path className="guided-rocket__line" d="M29 76h14" />
          <path className="guided-flight-flame" d="M29 77 Q36 112 43 77 Q36 89 29 77Z" />
        </g>
      </g>
    </svg>
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
}: {
  snapshot: ApplicantProfileSnapshot;
  profile: DemoProfile;
  ranked: RankedAction[];
}) {
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
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed },
      className: "guided-spine-edge",
      style: { stroke: "#5ce0b5", strokeWidth: status === "recommended" ? 3.4 : 2.7 },
    });
    priorId = `milestone-${milestone.id}`;
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
    animated: false,
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
  const [selectedNode, setSelectedNode] = useState<GuidedNode | null>(null);
  const [selectedGap, setSelectedGap] = useState<ReadinessDimension | null>(null);
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, ActionOutcome>>({});
  const [view, setView] = useState<"graph" | "recommendation" | "evidence">("graph");
  const [stateMessage, setStateMessage] = useState("");
  const [launchPhase, setLaunchPhase] = useState<"idle" | "launching" | "celebrating">("idle");
  const [launchCount, setLaunchCount] = useState(0);
  const [showAllMilestoneItems, setShowAllMilestoneItems] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [advisorQuestion, setAdvisorQuestion] = useState<AdvisorQuestion | null>(null);
  const [advisorResponse, setAdvisorResponse] = useState("");
  const [advisorError, setAdvisorError] = useState("");
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const advisorAbortRef = useRef<AbortController | null>(null);

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

  const completeLaunch = useCallback(() => setLaunchPhase("celebrating"), []);

  useEffect(() => {
    if (launchPhase !== "celebrating") return;
    const timer = window.setTimeout(() => setLaunchPhase("idle"), 1250);
    return () => window.clearTimeout(timer);
  }, [launchPhase]);

  useEffect(() => () => advisorAbortRef.current?.abort(), []);

  useEffect(() => {
    if (!advisorOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAdvisorOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [advisorOpen]);

  const baseProfile = useMemo(() => snapshot ? profileToRecommendationProfile(snapshot) : null, [snapshot]);
  const assessment = useMemo(() => snapshot ? deriveReadinessGaps(snapshot) : null, [snapshot]);
  const personalizedNodes = useMemo(() => snapshot && assessment ? buildPersonalizedActionNodes(snapshot, assessment) : [], [snapshot, assessment]);
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
    () => profile ? rankActions(profile, [...graphNodes, ...personalizedNodes], graphEdges, rubricComponents) : [],
    [profile, graphNodes, personalizedNodes, graphEdges, rubricComponents]
  );
  const topAction = ranked[0];
  const alternativeAction = ranked[1];
  const guidedGraph = useMemo(
    () => snapshot && profile
      ? buildGuidedGraph({ snapshot, profile, ranked })
      : { nodes: [] as GuidedNode[], edges: [] as Edge[] },
    [snapshot, profile, ranked]
  );
  const selectedMilestone = selectedNode?.data.kind === "milestone" ? selectedNode.data.milestone : undefined;
  const selectedMilestoneDefinition = milestoneDefinitions.find((milestone) => milestone.id === selectedMilestone);
  const selectedMilestoneItems = selectedMilestone && snapshot
    ? buildProfileItems(snapshot).filter((item) => item.milestone === selectedMilestone && (item.status === "completed" || item.status === "active"))
    : [];
  const selectedMilestoneActions = selectedMilestone
    ? ranked.filter((action) => milestoneForGraphNode(action.node) === selectedMilestone).slice(0, 5)
    : [];
  const missingActivityHours = snapshot?.activities.filter((activity) => {
    const hours = Number(activity.hours);
    return !activity.hours.trim() || !Number.isFinite(hours) || hours <= 0;
  }) ?? [];

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

  function recordOutcome(actionName: string, outcome: ActionOutcome | null) {
    advisorAbortRef.current?.abort();
    advisorAbortRef.current = null;
    setAdvisorOpen(false);
    setAdvisorQuestion(null);
    setAdvisorResponse("");
    setAdvisorError("");
    setAdvisorLoading(false);
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

  async function askTrajectory(question: AdvisorQuestion) {
    if (!topAction || !assessment || !snapshot || !profile) return;

    advisorAbortRef.current?.abort();
    const controller = new AbortController();
    advisorAbortRef.current = controller;
    setAdvisorOpen(true);
    setAdvisorQuestion(question);
    setAdvisorResponse("");
    setAdvisorError("");
    setAdvisorLoading(true);

    try {
      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          question,
          profile: {
            target: assessment.targetFit.benchmark.shortLabel,
            targetFit: assessment.targetFit.message,
            major: snapshot.basic.major,
            gpa: snapshot.basic.gpa,
            mcat: snapshot.basic.mcatScore ? `Score ${snapshot.basic.mcatScore}` : `Goal ${assessment.targetFit.suggestedMcatGoal}+; status ${snapshot.basic.mcatStatus || "not recorded"}`,
            applicationCycle: snapshot.basic.applicationCycle,
            weeklyHoursAvailable: snapshot.basic.weeklyHoursAvailable,
            readiness: Object.fromEntries(Object.entries(profile.gaps).map(([key, gap]) => [key, Math.round((1 - gap) * 100)])),
            coursework: {
              standardReadinessPercent: Math.round(assessment.coursework.readiness * 100),
              missingStandard: assessment.coursework.missingStandard,
              schoolDependentToVerify: assessment.coursework.missingMany,
            },
            experienceHours: {
              clinical: assessment.comparisons.clinical.hours,
              service: assessment.comparisons.service.hours,
              research: assessment.comparisons.research.hours,
            },
          },
          recommendation: {
            action: topAction.actionLabel,
            impact: topAction.impact,
            addressedGap: topAction.addressedGap,
            estimatedCommitment: estimatedHours(topAction),
            reasons: topAction.reasons,
            evidenceType: evidenceLabel(topAction.evidenceType, "badge"),
            evidenceNote: topAction.evidenceNote,
          },
          alternative: alternativeAction ? {
            action: alternativeAction.actionLabel,
            impact: alternativeAction.impact,
            addressedGap: alternativeAction.addressedGap,
            estimatedCommitment: estimatedHours(alternativeAction),
            reasons: alternativeAction.reasons,
            evidenceType: evidenceLabel(alternativeAction.evidenceType, "badge"),
            evidenceNote: alternativeAction.evidenceNote,
          } : null,
          evidence: supportingEvidence.map((record) => ({
            claim: record.atomic_claim,
            source: record.sourceTitle,
            limitation: record.limitations,
          })),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(errorBody?.error || "Ask Trajectory could not answer right now.");
      }
      if (!response.body) throw new Error("Ask Trajectory returned an empty response.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setAdvisorResponse(accumulated);
      }
      accumulated += decoder.decode();
      setAdvisorResponse(accumulated);
      if (!accumulated.trim()) throw new Error("Claude did not return an explanation. Please try again.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setAdvisorError(error instanceof Error ? error.message : "Ask Trajectory could not answer right now.");
    } finally {
      if (advisorAbortRef.current === controller) {
        advisorAbortRef.current = null;
        setAdvisorLoading(false);
      }
    }
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

  if (missingActivityHours.length > 0) {
    return (
      <>{nav}<section className="guided-missing-profile">
        <p>HOURS REQUIRED</p><h1>Add activity hours to continue.</h1>
        <span>Trajectory needs an hour estimate for every activity before it can build an accurate, personalized recommendation. Rough estimates are okay.</span>
        <Link href="/profile">Return to applicant profile →</Link>
      </section></>
    );
  }

  if (view === "recommendation" && topAction) {
    return (
      <>{nav}<section className="journey-detail guided-detail">
        <button className="journey-back" type="button" onClick={() => setView("graph")}>← Back to trajectory</button>
        <div className="journey-action-card">
          <p className="trajectory-kicker">HIGHEST-IMPACT FOCUS THIS MONTH</p>
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
          <div className="trajectory-evidence-basis" data-type={topAction.evidenceType ?? "heuristic"}>
            <span>{evidenceLabel(topAction.evidenceType, "heading")}</span>
            <p>{topAction.evidenceNote}</p>
          </div>
          <div className="evidence-list">
            {supportingEvidence.length > 0 ? supportingEvidence.map((record) => (
              <article key={record.evidence_id}>
                <div><span>Claim class {record.claim_class}</span><i>{record.evidence_id}</i></div>
                <h2>{record.atomic_claim}</h2><h3>{record.sourceTitle}</h3>
                <p>{record.relevance_to_trajectory}</p>
                <small><strong>Limitation:</strong> {record.limitations}</small>
                <a href={record.source_url} target="_blank" rel="noreferrer">Open source ↗</a>
              </article>
            )) : <article><h2>No peer-reviewed atomic claim is linked to this action.</h2><p>The benchmark or planning basis above is still used directionally and is explicitly separated from research evidence.</p></article>}
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
        {assessment ? <div className="guided-target-fit" data-status={assessment.targetFit.status}>
          <span>{assessment.targetFit.benchmark.shortLabel} TARGET</span>
          <strong>{assessment.targetFit.title}</strong>
          <small>{snapshot.basic.mcatScore ? `MCAT ${snapshot.basic.mcatScore}` : `MCAT goal ${assessment.targetFit.suggestedMcatGoal}+`} · GPA {snapshot.basic.gpa || "not entered"}</small>
        </div> : null}
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
              } else {
                setShowAllMilestoneItems(false);
                setSelectedNode(guided);
              }
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(117, 148, 164, 0.18)" />
            <Controls showInteractive={false} />
          </ReactFlow>

          {launchPhase === "launching" ? (
            <div className="guided-flight-path" key={launchCount} aria-hidden="true">
              <FlightRocket onComplete={completeLaunch} />
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
              {selectedMilestone && selectedMilestoneDefinition ? (
                <div className="guided-milestone-summary">
                  <div className="guided-milestone-summary__strength">
                    <span>Section readiness</span>
                    <strong>{readinessLabel(profile.gaps[selectedMilestoneDefinition.gap])}</strong>
                    <em>{Math.round((1 - profile.gaps[selectedMilestoneDefinition.gap]) * 100)}% ready</em>
                  </div>
                  {selectedMilestone === "foundation" && assessment ? <div className="guided-course-audit">
                    <strong>{assessment.coursework.standardComplete ? "Standard prerequisites substantially complete" : `${assessment.coursework.missingStandard.length} standard area${assessment.coursework.missingStandard.length === 1 ? "" : "s"} still incomplete`}</strong>
                    <p>{assessment.coursework.onlyRecommendedOrLimitedManyRemain ? "Only recommended courses or a limited number of school-dependent requirements remain. This section is treated as near-complete." : assessment.coursework.missingStandard.join(", ")}</p>
                    {assessment.coursework.labSubjectsToVerify.length > 0 ? <small>Verify transcript/lab treatment with individual schools: {assessment.coursework.labSubjectsToVerify.join(", ")}.</small> : null}
                  </div> : null}
                  {selectedMilestone === "application" && assessment ? <div className="guided-course-audit" data-fit={assessment.targetFit.status}>
                    <strong>{assessment.targetFit.title}</strong><p>{assessment.targetFit.message}</p>
                  </div> : null}
                  <section>
                    <span>{profile.gaps[selectedMilestoneDefinition.gap] <= 0.28 ? "Section assessment" : "Potential ways to improve"}</span>
                    {profile.gaps[selectedMilestoneDefinition.gap] <= 0.28 ? (
                      <p>This section is currently strong. Focus on maintaining depth and documenting meaningful outcomes rather than adding activities solely for quantity.</p>
                    ) : selectedMilestoneActions.length > 0 ? selectedMilestoneActions.map((action, index) => (
                      <article key={action.node.id}><i>{index + 1}</i><div><strong>{action.actionLabel}</strong><small>{action.impact} impact · {estimatedHours(action)}</small></div></article>
                    )) : <p>No currently eligible option is available. Review prerequisites, deadlines, and existing commitments before adding another activity.</p>}
                  </section>
                  <section>
                    <span>Your completed and current work</span>
                    {selectedMilestoneItems.length > 0 ? selectedMilestoneItems.slice(0, showAllMilestoneItems ? undefined : 4).map((item) => (
                      <article key={item.id}><i data-status={item.status}>{item.status === "completed" ? "✓" : "●"}</i><div><strong>{item.name}</strong><small>{item.detail}</small></div></article>
                    )) : <p>No qualifying work is recorded in this section yet.</p>}
                    {selectedMilestoneItems.length > 4 ? (
                      <button className="guided-milestone-summary__toggle" type="button" onClick={() => setShowAllMilestoneItems((shown) => !shown)}>
                        {showAllMilestoneItems ? "Show less" : `Show all (${selectedMilestoneItems.length})`}
                      </button>
                    ) : null}
                  </section>
                </div>
              ) : null}
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
            </aside>
          ) : null}
        </div>
        <div className="guided-legend">
          {(Object.keys(statusLabels) as VisualStatus[]).map((status) => <span key={status}><i style={{ background: statusColors[status] }} />{statusLabels[status]}</span>)}
          <em>Solid line · primary route</em>
        </div>
      </div>

      <aside className="guided-impact">
        <small>HIGHEST-IMPACT FOCUS THIS MONTH</small>
        {topAction ? <>
          <span className="guided-impact__icon">★</span>
          <span className="guided-impact__evidence">{evidenceLabel(topAction.evidenceType, "badge")}</span>
          <h2>{topAction.actionLabel}</h2>
          <div className="guided-impact__metrics"><span>◷ {estimatedHours(topAction)}</span><span>↗ {topAction.impact} impact</span></div>
          <h3>Why this matters</h3>
          <p>{topAction.reasons[0]} {topAction.reasons[1]}</p>
          <button type="button" onClick={() => setView("recommendation")}>View action plan <span>→</span></button>
          <div className="guided-advisor" data-open={advisorOpen}>
            <button className="guided-advisor__toggle" type="button" aria-haspopup="dialog" aria-expanded={advisorOpen} onClick={() => setAdvisorOpen(true)}>
              <span><i>✦</i> Ask Trajectory</span><b>↗</b>
            </button>
          </div>
        </> : <><h2>No eligible action yet</h2><p>Review blocked prerequisites or update your profile.</p></>}
      </aside>
    </section>
    {advisorOpen && topAction ? (
      <div className="guided-advisor-overlay" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setAdvisorOpen(false);
      }}>
        <section className="guided-advisor-modal" role="dialog" aria-modal="true" aria-labelledby="guided-advisor-title">
          <header>
            <div>
              <small>CONTEXTUAL CLAUDE ADVISOR</small>
              <h2 id="guided-advisor-title"><i>✦</i> Ask Trajectory</h2>
              <p>Understand the recommendation Trajectory already calculated or turn it into a practical monthly plan.</p>
            </div>
            <button type="button" aria-label="Close Ask Trajectory" onClick={() => setAdvisorOpen(false)}>×</button>
          </header>
          <div className="guided-advisor-modal__focus">
            <span>YOUR HIGHEST-IMPACT FOCUS THIS MONTH</span>
            <strong>{topAction.actionLabel}</strong>
            <small>{topAction.impact} impact · {estimatedHours(topAction)} · {topAction.addressedGap} readiness</small>
          </div>
          <div className="guided-advisor__prompts">
            {advisorPrompts.map((prompt) => (
              <button
                type="button"
                key={prompt.id}
                data-active={advisorQuestion === prompt.id}
                disabled={advisorLoading || (prompt.id === "alternative" && !alternativeAction)}
                onClick={() => askTrajectory(prompt.id)}
              ><i>{prompt.id === "why" ? "01" : prompt.id === "month_plan" ? "02" : "03"}</i><span>{prompt.label}</span></button>
            ))}
          </div>
          <div className="guided-advisor-modal__answer">
            {!advisorQuestion && !advisorError ? <div className="guided-advisor-modal__empty"><i>✦</i><strong>Choose a question above.</strong><span>Claude will use only your profile, the deterministic ranking, and the evidence already supplied to Trajectory.</span></div> : null}
            {advisorLoading && !advisorResponse ? <div className="guided-advisor__thinking" role="status"><i /><i /><i /><span>Building your response…</span></div> : null}
            {advisorResponse ? <div className="guided-advisor__response" aria-live="polite" aria-busy={advisorLoading}>{advisorResponse}{advisorLoading ? <i aria-hidden="true" /> : null}</div> : null}
            {advisorError ? <p className="guided-advisor__error" role="alert">{advisorError}</p> : null}
          </div>
          <footer><i>ⓘ</i><span>Claude explains the deterministic result. It cannot change scores, introduce outside evidence, or predict admission.</span></footer>
        </section>
      </div>
    ) : null}
    </>
  );
}
