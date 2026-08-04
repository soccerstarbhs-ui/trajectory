import { TrajectoryGraph } from "@/components/trajectory-graph";

export default function Home() {
  return (
    <main className="trajectory-shell">
      <header className="trajectory-header">
        <div>
          <p className="trajectory-kicker">TRAJECTORY</p>
          <h1>Your future, mapped.</h1>
          <p className="trajectory-subtitle">
            Explore the courses and opportunities connecting where you are to
            where you want to go.
          </p>
        </div>
        <span className="trajectory-status">
          <i />
          Interactive graph
        </span>
      </header>

      <section className="trajectory-graph-frame" aria-label="Trajectory graph">
        <div className="trajectory-graph-frame__topline">
          <span>MEDICAL SCHOOL PATHWAY</span>
          <span>Drag · pan · zoom</span>
        </div>
        <TrajectoryGraph />
      </section>
    </main>
  );
}
