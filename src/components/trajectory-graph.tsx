"use client";

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
  useEdgesState,
  useNodesState,
} from "@xyflow/react";

type TrajectoryNodeData = {
  eyebrow: string;
  title: string;
  detail: string;
  tone: "current" | "course" | "opportunity" | "goal";
};

type TrajectoryNode = Node<TrajectoryNodeData, "trajectory">;

const initialNodes: TrajectoryNode[] = [
  {
    id: "current",
    type: "trajectory",
    position: { x: 40, y: 220 },
    data: {
      eyebrow: "Current position",
      title: "Columbia pre-med",
      detail: "Strong clinical exposure · research gap",
      tone: "current",
    },
  },
  {
    id: "course",
    type: "trajectory",
    position: { x: 365, y: 80 },
    data: {
      eyebrow: "Course",
      title: "BIOL UN2005",
      detail: "Builds core research eligibility",
      tone: "course",
    },
  },
  {
    id: "opportunity",
    type: "trajectory",
    position: { x: 365, y: 355 },
    data: {
      eyebrow: "Opportunity",
      title: "Columbia SURF",
      detail: "Research · mentorship · future pathways",
      tone: "opportunity",
    },
  },
  {
    id: "goal",
    type: "trajectory",
    position: { x: 745, y: 220 },
    data: {
      eyebrow: "Destination",
      title: "U.S. MD pathway",
      detail: "Evidence-backed preparation",
      tone: "goal",
    },
  },
];

const initialEdges: Edge[] = [
  {
    id: "current-course",
    source: "current",
    target: "course",
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#818cf8", strokeWidth: 2 },
  },
  {
    id: "current-opportunity",
    source: "current",
    target: "opportunity",
    type: "smoothstep",
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#f59e0b", strokeWidth: 2.5 },
  },
  {
    id: "course-goal",
    source: "course",
    target: "goal",
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#818cf8", strokeWidth: 2 },
  },
  {
    id: "opportunity-goal",
    source: "opportunity",
    target: "goal",
    type: "smoothstep",
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#34d399", strokeWidth: 2.5 },
  },
];

const toneColors: Record<TrajectoryNodeData["tone"], string> = {
  current: "#a78bfa",
  course: "#60a5fa",
  opportunity: "#fbbf24",
  goal: "#34d399",
};

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

export function TrajectoryGraph() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="trajectory-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.55}
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
          nodeColor={(node) =>
            toneColors[(node.data as TrajectoryNodeData).tone]
          }
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
  );
}
