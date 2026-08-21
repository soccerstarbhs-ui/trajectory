import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPersonalizedActionNodes,
  deriveReadinessGaps,
  rankActions,
  type DemoProfile,
  type ApplicantProfileSnapshot,
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
  testing: 0.2,
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
    clinicalDepth: { experiences: 0, substantialExperiences: 0 },
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

const clinicalNodes: EngineNode[] = [
  { id: "clinical-goal", type: "goal", name: "Medical School", description: null, metadata: null },
  { id: "cuems", type: "extracurricular", name: "CU Emergency Medical Service (CUEMS) Volunteer EMT", description: null, metadata: { weekly_hours: 4 } },
  { id: "hospital", type: "extracurricular", name: "Mount Sinai Morningside Hospital Volunteering", description: null, metadata: { weekly_hours: 4 } },
  { id: "scribe", type: "extracurricular", name: "Medical Scribing (part-time job)", description: null, metadata: { weekly_hours: 8 } },
  { id: "shadowing", type: "extracurricular", name: "Physician Shadowing (40+ hrs)", description: null, metadata: { weekly_hours: 2 } },
  { id: "shadowing-alt", type: "extracurricular", name: "Additional Physician Shadowing", description: null, metadata: { weekly_hours: 2 } },
  { id: "research-output", type: "personalized_action", name: "Turn existing research into a publication", description: "Deepen existing research.", metadata: { readiness_dimension: "research", personalized: true, base_priority: 0.88, weekly_hours: 4, deepen_existing: true } },
];

const clinicalEdges: EngineEdge[] = clinicalNodes
  .filter((node) => node.type !== "goal")
  .map((node) => ({ id: `${node.id}-goal`, source_id: node.id, target_id: "clinical-goal", relationship_type: "supports", evidence_class: "B", confidence: "moderate" }));

test("one completed clinical commitment pushes research output ahead of another clinical position", () => {
  const ranked = rankActions(profile({
    gaps: { ...openGaps, clinical: 1, exploration: 0.8, research: 0.6 },
    completedNodeNames: ["CU Emergency Medical Service (CUEMS) Volunteer EMT"],
    actionOutcomes: { "CU Emergency Medical Service (CUEMS) Volunteer EMT": "completed" },
    clinicalDepth: { experiences: 1, substantialExperiences: 1 },
    researchDepth: { experiences: 1, substantialExperiences: 1 },
  }), clinicalNodes, clinicalEdges, []);

  assert.equal(ranked[0]?.node.name, "Turn existing research into a publication");
  const nextClinical = ranked.find((action) => action.node.name === "Mount Sinai Morningside Hospital Volunteering");
  assert.ok(nextClinical);
  assert.equal(nextClinical.breakdown.diminishing_returns, 11);
  assert.match(nextClinical.reasons.join(" "), /clinical marginal value reduced to 45%/i);
});

test("two completed clinical commitments suppress additional clinical acquisition", () => {
  const completedClinical = ["CU Emergency Medical Service (CUEMS) Volunteer EMT", "Mount Sinai Morningside Hospital Volunteering"];
  const ranked = rankActions(profile({
    gaps: { ...openGaps, clinical: 1, exploration: 0.8, research: 0.6 },
    completedNodeNames: completedClinical,
    actionOutcomes: Object.fromEntries(completedClinical.map((name) => [name, "completed" as const])),
    clinicalDepth: { experiences: 2, substantialExperiences: 2 },
    researchDepth: { experiences: 1, substantialExperiences: 1 },
  }), clinicalNodes, clinicalEdges, []);

  assert.equal(ranked.some((action) => action.node.name === "Medical Scribing (part-time job)"), false);
  assert.equal(ranked[0]?.node.name, "Turn existing research into a publication");
});

test("completed shadowing suppresses another shadowing recommendation", () => {
  const ranked = rankActions(profile({
    completedNodeNames: ["Physician Shadowing (40+ hrs)"],
    actionOutcomes: { "Physician Shadowing (40+ hrs)": "completed" },
  }), clinicalNodes, clinicalEdges, []);

  assert.equal(ranked.some((action) => action.node.name === "Additional Physician Shadowing"), false);
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
  assert.ok(withResearch.gaps.research < withoutResearch.gaps.research);
  assert.equal(withResearch.researchDepth.substantialExperiences, 1);
});

function completeCoursework() {
  return [
    "BIOL UN2005 — Introductory Biology I", "BIOL UN2006 — Introductory Biology II",
    "CHEM UN1403 — General Chemistry I", "CHEM UN1404 — General Chemistry II",
    "CHEM UN2443 — Organic Chemistry I", "CHEM UN2444 — Organic Chemistry II",
    "PHYS UN1201 — General Physics I", "PHYS UN1202 — General Physics II",
    "ENGL CC1010 — University Writing", "HUMA UN1123 — Music Humanities",
    "BIOC UN3300 — Biochemistry", "STAT UN1201 — Introduction to Statistics", "MATH UN1101 — Calculus I",
  ].map((name) => ({ name, status: "completed" as const, term: "", grade: "A" }));
}

function applicant(overrides: Partial<ApplicantProfileSnapshot["basic"]> = {}): ApplicantProfileSnapshot {
  return {
    basic: {
      major: "Biomedical Engineering",
      gpa: "3.82",
      graduationDate: "2027-05",
      applicationCycle: "2027–2028",
      targetTier: "t10" as const,
      mcatStatus: "completed" as const,
      mcatScore: "518",
      ...overrides,
    },
    courses: completeCoursework(),
    activities: [],
  };
}

test("completed standard coursework is strong when only optional courses remain", () => {
  const result = deriveReadinessGaps(applicant());
  assert.equal(result.coursework.standardComplete, true);
  assert.equal(result.coursework.onlyRecommendedOrLimitedManyRemain, true);
  assert.ok(result.coursework.readiness >= 0.95);
  assert.ok(result.gaps.academic < 0.2);
});

test("Columbia Core writing courses count toward the writing pattern", () => {
  const snapshot = applicant();
  snapshot.courses = snapshot.courses.filter((course) => !/University Writing|Music Humanities/.test(course.name));
  snapshot.courses.push(
    { name: "HUMA CC1001 — Literature Humanities I", status: "completed", term: "", grade: "A" },
    { name: "HUMA UN1121 — Art Humanities", status: "completed", term: "", grade: "A" },
  );
  const writing = deriveReadinessGaps(snapshot).coursework.requirements.find((item) => item.key === "writing");
  assert.equal(writing?.satisfied, true);
});

test("an extreme T10 academic mismatch is labeled statistically improbable", () => {
  const result = deriveReadinessGaps(applicant({ gpa: "3.40", mcatScore: "505" }));
  assert.equal(result.targetFit.status, "statistically_improbable");
  assert.match(result.targetFit.message, /broader school list/i);
});

test("an applicant without an MCAT receives a tier-specific planning goal", () => {
  const result = deriveReadinessGaps(applicant({ targetTier: "t20", mcatStatus: "planning", mcatScore: "" }));
  assert.equal(result.targetFit.status, "not_scored");
  assert.equal(result.targetFit.suggestedMcatGoal, 520);
  assert.ok(result.gaps.testing > 0.5);
});

test("self-reported hour benchmarks remain explicit", () => {
  const result = deriveReadinessGaps(applicant());
  assert.deepEqual(result.comparisons.research.benchmark, { p10: 542, p25: 940, median: 1608 });
  assert.equal(result.comparisons.research.coverage, 10);
});

test("substantial research produces a depth action instead of a second lab", () => {
  const snapshot = applicant();
  snapshot.activities.push({
    category: "research", name: "Cancer Biology Lab", role: "Research assistant", status: "active",
    startDate: "2025-09", endDate: "", hours: "700", description: "Sustained bench research",
    responsibility: "contributor", outcome: "none",
  });
  const actions = buildPersonalizedActionNodes(snapshot, deriveReadinessGaps(snapshot, new Date("2026-08-21")));
  assert.ok(actions.some((node) => /poster, abstract, or manuscript/i.test(node.name)));
  assert.equal(actions.some((node) => /join.*lab/i.test(node.name)), false);
});
