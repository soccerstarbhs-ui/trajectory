// ============================================================
// Trajectory — Phase 1 seed data: Medical School @ Columbia University
// ============================================================
// Real, verifiable data sourced from: Columbia Premedical Handbook
// 2023-24 and cc-seas.columbia.edu (course codes, advising office),
// biology.columbia.edu (SURF / Amgen Scholars — Columbia-specific
// research pipeline), zuckermaninstitute.columbia.edu and
// cancer.columbia.edu (real research institutes), and real national
// scholarship/fellowship programs.
//
// Individual named professors/PIs are intentionally NOT included as
// nodes — labs/institutes are real, PI-level detail is not, to avoid
// representing real individuals' research/mentorship inside the app
// without their knowledge.

export type SeedNode = {
  key: string;
  type:
    | "goal"
    | "course"
    | "extracurricular"
    | "scholarship"
    | "research_lab"
    | "professor"
    | "club"
    | "internship";
  name: string;
  metadata: Record<string, unknown>;
  probability_impact: number;
};

export type SeedEdge = {
  source: string;
  target: string;
  relationship_type:
    | "prerequisite"
    | "unlocks"
    | "increases_probability"
    | "alternative_to";
  weight: number;
};

export const nodes: SeedNode[] = [
  // ---------------- GOAL ----------------
  { key: "goal_med_school", type: "goal", name: "Medical School", metadata: { description: "Admission to an accredited U.S. MD or DO program", school: "Columbia University" }, probability_impact: 0 },

  // ---------------- COURSES (real Columbia course codes, Premedical Handbook 2023-24) ----------------
  { key: "c_genchem1", type: "course", name: "CHEM UN1403 General Chemistry I", metadata: { credits: 4, dept: "Chemistry" }, probability_impact: 1 },
  { key: "c_genchem2", type: "course", name: "CHEM UN1404 General Chemistry II", metadata: { credits: 4, dept: "Chemistry" }, probability_impact: 1 },
  { key: "c_genchemlab", type: "course", name: "CHEM UN1500 General Chemistry Laboratory", metadata: { credits: 3, dept: "Chemistry" }, probability_impact: 1 },
  { key: "c_ochem1", type: "course", name: "CHEM UN2443 Organic Chemistry I", metadata: { credits: 4, dept: "Chemistry" }, probability_impact: 2 },
  { key: "c_ochem2", type: "course", name: "CHEM UN2444 Organic Chemistry II", metadata: { credits: 4, dept: "Chemistry" }, probability_impact: 2 },
  { key: "c_ochemlab", type: "course", name: "CHEM UN2493/2494 Organic Chemistry Laboratory", metadata: { credits: 3, dept: "Chemistry" }, probability_impact: 1 },
  { key: "c_bio1", type: "course", name: "BIOL UN2005 Introductory Biology I: Biochemistry, Genetics & Molecular Biology", metadata: { credits: 4, dept: "Biological Sciences" }, probability_impact: 1.5 },
  { key: "c_bio2", type: "course", name: "BIOL UN2006 Introductory Biology II: Cell Biology, Development & Physiology", metadata: { credits: 4, dept: "Biological Sciences" }, probability_impact: 1.5 },
  { key: "c_biolab", type: "course", name: "BIOL UN2501 Contemporary Biology Laboratory", metadata: { credits: 3, dept: "Biological Sciences" }, probability_impact: 1 },
  { key: "c_phys1", type: "course", name: "PHYS UN1201 General Physics I", metadata: { credits: 3, dept: "Physics" }, probability_impact: 1 },
  { key: "c_phys2", type: "course", name: "PHYS UN1202 General Physics II", metadata: { credits: 3, dept: "Physics" }, probability_impact: 1 },
  { key: "c_physlab", type: "course", name: "PHYS UN1291/1292 General Physics Laboratory", metadata: { credits: 2, dept: "Physics" }, probability_impact: 1 },
  { key: "c_calc1", type: "course", name: "MATH UN1101 Calculus I", metadata: { credits: 3, dept: "Mathematics" }, probability_impact: 0.5 },
  { key: "c_calc2", type: "course", name: "MATH UN1102 Calculus II", metadata: { credits: 3, dept: "Mathematics" }, probability_impact: 0.5 },
  { key: "c_stats", type: "course", name: "STAT UN1101 Introduction to Statistics (without calculus)", metadata: { credits: 3, dept: "Statistics" }, probability_impact: 1 },
  { key: "c_biochem", type: "course", name: "BIOC UN3300 Biochemistry", metadata: { credits: 3, dept: "Biochemistry" }, probability_impact: 3 },
  { key: "c_psych", type: "course", name: "PSYC UN1001 The Science of Psychology", metadata: { credits: 3, dept: "Psychology" }, probability_impact: 1 },
  { key: "c_writing", type: "course", name: "ENGL CC1010 University Writing", metadata: { credits: 3, dept: "English" }, probability_impact: 0.5 },
  { key: "c_litHum", type: "course", name: "HUMA CC1001 Literature Humanities I", metadata: { credits: 4, dept: "Core Curriculum" }, probability_impact: 0.5 },
  { key: "c_genetics", type: "course", name: "Advanced Genetics (Biological Sciences upper-level elective)", metadata: { credits: 3, dept: "Biological Sciences" }, probability_impact: 2 },
  { key: "c_micro", type: "course", name: "Microbiology (Biological Sciences upper-level elective)", metadata: { credits: 3, dept: "Biological Sciences" }, probability_impact: 1.5 },
  { key: "c_immuno", type: "course", name: "Immunobiology (Biological Sciences upper-level elective)", metadata: { credits: 3, dept: "Biological Sciences" }, probability_impact: 1.5 },
  { key: "c_neurosci", type: "course", name: "PSYC UN2430 Introduction to Behavioral Neuroscience", metadata: { credits: 3, dept: "Psychology" }, probability_impact: 1.5 },
  { key: "c_biostat", type: "course", name: "STAT GU4001 Introduction to Probability and Statistics", metadata: { credits: 3, dept: "Statistics" }, probability_impact: 1.5 },
  { key: "c_orgchem_placement", type: "course", name: "CHEM UN2045/2046 Intensive Organic Chemistry (First-Year)", metadata: { credits: 8, dept: "Chemistry", note: "Advanced placement track" }, probability_impact: 2 },
  { key: "c_capstone", type: "course", name: "BIOL UN3500 Independent Research in Biological Sciences", metadata: { credits: 3, dept: "Biological Sciences" }, probability_impact: 3 },
  { key: "c_pharm", type: "course", name: "Molecular Pharmacology (Biochemistry upper-level elective)", metadata: { credits: 3, dept: "Biochemistry" }, probability_impact: 1.5 },
  { key: "c_devbio", type: "course", name: "Developmental Biology (Biological Sciences upper-level elective)", metadata: { credits: 3, dept: "Biological Sciences" }, probability_impact: 1 },
  { key: "c_medethics", type: "course", name: "Bioethics (interdisciplinary elective)", metadata: { credits: 3, dept: "Bioethics" }, probability_impact: 1 },
  { key: "c_publichealth", type: "course", name: "Introduction to Public Health (Sociomedical Sciences)", metadata: { credits: 3, dept: "Sociomedical Sciences" }, probability_impact: 0.5 },

  // ---------------- EXTRACURRICULARS ----------------
  { key: "e_hospital_volunteer", type: "extracurricular", name: "Mount Sinai Morningside Hospital Volunteering", metadata: { note: "Real, Columbia's closest teaching hospital; not open to first-years until spring semester", hours_needed: 100 }, probability_impact: 3 },
  { key: "e_shadowing", type: "extracurricular", name: "Physician Shadowing (40+ hrs)", metadata: { hours_needed: 40 }, probability_impact: 4 },
  { key: "e_scribe", type: "extracurricular", name: "Medical Scribing (part-time job)", metadata: {}, probability_impact: 4 },
  { key: "e_peertutor", type: "extracurricular", name: "CSA Tutoring Service — Science Peer Tutor", metadata: { note: "Real Columbia Center for Student Advising program" }, probability_impact: 1.5 },
  { key: "e_blooddrive", type: "extracurricular", name: "Campus Blood Drive Organizer", metadata: {}, probability_impact: 1 },
  { key: "e_nonprofit", type: "extracurricular", name: "Health-Focused Student Nonprofit Founder/Lead", metadata: {}, probability_impact: 3 },
  { key: "e_ra", type: "extracurricular", name: "Resident Advisor (Columbia Housing)", metadata: {}, probability_impact: 1 },
  { key: "e_labtech", type: "extracurricular", name: "Part-time Lab Technician / Research Assistant Job", metadata: {}, probability_impact: 2 },
  { key: "e_mission_trip", type: "extracurricular", name: "Global Medical Brigades Trip", metadata: {}, probability_impact: 2 },
  { key: "e_studentgov", type: "extracurricular", name: "Columbia College Student Council", metadata: { note: "Real Columbia student government body" }, probability_impact: 1 },
  { key: "e_publication_nonresearch", type: "extracurricular", name: "Columbia University Science Journal Writer", metadata: { note: "Real: CUSJ, student-led research publication" }, probability_impact: 1.5 },
  { key: "e_peerhealth", type: "extracurricular", name: "Peer Health Exchange Volunteer Educator", metadata: { note: "Real: teaches health ed workshops in under-resourced NYC high schools" }, probability_impact: 2 },
  { key: "e_ems_volunteer", type: "extracurricular", name: "CU Emergency Medical Service (CUEMS) Volunteer EMT", metadata: { note: "Real: NYS-certified student BLS ambulance corps, ~700 calls/year" }, probability_impact: 5 },
  { key: "e_freeclinic", type: "extracurricular", name: "Free Clinic / Community Health Fair Volunteer", metadata: {}, probability_impact: 3 },
  { key: "e_teamsport", type: "extracurricular", name: "Club Sport (4 years)", metadata: {}, probability_impact: 1 },

  // ---------------- SCHOLARSHIPS (real, national, applicable to Columbia students) ----------------
  { key: "s_goldwater", type: "scholarship", name: "Barry Goldwater Scholarship", metadata: { deadline: "Late January", amount: "$7,500/yr", note: "Columbia nominates students annually via URF office" }, probability_impact: 3 },
  { key: "s_amsa_scholarship", type: "scholarship", name: "AMSA Premedical Scholarship", metadata: {}, probability_impact: 1.5 },
  { key: "s_aamc_fap", type: "scholarship", name: "AAMC Fee Assistance Program", metadata: { note: "Reduces MCAT/AMCAS costs for eligible students" }, probability_impact: 0.5 },
  { key: "s_jkcf", type: "scholarship", name: "Jack Kent Cooke Foundation Scholarship", metadata: {}, probability_impact: 1.5 },
  { key: "s_gates", type: "scholarship", name: "Gates Scholarship", metadata: {}, probability_impact: 1.5 },
  { key: "s_hispanic_scholarship_fund", type: "scholarship", name: "Hispanic Scholarship Fund", metadata: {}, probability_impact: 1 },
  { key: "s_apiasf", type: "scholarship", name: "APIA Scholars Award", metadata: {}, probability_impact: 1 },
  { key: "s_naacp", type: "scholarship", name: "NAACP STEM Scholarship", metadata: {}, probability_impact: 1 },
  { key: "s_sma", type: "scholarship", name: "Student National Medical Association Scholarship", metadata: {}, probability_impact: 1.5 },
  { key: "s_beinecke", type: "scholarship", name: "Beinecke Scholarship", metadata: { note: "For research-intending juniors; Columbia nominates via URF office" }, probability_impact: 1 },
  { key: "s_udall", type: "scholarship", name: "Udall Scholarship", metadata: { note: "Environmental/health policy focus; Columbia nominates via URF office" }, probability_impact: 1 },

  // ---------------- RESEARCH LABS / INSTITUTES (real Columbia institutes, no individual PIs named) ----------------
  { key: "r_zuckerman", type: "research_lab", name: "Zuckerman Institute — Neuroscience Research", metadata: { note: "Real: Columbia's Mortimer B. Zuckerman Mind Brain Behavior Institute", focus: "Neuroscience, cognition, behavior" }, probability_impact: 5 },
  { key: "r_hiccc", type: "research_lab", name: "Herbert Irving Comprehensive Cancer Center — Cancer Biology", metadata: { note: "Real: NCI-designated cancer center at CUIMC", focus: "Cancer regulatory networks, genetics, epigenetics" }, probability_impact: 5 },
  { key: "r_biosci_dept", type: "research_lab", name: "Department of Biological Sciences — SURF-Affiliated Lab", metadata: { note: "Real: labs on Morningside campus and Health Sciences campus participating in SURF", focus: "Varies by lab; molecular/cell biology, genetics, physiology" }, probability_impact: 5 },
  { key: "r_taub", type: "research_lab", name: "Taub Institute for Research on Alzheimer's Disease and the Aging Brain", metadata: { note: "Real Columbia research institute", focus: "Neurodegeneration, aging" }, probability_impact: 4 },
  { key: "r_aging_center", type: "research_lab", name: "Robert N. Butler Columbia Aging Center", metadata: { note: "Real Columbia research center", focus: "Aging and longevity" }, probability_impact: 3 },
  { key: "r_womens_health", type: "research_lab", name: "Women's Health Initiative — Columbia Site", metadata: { note: "Real, Columbia-affiliated arm of national NIH study", focus: "Population health, chronic disease in women" }, probability_impact: 3 },
  { key: "r_irving_cancer_dynamics", type: "research_lab", name: "Irving Institute for Cancer Dynamics", metadata: { note: "Real Columbia research institute", focus: "Quantitative/computational cancer biology" }, probability_impact: 4 },

  // ---------------- PROFESSORS (generic role-based only; no real individuals named) ----------------
  { key: "p_premed_advisor", type: "professor", name: "Preprofessional Advising Dean", metadata: { office: "403 Alfred Lerner Hall", note: "Real Columbia office: Preprofessional Advising, Center for Student Advising" }, probability_impact: 2 },
  { key: "p_biosci_pi", type: "professor", name: "SURF-Affiliated Lab Director (Biological Sciences)", metadata: {}, probability_impact: 1 },
  { key: "p_biochem_prof", type: "professor", name: "Biochemistry Course Faculty (BIOC UN3300)", metadata: {}, probability_impact: 0.5 },

  // ---------------- CLUBS (real Columbia premedical-related student orgs + supplemental interest groups) ----------------
  { key: "cl_amsa", type: "club", name: "American Medical Student Association (AMSA) — Columbia Chapter", metadata: { note: "Real Columbia premedical society" }, probability_impact: 1 },
  { key: "cl_caps", type: "club", name: "Columbia University Association of Predental Students (CAPS)", metadata: { note: "Real Columbia org" }, probability_impact: 0.5 },
  { key: "cl_cuems_club", type: "club", name: "CU Emergency Medical Service (CUEMS)", metadata: { note: "Real; see also extracurricular EMT volunteer node" }, probability_impact: 1.5 },
  { key: "cl_cusj", type: "club", name: "Columbia University Science Journal (CUSJ)", metadata: { note: "Real: student-led undergraduate research publication" }, probability_impact: 1 },
  { key: "cl_charlesdrew", type: "club", name: "Charles Drew Premedical Society", metadata: { note: "Real: support/resource group for underrepresented premedical students" }, probability_impact: 1.5 },
  { key: "cl_peerhealthexchange", type: "club", name: "Peer Health Exchange", metadata: { note: "Real: trains students to teach health ed in NYC high schools" }, probability_impact: 1 },
  { key: "cl_premed_society", type: "club", name: "Columbia Pre-Med Society", metadata: {}, probability_impact: 1.5 },
  { key: "cl_globalmed", type: "club", name: "Global Medical Brigades — Columbia Chapter", metadata: {}, probability_impact: 2 },
  { key: "cl_redcross", type: "club", name: "Columbia Red Cross Club", metadata: {}, probability_impact: 1 },
  { key: "cl_bioethics", type: "club", name: "Bioethics Discussion Society", metadata: {}, probability_impact: 0.5 },
  { key: "cl_womeninmed", type: "club", name: "Women in Medicine", metadata: {}, probability_impact: 1 },
  { key: "cl_researchclub", type: "club", name: "Undergraduate Research Club", metadata: {}, probability_impact: 1 },
  { key: "cl_neuroclub", type: "club", name: "Neuroscience Club", metadata: {}, probability_impact: 1 },
  { key: "cl_mentalhealth", type: "club", name: "Mental Health Advocacy Club", metadata: {}, probability_impact: 1 },
  { key: "cl_publichealthclub", type: "club", name: "Public Health Student Association", metadata: {}, probability_impact: 1 },
  { key: "cl_prehealth_minority", type: "club", name: "Minority Association of Pre-Health Students", metadata: {}, probability_impact: 1.5 },
  { key: "cl_surgery_interest", type: "club", name: "Surgery Interest Group", metadata: {}, probability_impact: 1 },
  { key: "cl_healthpolicy", type: "club", name: "Health Policy Club", metadata: {}, probability_impact: 0.5 },
  { key: "cl_lgbtq_health", type: "club", name: "LGBTQ+ Health Alliance", metadata: {}, probability_impact: 1 },
  { key: "cl_nutrition_club", type: "club", name: "Nutrition & Wellness Club", metadata: {}, probability_impact: 0.5 },

  // ---------------- INTERNSHIPS / FELLOWSHIPS (real, Columbia-specific where possible) ----------------
  { key: "i_surf", type: "internship", name: "Columbia SURF (Summer Undergraduate Research Fellowship)", metadata: { deadline: "Early January", duration: "10 weeks", note: "Real, Columbia-specific: Dept. of Biological Sciences, since the 1980s" }, probability_impact: 6 },
  { key: "i_amgen_columbia", type: "internship", name: "Amgen Scholars Program — Columbia University", metadata: { note: "Real: SURF applicants are automatically considered for Amgen Scholars" }, probability_impact: 6 },
  { key: "i_nih_sip", type: "internship", name: "NIH Summer Internship Program", metadata: { deadline: "March 1", note: "Real, national NIH program" }, probability_impact: 5 },
  { key: "i_reu", type: "internship", name: "NSF Research Experience for Undergraduates (REU)", metadata: {}, probability_impact: 4 },
  { key: "i_mayo_sure", type: "internship", name: "Mayo Clinic SURF Program", metadata: {}, probability_impact: 5 },
  { key: "i_cdc_urep", type: "internship", name: "CDC Undergraduate Public Health Scholars Program", metadata: {}, probability_impact: 4 },
  { key: "i_hospital_internship", type: "internship", name: "NewYork-Presbyterian/Columbia Administrative Internship", metadata: {}, probability_impact: 2 },
  { key: "i_pharma_internship", type: "internship", name: "Pharmaceutical Industry Summer Internship", metadata: {}, probability_impact: 3 },
];
