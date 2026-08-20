"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type MotionPhase = "orbiting" | "approaching" | "launching";

const CENTER = { x: 314, y: 324 };
const RADIUS = 123;
const TOP_ANGLE = Math.PI * 1.5;
const MEDICAL_END = { x: 675, y: 201 };

function pointOnOrbit(angle: number) {
  return {
    x: CENTER.x + Math.cos(angle) * RADIUS,
    y: CENTER.y + Math.sin(angle) * RADIUS,
  };
}

export function OrbitLanding() {
  const router = useRouter();
  const [phase, setPhase] = useState<MotionPhase>("orbiting");
  const [ball, setBall] = useState(() => pointOnOrbit(Math.PI / 2));
  const phaseRef = useRef<MotionPhase>("orbiting");
  const angleRef = useRef(Math.PI / 2);
  const launchStartRef = useRef(0);
  const previousTimeRef = useRef(0);

  const selectMedical = useCallback(() => {
    if (phaseRef.current !== "orbiting") return;
    phaseRef.current = "approaching";
    setPhase("approaching");
  }, []);

  useEffect(() => {
    let frame = 0;

    const animate = (time: number) => {
      const previous = previousTimeRef.current || time;
      const delta = Math.min((time - previous) / 1000, 0.04);
      previousTimeRef.current = time;

      if (phaseRef.current === "orbiting") {
        angleRef.current = (angleRef.current + delta * 0.72) % (Math.PI * 2);
        setBall(pointOnOrbit(angleRef.current));
      } else if (phaseRef.current === "approaching") {
        const remaining = (TOP_ANGLE - angleRef.current + Math.PI * 2) % (Math.PI * 2);
        const step = delta * 1.45;

        if (remaining <= step || remaining < 0.012) {
          angleRef.current = TOP_ANGLE;
          setBall(pointOnOrbit(TOP_ANGLE));
          phaseRef.current = "launching";
          setPhase("launching");
          launchStartRef.current = time;
        } else {
          angleRef.current = (angleRef.current + step) % (Math.PI * 2);
          setBall(pointOnOrbit(angleRef.current));
        }
      } else {
        const elapsed = time - launchStartRef.current;
        const rawProgress = Math.min(elapsed / 1120, 1);
        const progress = 1 - Math.pow(1 - rawProgress, 3);
        const start = pointOnOrbit(TOP_ANGLE);
        setBall({
          x: start.x + (MEDICAL_END.x - start.x) * progress,
          y: start.y + (MEDICAL_END.y - start.y) * progress,
        });

        if (rawProgress === 1) {
          router.push("/profile");
          return;
        }
      }

      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [router]);

  const tetherVisible = phase !== "launching";
  const medicalActive = phase !== "orbiting";

  return (
    <main className="orbit-page">
      <div className="orbit-page__stars" aria-hidden="true" />
      <header className="orbit-nav" aria-label="Trajectory home">
        <a href="/" className="orbit-brand" aria-label="Trajectory home">
          <span className="orbit-brand__mark" aria-hidden="true"><i /></span>
          TRAJECTORY
        </a>
        <span className="orbit-nav__tag">YOUR PATH, IN MOTION</span>
      </header>

      <section className="orbit-hero">
        <div className="orbit-copy">
          <p className="orbit-eyebrow">THE FUTURE DOESN&apos;T FOLLOW A SYLLABUS</p>
          <h1>Your future.<span>Mapped.</span></h1>
          <p className="orbit-copy__body">
            Discover the right path, adapt in real time, and turn every decision into forward motion.
          </p>
          <div className="orbit-copy__hint"><span aria-hidden="true">↗</span>Choose a destination to begin</div>
        </div>

        <div className="orbit-visual" aria-label="Animated career path selector">
          <div className="orbit-visual__glow" aria-hidden="true" />
          <svg viewBox="0 0 800 620" role="img" aria-labelledby="orbit-title orbit-description">
            <title id="orbit-title">Choose a career destination</title>
            <desc id="orbit-description">A moving ball orbits a fixed center. Three paths leave the top of the orbit toward law, medical, and dental school. Only medical school is currently available.</desc>
            <defs>
              <filter id="ball-glow" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <linearGradient id="ball-fill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#c9fff0" /><stop offset="0.42" stopColor="#62e6bd" /><stop offset="1" stopColor="#168e73" />
              </linearGradient>
            </defs>

            <circle className="orbit-ring" cx={CENTER.x} cy={CENTER.y} r={RADIUS} />
            <path className="destination-path destination-path--law" d="M314 201 C428 201 470 129 602 83" />
            <path className={`destination-path destination-path--medical${medicalActive ? " is-active" : ""}`} d={`M314 201 L${MEDICAL_END.x} ${MEDICAL_END.y}`} />
            <path className="destination-path destination-path--dental" d="M314 201 C433 204 494 276 602 353" />

            <circle className="branch-point" cx="314" cy="201" r="5" />
            <circle className="destination-dot" cx="602" cy="83" r="6" />
            <circle className="destination-dot destination-dot--medical" cx={MEDICAL_END.x} cy={MEDICAL_END.y} r="6" />
            <circle className="destination-dot" cx="602" cy="353" r="6" />

            {tetherVisible ? <line className="orbit-tether" x1={CENTER.x} y1={CENTER.y} x2={ball.x} y2={ball.y} /> : null}
            <circle className="orbit-anchor" cx={CENTER.x} cy={CENTER.y} r="9" />
            <circle className="orbit-anchor-core" cx={CENTER.x} cy={CENTER.y} r="4" />
            <circle className="orbit-ball" cx={ball.x} cy={ball.y} r="17" fill="url(#ball-fill)" filter="url(#ball-glow)" />

            <g className="destination-label destination-label--inactive" transform="translate(620 52)"><rect width="137" height="50" rx="13" /><text x="18" y="31">Law School</text></g>
            <g className="destination-label destination-label--inactive" transform="translate(620 328)"><rect width="147" height="50" rx="13" /><text x="18" y="31">Dental School</text></g>
          </svg>
          <button className="medical-hit-target" type="button" onClick={selectMedical} disabled={phase !== "orbiting"}>
            <span>Medical School</span>
            <small>{phase === "orbiting" ? "Start trajectory" : "Mapping your path…"}</small>
          </button>
          <p className="orbit-coming-soon">Law and Dental pathways coming soon</p>
        </div>
      </section>
    </main>
  );
}
