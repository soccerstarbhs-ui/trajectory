export type ReadinessDimension =
  | "academic"
  | "clinical"
  | "research"
  | "service"
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

export type DemoProfile = {
  id: string;
  label: string;
  summary: string;
  timeline: string;
  gaps: Record<ReadinessDimension, number>;
  completedNodeNames: string[];
  blockedNodeNames: string[];
  urgency: "normal" | "deadline";
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
  breakdown: Record<string, number>;
};

const fallbackWeights: Record<string, number> = {
  gap_reduction: 25,
  downstream_value: 20,
  evidence_strength: 15,
  mission_relevance: 10,
  feasibility: 15,
  time_utility: 15,
  uncertainty: 20,
};

const evidenceFraction: Record<string, number> = {
  A: 1,
  B: 0.8,
  C: 0.6,
  D: 0.4,
  E: 0.2,
};

function dimensionsFor(node: EngineNode): ReadinessDimension[] {
  const text = `${node.name} ${JSON.stringify(node.metadata ?? {})}`.toLowerCase();
  const dimensions = new Set<ReadinessDimension>();

  if (node.type === "course") dimensions.add("academic");
  if (node.type === "professor") {
    dimensions.add("mentorship");
    dimensions.add("planning");
  }
  if (node.type === "research_lab" || /research|surf|nih|\breu\b|amgen|laboratory/.test(text)) {
    dimensions.add("research");
    dimensions.add("mentorship");
  }
  if (/emt|scrib|hospital|clinic|patient/.test(text)) dimensions.add("clinical");
  if (/shadow|scrib|clinical|emt/.test(text)) dimensions.add("exploration");
  if (/volunteer|service|health educator|community|nonprofit/.test(text)) dimensions.add("service");
  if (node.type === "scholarship" || node.type === "internship" || /deadline|advis/.test(text)) {
    dimensions.add("planning");
  }
  if (dimensions.size === 0) dimensions.add("planning");

  return [...dimensions];
}

function actionVerb(node: EngineNode) {
  if (node.type === "course") return "Prioritize";
  if (node.type === "research_lab") return "Join";
  if (node.type === "internship" || node.type === "scholarship") return "Apply to";
  if (node.type === "professor") return "Meet with";
  return "Start";
}

function weightFor(components: RubricComponent[], key: string) {
  return components.find((component) => component.component_key === key)?.max_points ?? fallbackWeights[key];
}

export function rankActions(
  profile: DemoProfile,
  nodes: EngineNode[],
  edges: EngineEdge[],
  components: RubricComponent[]
): RankedAction[] {
  const completed = new Set(profile.completedNodeNames);
  const blocked = new Set(profile.blockedNodeNames);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return nodes
    .filter(
      (node) =>
        node.type !== "goal" && !completed.has(node.name) && !blocked.has(node.name)
    )
    .map((node): RankedAction | null => {
      const incomingPrerequisites = edges.filter(
        (edge) => edge.target_id === node.id && edge.relationship_type === "prerequisite"
      );
      const satisfiedPrerequisites = incomingPrerequisites.filter((edge) =>
        completed.has(nodeById.get(edge.source_id)?.name ?? "")
      ).length;
      if (incomingPrerequisites.length > 0 && satisfiedPrerequisites < incomingPrerequisites.length) {
        return null;
      }

      const dimensions = dimensionsFor(node);
      const addressedGap = dimensions.reduce((largest, dimension) =>
        profile.gaps[dimension] > profile.gaps[largest] ? dimension : largest
      );
      const gap = profile.gaps[addressedGap];
      const outgoing = edges.filter(
        (edge) => edge.source_id === node.id && edge.relationship_type !== "alternative_to"
      );
      const support = outgoing
        .filter((edge) => edge.relationship_type === "supports")
        .sort(
          (a, b) =>
            (evidenceFraction[b.evidence_class ?? ""] ?? 0) -
            (evidenceFraction[a.evidence_class ?? ""] ?? 0)
        )[0];
      const evidenceClass = support?.evidence_class ?? "Unclassified";
      const evidenceStrength = evidenceFraction[support?.evidence_class ?? ""] ?? 0.13;
      const confidence = support?.confidence ?? "unknown";
      const metadataText = JSON.stringify(node.metadata ?? {}).toLowerCase();
      const missionFit = /columbia|morningside|cuems|surf/.test(`${node.name} ${metadataText}`.toLowerCase());
      const hasDeadline = Boolean(node.metadata?.deadline);

      const breakdown = {
        gap_reduction: gap * weightFor(components, "gap_reduction"),
        downstream_value:
          Math.min(outgoing.length / 4, 1) * weightFor(components, "downstream_value"),
        evidence_strength: evidenceStrength * weightFor(components, "evidence_strength"),
        mission_relevance: (missionFit ? 0.8 : 0.45) * weightFor(components, "mission_relevance"),
        feasibility: weightFor(components, "feasibility"),
        time_utility:
          (profile.urgency === "deadline" && hasDeadline ? 1 : hasDeadline ? 0.5 : 0.27) *
          weightFor(components, "time_utility"),
        uncertainty: (1 - evidenceStrength) * weightFor(components, "uncertainty"),
      };

      let score =
        breakdown.gap_reduction +
        breakdown.downstream_value +
        breakdown.evidence_strength +
        breakdown.mission_relevance +
        breakdown.feasibility +
        breakdown.time_utility -
        breakdown.uncertainty;

      if (gap < 0.25 && outgoing.length === 0) score -= 12;
      score = Math.max(0, Math.min(100, Math.round(score)));

      return {
        node,
        actionLabel: `${actionVerb(node)} ${node.name}`,
        score,
        impact: score >= 70 ? "High" : score >= 50 ? "Moderate" : "Focused",
        addressedGap,
        unlockCount: outgoing.length,
        evidenceClass,
        confidence,
        breakdown: Object.fromEntries(
          Object.entries(breakdown).map(([key, value]) => [key, Math.round(value)])
        ),
      };
    })
    .filter((action): action is RankedAction => Boolean(action))
    .sort((a, b) => b.score - a.score || a.node.name.localeCompare(b.node.name));
}
