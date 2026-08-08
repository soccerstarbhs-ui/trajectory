"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { demoProfiles } from "@/lib/demo-profiles";
import {
  rankActions,
  type EngineEdge,
  type EngineNode,
  type RubricComponent,
} from "@/lib/recommendation-engine";

const componentLabels: Record<string, string> = {
  gap_reduction: "Gap reduction",
  downstream_value: "Downstream value",
  evidence_strength: "Evidence",
  mission_relevance: "Mission relevance",
  feasibility: "Feasibility",
  time_utility: "Time utility",
  uncertainty: "Uncertainty penalty",
};

export function RecommendationDemo({
  nodes,
  edges,
  components,
}: {
  nodes: EngineNode[];
  edges: EngineEdge[];
  components: RubricComponent[];
}) {
  const [profileId, setProfileId] = useState(demoProfiles[0].id);
  const profile = demoProfiles.find((item) => item.id === profileId) ?? demoProfiles[0];
  const ranked = useMemo(
    () => rankActions(profile, nodes, edges, components),
    [profile, nodes, edges, components]
  );
  const top = ranked[0];

  return (
    <main className="recommendation-shell">
      <header className="recommendation-header">
        <div>
          <p className="trajectory-kicker">CHECKPOINT 3 · ENGINE TEST</p>
          <h1>Different student. Different next move.</h1>
          <p>
            Switch profiles to verify that the same graph produces a different,
            deterministic recommendation.
          </p>
        </div>
        <Link href="/">Back to graph</Link>
      </header>

      <nav className="profile-switcher" aria-label="Demo student profile">
        {demoProfiles.map((item) => (
          <button
            key={item.id}
            type="button"
            data-active={item.id === profile.id}
            onClick={() => setProfileId(item.id)}
          >
            <strong>{item.label}</strong>
            <span>{item.summary}</span>
          </button>
        ))}
      </nav>

      {top ? (
        <section className="engine-results">
          <article className="top-action-card">
            <div className="top-action-card__label">
              <span>Highest-ranked action</span>
              <i>{top.impact} impact</i>
            </div>
            <h2>{top.actionLabel}</h2>
            <p>
              Addresses the <strong>{top.addressedGap}</strong> gap
              {top.unlockCount > 0 ? ` and preserves ${top.unlockCount} downstream connection${top.unlockCount === 1 ? "" : "s"}` : ""}.
            </p>
            <div className="action-metrics">
              <span><strong>{top.score}</strong> Action Impact points</span>
              <span><strong>{top.evidenceClass}</strong> evidence class</span>
              <span><strong>{top.confidence}</strong> confidence</span>
            </div>
            <small>
              Product heuristic for relative ranking—not an acceptance probability.
            </small>
          </article>

          <aside className="engine-breakdown">
            <div>
              <span>Profile context</span>
              <strong>{profile.timeline}</strong>
            </div>
            <h3>Why it ranked first</h3>
            {Object.entries(top.breakdown).map(([key, value]) => (
              <div className="breakdown-row" key={key}>
                <span>{componentLabels[key] ?? key}</span>
                <strong>{key === "uncertainty" ? "−" : "+"}{value}</strong>
              </div>
            ))}
          </aside>

          <section className="runner-up-list">
            <span>Next-best alternatives</span>
            {ranked.slice(1, 4).map((action, index) => (
              <article key={action.node.id}>
                <i>0{index + 2}</i>
                <div>
                  <strong>{action.actionLabel}</strong>
                  <span>{action.addressedGap} gap · {action.impact} impact</span>
                </div>
                <b>{action.score}</b>
              </article>
            ))}
          </section>
        </section>
      ) : null}
    </main>
  );
}
