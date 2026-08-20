import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveReadinessGaps,
  rankActions,
  type DemoProfile,
  type EngineEdge,
  type EngineNode,
  type ReadinessDimension,
} from "./recommendation-engine";

const SURF = "Columbia SURF (Summer Undergraduate Research Fellowship)";
const ZUCKERMAN = "Zuckerman Institute — Neuroscience Research";

const nodes: EngineNode[] = [
  { id: "goal", type: "goal", name: "Medical School", description: null, metadata: null },
  { id: "surf", type: "internship", name: SURF, description: null, metadata: { weekly_hours: 8 } },
  { id: "zuckerman", type: "research_lab", name: ZUCKERMAN, description: null, metadata: { weekly_hours: 8 } },
  { id: "service", type: "extracurricular", name: "Community Health Volunteer", description: null, metadata: { weekly_hours: 3 } },
];

const edges: EngineEdge[] = [
  { id: "surf-goal", source_id: "surf", target_id: "goal", relationship_type: "supports", evidence_class: "B", confidence: "high" },
  { id: "zuckerman-goal", source_id: "zuckerman", target_id: "goal", relationship_type: "supports", evidence_class: "B", confidence: "high" },
  { id: "service-goal", source_id: "service", target_id: "goal", relationship_type: "supports", evidence_class: "B", confidence: "high" },
  { id: "surf-zuckerman", source_id: "surf", target_id: "zuckerman", relationship_type: "alternative_to", evidence_class: null, confidence: null },
];

const openGaps: Record<ReadinessDimension, number> = {
  academic: 0.2,
  clinical: 0.2,
  research: 1,
  service: 0.45,
  leadership: 0.35,
  exploration: 0.2,
  mentorship: 0.7,
  planning: 0.35,
};

function profile(overrides: Partial<DemoProfile> = {}): DemoProfile {
  return {
    id: "test",
    label: "Test applicant",
    summary: "",
    timeline: "",
    gaps: openGaps,
    completedNodeNames: [],
    blockedNodeNames: [],
    urgency: "normal",
    asOfDate: "2026-01-01",
    applicationDate: "2027-06-01",
    weeklyHoursAvailable: 10,
    currentCommitments: 1,
    researchDepth: { experiences: 0, substantialExperiences: 0 },
    ...overrides,
  };
}

test("completing SURF does not recommend Zuckerman next", () => {
  const ranked = rankActions(profile({
    completedNodeNames: [SURF],
    actionOutcomes: { [SURF]: "completed" },
    researchDepth: { experiences: 1, substantialExperiences: 1 },
  }), nodes, edges, []);

  assert.equal(ranked.some((action) => action.node.name === ZUCKERMAN), false);
  assert.equal(ranked[0]?.node.name, "Community Health Volunteer");
});

test("a SURF rejection unlocks Zuckerman as the recovery route", () => {
  const ranked = rankActions(profile({ actionOutcomes: { [SURF]: "rejected" } }), nodes, edges, []);

  assert.equal(ranked[0]?.node.name, ZUCKERMAN);
  assert.equal(ranked[0]?.breakdown.recovery_route, 16);
  assert.match(ranked[0]?.reasons.join(" ") ?? "", /recovery route after SURF rejected/i);
});

test("substantial research applies diminishing returns to another lab", () => {
  const baseline = rankActions(profile({ actionOutcomes: { [SURF]: "rejected" } }), nodes, edges, []);
  const experienced = rankActions(profile({
    actionOutcomes: { [SURF]: "rejected" },
    researchDepth: { experiences: 1, substantialExperiences: 1 },
  }), nodes, edges, []);
  const baselineZuckerman = baseline.find((action) => action.node.name === ZUCKERMAN);
  const experiencedZuckerman = experienced.find((action) => action.node.name === ZUCKERMAN);

  assert.ok(baselineZuckerman && experiencedZuckerman);
  assert.ok(experiencedZuckerman.score < baselineZuckerman.score);
  assert.equal(experiencedZuckerman.breakdown.diminishing_returns, 14);
});

test("profile activities become depth-sensitive readiness gaps", () => {
  const withoutResearch = deriveReadinessGaps({
    basic: { major: "Biology", gpa: "3.7", graduationDate: "2027-05", applicationCycle: "2027–2028" },
    courses: [],
    activities: [],
  }, new Date("2026-08-20T00:00:00Z"));
  const withResearch = deriveReadinessGaps({
    basic: { major: "Biology", gpa: "3.7", graduationDate: "2027-05", applicationCycle: "2027–2028" },
    courses: [],
    activities: [{
      category: "research",
      name: "Cancer Biology Lab",
      role: "Research assistant",
      status: "active",
      startDate: "2026-01",
      endDate: "",
      hours: "140",
      description: "One sustained lab commitment",
    }],
  }, new Date("2026-08-20T00:00:00Z"));

  assert.equal(withoutResearch.gaps.research, 1);
  assert.equal(withResearch.gaps.research, 0.22);
  assert.equal(withResearch.researchDepth.substantialExperiences, 1);
});
