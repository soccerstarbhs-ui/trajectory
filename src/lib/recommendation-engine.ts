import { buildPersonalizedActionNodes, deriveApplicantAssessment } from "@/lib/applicant-assessment";

export type ReadinessDimension =
  | "academic"
  | "testing"
  | "clinical"
  | "research"
  | "service"
  | "leadership"
  | "exploration"
  | "mentorship"
  | "planning";

export type EngineNode = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
};

export type EngineEdge = {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: string;
  evidence_class: string | null;
  confidence: string | null;
};

export type RubricComponent = {
  component_key: string;
  direction: "positive" | "penalty";
  max_points: number;
};

export type ActionOutcome = "completed" | "rejected" | "conflict" | "ineligible";

export type DemoProfile = {
  id: string;
  label: string;
  summary: string;
  timeline: string;
  gaps: Record<ReadinessDimension, number>;
  completedNodeNames: string[];
  blockedNodeNames: string[];
  urgency: "normal" | "deadline";
  priorityNodeName?: string;
  actionOutcomes?: Record<string, ActionOutcome>;
  weeklyHoursAvailable?: number;
  currentCommitments?: number;
  applicationDate?: string;
  asOfDate?: string;
  clinicalDepth?: { experiences: number; substantialExperiences: number };
  researchDepth?: { experiences: number; substantialExperiences: number; hasOutput?: boolean };
  targetTier?: import("@/data/admissions-benchmarks").TargetTier;
};

export type ApplicantProfileSnapshot = {
  basic: {
    major: string;
    gpa: string;
    scienceGpa?: string;
    graduationDate: string;
    applicationCycle: string;
    targetTier?: import("@/data/admissions-benchmarks").TargetTier | "";
    mcatStatus?: "not_taken" | "planning" | "scheduled" | "completed" | "retaking" | "";
    mcatScore?: string;
    mcatGoal?: string;
    mcatDate?: string;
    academicTrend?: "upward" | "stable" | "downward" | "mixed" | "not_sure" | "";
    stateResidency?: string;
    applicantStatus?: string;
    gapYearFlexibility?: string;
    geographyPreferences?: string;
    missionPreferences?: string;
    contextFactors?: string;
    weeklyHoursAvailable?: string;
  };
  courses: Array<{
    name: string;
    status: "planned" | "in_progress" | "completed";
    term: string;
    grade: string;
  }>;
  activities: Array<{
    category: "extracurricular" | "clinical" | "volunteering" | "leadership" | "research" | "other";
    name: string;
    role: string;
    status: "planned" | "active" | "completed";
    startDate: string;
    endDate: string;
    hours: string;
    description: string;
    responsibility?: "participant" | "contributor" | "lead";
    outcome?: "none" | "measurable_impact" | "presentation" | "poster" | "publication" | "award" | "other";
  }>;
};

export type RankedAction = {
  node: EngineNode;
  actionLabel: string;
  score: number;
  impact: "High" | "Moderate" | "Focused";
  addressedGap: ReadinessDimension;
  unlockCount: number;
  evidenceClass: string;
  confidence: string;
  evidenceType?: "school_data" | "research" | "self_reported" | "institutional" | "heuristic" | "mixed";
  evidenceNote?: string;
  breakdown: Record<string, number>;
  reasons: string[];
};

const SURF_NAME = "Columbia SURF (Summer Undergraduate Research Fellowship)";
const ZUCKERMAN_NAME = "Zuckerman Institute — Neuroscience Research";
const adverseOutcomes = new Set<ActionOutcome>(["rejected", "conflict", "ineligible"]);

const fallbackWeights: Record<string, number> = {
  gap_reduction: 25,
  downstream_value: 20,
  evidence_strength: 15,
  mission_relevance: 10,
  feasibility: 15,
  time_utility: 15,
  uncertainty: 20,
};

const evidenceFraction: Record<string, number> = { A: 1, B: 0.8, C: 0.6, D: 0.4, E: 0.2 };


export function deriveReadinessGaps(snapshot: ApplicantProfileSnapshot, asOfDate = new Date()) {
  return deriveApplicantAssessment(snapshot, asOfDate);
}

export { buildPersonalizedActionNodes };

export function profileToRecommendationProfile(
  snapshot: ApplicantProfileSnapshot,
  context: Partial<Pick<DemoProfile, "actionOutcomes" | "blockedNodeNames" | "weeklyHoursAvailable" | "applicationDate" | "asOfDate">> = {}
): DemoProfile {
  const derived = deriveReadinessGaps(snapshot, context.asOfDate ? new Date(context.asOfDate) : new Date());
  const cycleYear = snapshot.basic.applicationCycle.match(/\d{4}/)?.[0];
  return {
    id: "applicant-profile",
    label: snapshot.basic.major || "Applicant",
    summary: derived.targetFit.message,
    timeline: snapshot.basic.applicationCycle ? `Application cycle ${snapshot.basic.applicationCycle}` : "Application cycle not set",
    gaps: derived.gaps,
    completedNodeNames: derived.completedNodeNames,
    blockedNodeNames: context.blockedNodeNames ?? [],
    urgency: "normal",
    actionOutcomes: context.actionOutcomes,
    weeklyHoursAvailable: context.weeklyHoursAvailable ?? (Number(snapshot.basic.weeklyHoursAvailable) || undefined),
    currentCommitments: derived.currentCommitments,
    applicationDate: context.applicationDate ?? (cycleYear ? `${cycleYear}-06-01` : undefined),
    asOfDate: context.asOfDate,
    clinicalDepth: derived.clinicalDepth,
    researchDepth: derived.researchDepth,
    targetTier: derived.targetFit.targetTier,
  };
}

function normalizedName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function courseCode(value: string) {
  const match = value.toUpperCase().match(/([A-Z]{4})\s*[A-Z]{0,2}\s*(\d{4})/);
  return match ? `${match[1]}${match[2]}` : "";
}

function namesMatch(first: string, second: string) {
  const firstCode = courseCode(first);
  const secondCode = courseCode(second);
  if (firstCode && firstCode === secondCode) return true;
  const normalizedFirst = normalizedName(first);
  const normalizedSecond = normalizedName(second);
  return normalizedFirst === normalizedSecond
    || (Math.min(normalizedFirst.length, normalizedSecond.length) >= 14
      && (normalizedFirst.includes(normalizedSecond) || normalizedSecond.includes(normalizedFirst)));
}

function includesName(names: string[], candidate: string) {
  return names.some((name) => namesMatch(name, candidate));
}

function outcomeFor(profile: DemoProfile, nodeName: string) {
  return Object.entries(profile.actionOutcomes ?? {}).find(([name]) => namesMatch(name, nodeName))?.[1];
}

function dimensionsFor(node: EngineNode): ReadinessDimension[] {
  const explicit = node.metadata?.readiness_dimension;
  if (typeof explicit === "string" && ["academic", "testing", "clinical", "research", "service", "leadership", "exploration", "mentorship", "planning"].includes(explicit)) {
    return [explicit as ReadinessDimension];
  }
  const text = `${node.name} ${JSON.stringify(node.metadata ?? {})}`.toLowerCase();
  const dimensions = new Set<ReadinessDimension>();
  if (node.type === "course") dimensions.add("academic");
  if (/mcat|test prep/.test(text)) dimensions.add("testing");
  if (node.type === "professor") { dimensions.add("mentorship"); dimensions.add("planning"); }
  if (node.type === "research_lab" || /research|surf|nih|\breu\b|amgen|laboratory/.test(text)) {
    dimensions.add("research");
    dimensions.add("mentorship");
  }
  if (/emt|scrib|hospital|clinic|patient/.test(text)) dimensions.add("clinical");
  if (/shadow|scrib|clinical|emt/.test(text)) dimensions.add("exploration");
  if (/volunteer|service|health educator|community|nonprofit/.test(text)) dimensions.add("service");
  if (/lead|president|organizer|founder|student council|resident advisor/.test(text)) dimensions.add("leadership");
  if (node.type === "scholarship" || node.type === "internship" || /deadline|advis/.test(text)) dimensions.add("planning");
  if (dimensions.size === 0) dimensions.add("planning");
  return [...dimensions];
}

function isResearchAcquisition(node: EngineNode) {
  return (node.type === "research_lab" || node.type === "internship") && dimensionsFor(node).includes("research") && !node.metadata?.deepen_existing;
}

function isShadowingAction(node: EngineNode) {
  return /shadow/.test(`${node.name} ${JSON.stringify(node.metadata ?? {})}`.toLowerCase());
}

function isClinicalAcquisition(node: EngineNode) {
  return dimensionsFor(node).includes("clinical") && !node.metadata?.deepen_existing;
}

function actionVerb(node: EngineNode) {
  if (node.type === "personalized_action") return "";
  if (node.type === "course") return "Prioritize ";
  if (node.type === "research_lab") return "Join ";
  if (node.type === "internship" || node.type === "scholarship") return "Apply to ";
  if (node.type === "professor") return "Meet with ";
  return "Start ";
}

function weightFor(components: RubricComponent[], key: string) {
  return components.find((component) => component.component_key === key)?.max_points ?? fallbackWeights[key];
}

function alternativeGroup(nodeId: string, edges: EngineEdge[]) {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges.filter((item) => item.relationship_type === "alternative_to")) {
    if (!adjacency.has(edge.source_id)) adjacency.set(edge.source_id, new Set());
    if (!adjacency.has(edge.target_id)) adjacency.set(edge.target_id, new Set());
    adjacency.get(edge.source_id)?.add(edge.target_id);
    adjacency.get(edge.target_id)?.add(edge.source_id);
  }
  const visited = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const neighbor of adjacency.get(current) ?? []) queue.push(neighbor);
  }
  return visited;
}

function deadlineUtility(node: EngineNode, profile: DemoProfile) {
  const deadlineValue = node.metadata?.deadlineDate ?? node.metadata?.deadline_date;
  if (typeof deadlineValue === "string") {
    const deadline = new Date(`${deadlineValue}T23:59:59Z`);
    const now = profile.asOfDate ? new Date(profile.asOfDate) : new Date();
    const applicationDate = profile.applicationDate ? new Date(`${profile.applicationDate}T00:00:00Z`) : null;
    const timingMultiplier = applicationDate && !Number.isNaN(applicationDate.getTime()) && deadline > applicationDate ? 0.35 : 1;
    const days = (deadline.getTime() - now.getTime()) / 86_400_000;
    if (days < 0) return { expired: true, fraction: 0, timingMultiplier: 1 };
    if (days <= 14) return { expired: false, fraction: 1, timingMultiplier };
    if (days <= 45) return { expired: false, fraction: 0.78, timingMultiplier };
    return { expired: false, fraction: 0.42, timingMultiplier };
  }
  const hasDeadline = Boolean(node.metadata?.deadline);
  const now = profile.asOfDate ? new Date(profile.asOfDate) : new Date();
  const applicationDate = profile.applicationDate ? new Date(`${profile.applicationDate}T00:00:00Z`) : null;
  const monthsUntilApplication = applicationDate && !Number.isNaN(applicationDate.getTime())
    ? (applicationDate.getTime() - now.getTime()) / (86_400_000 * 30.44)
    : null;
  const rawDuration = node.metadata?.duration_months ?? node.metadata?.durationMonths;
  const durationMonths = typeof rawDuration === "number" ? rawDuration : Number(rawDuration) || 0;
  const timingMultiplier = monthsUntilApplication !== null && monthsUntilApplication < 0
    ? 0.3
    : monthsUntilApplication !== null && durationMonths > monthsUntilApplication
      ? Math.max(0.3, monthsUntilApplication / Math.max(durationMonths, 1))
      : 1;
  return {
    expired: false,
    fraction: profile.urgency === "deadline" && hasDeadline ? 1 : hasDeadline ? 0.55 : monthsUntilApplication !== null && monthsUntilApplication <= 6 ? 0.72 : 0.25,
    timingMultiplier,
  };
}

function researchMultiplier(profile: DemoProfile, completedResearchNodes: number) {
  const substantial = Math.max(profile.researchDepth?.substantialExperiences ?? 0, completedResearchNodes);
  if (substantial >= 2) return 0.12;
  if (substantial === 1) return 0.3;
  if ((profile.researchDepth?.experiences ?? 0) > 0) return 0.68;
  return 1;
}

function clinicalMultiplier(profile: DemoProfile, completedClinicalNodes: number) {
  const substantial = Math.max(profile.clinicalDepth?.substantialExperiences ?? 0, completedClinicalNodes);
  if (substantial >= 2) return 0;
  if (substantial === 1) return 0.45;
  if ((profile.clinicalDepth?.experiences ?? 0) > 0) return 0.72;
  return 1;
}

export function rankActions(
  profile: DemoProfile,
  nodes: EngineNode[],
  edges: EngineEdge[],
  components: RubricComponent[]
): RankedAction[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const completedNodes = nodes.filter((node) =>
    includesName(profile.completedNodeNames, node.name) || outcomeFor(profile, node.name) === "completed"
  );
  const completedIds = new Set(completedNodes.map((node) => node.id));
  const completedResearchNodes = completedNodes.filter(isResearchAcquisition).length;
  const completedClinicalNodes = completedNodes.filter(isClinicalAcquisition).length;
  const completedShadowingNodes = completedNodes.filter(isShadowingAction).length;
  const clinicalSaturation = Math.max(profile.clinicalDepth?.substantialExperiences ?? 0, completedClinicalNodes);
  const surfOutcome = outcomeFor(profile, SURF_NAME);
  const recoveryFromSurf = Boolean(surfOutcome && adverseOutcomes.has(surfOutcome));

  return nodes
    .filter((node) => node.type !== "goal")
    .map((node): RankedAction | null => {
      const outcome = outcomeFor(profile, node.name);
      if (completedIds.has(node.id) || includesName(profile.blockedNodeNames, node.name) || (outcome && outcome !== "completed")) return null;
      if (namesMatch(node.name, ZUCKERMAN_NAME) && !recoveryFromSurf) return null;
      if (isClinicalAcquisition(node) && clinicalSaturation >= 2) return null;
      if (isShadowingAction(node) && completedShadowingNodes >= 1) return null;

      const incomingPrerequisites = edges.filter((edge) => edge.target_id === node.id && edge.relationship_type === "prerequisite");
      if (incomingPrerequisites.some((edge) => !completedIds.has(edge.source_id))) return null;

      const deadline = deadlineUtility(node, profile);
      if (deadline.expired) return null;

      if (isResearchAcquisition(node)) {
        const group = alternativeGroup(node.id, edges);
        const completedComparableAlternative = [...group].some((id) => {
          const alternativeNode = nodeById.get(id);
          return id !== node.id && completedIds.has(id) && Boolean(alternativeNode && isResearchAcquisition(alternativeNode));
        });
        if (completedComparableAlternative) return null;
        if ((profile.researchDepth?.substantialExperiences ?? 0) >= 1 && !(namesMatch(node.name, ZUCKERMAN_NAME) && recoveryFromSurf)) return null;
      }

      const dimensions = dimensionsFor(node);
      const addressedGap = dimensions.reduce((largest, dimension) =>
        profile.gaps[dimension] > profile.gaps[largest] ? dimension : largest
      );
      const gap = profile.gaps[addressedGap];
      const outgoing = edges.filter((edge) => edge.source_id === node.id && edge.relationship_type !== "alternative_to");
      const newUnlocks = outgoing.filter((edge) => !completedIds.has(edge.target_id));
      const support = outgoing
        .filter((edge) => edge.relationship_type === "supports")
        .sort((a, b) => (evidenceFraction[b.evidence_class ?? ""] ?? 0) - (evidenceFraction[a.evidence_class ?? ""] ?? 0))[0];
      const isPriorityRecovery = profile.priorityNodeName === node.name;
      const evidenceClass = isPriorityRecovery ? "Graph prerequisite" : support?.evidence_class ?? (node.metadata?.personalized ? "Directional" : "Unclassified");
      const evidenceStrength = isPriorityRecovery ? 1 : support ? evidenceFraction[support.evidence_class ?? ""] ?? 0.3 : node.metadata?.personalized ? 0.68 : 0.13;
      const confidence = isPriorityRecovery ? "high" : support?.confidence ?? (node.metadata?.personalized ? "directional" : "unknown");
      const metadataText = JSON.stringify(node.metadata ?? {}).toLowerCase();
      const missionFit = /columbia|morningside|cuems|surf/.test(`${node.name} ${metadataText}`.toLowerCase()) || Boolean(node.metadata?.personalized);

      const incomingUnlocks = edges.filter((edge) => edge.target_id === node.id && edge.relationship_type === "unlocks");
      const hasUnlockAccess = incomingUnlocks.length === 0 || incomingUnlocks.some((edge) => completedIds.has(edge.source_id));
      const estimatedWeeklyHours = Number(node.metadata?.weekly_hours ?? node.metadata?.weeklyHours ?? (isResearchAcquisition(node) ? 8 : 3));
      let feasibilityFraction = hasUnlockAccess ? 1 : 0.62;
      if ((profile.currentCommitments ?? 0) >= 3) feasibilityFraction *= 0.78;
      if (profile.weeklyHoursAvailable !== undefined && estimatedWeeklyHours > profile.weeklyHoursAvailable) {
        feasibilityFraction *= Math.max(0.25, profile.weeklyHoursAvailable / estimatedWeeklyHours);
      }
      feasibilityFraction *= deadline.timingMultiplier;

      const clinicalAcquisition = isClinicalAcquisition(node);
      const shadowingAction = isShadowingAction(node);
      const diminishingMultiplier = isResearchAcquisition(node)
        ? researchMultiplier(profile, completedResearchNodes)
        : clinicalAcquisition
          ? clinicalMultiplier(profile, completedClinicalNodes)
          : shadowingAction && clinicalSaturation >= 1
            ? clinicalSaturation >= 2 ? 0.35 : 0.65
            : 1;
      const diminishingPenalty = diminishingMultiplier < 1 ? (1 - diminishingMultiplier) * 20 : 0;
      const recoveryBonus = namesMatch(node.name, ZUCKERMAN_NAME) && recoveryFromSurf ? 16 : 0;
      const personalization = Number(node.metadata?.base_priority ?? 0) * 14;

      const breakdown = {
        gap_reduction: gap * weightFor(components, "gap_reduction") * diminishingMultiplier,
        downstream_value: Math.min(newUnlocks.length / 4, 1) * weightFor(components, "downstream_value") * diminishingMultiplier,
        evidence_strength: evidenceStrength * weightFor(components, "evidence_strength"),
        mission_relevance: (missionFit ? 0.8 : 0.45) * weightFor(components, "mission_relevance"),
        feasibility: feasibilityFraction * weightFor(components, "feasibility"),
        time_utility: deadline.fraction * weightFor(components, "time_utility"),
        personalization,
        uncertainty: (1 - evidenceStrength) * weightFor(components, "uncertainty"),
        diminishing_returns: diminishingPenalty,
        recovery_route: recoveryBonus,
      };

      let score = breakdown.gap_reduction + breakdown.downstream_value + breakdown.evidence_strength
        + breakdown.mission_relevance + breakdown.feasibility + breakdown.time_utility
        + breakdown.personalization + breakdown.recovery_route - breakdown.uncertainty - breakdown.diminishing_returns;
      if (gap < 0.25 && newUnlocks.length === 0 && !node.metadata?.personalized) score -= 12;
      score = Math.max(0, Math.min(100, Math.round(score)));

      const reasons = [
        node.metadata?.personalized && node.description ? node.description : `Addresses the ${addressedGap} gap (${Math.round(gap * 100)}% open).`,
        newUnlocks.length > 0 ? `Preserves ${newUnlocks.length} new downstream connection${newUnlocks.length === 1 ? "" : "s"}.` : node.metadata?.personalized ? "Tailored to your profile and selected target." : "Adds no new downstream connection.",
        hasUnlockAccess ? "Graph access requirements are satisfied." : "No incoming unlock is complete, so feasibility is reduced.",
      ];
      if (diminishingPenalty > 0 && isResearchAcquisition(node)) reasons.push(`Research marginal value reduced to ${Math.round(diminishingMultiplier * 100)}% because substantial research already exists.`);
      else if (diminishingPenalty > 0 && clinicalAcquisition) reasons.push(`Clinical marginal value reduced to ${Math.round(diminishingMultiplier * 100)}% because sustained patient-facing experience is already represented.`);
      else if (diminishingPenalty > 0 && shadowingAction) reasons.push("Shadowing value is reduced because direct clinical experience is already represented; another category may add more value.");
      if (recoveryBonus > 0) reasons.push(`Surfaced as a recovery route after SURF ${surfOutcome}.`);
      if (deadline.timingMultiplier < 1) reasons.push("The action's timing does not fit cleanly before the intended application date, so feasibility is reduced.");

      return {
        node,
        actionLabel: `${actionVerb(node)}${node.name}`,
        score,
        impact: score >= 70 ? "High" : score >= 50 ? "Moderate" : "Focused",
        addressedGap,
        unlockCount: newUnlocks.length,
        evidenceClass,
        confidence,
        evidenceType: typeof node.metadata?.evidence_type === "string" ? node.metadata.evidence_type as RankedAction["evidenceType"] : support ? "research" : "heuristic",
        evidenceNote: typeof node.metadata?.evidence_note === "string" ? node.metadata.evidence_note : "Ranked using the evidence graph plus profile-specific feasibility and gap rules.",
        breakdown: Object.fromEntries(Object.entries(breakdown).map(([key, value]) => [key, Math.round(value)])),
        reasons,
      };
    })
    .filter((action): action is RankedAction => Boolean(action))
    .sort((a, b) => b.score - a.score || a.node.name.localeCompare(b.node.name));
}
