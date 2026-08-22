# Trajectory recommendation logic v2

## Purpose and boundary

Trajectory ranks practical next actions. It does **not** calculate an acceptance probability, promise that an activity offsets academics, or treat a school average as a cutoff.

The engine combines:

1. aggregated self-reported GPA and MCAT distributions;
2. self-reported clinical, nonclinical-service, research-hour, publication, and interview-record summaries;
3. existing linked research and institutional evidence;
4. deterministic planning rules for timing, feasibility, redundancy, quality, and missing information.

The interface distinguishes self-reported applicant evidence, research evidence, institutional guidance, combined evidence, and planning methodology.

## Target groups

The selected goal is cumulative: Top 10 uses ranks 1–10, Top 20 uses 1–20, Top 50 uses 1–50, and Top 100 uses 1–100. “Any MD acceptance” uses the broad Top 100 distribution with the average 25th percentile—not the median—as its planning center.

| Goal | MCAT planning target | Mean MCAT median | Mean GPA median | Self-reported interview records* |
| --- | ---: | ---: | ---: | ---: |
| Top 10 | 521 | 520.9 | 3.954 | 970 |
| Top 20 | 520 | 520.2 | 3.943 | 1,836 |
| Top 50 | 517 | 517.3 | 3.911 | 4,039 |
| Top 100 | 515 | 515.3 | 3.894 | 6,355 |
| Any MD acceptance | 512 | 515.3 | 3.894 | 6,355 |

\*These are school-interview records, not guaranteed unique applicants.

All applicant-reported benchmarks are used directionally. Missing values are never converted to zero, and none of the reported percentiles are treated as admissions requirements or guarantees.

## Academic target fit

- **Aligned:** GPA and MCAT are at or above the selected planning center.
- **Within reported range:** both values are at or above the averaged 10th percentile but at least one is below the planning center.
- **Reach:** at least one value is below the averaged 10th percentile.
- **Statistically improbable:** for a ranked target, MCAT is more than 5 points below the averaged 10th percentile **and** GPA is more than 0.25 below its averaged 10th percentile.
- **Not scored:** no completed MCAT is available. The engine assigns a tier-specific planning target.

The “statistically improbable” message is intentionally reserved for a large two-metric mismatch. A borderline value does not trigger it.

Science GPA is optional. When supplied, it contributes 30% of the GPA readiness subscore and cumulative GPA contributes 70%. An upward trend adds a small readiness adjustment; a downward trend subtracts a small adjustment.

## Coursework

Coursework readiness weights standard prerequisites at 78%, requirements used by many schools at 17%, and recommended coursework at 5%.

Standard pattern:

- Biology I–II
- General Chemistry I–II
- Organic Chemistry I–II
- Physics I–II
- two writing/English-intensive semesters

Frequently required or safest to complete:

- Biochemistry
- Statistics
- Calculus

Recommended courses contribute only a small bonus and do not keep an otherwise complete student in “Developing.” When all standard areas are present and no more than two school-dependent areas remain, readiness has a 90% floor. With all standard areas and at most one school-dependent area remaining, it has a 95% floor.

Columbia writing recognition includes University Writing, Literature Humanities I–II, Contemporary Civilization I–II, Art Humanities, and Music Humanities. Because medical schools differ in whether they accept specific Core courses, AP credit, or embedded/separate labs, the app still directs students to verify each school’s admissions page.

## Experience benchmarks and quality

Hours are compared with the averaged self-reported 10th, 25th, and 50th percentiles for the selected target. The interface clearly identifies these figures as directional self-reported context rather than requirements.

Hours contribute 68% of an experience-readiness value. Quality contributes 32% and uses:

- continuity derived from dates;
- responsibility level (participant, contributor, or lead);
- documented output or impact (measurable impact, presentation, poster, publication, award, or other outcome).

One substantial research experience is defined as at least 120 recorded hours or four months of continuity. A substantial experience establishes a readiness floor; a documented output raises it further.

## Diminishing returns and alternatives

- Completing one substantial research commitment suppresses generic “join another lab” recommendations.
- The engine instead recommends deepening the current work or pursuing a concrete output when appropriate.
- Comparable labs linked as alternatives cannot appear sequentially.
- Zuckerman remains hidden after SURF completion and appears only after a SURF rejection, conflict, or ineligibility.
- Two or more substantial research experiences reduce the marginal value of another research-acquisition action even further.

## Compensating strengths

If a student is within the reported GPA/MCAT range but below the target median, the engine can recommend a coherent differentiator: exceptional depth in research, community impact, creative achievement, entrepreneurship, advocacy, or another sustained contribution.

This is not described as a numerical offset. When both academic metrics are far outside the selected range, the engine prioritizes academic repair, an MCAT retake decision, and a broader school list rather than suggesting that a publication or “X factor” erases the mismatch.

## Feasibility and context

Recommendations account for application date, activity duration, deadlines, weekly hours available, current commitments, state residency, applicant status, geography, mission interests, and gap-year flexibility. International applicants receive a specific eligibility-and-funding school-list audit action.

## Recommendation score

Actions are ranked using an ordinal product score composed of:

- gap reduction;
- downstream value;
- evidence strength;
- target/mission relevance;
- feasibility;
- time utility;
- profile personalization;
- recovery-route bonuses;
- uncertainty and diminishing-return penalties.

The score ranks actions against one another. It is not an admissions effect size or acceptance probability.
