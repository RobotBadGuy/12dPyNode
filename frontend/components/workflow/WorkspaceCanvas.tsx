'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  Node,
  Connection,
  Viewport,
  ReactFlowInstance,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LayoutGrid, FileSpreadsheet } from 'lucide-react';
import { WorkflowNode, WorkflowEdge } from '@/lib/workflow/types';
import { validateConnection } from '@/lib/workflow/edgeRules';
import { exportCanvasImage, type ExportImageFormat } from '@/lib/workflow/exportImage';
import { notify } from '@/lib/notify';
import { ExportMenu } from './ExportMenu';
import { ExcelModelsNode } from './nodes/ExcelModelsNode';
import { ManualModelsNode } from './nodes/ManualModelsNode';
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
import { RunFunctionNode } from './nodes/RunFunctionNode';
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
import { ApplyMtfNode } from './nodes/ApplyMtfNode';
import { CreateApplyMtfNode } from './nodes/CreateApplyMtfNode';
import { CreateTrimeshFromTinNode } from './nodes/CreateTrimeshFromTinNode';
import { CreateMtfFileNode } from './nodes/CreateMtfFileNode';
import { CreateTemplateFileNode } from './nodes/CreateTemplateFileNode';
import { AddCommentNode } from './nodes/AddCommentNode';
import { AddLabelNode } from './nodes/AddLabelNode';
import { IfFunctionExistsNode } from './nodes/IfFunctionExistsNode';

interface WorkspaceCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onNodeDoubleClick?: (event: React.MouseEvent, node: Node) => void;
  onNodeContextMenu?: (event: React.MouseEvent, node: Node) => void;
  onViewportChange?: (viewport: Viewport) => void;
  // Lets the parent capture the ReactFlowInstance so it can drive the
  // viewport programmatically (e.g. when restoring a saved template).
  onInit?: (instance: ReactFlowInstance) => void;
  onAutoLayout?: () => void;
  // PC-910 — base name for exported images; falls back to a default when blank.
  exportFileName?: string;
  // PC-904 — files dropped onto the canvas, with the drop point in flow coords.
  onFilesDropped?: (files: File[], flowPosition: { x: number; y: number }) => void;
}

export function WorkspaceCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onNodeDoubleClick,
  onNodeContextMenu,
  onViewportChange,
  onInit,
  onAutoLayout,
  exportFileName,
  onFilesDropped,
}: WorkspaceCanvasProps) {
  const reactFlow = useReactFlow();
  // PC-904 — full-canvas file drop. dragDepth counts enter/leave across nested
  // children so the overlay doesn't flicker when the cursor crosses a node.
  const [fileDragging, setFileDragging] = useState(false);
  const dragDepth = useRef(0);

  const dragHasFiles = (e: React.DragEvent): boolean =>
    Array.from(e.dataTransfer?.types ?? []).includes('Files');

  const handleFileDragEnter = useCallback((e: React.DragEvent) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setFileDragging(true);
  }, []);

  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    if (!dragHasFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setFileDragging(false);
  }, []);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setFileDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      const flowPosition = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      onFilesDropped?.(files, flowPosition);
    },
    [reactFlow, onFilesDropped],
  );

  // Safety net: the enter/leave counter can be left unbalanced when a drag ends
  // away from the wrapper (ESC-cancel, drop elsewhere, or the cursor leaving the
  // window), which would otherwise leave the overlay stuck. Force-clear it on
  // any window-level drag end, and when the drag leaves the window entirely
  // (dragleave with no relatedTarget).
  useEffect(() => {
    const reset = () => {
      dragDepth.current = 0;
      setFileDragging(false);
    };
    const onWindowDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) reset();
    };
    window.addEventListener('drop', reset);
    window.addEventListener('dragend', reset);
    window.addEventListener('dragleave', onWindowDragLeave);
    return () => {
      window.removeEventListener('drop', reset);
      window.removeEventListener('dragend', reset);
      window.removeEventListener('dragleave', onWindowDragLeave);
    };
  }, []);
  const nodeTypes = {
    excelModels: ExcelModelsNode,
    manualModels: ManualModelsNode,
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
    runFunction: RunFunctionNode,
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
    applyMtf: ApplyMtfNode,
    createApplyMtf: CreateApplyMtfNode,
    createMtfFile: CreateMtfFileNode,
    createTemplateFile: CreateTemplateFileNode,
    createTrimeshFromTin: CreateTrimeshFromTinNode,
    addComment: AddCommentNode,
    addLabel: AddLabelNode,
    ifFunctionExists: IfFunctionExistsNode,
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

  // PC-910 — capture the canvas and download it. Read-only (no graph mutation),
  // so it lives here next to the React Flow DOM rather than in the page handler.
  const handleExportImage = useCallback(
    async (format: ExportImageFormat) => {
      try {
        await exportCanvasImage(nodes, { format, fileName: exportFileName });
        notify.success(`Canvas exported as ${format.toUpperCase()}`);
      } catch (err) {
        notify.error('Could not export the canvas', {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [nodes, exportFileName],
  );

  return (
    <div
      className="w-full h-full relative"
      onDragEnter={handleFileDragEnter}
      onDragOver={handleFileDragOver}
      onDragLeave={handleFileDragLeave}
      onDrop={handleFileDrop}
    >
      <ReactFlow
        nodes={nodes as Node[]}
        edges={coloredEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={validateConnection}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={(event, node) => {
          event.preventDefault(); // suppress the native browser context menu
          onNodeContextMenu?.(event, node);
        }}
        onMoveEnd={(_, viewport) => {
          if (onViewportChange) {
            onViewportChange(viewport);
          }
        }}
        onInit={(instance) => {
          if (onViewportChange) {
            onViewportChange(instance.getViewport());
          }
          if (onInit) {
            // The colored-edge style narrows the inferred edge type; cast back
            // to the public ReactFlowInstance shape parents expect.
            onInit(instance as unknown as ReactFlowInstance);
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
              case 'manualModels':
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
        {nodes.length > 0 && (
          <Panel position="top-right">
            <div className="flex items-center gap-2">
              {onAutoLayout && (
                <button
                  type="button"
                  onClick={onAutoLayout}
                  className="flex items-center gap-2 bg-gray-900/80 border border-gray-700 hover:bg-gray-800 text-gray-200 text-sm font-medium px-3 py-2 rounded-md shadow"
                  title="Auto-layout (re-flow the graph)"
                  aria-label="Auto-layout"
                >
                  <LayoutGrid className="w-4 h-4" />
                  Auto-layout
                </button>
              )}
              <ExportMenu onExport={handleExportImage} />
            </div>
          </Panel>
        )}
      </ReactFlow>
      {/* PC-904 — drop overlay. pointer-events-none so the drag/drop events
          still reach the wrapper's handlers underneath. */}
      {fileDragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-emerald-950/40 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-emerald-400 bg-gray-900/80 px-8 py-6 text-emerald-200 shadow-2xl">
            <FileSpreadsheet className="w-8 h-8" />
            <p className="text-sm font-medium">Drop an Excel (.xlsx) file to add a model source</p>
          </div>
        </div>
      )}
    </div>
  );
}

