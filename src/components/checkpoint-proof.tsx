const careerTemplates = [
  {
    label: "Medical School",
    status: "Live demo",
    detail: "Courses, clinical exposure, research, service, timing, and evidence-backed next actions.",
  },
  {
    label: "NASA Engineer",
    status: "Template-ready",
    detail: "Technical prerequisites, project experience, mentors, internships, and mission-specific opportunities.",
  },
  {
    label: "Biotech Founder",
    status: "Template-ready",
    detail: "Scientific depth, venture skills, collaborators, funding programs, and milestone dependencies.",
  },
];

const comparisons = [
  ["Degree planners", "List course requirements", "Calculates the highest-value next action"],
  ["AI chatbots", "Answer one prompt at a time", "Maintains an evolving student-state graph"],
  ["Admissions calculators", "Estimate competitiveness", "Ranks controllable actions without fake probabilities"],
  ["Static roadmaps", "Show one fixed sequence", "Reroutes after setbacks and new opportunities"],
];

const scoreComponents = [
  "Gap reduction",
  "Downstream value",
  "Evidence strength",
  "Mission relevance",
  "Feasibility",
  "Time utility",
  "− Uncertainty",
];

export function CheckpointProof() {
  return (
    <section className="checkpoint-proof" aria-label="Trajectory scalability and methodology">
      <div className="proof-heading">
        <p className="trajectory-kicker">WHY TRAJECTORY SCALES</p>
        <h2>One engine. Many destinations.</h2>
        <p>
          The domain changes; the architecture does not. Each template supplies its own
          dependencies, opportunities, evidence, and outcomes.
        </p>
      </div>

      <div className="architecture-flow" aria-label="Career-agnostic architecture">
        {["Goal", "Dependencies", "Opportunities", "Outcomes", "Rerouting", "Next-best action"].map(
          (step, index) => (
            <span key={step}>{index > 0 ? <i>→</i> : null}{step}</span>
          )
        )}
      </div>

      <div className="career-template-grid">
        {careerTemplates.map((template) => (
          <article key={template.label} data-live={template.status === "Live demo"}>
            <span>{template.status}</span>
            <h3>{template.label}</h3>
            <p>{template.detail}</p>
          </article>
        ))}
      </div>

      <div className="proof-grid">
        <article className="difference-card">
          <p className="trajectory-kicker">NOT ANOTHER PLANNER</p>
          <h2>The difference is continuous decision support.</h2>
          <div className="comparison-table">
            <div className="comparison-table__head">
              <span>Category</span><span>Typical product</span><span>Trajectory</span>
            </div>
            {comparisons.map(([category, typical, trajectory]) => (
              <div key={category}>
                <strong>{category}</strong><span>{typical}</span><span>{trajectory}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="method-card">
          <p className="trajectory-kicker">ACTION IMPACT · 20-SECOND METHOD</p>
          <h2>Transparent today. Probability only after validation.</h2>
          <p>
            Action Impact is a 0–100 relative product score: it combines gap reduction,
            downstream value, evidence strength, mission fit, feasibility, and timing, then
            subtracts uncertainty. It does not claim to predict admission.
          </p>
          <div className="method-components">
            {scoreComponents.map((component) => <span key={component}>{component}</span>)}
          </div>
          <small>
            Evidence classes separate empirical support from model inference. Diminishing returns
            prevent redundant activities from dominating. Personalized probability remains gated
            until prospective outcome data can validate it; ML is a future scaling layer, not this MVP.
          </small>
        </article>
      </div>
    </section>
  );
}
