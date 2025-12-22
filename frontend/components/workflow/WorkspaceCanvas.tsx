'use client';

import React from 'react';
import { ReactFlow, Background, Controls, MiniMap, Node, Connection } from '@xyflow/react';
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

interface WorkspaceCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
}

export function WorkspaceCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
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
  };

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        deleteKeyCode={['Backspace', 'Delete']}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-800"
      >
        <Background
          patternId="grid"
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

