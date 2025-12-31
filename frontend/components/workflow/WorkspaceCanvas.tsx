'use client';

import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Connection,
  Viewport,
  ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkflowNode, WorkflowEdge } from '@/lib/workflow/types';
import { ExcelModelsNode } from './nodes/ExcelModelsNode';
import { ForeachModelNode } from './nodes/ForeachModelNode';
import { ChainFileOutputNode } from './nodes/ChainFileOutputNode';
import { ImportNode } from './nodes/ImportNode';
import { CleanModelNode } from './nodes/CleanModelNode';
import { CreateViewNode } from './nodes/CreateViewNode';
import { SetVariableNode } from './nodes/SetVariableNode';
import { AddModelToViewNode } from './nodes/AddModelToViewNode';
import { RemoveModelFromViewNode } from './nodes/RemoveModelFromViewNode';
import { DeleteModelsFromViewNode } from './nodes/DeleteModelsFromViewNode';
import { CreateSharedModelNode } from './nodes/CreateSharedModelNode';
import { TriangulateManualOptionNode } from './nodes/TriangulateManualOptionNode';
import { TinFunctionNode } from './nodes/TinFunctionNode';
import { RenameModelNode } from './nodes/RenameModelNode';
import { GetTotalSurfaceAreaNode } from './nodes/GetTotalSurfaceAreaNode';
import { TrimeshVolumeReportNode } from './nodes/TrimeshVolumeReportNode';
import { VolumeTinToTinNode } from './nodes/VolumeTinToTinNode';
import { ConvertLinesToVariableNode } from './nodes/ConvertLinesToVariableNode';
import { CreateContourSmoothLabelNode } from './nodes/CreateContourSmoothLabelNode';
import { DrapeToTinNode } from './nodes/DrapeToTinNode';
import { RunOrCreateContoursNode } from './nodes/RunOrCreateContoursNode';
import { RunOrCreateMtfNode } from './nodes/RunOrCreateMtfNode';
import { CreateMtfNode } from './nodes/CreateMtfNode';
import { CreateTrimeshFromTinNode } from './nodes/CreateTrimeshFromTinNode';
import { AddCommentNode } from './nodes/AddCommentNode';
import { AddLabelNode } from './nodes/AddLabelNode';

interface WorkspaceCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onViewportChange?: (viewport: Viewport) => void;
}

export function WorkspaceCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onViewportChange,
}: WorkspaceCanvasProps) {
  const nodeTypes = {
    excelModels: ExcelModelsNode,
    foreachModel: ForeachModelNode,
    chainFileOutput: ChainFileOutputNode,
    import: ImportNode,
    cleanModel: CleanModelNode,
    createView: CreateViewNode,
    setVariable: SetVariableNode,
    addModelToView: AddModelToViewNode,
    removeModelFromView: RemoveModelFromViewNode,
    deleteModelsFromView: DeleteModelsFromViewNode,
    createSharedModel: CreateSharedModelNode,
    triangulateManualOption: TriangulateManualOptionNode,
    tinFunction: TinFunctionNode,
    renameModel: RenameModelNode,
    getTotalSurfaceArea: GetTotalSurfaceAreaNode,
    trimeshVolumeReport: TrimeshVolumeReportNode,
    volumeTinToTin: VolumeTinToTinNode,
    convertLinesToVariable: ConvertLinesToVariableNode,
    createContourSmoothLabel: CreateContourSmoothLabelNode,
    drapeToTin: DrapeToTinNode,
    runOrCreateContours: RunOrCreateContoursNode,
    runOrCreateMtf: RunOrCreateMtfNode,
    createMtf: CreateMtfNode,
    createTrimeshFromTin: CreateTrimeshFromTinNode,
    addComment: AddCommentNode,
    addLabel: AddLabelNode,
  };

  // Generate a consistent random color for each edge based on its ID
  const getEdgeColor = (edgeId: string): string => {
    // Use a hash of the edge ID to generate a consistent color
    let hash = 0;
    for (let i = 0; i < edgeId.length; i++) {
      hash = edgeId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate a bright, vibrant color
    const hue = Math.abs(hash) % 360;
    const saturation = 65 + (Math.abs(hash) % 20); // 65-85% saturation
    const lightness = 50 + (Math.abs(hash) % 15); // 50-65% lightness
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  // Apply colors to edges
  const coloredEdges = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      style: {
        stroke: getEdgeColor(edge.id),
        strokeWidth: 2,
      },
    }));
  }, [edges]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes as Node[]}
        edges={coloredEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onMoveEnd={(_, viewport) => {
          if (onViewportChange) {
            onViewportChange(viewport);
          }
        }}
        onInit={(instance) => {
          if (onViewportChange) {
            onViewportChange(instance.getViewport());
          }
        }}
        deleteKeyCode={['Backspace', 'Delete']}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-800"
      >
        <Background
          gap={20}
          size={1}
          lineWidth={0.5}
          color="rgba(255, 255, 255, 0.1)"
          className="workspace-grid"
        />
        <Controls className="bg-gray-900/80 border-gray-700" />
        <MiniMap
          className="bg-gray-900/80 border-gray-700"
          nodeColor={(node) => {
            switch (node.type) {
              case 'excelModels':
                return '#10b981';
              case 'foreachModel':
                return '#3b82f6';
              case 'chainFileOutput':
                return '#8b5cf6';
              default:
                return '#6b7280';
            }
          }}
        />
      </ReactFlow>
    </div>
  );
}

