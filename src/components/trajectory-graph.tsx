"use client";

import { useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";

export type GraphNodeRecord = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
};

export type GraphEdgeRecord = {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: string;
  confidence: string | null;
};

type Stage = "exploring" | "building" | "applying";

type TrajectoryNodeData = {
  eyebrow: string;
  title: string;
  detail: string;
  tone: "current" | "course" | "opportunity" | "goal";
};

type TrajectoryNode = Node<TrajectoryNodeData, "trajectory">;

const stages: Array<{ id: Stage; title: string; detail: string; depth: number }> = [
  {
    id: "exploring",
    title: "Exploring my path",
    detail: "I’m building my academic foundation.",
    depth: 3,
  },
  {
    id: "building",
    title: "Building my profile",
    detail: "Coursework and experiences are underway.",
    depth: 2,
  },
  {
    id: "applying",
    title: "Preparing to apply",
    detail: "I’m focused on closing final gaps.",
    depth: 1,
  },
];

const toneColors: Record<TrajectoryNodeData["tone"], string> = {
  current: "#a78bfa",
  course: "#60a5fa",
  opportunity: "#fbbf24",
  goal: "#34d399",
};

const typeLabels: Record<string, string> = {
  club: "Student organization",
  course: "Course",
  extracurricular: "Experience",
  goal: "Destination",
  internship: "Program",
  professor: "Mentor",
  research_lab: "Research",
  scholarship: "Funding",
};

const priorityByStage: Record<Stage, string[]> = {
  exploring: ["course", "professor", "club", "extracurricular", "research_lab", "internship", "scholarship"],
  building: ["research_lab", "internship", "extracurricular", "course", "professor", "club", "scholarship"],
  applying: ["extracurricular", "research_lab", "internship", "professor", "course", "club", "scholarship"],
};

function toneForType(type: string): TrajectoryNodeData["tone"] {
  if (type === "goal") return "goal";
  if (type === "course") return "course";
  return "opportunity";
}

function detailForNode(node: GraphNodeRecord) {
  const metadata = node.metadata ?? {};
  const detail =
    node.description ??
    metadata.focus ??
    metadata.deadline ??
    metadata.dept ??
    metadata.note ??
    "Part of your evidence-backed pathway";

  return String(detail).length > 78
    ? `${String(detail).slice(0, 75)}…`
    : String(detail);
}

function TrajectoryNodeCard({ data, selected }: NodeProps<TrajectoryNode>) {
  const color = toneColors[data.tone];

  return (
    <div
      className="trajectory-node"
      data-selected={selected}
      style={{ "--node-accent": color } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Left} />
      <span className="trajectory-node__eyebrow">{data.eyebrow}</span>
      <strong>{data.title}</strong>
      <span className="trajectory-node__detail">{data.detail}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { trajectory: TrajectoryNodeCard };

function buildPathway(
  records: GraphNodeRecord[],
  edgeRecords: GraphEdgeRecord[],
  goalId: string,
  stage: Stage
) {
  const stageConfig = stages.find((item) => item.id === stage)!;
  const nodeById = new Map(records.map((node) => [node.id, node]));
  const selected = new Set([goalId]);
  const distance = new Map([[goalId, 0]]);
  let frontier = [goalId];

  for (let level = 1; level <= stageConfig.depth; level += 1) {
    const candidates = new Set<string>();
    for (const targetId of frontier) {
      for (const edge of edgeRecords) {
        if (edge.target_id === targetId && nodeById.has(edge.source_id)) {
          candidates.add(edge.source_id);
        }
      }
    }

    const priority = priorityByStage[stage];
    frontier = [...candidates]
      .filter((id) => !selected.has(id))
      .sort((a, b) => {
        const left = nodeById.get(a)!;
        const right = nodeById.get(b)!;
        const typeOrder = priority.indexOf(left.type) - priority.indexOf(right.type);
        return typeOrder || left.name.localeCompare(right.name);
      })
      .slice(0, 9);

    frontier.forEach((id) => {
      selected.add(id);
      distance.set(id, level);
    });
  }

  const visibleRecords = [...selected]
    .map((id) => nodeById.get(id))
    .filter((node): node is GraphNodeRecord => Boolean(node));

  const grouped = new Map<number, GraphNodeRecord[]>();
  for (const node of visibleRecords) {
    const level = distance.get(node.id) ?? 0;
    grouped.set(level, [...(grouped.get(level) ?? []), node]);
  }

  const nodes: TrajectoryNode[] = visibleRecords.map((node) => {
    const level = distance.get(node.id) ?? 0;
    const siblings = grouped.get(level) ?? [];
    const index = siblings.findIndex((item) => item.id === node.id);
    return {
      id: node.id,
      type: "trajectory",
      position: {
        x: (stageConfig.depth - level + 1) * 340,
        y: (index - (siblings.length - 1) / 2) * 138 + 420,
      },
      data: {
        eyebrow: typeLabels[node.type] ?? node.type,
        title: node.name,
        detail: detailForNode(node),
        tone: toneForType(node.type),
      },
    };
  });

  nodes.push({
    id: "current-position",
    type: "trajectory",
    position: { x: 0, y: 420 },
    data: {
      eyebrow: "Current position",
      title: stageConfig.title,
      detail: stageConfig.detail,
      tone: "current",
    },
  });

  const edges: Edge[] = edgeRecords
    .filter((edge) => selected.has(edge.source_id) && selected.has(edge.target_id))
    .map((edge) => ({
      id: edge.id,
      source: edge.source_id,
      target: edge.target_id,
      type: "smoothstep",
      animated: edge.relationship_type === "supports",
      markerEnd: { type: MarkerType.ArrowClosed },
      label: edge.relationship_type.replaceAll("_", " "),
      style: {
        stroke: edge.relationship_type === "supports" ? "#34d399" : "#64748b",
        strokeWidth: edge.relationship_type === "supports" ? 2.2 : 1.5,
      },
    }));

  const entryNodes = visibleRecords.filter(
    (node) => distance.get(node.id) === stageConfig.depth
  );
  for (const node of entryNodes) {
    edges.push({
      id: `current-${node.id}`,
      source: "current-position",
      target: node.id,
      type: "smoothstep",
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#a78bfa", strokeWidth: 2 },
    });
  }

  return { nodes, edges };
}

export function TrajectoryGraph({
  graphNodes,
  graphEdges,
}: {
  graphNodes: GraphNodeRecord[];
  graphEdges: GraphEdgeRecord[];
}) {
  const goals = graphNodes.filter((node) => node.type === "goal");
  const [goalId, setGoalId] = useState(goals[0]?.id ?? "");
  const [stage, setStage] = useState<Stage>("building");
  const [started, setStarted] = useState(false);
  const pathway = useMemo(
    () => buildPathway(graphNodes, graphEdges, goalId, stage),
    [graphNodes, graphEdges, goalId, stage]
  );

  if (!started) {
    return (
      <section className="onboarding-shell" aria-labelledby="onboarding-title">
        <div className="onboarding-copy">
          <p className="trajectory-kicker">TRAJECTORY</p>
          <h1 id="onboarding-title">Where do you want to go?</h1>
          <p>
            Tell us your destination and where you are now. We&apos;ll map the
            real courses and opportunities between them.
          </p>
        </div>

        <div className="onboarding-panel">
          <fieldset>
            <legend>01 · Choose your destination</legend>
            <label className="destination-card">
              <input
                type="radio"
                name="destination"
                value={goalId}
                checked
                onChange={() => setGoalId(goals[0]?.id ?? "")}
              />
              <span>
                <small>HEALTHCARE</small>
                <strong>{goals[0]?.name ?? "Medical School"}</strong>
                <em>U.S. MD or DO pathway</em>
              </span>
              <i>✓</i>
            </label>
          </fieldset>

          <fieldset>
            <legend>02 · Where are you now?</legend>
            <div className="stage-grid">
              {stages.map((item) => (
                <label key={item.id} className="stage-card" data-active={stage === item.id}>
                  <input
                    type="radio"
                    name="stage"
                    value={item.id}
                    checked={stage === item.id}
                    onChange={() => setStage(item.id)}
                  />
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button type="button" onClick={() => setStarted(true)} disabled={!goalId}>
            Map my trajectory <span>→</span>
          </button>
        </div>
      </section>
    );
  }

  const goal = goals.find((item) => item.id === goalId);

  return (
    <>
      <header className="trajectory-header">
        <div>
          <p className="trajectory-kicker">TRAJECTORY</p>
          <h1>Your future, mapped.</h1>
          <p className="trajectory-subtitle">
            A focused path from where you are now to {goal?.name ?? "your goal"}.
          </p>
        </div>
        <button className="trajectory-edit" type="button" onClick={() => setStarted(false)}>
          Edit path
        </button>
      </header>

      <section className="trajectory-graph-frame" aria-label="Trajectory graph">
        <div className="trajectory-graph-frame__topline">
          <span>{goal?.name.toUpperCase()} PATHWAY</span>
          <span>{pathway.nodes.length - 1} LIVE NODES · {pathway.edges.length} CONNECTIONS</span>
        </div>
        <div className="trajectory-canvas">
          <ReactFlow
            key={`${goalId}-${stage}`}
            nodes={pathway.nodes}
            edges={pathway.edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.16 }}
            minZoom={0.3}
            maxZoom={1.65}
            nodesConnectable={false}
            deleteKeyCode={null}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1.15}
              color="rgba(148, 163, 184, 0.2)"
            />
            <MiniMap
              pannable
              zoomable
              nodeColor={(node) => toneColors[(node.data as TrajectoryNodeData).tone]}
            />
            <Controls showInteractive={false} />
          </ReactFlow>
          <div className="trajectory-canvas__legend">
            <span><i className="legend-current" />Current</span>
            <span><i className="legend-course" />Course</span>
            <span><i className="legend-opportunity" />Opportunity</span>
            <span><i className="legend-goal" />Goal</span>
          </div>
        </div>
      </section>
    </>
  );
}
