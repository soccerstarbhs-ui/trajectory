export type TargetTier = "t10" | "t20" | "t50" | "t100" | "any";

export type PercentileSeries = {
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
};

export type ActivityBenchmark = {
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  coverage: { p10: number; p25: number; median: number; p75: number; p90: number };
};

export type AdmissionsBenchmark = {
  key: TargetTier;
  label: string;
  shortLabel: string;
  description: string;
  schoolCount: number;
  activitySchoolCount: number;
  interviewRecordCount: number;
  interviewRecordCoverage: number;
  mcat: PercentileSeries;
  gpa: PercentileSeries;
  scienceGpaMedian: number;
  clinical: ActivityBenchmark;
  nonclinicalService: ActivityBenchmark;
  research: ActivityBenchmark;
  publicationShare: number;
  publicationCoverage: number;
  applicationToInterviewShare: number;
  suggestedMcatGoal: number;
};

const coverage = (p10: number, p25: number, median: number, p75: number, p90: number) => ({
  p10,
  p25,
  median,
  p75,
  p90,
});

/**
 * Cumulative tier summaries calculated from Admit_Top100_MCAT_GPA_2026-08-21.xlsx.
 * Academic values average each school's reported percentile. Activity values average
 * the self-reported percentile at exact school-name matches and intentionally preserve
 * sparse coverage rather than replacing missing values with zero.
 */
export const admissionsBenchmarks: Record<TargetTier, AdmissionsBenchmark> = {
  t10: {
    key: "t10",
    label: "Top 10 medical schools",
    shortLabel: "Top 10",
    description: "A research-intensive, exceptionally selective target set.",
    schoolCount: 10,
    activitySchoolCount: 10,
    interviewRecordCount: 970,
    interviewRecordCoverage: 10,
    mcat: { p10: 515.4, p25: 518.1, median: 520.9, p75: 523.2, p90: 525.1 },
    gpa: { p10: 3.805, p25: 3.888, median: 3.954, p75: 3.991, p90: 4 },
    scienceGpaMedian: 3.949,
    clinical: { p10: 259, p25: 441, median: 833, p75: 1701, p90: 2649, coverage: coverage(10, 10, 10, 10, 10) },
    nonclinicalService: { p10: 124, p25: 238, median: 436, p75: 745, p90: 1581, coverage: coverage(10, 10, 10, 10, 10) },
    research: { p10: 542, p25: 940, median: 1608, p75: 2762, p90: 4275, coverage: coverage(10, 10, 10, 10, 10) },
    publicationShare: 0.604,
    publicationCoverage: 10,
    applicationToInterviewShare: 0.1,
    suggestedMcatGoal: 521,
  },
  t20: {
    key: "t20",
    label: "Top 20 medical schools",
    shortLabel: "Top 20",
    description: "A highly selective national target set with strong academic and depth expectations.",
    schoolCount: 20,
    activitySchoolCount: 19,
    interviewRecordCount: 1836,
    interviewRecordCoverage: 19,
    mcat: { p10: 514.1, p25: 517.1, median: 520.2, p75: 522.7, p90: 524.7 },
    gpa: { p10: 3.764, p25: 3.864, median: 3.943, p75: 3.987, p90: 4 },
    scienceGpaMedian: 3.935,
    clinical: { p10: 261, p25: 432, median: 826, p75: 1665, p90: 2718, coverage: coverage(19, 19, 19, 19, 19) },
    nonclinicalService: { p10: 120, p25: 224, median: 419, p75: 704, p90: 1499, coverage: coverage(19, 19, 19, 19, 19) },
    research: { p10: 512, p25: 895, median: 1526, p75: 2558, p90: 4224, coverage: coverage(19, 19, 19, 19, 19) },
    publicationShare: 0.582,
    publicationCoverage: 19,
    applicationToInterviewShare: 0.096,
    suggestedMcatGoal: 520,
  },
  t50: {
    key: "t50",
    label: "Top 50 medical schools",
    shortLabel: "Top 50",
    description: "A selective target set spanning research-intensive and broad-mission programs.",
    schoolCount: 50,
    activitySchoolCount: 49,
    interviewRecordCount: 4039,
    interviewRecordCoverage: 49,
    mcat: { p10: 510.8, p25: 514, median: 517.3, p75: 520.3, p90: 522.9 },
    gpa: { p10: 3.668, p25: 3.806, median: 3.911, p75: 3.974, p90: 3.997 },
    scienceGpaMedian: 3.891,
    clinical: { p10: 272, p25: 469, median: 944, p75: 1875, p90: 3235, coverage: coverage(49, 49, 48, 49, 49) },
    nonclinicalService: { p10: 112, p25: 201, median: 375, p75: 645, p90: 1271, coverage: coverage(48, 48, 48, 48, 49) },
    research: { p10: 355, p25: 701, median: 1218, p75: 2231, p90: 3851, coverage: coverage(48, 48, 48, 49, 49) },
    publicationShare: 0.491,
    publicationCoverage: 49,
    applicationToInterviewShare: 0.1,
    suggestedMcatGoal: 517,
  },
  t100: {
    key: "t100",
    label: "Top 100 medical schools",
    shortLabel: "Top 100",
    description: "A broad target set that still benefits from a balanced, school-specific list.",
    schoolCount: 100,
    activitySchoolCount: 96,
    interviewRecordCount: 6355,
    interviewRecordCoverage: 91,
    mcat: { p10: 508.6, p25: 511.8, median: 515.3, p75: 518.6, p90: 521.4 },
    gpa: { p10: 3.624, p25: 3.774, median: 3.894, p75: 3.966, p90: 3.994 },
    scienceGpaMedian: 3.866,
    clinical: { p10: 294, p25: 524, median: 1022, p75: 2019, p90: 3410, coverage: coverage(93, 91, 88, 91, 93) },
    nonclinicalService: { p10: 109, p25: 194, median: 369, p75: 633, p90: 1219, coverage: coverage(91, 87, 87, 89, 92) },
    research: { p10: 283, p25: 573, median: 1071, p75: 1989, p90: 3574, coverage: coverage(89, 89, 87, 88, 93) },
    publicationShare: 0.441,
    publicationCoverage: 96,
    applicationToInterviewShare: 0.106,
    suggestedMcatGoal: 515,
  },
  any: {
    key: "any",
    label: "The strongest path to an MD acceptance",
    shortLabel: "Any MD acceptance",
    description: "A broad, realistic school-list strategy rather than a ranking cutoff.",
    schoolCount: 100,
    activitySchoolCount: 96,
    interviewRecordCount: 6355,
    interviewRecordCoverage: 91,
    mcat: { p10: 508.6, p25: 511.8, median: 515.3, p75: 518.6, p90: 521.4 },
    gpa: { p10: 3.624, p25: 3.774, median: 3.894, p75: 3.966, p90: 3.994 },
    scienceGpaMedian: 3.866,
    clinical: { p10: 294, p25: 524, median: 1022, p75: 2019, p90: 3410, coverage: coverage(93, 91, 88, 91, 93) },
    nonclinicalService: { p10: 109, p25: 194, median: 369, p75: 633, p90: 1219, coverage: coverage(91, 87, 87, 89, 92) },
    research: { p10: 283, p25: 573, median: 1071, p75: 1989, p90: 3574, coverage: coverage(89, 89, 87, 88, 93) },
    publicationShare: 0.441,
    publicationCoverage: 96,
    applicationToInterviewShare: 0.106,
    suggestedMcatGoal: 512,
  },
};

export const benchmarkSources = {
  academic: {
    label: "Structured school data",
    url: "https://med.admit.org/school-rankings",
    note: "School-level GPA and MCAT percentile distributions; 98 of the Top 100 pages were available in the supplied 2026-08-21 snapshot.",
  },
  activities: {
    label: "Self-reported applicant data",
    url: "https://docs.google.com/spreadsheets/d/1nbLZ92IvJYAMZgCmg1akG4hvccU8-KsA3vN8UzbO8h8/htmlview",
    note: "Clinical, nonclinical-service, research-hour, and publication summaries are selection-biased and have uneven coverage. They are directional benchmarks, not requirements or causal estimates.",
  },
} as const;
