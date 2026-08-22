"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";

type MotionPhase = "orbiting" | "approaching" | "launching" | "transitioning";
type DestinationId = "law" | "medical" | "dental";
type Point = { x: number; y: number };
type MotionFrame = { ball: Point; trail: Point[] };
type PortalRect = { top: number; left: number; width: number; height: number };

type Destination = {
  id: DestinationId;
  label: string;
  end: Point;
  controls: [Point, Point];
  buttonY: number;
  route: string;
};

const CENTER = { x: 314, y: 324 };
const RADIUS = 123;
const TOP_ANGLE = Math.PI * 1.5;
const BRANCH_POINT = { x: 314, y: 201 };

const destinations: Record<DestinationId, Destination> = {
  law: {
    id: "law",
    label: "Law School",
    end: { x: 602, y: 83 },
    controls: [{ x: 428, y: 201 }, { x: 470, y: 129 }],
    buttonY: 48,
    route: "/coming-soon/law",
  },
  medical: {
    id: "medical",
    label: "Medical School",
    end: { x: 602, y: 201 },
    controls: [{ x: 410, y: 201 }, { x: 506, y: 201 }],
    buttonY: 166,
    route: "/profile",
  },
  dental: {
    id: "dental",
    label: "Dental School",
    end: { x: 602, y: 353 },
    controls: [{ x: 433, y: 204 }, { x: 494, y: 276 }],
    buttonY: 318,
    route: "/coming-soon/dental",
  },
};

function pointOnOrbit(angle: number) {
  return {
    x: CENTER.x + Math.cos(angle) * RADIUS,
    y: CENTER.y + Math.sin(angle) * RADIUS,
  };
}

function initialTrail(angle: number) {
  return Array.from({ length: 23 }, (_, index) =>
    pointOnOrbit(angle - (22 - index) * 0.013)
  );
}

function pointOnBezier(start: Point, first: Point, second: Point, end: Point, progress: number) {
  const inverse = 1 - progress;
  return {
    x: inverse ** 3 * start.x + 3 * inverse ** 2 * progress * first.x + 3 * inverse * progress ** 2 * second.x + progress ** 3 * end.x,
    y: inverse ** 3 * start.y + 3 * inverse ** 2 * progress * first.y + 3 * inverse * progress ** 2 * second.y + progress ** 3 * end.y,
  };
}

export function OrbitLanding() {
  const router = useRouter();
  const [phase, setPhase] = useState<MotionPhase>("orbiting");
  const [selectedId, setSelectedId] = useState<DestinationId | null>(null);
  const [hoveredId, setHoveredId] = useState<DestinationId | null>(null);
  const [portalRect, setPortalRect] = useState<PortalRect | null>(null);
  const [motion, setMotion] = useState<MotionFrame>(() => ({
    ball: pointOnOrbit(Math.PI / 2),
    trail: initialTrail(Math.PI / 2),
  }));
  const phaseRef = useRef<MotionPhase>("orbiting");
  const selectedRef = useRef<DestinationId | null>(null);
  const angleRef = useRef(Math.PI / 2);
  const launchStartRef = useRef(0);
  const previousTimeRef = useRef(0);
  const medicalButtonRef = useRef<HTMLButtonElement | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);

  const selectDestination = useCallback((destination: DestinationId) => {
    if (phaseRef.current !== "orbiting") return;
    selectedRef.current = destination;
    setSelectedId(destination);
    phaseRef.current = "approaching";
    setPhase("approaching");
  }, []);

  const beginProfileTransition = useCallback(() => {
    if (phaseRef.current === "transitioning") return;
    phaseRef.current = "transitioning";
    setPhase("transitioning");
    const rect = medicalButtonRef.current?.getBoundingClientRect();
    if (!rect) {
      router.push("/profile");
      return;
    }
    setPortalRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    transitionTimeoutRef.current = window.setTimeout(() => router.push("/profile"), 1050);
  }, [router]);

  useEffect(() => {
    let frame = 0;

    const moveBall = (nextBall: Point) => {
      setMotion((current) => ({
        ball: nextBall,
        trail: [...current.trail.slice(-22), current.ball],
      }));
    };

    const animate = (time: number) => {
      const previous = previousTimeRef.current || time;
      const delta = Math.min((time - previous) / 1000, 0.04);
      previousTimeRef.current = time;

      if (phaseRef.current === "orbiting") {
        angleRef.current = (angleRef.current + delta * 0.72) % (Math.PI * 2);
        moveBall(pointOnOrbit(angleRef.current));
      } else if (phaseRef.current === "approaching") {
        const remaining = (TOP_ANGLE - angleRef.current + Math.PI * 2) % (Math.PI * 2);
        const step = delta * 1.45;

        if (remaining <= step || remaining < 0.012) {
          angleRef.current = TOP_ANGLE;
          moveBall(BRANCH_POINT);
          phaseRef.current = "launching";
          setPhase("launching");
          launchStartRef.current = time;
        } else {
          angleRef.current = (angleRef.current + step) % (Math.PI * 2);
          moveBall(pointOnOrbit(angleRef.current));
        }
      } else if (phaseRef.current === "launching") {
        const destinationId = selectedRef.current;
        if (!destinationId) return;
        const destination = destinations[destinationId];
        const rawProgress = Math.min((time - launchStartRef.current) / 1120, 1);
        const progress = 1 - Math.pow(1 - rawProgress, 3);
        moveBall(pointOnBezier(BRANCH_POINT, destination.controls[0], destination.controls[1], destination.end, progress));

        if (rawProgress === 1) {
          if (destinationId === "medical") beginProfileTransition();
          else router.push(destination.route);
          return;
        }
      } else {
        return;
      }

      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [beginProfileTransition, router]);

  useEffect(() => () => {
    if (transitionTimeoutRef.current !== null) window.clearTimeout(transitionTimeoutRef.current);
  }, []);

  const tetherVisible = phase !== "launching";
  const highlightedId = selectedId ?? hoveredId;
  const ball = motion.ball;
  const trailScale = phase === "orbiting" ? 1 : phase === "approaching" ? 1.28 : 1.42;

  return (
    <main className="orbit-page">
      <div className="orbit-page__stars" aria-hidden="true" />
      <header className="orbit-nav" aria-label="Trajectory home">
        <Link href="/" className="orbit-brand" aria-label="Trajectory home">
          <span className="orbit-brand__mark" aria-hidden="true"><i /></span>
          TRAJECTORY
        </Link>
        <span className="orbit-nav__tag">YOUR PATH, IN MOTION</span>
      </header>

      <section className="orbit-hero">
        <div className="orbit-copy">
          <p className="orbit-eyebrow">THE FUTURE DOESN&apos;T FOLLOW A SYLLABUS</p>
          <h1>Your future.<span>Mapped.</span></h1>
          <p className="orbit-copy__body">Discover the right path, adapt in real time, and turn every decision into forward motion.</p>
          <div className="orbit-copy__hint"><span aria-hidden="true">↗</span>Choose a destination to begin</div>
        </div>

        <div className="orbit-visual" aria-label="Animated career path selector">
          <div className="orbit-visual__glow" aria-hidden="true" />
          <svg viewBox="0 0 800 620" role="img" aria-labelledby="orbit-title orbit-description">
            <title id="orbit-title">Choose a career destination</title>
            <desc id="orbit-description">A moving ball orbits a fixed center. Three paths leave the top of the orbit toward law, medical, and dental school.</desc>
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
            {(Object.values(destinations)).map((destination) => (
              <path
                key={destination.id}
                className={`destination-path destination-path--${destination.id}${highlightedId === destination.id ? " is-active" : ""}`}
                d={`M${BRANCH_POINT.x} ${BRANCH_POINT.y} C${destination.controls[0].x} ${destination.controls[0].y} ${destination.controls[1].x} ${destination.controls[1].y} ${destination.end.x} ${destination.end.y}`}
              />
            ))}

            <circle className="branch-point" cx={BRANCH_POINT.x} cy={BRANCH_POINT.y} r="5" />
            {Object.values(destinations).map((destination) => (
              <circle key={destination.id} className={`destination-dot${highlightedId === destination.id ? " is-active" : ""}`} cx={destination.end.x} cy={destination.end.y} r="6" />
            ))}

            {tetherVisible ? <line className="orbit-tether" x1={CENTER.x} y1={CENTER.y} x2={ball.x} y2={ball.y} /> : null}
            <circle className="orbit-anchor" cx={CENTER.x} cy={CENTER.y} r="9" />
            <circle className="orbit-anchor-core" cx={CENTER.x} cy={CENTER.y} r="4" />
            <g className="orbit-trail" aria-hidden="true">
              {motion.trail.map((point, index) => (
                <circle key={index} cx={point.x} cy={point.y} r={(3.5 + index * 0.12) * trailScale} opacity={0.08 + (index + 1) / (motion.trail.length + 1) * 0.48} />
              ))}
            </g>
            <circle className="orbit-ball" cx={ball.x} cy={ball.y} r="17" fill="url(#ball-fill)" filter="url(#ball-glow)" />

            {Object.values(destinations).map((destination) => (
              <foreignObject className="destination-control" key={destination.id} x="612" y={destination.buttonY - 8} width="186" height="92">
                <button
                  ref={destination.id === "medical" ? medicalButtonRef : undefined}
                  className={`destination-button${highlightedId === destination.id ? " is-active" : ""}`}
                  type="button"
                  disabled={phase !== "orbiting"}
                  onClick={() => selectDestination(destination.id)}
                  onPointerEnter={() => setHoveredId(destination.id)}
                  onPointerLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(destination.id)}
                  onBlur={() => setHoveredId(null)}
                >
                  <span>{destination.label}</span>
                  <small>{selectedId === destination.id ? "Mapping your path…" : "Start trajectory"}</small>
                </button>
              </foreignObject>
            ))}
          </svg>
        </div>
      </section>

      {portalRect ? (
        <div
          className="orbit-profile-transition"
          style={{
            "--portal-top": `${portalRect.top}px`,
            "--portal-left": `${portalRect.left}px`,
            "--portal-width": `${portalRect.width}px`,
            "--portal-height": `${portalRect.height}px`,
          } as CSSProperties}
          aria-hidden="true"
        >
          <div className="orbit-profile-transition__stars" />
          <div className="orbit-profile-transition__preview">
            <div className="orbit-profile-transition__brand"><span className="orbit-brand__mark"><i /></span>TRAJECTORY</div>
            <p>STEP 01 · YOUR BACKGROUND</p>
            <h2>Show us where you are now.</h2>
            <span>Your personalized path starts with the experiences you already have.</span>
            <div className="orbit-profile-transition__cards"><i /><i /><i /></div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
