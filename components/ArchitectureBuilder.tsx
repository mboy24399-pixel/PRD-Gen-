'use client';

import { useCallback, useEffect } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, addEdge, applyEdgeChanges,
  applyNodeChanges, useEdgesState, useNodesState,
  type Connection, type Node, type Edge, type EdgeChange, type NodeChange
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ArchEdge, ArchNode } from '../lib/store';

const palette = [
  ['Frontend', 'Web Client'], ['Backend', 'Application'], ['DB', 'Database'],
  ['Cache', 'Cache'], ['Queue', 'Queue'], ['Storage', 'Object Storage'],
  ['CDN', 'CDN'], ['External', 'External Service']
] as const;

type Props = {
  nodes: ArchNode[];
  onChangeNodes: (nodes: ArchNode[]) => void;
  edges: ArchEdge[];
  onChangeEdges: (edges: ArchEdge[]) => void;
};

export default function ArchitectureBuilder({ nodes, onChangeNodes, edges, onChangeEdges }: Props) {
  const [flowNodes, setFlowNodes] = useNodesState(nodes as Node[]);
  const [flowEdges, setFlowEdges] = useEdgesState(edges as Edge[]);

  useEffect(() => {
    setFlowNodes(nodes as Node[]);
  }, [nodes, setFlowNodes]);

  useEffect(() => {
    setFlowEdges(edges as Edge[]);
  }, [edges, setFlowEdges]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const next = applyNodeChanges(changes, flowNodes);
    setFlowNodes(next);
    onChangeNodes(next as ArchNode[]);
  }, [flowNodes, onChangeNodes, setFlowNodes]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const next = applyEdgeChanges(changes, flowEdges);
    setFlowEdges(next);
    onChangeEdges(next as ArchEdge[]);
  }, [flowEdges, onChangeEdges, setFlowEdges]);

  const connect = useCallback((connection: Connection) => {
    const next = addEdge({ ...connection, animated: true }, flowEdges);
    setFlowEdges(next);
    onChangeEdges(next as ArchEdge[]);
  }, [flowEdges, onChangeEdges, setFlowEdges]);

  const add = (kind: string, label: string) => {
    const node: Node = {
      id: `n-${Date.now()}-${flowNodes.length}`,
      type: 'default',
      position: { x: 80 + (flowNodes.length % 5) * 180, y: 60 + Math.floor(flowNodes.length / 5) * 100 },
      data: { label, kind }
    };
    const next = [...flowNodes, node];
    setFlowNodes(next);
    onChangeNodes(next as ArchNode[]);
  };

  return (
    <div className="arch-wrap">
      <div className="arch-palette">
        {palette.map(([kind, label]) => <button type="button" key={kind} onClick={() => add(kind, label)}>{kind}</button>)}
      </div>
      <div className="arch-canvas">
        <ReactFlow nodes={flowNodes} edges={flowEdges} onNodesChange={handleNodesChange} onEdgesChange={handleEdgesChange} onConnect={connect} fitView>
          <Background gap={20} />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
