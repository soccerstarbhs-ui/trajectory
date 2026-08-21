import { admissionsBenchmarks, benchmarkSources, type AdmissionsBenchmark, type TargetTier } from "@/data/admissions-benchmarks";
import type { ApplicantProfileSnapshot, EngineNode, ReadinessDimension } from "@/lib/recommendation-engine";

export type TargetFitStatus = "not_scored" | "aligned" | "within_range" | "reach" | "statistically_improbable";

export type CourseRequirementAssessment = {
  key: string;
  label: string;
  section: "standard" | "many" | "recommended";
  completed: number;
  required: number;
  satisfied: boolean;
};

export type CourseworkAssessment = {
  readiness: number;
  standardComplete: boolean;
  onlyRecommendedOrLimitedManyRemain: boolean;
  requirements: CourseRequirementAssessment[];
  missingStandard: string[];
  missingMany: string[];
  recommendedRemaining: string[];
  labSubjectsToVerify: string[];
};

export type TargetFitAssessment = {
  status: TargetFitStatus;
  title: string;
  message: string;
  targetTier: TargetTier;
  benchmark: AdmissionsBenchmark;
  suggestedMcatGoal: number;
  mcatPercentileEstimate: number | null;
  gpaPercentileEstimate: number | null;
  belowAcademicMedian: boolean;
};

export type BenchmarkComparison = {
  dimension: "clinical" | "service" | "research";
  hours: number;
  band: "not_started" | "below_p10" | "p10_to_p25" | "p25_to_median" | "at_or_above_median";
  benchmark: { p10: number; p25: number; median: number };
  coverage: number;
  note: string;
};

export type ReadinessAssessment = {
  gaps: Record<ReadinessDimension, number>;
  completedNodeNames: string[];
  currentCommitments: number;
  researchDepth: { experiences: number; substantialExperiences: number; hasOutput: boolean };
  coursework: CourseworkAssessment;
  targetFit: TargetFitAssessment;
  comparisons: Record<"clinical" | "service" | "research", BenchmarkComparison>;
};

type Activity = ApplicantProfileSnapshot["activities"][number];
type ActivityOutcome = NonNullable<Activity["outcome"]>;

const outputOutcomes = new Set<ActivityOutcome>(["presentation", "poster", "publication", "award", "measurable_impact"]);

const requirements: Array<{
  key: string;
  label: string;
  section: CourseRequirementAssessment["section"];
  required: number;
  matches: (name: string) => boolean;
}> = [
  { key: "biology", label: "Biology I–II", section: "standard", required: 2, matches: (name) => (/\bBIOL(?:OGY)?\b|INTRO(?:DUCTORY)? BIOLOGY/.test(name) && !/MICRO|CELL|MOLECULAR|BIOCHEM/.test(name)) || /BIOL\s*(?:UN)?200[56]/.test(name) },
  { key: "general_chemistry", label: "General Chemistry I–II", section: "standard", required: 2, matches: (name) => /GENERAL CHEM|CHEM\s*(?:UN)?1[45]0[34]/.test(name) && !/ORGANIC|BIOCHEM/.test(name) },
  { key: "organic_chemistry", label: "Organic Chemistry I–II", section: "standard", required: 2, matches: (name) => /ORGANIC CHEM|CHEM\s*(?:UN)?244[34]/.test(name) },
  { key: "physics", label: "Physics I–II", section: "standard", required: 2, matches: (name) => /\bPHYS(?:ICS)?\b|PHYS\s*(?:UN)?(?:120[12]|140[1234]|160[12])/.test(name) },
  { key: "writing", label: "English / writing", section: "standard", required: 2, matches: (name) => /UNIVERSITY WRITING|ENGL\s*(?:CC|GS)?1010|COMPOSITION|RHETORIC|LITERATURE HUMANITIES|HUMA\s*(?:CC|GS)?100[12]|CONTEMPORARY CIVILIZATION|COCI\s*(?:CC|GS)?110[12]|ART HUMANITIES|HUMA\s*UN1121|MUSIC HUMANITIES|HUMA\s*UN1123|\bENGLISH\b|\bWRITING\b/.test(name) },
  { key: "biochemistry", label: "Biochemistry", section: "many", required: 1, matches: (name) => /BIOCHEM|\bBIOC\b|BIOC\s*(?:UN)?3300/.test(name) },
  { key: "statistics", label: "Statistics", section: "many", required: 1, matches: (name) => /STATISTICS|BIOSTAT|\bSTAT\b|PROBABILITY/.test(name) },
  { key: "calculus", label: "Calculus", section: "many", required: 1, matches: (name) => /CALCULUS|MATH\s*(?:UN)?(?:110[12]|120[12])/.test(name) },
  { key: "psychology", label: "Psychology", section: "recommended", required: 1, matches: (name) => /PSYCHOLOGY|\bPSYC\b/.test(name) },
  { key: "sociology", label: "Sociology", section: "recommended", required: 1, matches: (name) => /SOCIOLOGY|\bSOCI\b/.test(name) },
  { key: "microbiology", label: "Microbiology", section: "recommended", required: 1, matches: (name) => /MICROBIOLOGY/.test(name) },
  { key: "upper_biology", label: "Upper-level biology", section: "recommended", required: 1, matches: (name) => /GENETICS|CELL BIOLOGY|MOLECULAR BIOLOGY|PHYSIOLOGY/.test(name) },
  { key: "anatomy", label: "Anatomy", section: "recommended", required: 1, matches: (name) => /ANATOMY/.test(name) },
  { key: "humanities", label: "Additional humanities / social sciences", section: "recommended", required: 2, matches: (name) => /HUMANIT|HISTORY|PHILOSOPH|ANTHROPOLOGY|POLITICAL|ECONOMICS|RELIGION|ART HUMANITIES|MUSIC HUMANITIES|LITERATURE|SOCIOLOGY|PSYCHOLOGY|\bHUMA\b|\bHIST\b|\bPHIL\b/.test(name) },
];

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function numeric(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function monthSpan(startDate: string, endDate: string, fallbackEnd: Date) {
  if (!startDate) return 0;
  const start = new Date(`${startDate}-01T00:00:00Z`);
  const end = endDate ? new Date(`${endDate}-01T00:00:00Z`) : fallbackEnd;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth());
}

function percentileEstimate(value: number | null, series: { p10: number; p25: number; median: number; p75: number; p90: number }) {
  if (value === null) return null;
  const points = [[series.p10, 10], [series.p25, 25], [series.median, 50], [series.p75, 75], [series.p90, 90]] as const;
  if (value <= points[0][0]) return Math.max(1, 10 - ((points[0][0] - value) / Math.max(points[1][0] - points[0][0], 0.01)) * 15);
  for (let index = 1; index < points.length; index += 1) {
    const [highValue, highPercentile] = points[index];
    const [lowValue, lowPercentile] = points[index - 1];
    if (value <= highValue) return lowPercentile + ((value - lowValue) / Math.max(highValue - lowValue, 0.01)) * (highPercentile - lowPercentile);
  }
  return Math.min(99, 90 + ((value - series.p90) / Math.max(series.p90 - series.p75, 0.01)) * 9);
}

function academicReadiness(value: number | null, series: { p10: number; p25: number; median: number }, broadGoal = false) {
  if (value === null) return 0.34;
  const target = broadGoal ? series.p25 : series.median;
  if (value >= target) return clamp(0.9 + ((value - target) / Math.max(target - series.p25, 0.01)) * 0.08);
  if (value >= series.p25) return 0.72 + ((value - series.p25) / Math.max(series.median - series.p25, 0.01)) * 0.18;
  if (value >= series.p10) return 0.48 + ((value - series.p10) / Math.max(series.p25 - series.p10, 0.01)) * 0.24;
  return clamp(0.48 - ((series.p10 - value) / Math.max(series.p25 - series.p10, 0.01)) * 0.28, 0.08, 0.48);
}

export function assessCoursework(snapshot: ApplicantProfileSnapshot): CourseworkAssessment {
  const names = snapshot.courses
    .filter((course) => course.status === "completed" || course.status === "in_progress")
    .map((course) => course.name.toUpperCase().replace(/[–—-]/g, " ").replace(/\s+/g, " ").trim());
  const lectureNames = names.filter((name) => !/\bLAB(?:ORATORY)?\b/.test(name));
  const assessed = requirements.map((requirement) => {
    const source = requirement.key === "writing" || requirement.key === "humanities" ? names : lectureNames;
    const completed = Math.min(requirement.required, source.filter(requirement.matches).length);
    return { key: requirement.key, label: requirement.label, section: requirement.section, completed, required: requirement.required, satisfied: completed >= requirement.required };
  });
  const standard = assessed.filter((item) => item.section === "standard");
  const many = assessed.filter((item) => item.section === "many");
  const recommended = assessed.filter((item) => item.section === "recommended");
  const rate = (items: CourseRequirementAssessment[]) => items.reduce((sum, item) => sum + item.completed, 0) / items.reduce((sum, item) => sum + item.required, 0);
  const missingStandard = standard.filter((item) => !item.satisfied).map((item) => item.label);
  const missingMany = many.filter((item) => !item.satisfied).map((item) => item.label);
  let readiness = rate(standard) * 0.78 + rate(many) * 0.17 + rate(recommended) * 0.05;
  if (rate(standard) >= 0.9 && missingMany.length <= 2) readiness = Math.max(readiness, 0.9);
  if (rate(standard) === 1 && missingMany.length <= 1) readiness = Math.max(readiness, 0.95);
  const labSubjectsToVerify = [
    ["biology", "Biology labs", /BIO.*LAB/],
    ["general_chemistry", "General Chemistry labs", /CHEM.*LAB/],
    ["organic_chemistry", "Organic Chemistry labs", /ORGANIC.*LAB|CHEM.*LAB/],
    ["physics", "Physics labs", /PHYS.*LAB/],
  ].filter(([key, , pattern]) => assessed.find((item) => item.key === key)?.satisfied && !names.some((name) => (pattern as RegExp).test(name))).map(([, label]) => label as string);
  return {
    readiness: clamp(readiness),
    standardComplete: missingStandard.length === 0,
    onlyRecommendedOrLimitedManyRemain: missingStandard.length === 0 && missingMany.length <= 2,
    requirements: assessed,
    missingStandard,
    missingMany,
    recommendedRemaining: recommended.filter((item) => !item.satisfied).map((item) => item.label),
    labSubjectsToVerify,
  };
}

export function assessTargetFit(snapshot: ApplicantProfileSnapshot): TargetFitAssessment {
  const targetTier = snapshot.basic.targetTier || "any";
  const benchmark = admissionsBenchmarks[targetTier];
  const gpa = numeric(snapshot.basic.gpa);
  const hasScore = snapshot.basic.mcatStatus === "completed" || snapshot.basic.mcatStatus === "retaking";
  const mcat = hasScore ? numeric(snapshot.basic.mcatScore) : null;
  const base = {
    targetTier,
    benchmark,
    suggestedMcatGoal: benchmark.suggestedMcatGoal,
    mcatPercentileEstimate: percentileEstimate(mcat, benchmark.mcat),
    gpaPercentileEstimate: percentileEstimate(gpa, benchmark.gpa),
    belowAcademicMedian: Boolean((gpa !== null && gpa < benchmark.gpa.median) || (mcat !== null && mcat < benchmark.mcat.median)),
  };
  if (mcat === null) return { ...base, status: "not_scored", title: `Set an MCAT target around ${benchmark.suggestedMcatGoal}`, message: `Your ${benchmark.shortLabel} trajectory cannot be academically calibrated until an MCAT score is available. ${benchmark.suggestedMcatGoal} is a planning target informed by aggregated self-reported admissions data, not a cutoff or guarantee.` };
  if (targetTier !== "any" && mcat < benchmark.mcat.p10 - 5 && gpa !== null && gpa < benchmark.gpa.p10 - 0.25) {
    return { ...base, status: "statistically_improbable", title: `${benchmark.shortLabel} is statistically improbable with the current academics`, message: "Your GPA and MCAT are both materially below the average reported 10th-percentile values for this target set. A broader school list, academic repair, and an MCAT retake plan deserve priority; an “X factor” should not be presented as erasing both academic gaps." };
  }
  const alignedMcat = targetTier === "any" ? benchmark.mcat.p25 : benchmark.mcat.median;
  const alignedGpa = targetTier === "any" ? benchmark.gpa.p25 : benchmark.gpa.median;
  const aligned = mcat >= alignedMcat && gpa !== null && gpa >= alignedGpa;
  const inRange = mcat >= benchmark.mcat.p10 && gpa !== null && gpa >= benchmark.gpa.p10;
  const status: TargetFitStatus = aligned ? "aligned" : inRange ? "within_range" : "reach";
  return {
    ...base,
    status,
    title: aligned ? `Academically aligned with the ${benchmark.shortLabel} benchmark` : inRange ? "Within the reported range, below the center" : `${benchmark.shortLabel} remains a reach`,
    message: aligned
      ? "Your entered academics are at or above the planning benchmark. Recommendations should emphasize completeness, depth, fit, and execution rather than adding activities for quantity."
      : inRange
        ? "Your academics fall within the reported school ranges but below at least one average median. Strong depth, impact, writing, school fit, and a balanced list can strengthen the application without implying that any activity offsets academics mathematically."
        : "At least one academic metric is below the average reported 10th-percentile value for this target set. Treat this as a reach and build a broader school list while addressing the metric if feasible.",
  };
}

function inferredResponsibility(activity: Activity) {
  if (activity.responsibility) return activity.responsibility;
  const text = `${activity.role} ${activity.description}`.toLowerCase();
  if (/president|director|founder|chair|lead|captain|manager|coordinator/.test(text)) return "lead";
  if (/assistant|member|volunteer|participant|observer|shadow/.test(text)) return "participant";
  return "contributor";
}

function inferredOutcome(activity: Activity): ActivityOutcome {
  if (activity.outcome) return activity.outcome;
  const text = `${activity.name} ${activity.description}`.toLowerCase();
  if (/peer.review|publication|published|manuscript/.test(text)) return "publication";
  if (/poster/.test(text)) return "poster";
  if (/presentation|presented|abstract/.test(text)) return "presentation";
  if (/award|honor|prize/.test(text)) return "award";
  if (/increased|reduced|created|launched|organized|raised|served \d|trained \d/.test(text)) return "measurable_impact";
  return "none";
}

function qualityScore(activities: Activity[], asOfDate: Date) {
  let best = 0;
  for (const activity of activities) {
    const months = monthSpan(activity.startDate, activity.endDate, asOfDate);
    const continuity = months >= 12 ? 1 : months >= 6 ? 0.78 : months >= 3 ? 0.55 : 0.3;
    const responsibility = inferredResponsibility(activity) === "lead" ? 1 : inferredResponsibility(activity) === "contributor" ? 0.72 : 0.45;
    const outcome = outputOutcomes.has(inferredOutcome(activity)) ? 1 : inferredOutcome(activity) === "other" ? 0.65 : 0.35;
    best = Math.max(best, continuity * 0.42 + responsibility * 0.3 + outcome * 0.28);
  }
  return best;
}

function hoursReadiness(hours: number, benchmark: { p10: number; p25: number; median: number }) {
  if (hours <= 0) return 0;
  if (hours < benchmark.p10) return clamp(0.12 + (hours / Math.max(benchmark.p10, 1)) * 0.33);
  if (hours < benchmark.p25) return 0.45 + ((hours - benchmark.p10) / Math.max(benchmark.p25 - benchmark.p10, 1)) * 0.23;
  if (hours < benchmark.median) return 0.68 + ((hours - benchmark.p25) / Math.max(benchmark.median - benchmark.p25, 1)) * 0.2;
  return clamp(0.88 + ((hours - benchmark.median) / Math.max(benchmark.median, 1)) * 0.08);
}

function compare(dimension: BenchmarkComparison["dimension"], hours: number, benchmark: AdmissionsBenchmark["clinical"]): BenchmarkComparison {
  const band = hours <= 0 ? "not_started" : hours < benchmark.p10 ? "below_p10" : hours < benchmark.p25 ? "p10_to_p25" : hours < benchmark.median ? "p25_to_median" : "at_or_above_median";
  const text = { not_started: "No hours recorded.", below_p10: "Below the averaged 10th-percentile value.", p10_to_p25: "Between the averaged 10th- and 25th-percentile values.", p25_to_median: "Between the averaged 25th-percentile and median values.", at_or_above_median: "At or above the averaged median value." }[band];
  return { dimension, hours, band, benchmark: { p10: benchmark.p10, p25: benchmark.p25, median: benchmark.median }, coverage: benchmark.coverage.median, note: `${text} Compared with aggregated self-reported applicant data for the selected target range; use as directional context, not a requirement.` };
}

export function deriveApplicantAssessment(snapshot: ApplicantProfileSnapshot, asOfDate = new Date()): ReadinessAssessment {
  const targetFit = assessTargetFit(snapshot);
  const benchmark = targetFit.benchmark;
  const coursework = assessCoursework(snapshot);
  const cumulativeGpaReadiness = academicReadiness(numeric(snapshot.basic.gpa), benchmark.gpa, targetFit.targetTier === "any");
  const scienceDelta = benchmark.scienceGpaMedian - benchmark.gpa.median;
  const scienceSeries = { p10: benchmark.gpa.p10 + scienceDelta, p25: benchmark.gpa.p25 + scienceDelta, median: benchmark.scienceGpaMedian };
  const scienceGpa = numeric(snapshot.basic.scienceGpa);
  const gpaReadiness = scienceGpa === null ? cumulativeGpaReadiness : cumulativeGpaReadiness * 0.7 + academicReadiness(scienceGpa, scienceSeries, targetFit.targetTier === "any") * 0.3;
  const mcatReadiness = snapshot.basic.mcatStatus === "completed" || snapshot.basic.mcatStatus === "retaking"
    ? academicReadiness(numeric(snapshot.basic.mcatScore), benchmark.mcat, targetFit.targetTier === "any")
    : snapshot.basic.mcatStatus === "scheduled" ? 0.34 : 0.2;
  const counted = snapshot.activities.filter((activity) => activity.status !== "planned");
  const forCategory = (category: Activity["category"]) => counted.filter((activity) => activity.category === category);
  const totalHours = (activities: Activity[]) => activities.reduce((sum, activity) => sum + (Number(activity.hours) || 0), 0);
  const clinical = forCategory("clinical");
  const service = forCategory("volunteering");
  const research = forCategory("research");
  const leadership = forCategory("leadership");
  const clinicalHours = totalHours(clinical);
  const serviceHours = totalHours(service);
  const researchHours = totalHours(research);
  const activityReadiness = (activities: Activity[], hours: number, series: AdmissionsBenchmark["clinical"]) => activities.length === 0 ? 0 : clamp(hoursReadiness(hours, series) * 0.68 + qualityScore(activities, asOfDate) * 0.32);
  const substantialResearch = research.filter((activity) => (Number(activity.hours) || 0) >= 120 || monthSpan(activity.startDate, activity.endDate, asOfDate) >= 4).length;
  const hasOutput = research.some((activity) => outputOutcomes.has(inferredOutcome(activity)));
  let researchReadiness = activityReadiness(research, researchHours, benchmark.research);
  if (substantialResearch >= 1) researchReadiness = Math.max(researchReadiness, hasOutput ? 0.78 : 0.6);
  if (substantialResearch >= 2 && hasOutput) researchReadiness = Math.max(researchReadiness, 0.88);
  const shadowing = counted.filter((activity) => /shadow|physician|specialt/i.test(`${activity.name} ${activity.description}`));
  const shadowHours = totalHours(shadowing);
  const planningInputs = [snapshot.basic.applicationCycle, snapshot.basic.graduationDate, snapshot.basic.targetTier, snapshot.basic.stateResidency].filter(Boolean).length;
  const trendAdjustment = snapshot.basic.academicTrend === "upward" ? 0.04 : snapshot.basic.academicTrend === "downward" ? -0.06 : 0;
  const gaps: Record<ReadinessDimension, number> = {
    academic: 1 - clamp(coursework.readiness * 0.8 + gpaReadiness * 0.2 + trendAdjustment),
    testing: 1 - mcatReadiness,
    clinical: 1 - activityReadiness(clinical, clinicalHours, benchmark.clinical),
    research: 1 - researchReadiness,
    service: 1 - activityReadiness(service, serviceHours, benchmark.nonclinicalService),
    leadership: 1 - (leadership.length === 0 ? 0 : clamp(0.25 + qualityScore(leadership, asOfDate) * 0.7)),
    exploration: 1 - (shadowHours >= 50 ? 0.9 : shadowHours >= 20 ? 0.68 : shadowHours > 0 ? 0.42 : 0.15),
    mentorship: 1 - (substantialResearch > 0 || leadership.length > 0 ? 0.72 : counted.length > 0 ? 0.48 : 0.2),
    planning: 1 - clamp(0.25 + planningInputs * 0.15 + (snapshot.basic.geographyPreferences || snapshot.basic.missionPreferences ? 0.1 : 0)),
  };
  return {
    gaps,
    completedNodeNames: [...snapshot.courses.filter((course) => course.status === "completed").map((course) => course.name), ...counted.filter((activity) => activity.status === "completed").map((activity) => activity.name)],
    currentCommitments: counted.filter((activity) => activity.status === "active").length,
    researchDepth: { experiences: research.length, substantialExperiences: substantialResearch, hasOutput },
    coursework,
    targetFit,
    comparisons: { clinical: compare("clinical", clinicalHours, benchmark.clinical), service: compare("service", serviceHours, benchmark.nonclinicalService), research: compare("research", researchHours, benchmark.research) },
  };
}

function actionNode(id: string, name: string, dimension: ReadinessDimension, description: string, metadata: Record<string, unknown>): EngineNode {
  return { id: `personalized-${id}`, type: "personalized_action", name, description, metadata: { readiness_dimension: dimension, personalized: true, ...metadata } };
}

export function buildPersonalizedActionNodes(snapshot: ApplicantProfileSnapshot, assessment = deriveApplicantAssessment(snapshot)): EngineNode[] {
  const nodes: EngineNode[] = [];
  const { targetFit, coursework, comparisons } = assessment;
  const activityEvidence = `${benchmarkSources.activities.note} Interview outcomes are also self-reported and may include multiple records from the same applicant.`;
  if (snapshot.basic.mcatStatus !== "completed" || (targetFit.mcatPercentileEstimate ?? 100) < 25) nodes.push(actionNode("mcat", snapshot.basic.mcatStatus === "completed" ? "Build a focused MCAT retake decision plan" : `Set and execute a ${targetFit.suggestedMcatGoal}+ MCAT plan`, "testing", `Use ${targetFit.suggestedMcatGoal} as a planning target for ${targetFit.benchmark.shortLabel}, then adjust around practice-test performance and timing.`, { weekly_hours: 10, base_priority: 0.95, evidence_type: "self_reported", evidence_note: benchmarkSources.academic.note }));
  if (coursework.missingStandard.length > 0) nodes.push(actionNode("coursework", "Complete the remaining standard prerequisites", "academic", coursework.missingStandard.join(", "), { weekly_hours: 8, base_priority: 0.92, evidence_type: "institutional", evidence_note: "Common prerequisite pattern; individual schools control their own requirements." }));
  else nodes.push(actionNode("course-audit", "Audit coursework against each school on your list", "planning", "Your standard prerequisite pattern is substantially complete. Verify labs, AP-credit policies, and school-specific Biochemistry, Statistics, Calculus, and writing rules.", { weekly_hours: 1, base_priority: 0.46, evidence_type: "institutional", evidence_note: "Recommended courses are not treated as universal requirements." }));
  if (assessment.gaps.clinical > 0.3) nodes.push(actionNode("clinical", "Build sustained patient-facing clinical experience", "clinical", comparisons.clinical.note, { weekly_hours: 4, base_priority: 0.78, evidence_type: "self_reported", evidence_note: activityEvidence }));
  if (assessment.gaps.service > 0.3) nodes.push(actionNode("service", "Build consistent nonclinical community service", "service", comparisons.service.note, { weekly_hours: 3, base_priority: 0.72, evidence_type: "self_reported", evidence_note: activityEvidence }));
  const activeResearch = snapshot.activities.some((activity) => activity.category === "research" && activity.status === "active");
  if (assessment.researchDepth.substantialExperiences === 0) nodes.push(actionNode("research", "Build one sustained research commitment", "research", comparisons.research.note, { weekly_hours: 8, base_priority: 0.8, evidence_type: "mixed", evidence_note: "Self-reported hours inform depth; the redundancy rule favors one sustained contribution over unrelated short experiences." }));
  else if (!assessment.researchDepth.hasOutput && (["t10", "t20"] as TargetTier[]).includes(targetFit.targetTier)) nodes.push(actionNode("research-output", "Turn existing research into a poster, abstract, or manuscript", "research", "Aggregated self-reported applicant data indicate that research outputs are common among applicants targeting highly selective schools. This is descriptive context, not a requirement.", { weekly_hours: 4, base_priority: 0.88, evidence_type: "self_reported", evidence_note: activityEvidence, deepen_existing: true }));
  else if (activeResearch && assessment.gaps.research > 0.25) nodes.push(actionNode("research-depth", "Deepen your contribution in your current research", "research", "Prioritize ownership, skill growth, analysis, and a concrete output before considering a second lab.", { weekly_hours: 4, base_priority: 0.7, evidence_type: "heuristic", evidence_note: "Diminishing-returns rule: deepen one substantial commitment before adding a comparable lab.", deepen_existing: true }));
  if (assessment.gaps.leadership > 0.35) nodes.push(actionNode("leadership", "Create measurable impact in one existing commitment", "leadership", "Own a result, improve a process, mentor others, or document community impact instead of adding a title for its own sake.", { weekly_hours: 3, base_priority: 0.68, evidence_type: "heuristic", evidence_note: "Quality heuristic based on continuity, responsibility, and impact—not a universal hour threshold." }));
  if ((targetFit.targetTier === "t10" || targetFit.targetTier === "t20") && targetFit.belowAcademicMedian && (targetFit.status === "within_range" || targetFit.status === "aligned")) nodes.push(actionNode("differentiator", "Develop one coherent differentiator", "leadership", "Build exceptional depth around an authentic theme—research output, community impact, creative achievement, entrepreneurship, advocacy, or another sustained contribution—rather than collecting unrelated activities.", { weekly_hours: 3, base_priority: 0.76, evidence_type: "heuristic", evidence_note: "Holistic-planning heuristic. It does not numerically offset GPA or MCAT." }));
  if (targetFit.status === "reach" || targetFit.status === "statistically_improbable") nodes.push(actionNode("school-list", "Rebalance your school list using school-specific ranges", "planning", targetFit.message, { weekly_hours: 2, base_priority: targetFit.status === "statistically_improbable" ? 1 : 0.82, evidence_type: "self_reported", evidence_note: benchmarkSources.academic.note }));
  if (snapshot.basic.applicantStatus === "international") nodes.push(actionNode("international-list", "Build an international-applicant-eligible school list", "planning", "Confirm which schools accept international applicants, required funding documentation, prerequisite location rules, and institutional aid policies before investing in secondaries.", { weekly_hours: 2, base_priority: 0.9, evidence_type: "institutional", evidence_note: "Eligibility and funding policies must be verified on each medical school's current admissions page." }));
  if (!snapshot.basic.geographyPreferences || !snapshot.basic.missionPreferences) nodes.push(actionNode("fit-filters", "Define your school-list fit filters", "planning", "Add geographic constraints, state ties, and mission priorities so ranking alone does not determine the school list.", { weekly_hours: 1, base_priority: 0.4, evidence_type: "heuristic", evidence_note: "Planning heuristic; school mission and residency preferences vary by institution." }));
  return nodes;
}
