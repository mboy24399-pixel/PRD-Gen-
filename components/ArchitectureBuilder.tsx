'use client';
import {useCallback} from 'react';
import {ReactFlow,Background,Controls,MiniMap,addEdge,useEdgesState,useNodesState,type Connection, type Node,type Edge} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {ArchEdge,ArchNode} from '../lib/store';
const palette=[['Frontend','Web Client'],['Backend','Application'],['DB','Database'],['Cache','Cache'],['Queue','Queue'],['Storage','Object Storage'],['CDN','CDN'],['External','External Service']];
export default function ArchitectureBuilder({nodes,onChangeNodes,edges,onChangeEdges}:{nodes:ArchNode[];onChangeNodes:(x:ArchNode[])=>void;edges:ArchEdge[];onChangeEdges:(x:ArchEdge[])=>void}){
 const [flowNodes,setFlowNodes,onNodesChange]=useNodesState(nodes as Node[]);const [flowEdges,setFlowEdges,onEdgesChange]=useEdgesState(edges as Edge[]);
 const syncNodes=(changes:any)=>{onNodesChange(changes);setTimeout(()=>onChangeNodes(flowNodes as ArchNode[]),0)};
 const connect=useCallback((c:Connection)=>{const next=addEdge({...c,animated:true},flowEdges);setFlowEdges(next);onChangeEdges(next as ArchEdge[]);},[flowEdges,onChangeEdges]);
 const add=(kind:string,label:string)=>{const n={id:`n-${Date.now()}`,type:'default',position:{x:80+flowNodes.length*35,y:60+flowNodes.length*35},data:{label,kind}} as Node;const next=[...flowNodes,n];setFlowNodes(next);onChangeNodes(next as ArchNode[])};
 return <div className="arch-wrap"><div className="arch-palette">{palette.map(([kind,label])=><button key={kind} onClick={()=>add(kind,label)}>{kind}</button>)}</div><div className="arch-canvas"><ReactFlow nodes={flowNodes} edges={flowEdges} onNodesChange={syncNodes} onEdgesChange={(c)=>{onEdgesChange(c);setTimeout(()=>onChangeEdges(flowEdges as ArchEdge[]),0)}} onConnect={connect} fitView><Background gap={20}/><Controls/><MiniMap/></ReactFlow></div></div>;
}
