'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Node,
  Edge,
  Connection,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  ReactFlowProvider,
} from '@xyflow/react';
import { TopBar } from '@/components/workflow/TopBar';
import { LeftSidebar } from '@/components/workflow/LeftSidebar';
import { RightSidebar } from '@/components/workflow/RightSidebar';
import { WorkspaceCanvas } from '@/components/workflow/WorkspaceCanvas';
import { SuccessCelebration, FailedModel } from '@/components/workflow/SuccessCelebration';
import { ErrorModal } from '@/components/workflow/ErrorModal';
import { TemplateNotification } from '@/components/workflow/TemplateNotification';
import { SaveTemplateModal } from '@/components/workflow/SaveTemplateModal';
import { LoadTemplateModal } from '@/components/workflow/LoadTemplateModal';
import { DataMappingModal } from '@/components/workflow/DataMappingModal';
import { ShortcutsModal } from '@/components/workflow/ShortcutsModal';
import { LandingPage } from '@/components/LandingPage';
import { ProfilePage } from '@/components/ProfilePage';
import { WorkflowNode, WorkflowEdge, WorkflowTemplate, WorkflowTemplateVersionSnapshot, ExcelModelsNodeData } from '@/lib/workflow/types';
import { compileWorkflow, validateWorkflow, validateNode } from '@/lib/workflow/compile';
import { ActionableError, nodeLabel } from '@/lib/workflow/errors';
import { focusNode } from '@/lib/workflow/focusNode';
import { runWorkflow, getWorkflowStatus, getWorkflowDownloadUrl } from '@/lib/workflow/run';
import type { FileDetail } from '@/lib/workflow/run';
import { RunProgressPanel } from '@/components/workflow/RunProgressPanel';
import { aggregateNodeStates } from '@/lib/workflow/runStatus';
import { exportTemplate, importTemplate, migrateLocalStorageToServer } from '@/lib/workflow/templates';
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate as deleteTemplateApi,
} from '@/lib/workflow/templatesApi';
import type { ReactFlowInstance, Viewport } from '@xyflow/react';
import type { SaveTemplateOptions } from '@/components/workflow/SaveTemplateModal';
import { filterValidEdges } from '@/lib/workflow/nodeSchemas';
import { autoLayout } from '@/lib/workflow/autoLayout';
import { isSourceNode, isReadySource, hasReadyModelSource } from '@/lib/workflow/modelSources';
import { WorkflowRunProvider } from '@/lib/workflow/WorkflowRunContext';
import { notify } from '@/lib/notify';
import { NodeContextMenu } from '@/components/workflow/NodeContextMenu';
import { duplicateNode, removeNode, setNodeDisabled } from '@/lib/workflow/nodeOps';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

function sameWarnings(a: string[] | undefined, b: string[] | undefined): boolean {
  const aLen = a?.length ?? 0;
  const bLen = b?.length ?? 0;
  if (aLen !== bLen) return false;
  if (aLen === 0) return true;
  for (let i = 0; i < aLen; i++) {
    if (a![i] !== b![i]) return false;
  }
  return true;
}

// Stable across renders so it never needs to be a hook dependency. Mirrors the
// inline scheme handlePaste already uses.
function newNodeId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `node_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export default function WorkspacePage() {
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedSourceNodeIds, setSelectedSourceNodeIds] = useState<Set<string>>(new Set());
  const [modelFiles, setModelFiles] = useState<File[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successFileCount, setSuccessFileCount] = useState<number | undefined>(undefined);
  const [successTotalModels, setSuccessTotalModels] = useState<number | undefined>(undefined);
  const [successFailedModels, setSuccessFailedModels] = useState<FailedModel[]>([]);
  // PC-907: live per-model progress while a run is in flight. Reset to null
  // when the run finishes (success or error). The RunProgressPanel only
  // renders when this is non-null.
  const [runProgress, setRunProgress] = useState<{
    fileDetails: FileDetail[];
    currentExcel: number;       // 1-based
    totalExcels: number;
    excelLabel: string;
  } | null>(null);
  // PC-303: latest finished-run file_details + session id, kept around so the
  // right-sidebar Run Details panel and per-node coloring remain readable
  // after the run completes. Cleared when a new run starts.
  const [lastRunDetails, setLastRunDetails] = useState<{
    fileDetails: FileDetail[];
    sessionId: string;
  } | null>(null);
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isExcelError?: boolean;
    focusNodeId?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });
  const [templateNotification, setTemplateNotification] = useState<{
    isOpen: boolean;
    templateName?: string;
    nodeCount?: number;
    edgeCount?: number;
  }>({
    isOpen: false,
  });
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [showLoadTemplateModal, setShowLoadTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  // PC-203: which template (if any) was last loaded onto the canvas. Drives
  // the SaveTemplateModal's "Save Changes" path so each save accumulates a
  // new version on that template instead of forking a new one.
  const [loadedTemplate, setLoadedTemplate] = useState<{ id: string; name: string } | null>(null);
  // Captured via WorkspaceCanvas onInit so we can drive the canvas viewport
  // when restoring a template or version.
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const [mappingModal, setMappingModal] = useState<{ isOpen: boolean; nodeId: string | null }>({
    isOpen: false,
    nodeId: null,
  });
  const [currentPage, setCurrentPage] = useState<'landing' | 'editor' | 'profile'>('landing');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clipboard for copy/paste
  const clipboardRef = useRef<{
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
  } | null>(null);

  // Undo/redo history
  const [history, setHistory] = useState<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }[]>([]);
  const [viewport, setViewport] = useState<{ x: number; y: number; zoom: number }>({
    x: 0,
    y: 0,
    zoom: 1,
  });

  // PC-903: right-click context menu target + screen position.
  const [contextMenu, setContextMenu] =
    useState<{ nodeId: string; x: number; y: number } | null>(null);

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      const remaining = prev.slice(0, -1);
      setFuture((f) => [{ nodes, edges }, ...f]);
      setNodes(previous.nodes);
      setEdges(previous.edges);
      return remaining;
    });
  }, [nodes, edges]);

  const handleRedo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const [next, ...rest] = prev;
      setHistory((h) => [...h, { nodes, edges }]);
      setNodes(next.nodes);
      setEdges(next.edges);
      return rest;
    });
  }, [nodes, edges]);

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) {
      notify.info('Nothing to lay out');
      return;
    }
    setHistory((prev) => [...prev, { nodes, edges }]);
    setFuture([]);
    setNodes(autoLayout(nodes, edges));
    reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 300 });
    notify.success('Workflow auto-laid out');
  }, [nodes, edges]);

  // PC-903 — open the context menu on the right-clicked node.
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);                // reflect target in the right sidebar
    setSelectedSourceNodeIds(new Set());   // single-node intent: drop multi-select
    setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
  }, []);

  const handleDuplicateNode = useCallback((nodeId: string) => {
    const original = nodes.find((n) => n.id === nodeId);
    if (!original) return;
    setHistory((prev) => [...prev, { nodes, edges }]);
    setFuture([]);
    const copy = duplicateNode(original, newNodeId);
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), copy]);
    notify.success('Node duplicated');
  }, [nodes, edges]);

  const handleCopyNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const { x, y } = node.position;
    clipboardRef.current = {
      nodes: [structuredClone(node)],
      edges: [],
      bounds: { minX: x, minY: y, maxX: x, maxY: y },
    };
    notify.info('Copied');
  }, [nodes]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setHistory((prev) => [...prev, { nodes, edges }]);
    setFuture([]);
    const next = removeNode(nodes, edges, nodeId);
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelectedNode((cur) => (cur && cur.id === nodeId ? null : cur));
    notify.success('Node deleted');
  }, [nodes, edges]);

  const handleToggleDisableNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const next = !node.data?.disabled;
    setHistory((prev) => [...prev, { nodes, edges }]);
    setFuture([]);
    setNodes((nds) => setNodeDisabled(nds, nodeId, next));
    setSelectedNode((cur) =>
      cur && cur.id === nodeId ? { ...cur, data: { ...cur.data, disabled: next } } : cur,
    );
    notify.info(next ? 'Node disabled' : 'Node enabled');
  }, [nodes, edges]);

  // Copy handler: capture selected nodes and internal edges
  const handleCopy = useCallback(() => {
    // Get selected nodes (React Flow's selected property or fallback to selectedNode)
    const selectedNodes = nodes.filter((n) => n.selected);
    const nodesToCopy = selectedNodes.length > 0
      ? selectedNodes
      : (selectedNode ? [selectedNode as WorkflowNode] : []);

    if (nodesToCopy.length === 0) return;

    const selectedIds = new Set(nodesToCopy.map((n) => n.id));

    // Find internal edges (edges where both source and target are in the selection)
    const internalEdges = edges.filter(
      (e) => selectedIds.has(e.source) && selectedIds.has(e.target)
    );

    // Calculate bounds for positioning
    const positions = nodesToCopy.map((n) => n.position);
    const minX = Math.min(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const maxX = Math.max(...positions.map((p) => p.x));
    const maxY = Math.max(...positions.map((p) => p.y));

    // Deep clone nodes and edges (using structuredClone if available, otherwise JSON parse/stringify)
    try {
      const clonedNodes = structuredClone(nodesToCopy);
      const clonedEdges = structuredClone(internalEdges);
      clipboardRef.current = {
        nodes: clonedNodes,
        edges: clonedEdges,
        bounds: { minX, minY, maxX, maxY },
      };
    } catch (err) {
      // Fallback for environments without structuredClone
      const clonedNodes = JSON.parse(JSON.stringify(nodesToCopy)) as WorkflowNode[];
      const clonedEdges = JSON.parse(JSON.stringify(internalEdges)) as WorkflowEdge[];
      clipboardRef.current = {
        nodes: clonedNodes,
        edges: clonedEdges,
        bounds: { minX, minY, maxX, maxY },
      };
    }
  }, [nodes, edges, selectedNode]);

  // Paste handler: create new nodes and edges with new IDs
  const handlePaste = useCallback(() => {
    const clipboard = clipboardRef.current;
    if (!clipboard || clipboard.nodes.length === 0) return;

    // Calculate paste position (viewport center with offset)
    const { innerWidth, innerHeight } = window;
    const centerX = innerWidth / 2;
    const centerY = innerHeight / 2;
    const zoom = viewport.zoom || 1;

    const viewportCenter = {
      x: (centerX - viewport.x) / zoom,
      y: (centerY - viewport.y) / zoom,
    };

    // Calculate center of copied bounds
    const copiedCenter = {
      x: (clipboard.bounds.minX + clipboard.bounds.maxX) / 2,
      y: (clipboard.bounds.minY + clipboard.bounds.maxY) / 2,
    };

    // Offset to position pasted nodes at viewport center + small offset
    const offset = {
      x: viewportCenter.x - copiedCenter.x + 20,
      y: viewportCenter.y - copiedCenter.y + 20,
    };

    // Generate ID mapping
    const idMap = new Map<string, string>();
    const timestamp = Date.now();
    clipboard.nodes.forEach((node, index) => {
      // Use crypto.randomUUID if available, otherwise fallback to timestamp-based ID
      let newId: string;
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        newId = crypto.randomUUID();
      } else {
        newId = `${node.type}_${timestamp}_${index}_${Math.random().toString(36).substr(2, 9)}`;
      }
      idMap.set(node.id, newId);
    });

    // Create new nodes with new IDs and updated positions
    const newNodes: WorkflowNode[] = clipboard.nodes.map((node) => ({
      ...node,
      id: idMap.get(node.id)!,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
      selected: true,
    }));

    // Create new edges with remapped source/target IDs (edges between pasted nodes)
    const newEdges: WorkflowEdge[] = clipboard.edges.map((edge, index) => ({
      ...edge,
      id: `edge_${timestamp}_${index}_${Math.random().toString(36).substr(2, 9)}`,
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
    }));

    // Deselect all existing nodes and add new nodes in a single update
    setNodes((nds) => {
      const deselectedNodes = nds.map((n) => ({ ...n, selected: false }));
      const nextNodes = [...deselectedNodes, ...newNodes];
      setHistory((prev) => [...prev, { nodes: nds as WorkflowNode[], edges }]);
      setFuture([]);
      return nextNodes;
    });

    // Update existing edges that reference pasted nodes AND add new edges
    setEdges((eds) => {
      const deselectedEdges = eds.map((e) => ({ ...e, selected: false }));

      // Update existing edges that reference any pasted node (either source or target)
      const updatedExistingEdges = deselectedEdges.map((edge) => {
        const oldSourceId = edge.source;
        const oldTargetId = edge.target;

        // Check if this edge references a pasted node
        const newSourceId = idMap.get(oldSourceId);
        const newTargetId = idMap.get(oldTargetId);

        // If either source or target was pasted, update the edge
        if (newSourceId || newTargetId) {
          return {
            ...edge,
            source: newSourceId || oldSourceId,
            target: newTargetId || oldTargetId,
          };
        }

        // Edge doesn't reference any pasted node, keep as-is
        return edge;
      });

      return [...updatedExistingEdges, ...newEdges];
    });
  }, [viewport, nodes, edges]);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Y / Ctrl+C / Ctrl+V
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputLike =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.getAttribute('contenteditable') === 'true');

      if (isInputLike) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopy();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste();
      } else if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShowShortcuts(true);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, handleCopy, handlePaste]);

  const onConnect = useCallback(
    (params: Connection) => {
      // Check if this is a parameter wiring edge
      if (params.targetHandle?.startsWith('param:')) {
        // Extract parameter key from target handle
        const paramKey = params.targetHandle.substring(6); // Remove 'param:' prefix

        // Extract token from source handle (value:token or just token)
        let token: string | null = null;

        // Special case: per-model outputs from ExcelModels node
        if (params.source && params.sourceHandle?.startsWith('value:model:')) {
          const indexStr = params.sourceHandle.split(':')[2];
          const index = Number(indexStr);
          const sourceNode = nodes.find((n) => n.id === params.source);
          if (
            sourceNode &&
            sourceNode.type === 'excelModels' &&
            Array.isArray((sourceNode.data as any).modelNames) &&
            index >= 0 &&
            index < (sourceNode.data as any).modelNames.length
          ) {
            token = String((sourceNode.data as any).modelNames[index]);
          }
        }

        // Special case: SetVariable node outputs (value:var:{index})
        if (!token && params.source && params.sourceHandle?.startsWith('value:var:')) {
          const indexStr = params.sourceHandle.split(':')[2];
          const index = Number(indexStr);
          const sourceNode = nodes.find((n) => n.id === params.source);
          if (
            sourceNode &&
            sourceNode.type === 'setVariable' &&
            Array.isArray((sourceNode.data as any).variables) &&
            index >= 0 &&
            index < (sourceNode.data as any).variables.length
          ) {
            const varBinding = (sourceNode.data as any).variables[index];
            if (varBinding && typeof varBinding.name === 'string') {
              token = varBinding.name;
            }
          }
        }

        // Default: use token from handle id
        if (!token) {
          if (params.sourceHandle?.startsWith('value:')) {
            token = params.sourceHandle.substring(6); // Remove 'value:' prefix
          } else if (params.sourceHandle) {
            token = params.sourceHandle;
          }
        }

        if (token && params.target) {
          // Update the target node's data field with the token/variable name
          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === params.target) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    [paramKey]: token,
                  },
                };
              }
              return node;
            })
          );
        }
      }

      // Record history and then add the new edge
      setEdges((eds) => {
        const nextEdges = addEdge(params, eds);
        setHistory((prev) => [...prev, { nodes, edges: eds }]);
        setFuture([]);
        return nextEdges as WorkflowEdge[];
      });
    },
    [nodes]
  );

  // Wrap React Flow node/edge change handlers to capture history
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const nextNodes = applyNodeChanges(changes, nds as any[]) as unknown as WorkflowNode[];
        setHistory((prev) => [...prev, { nodes: nds as WorkflowNode[], edges }]);
        setFuture([]);
        return nextNodes;
      });
    },
    [edges]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const nextEdges = applyEdgeChanges(changes, eds) as WorkflowEdge[];
        setHistory((prev) => [...prev, { nodes, edges: eds as WorkflowEdge[] }]);
        setFuture([]);
        return nextEdges;
      });
    },
    [nodes]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Handle multi-select for source nodes (excelModels, manualModels, etc.) with Ctrl/Cmd+click
    if (isSourceNode(node as WorkflowNode)) {
      if (event.ctrlKey || event.metaKey) {
        // Toggle selection
        setSelectedSourceNodeIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) {
            next.delete(node.id);
          } else {
            next.add(node.id);
          }
          return next;
        });
      } else {
        // Single select - clear others and select this one
        setSelectedSourceNodeIds(new Set([node.id]));
        setSelectedNode(node);
      }
    } else {
      // For non-source nodes, just set as selected
      setSelectedNode(node);
    }
  }, []);

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    setMappingModal({ isOpen: true, nodeId: node.id });
  }, []);

  const handleSaveMapping = useCallback((nodeId: string, updates: { data: any }) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...updates.data
            }
          };
        }
        return node;
      })
    );
  }, []);

  const handleAddNode = useCallback(
    (type: string, _position: { x: number; y: number }) => {
      // Compute a position roughly at the center of the current viewport
      const { innerWidth, innerHeight } = window;
      const centerX = innerWidth / 2;
      const centerY = innerHeight / 2;
      const zoom = viewport.zoom || 1;

      const position = {
        x: (centerX - viewport.x) / zoom,
        y: (centerY - viewport.y) / zoom,
      };

      // Initialize node data based on type
      let nodeData: any = {};

      if (type === 'excelModels') {
        nodeData = { file: null, columnName: '', modelNames: [], availableColumns: [], selectedColumnIndex: 0 };
      } else if (type === 'foreachModel') {
        nodeData = { currentModel: null };
      } else if (type === 'setVariable') {
        nodeData = { variables: [] };
      } else if (type === 'import') {
        nodeData = { fileType: 'dwg', actualFilePath: '' };
      } else if (type === 'cleanModel') {
        nodeData = {
          discipline: '',
          prefix: '',
          description: '',
          objectDimension: '',
          fileExt: '',
          variable: '',
        };
      } else if (type === 'createView') {
        nodeData = { modifiedVariable: '', coordinates: [40, 30, 565, 715] };
      } else if (type === 'addModelToView') {
        nodeData = { modifiedVariable: '' };
      } else if (type === 'removeModelFromView') {
        nodeData = { pattern: '*', modifiedVariable: '' };
      } else if (type === 'deleteModelsFromView') {
        nodeData = { modifiedVariable: '', coordinates: [497, 319], continueOnFailure: true };
      } else if (type === 'createSharedModel') {
        nodeData = {
          discipline: '',
          prefix: '',
          description: '',
          objectDimension: '',
          fileExt: '',
          variable: '',
          modifiedVariable: '',
        };
      } else if (type === 'triangulateManualOption') {
        nodeData = {
          modifiedVariable: '',
          prefix: '',
          surfaceValue: '',
          fileExt: '',
          optionsExt: '',
          discipline: '',
        };
      } else if (type === 'tinFunction') {
        nodeData = { modifiedVariable: '' };
      } else if (type === 'renameModel') {
        nodeData = { patternSearch: '', patternReplace: '' };
      } else if (type === 'getTotalSurfaceArea') {
        nodeData = { exportLocation: '', tinName: '', polygonName: '' };
      } else if (type === 'trimeshVolumeReport') {
        nodeData = { trimeshName: '', outputLocation: '', filename: '' };
      } else if (type === 'volumeTinToTin') {
        nodeData = { originalTinName: '', newTinName: '', outputLocation: '', filename: '' };
      } else if (type === 'convertLinesToVariable') {
        nodeData = { modelName: 'model_name' };
      } else if (type === 'createContourSmoothLabel') {
        nodeData = { prefix: '', cellValue: '' };
      } else if (type === 'drapeToTin') {
        nodeData = { dataToDrape: '', zOffset: '0', tinName: '' };
      } else if (type === 'runOrCreateContours') {
        nodeData = { prefix: '', cellValue: '' };
      } else if (type === 'runOrCreateMtf') {
        nodeData = { prefix: '', cellValue: '' };
      } else if (type === 'applyMtf') {
        nodeData = { functionName: 'function_name' };
      } else if (type === 'createMtfFile') {
        nodeData = { mtfName: '', templateLeftName: '', templateRightName: '' };
      } else if (type === 'createTemplateFile') {
        nodeData = { templateName: '', finalCutSlope: '2', finalFillSlope: '2', finalSearchDistance: '100' };
      } else if (type === 'createTrimeshFromTin') {
        nodeData = { prefix: '', cellValue: '', trimeshName: '', tinName: '', zOffset: '0', depth: '1', colour: '' };
      } else if (type === 'addComment') {
        nodeData = { commentName: '' };
      } else if (type === 'addLabel') {
        nodeData = { labelName: '' };
      } else if (type === 'ifFunctionExists') {
        nodeData = { functionName: '', passActionGoToLabel: '', failActionGoToLabel: '' };
      } else if (type === 'chainFileOutput') {
        nodeData = { modelName: '', projectFolder: '', modelType: 'Model' };
      } else if (type === 'runFunction') {
        nodeData = { commandName: '', functionName: '' };
      }

      const newNode: WorkflowNode = {
        id: `${type}_${Date.now()}`,
        type: type as any,
        position,
        data: nodeData,
      };
      setNodes((nds) => {
        const nextNodes = [...nds, newNode];
        setHistory((prev) => [...prev, { nodes: nds as WorkflowNode[], edges }]);
        setFuture([]);
        return nextNodes as WorkflowNode[];
      });
    },
    [edges, viewport]
  );

  // Helper to parse a single Excel file, reading from a specific column index
  const parseExcelFile = useCallback(
    (file: File, columnIndex: number = 0): Promise<{ modelNames: string[]; columnName: string; availableColumns: string[] }> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

            const rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, {
              header: 1,
              defval: '',
            }) as any[][];

            // Extract all column headers from the first row
            const availableColumns: string[] = [];
            if (rows.length > 0 && Array.isArray(rows[0])) {
              rows[0].forEach((cell) => {
                const header = String(cell ?? '').trim();
                if (header) availableColumns.push(header);
              });
            }

            // Clamp column index to valid range
            const safeIndex = Math.min(columnIndex, Math.max(0, (rows[0]?.length ?? 1) - 1));

            const modelNames = rows
              .map((row) => (Array.isArray(row) ? String((row[safeIndex] ?? '')).trim() : ''))
              .filter((name) => !!name);

            const columnName =
              rows.length > 0 && Array.isArray(rows[0])
                ? String((rows[0][safeIndex] ?? '')).trim()
                : '';

            resolve({ modelNames, columnName, availableColumns });
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    },
    []
  );

  // Handle changing the selected Excel column for an ExcelModels node
  const handleExcelColumnChange = useCallback(
    (nodeId: string, columnIndex: number) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || node.type !== 'excelModels') return;
      const file = (node.data as any)?.file as File | undefined;
      if (!file) return;

      parseExcelFile(file, columnIndex).then(({ modelNames, columnName, availableColumns }) => {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === nodeId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  modelNames,
                  columnName,
                  availableColumns,
                  selectedColumnIndex: columnIndex,
                },
              };
            }
            return n;
          })
        );
      });
    },
    [nodes, parseExcelFile]
  );

  const handleFileUpload = useCallback(
    (type: 'excel' | 'model', files: File[]) => {
      if (type === 'excel') {
        // Always create one ExcelModels node per uploaded Excel file
        Promise.all(files.map((f) => parseExcelFile(f, 0))).then((results) => {
          setNodes((nds) => {
            const newNodes: WorkflowNode[] = [];
            files.forEach((file, index) => {
              const { modelNames, columnName, availableColumns } = results[index];
              const newNode: WorkflowNode = {
                id: `excelModels_${Date.now()}_${index}`,
                type: 'excelModels',
                position: { x: 100 + index * 20, y: 100 + index * 20 },
                data: {
                  file,
                  modelNames,
                  columnName,
                  availableColumns,
                  selectedColumnIndex: 0,
                } as any,
              };
              newNodes.push(newNode);
            });
            return [...nds, ...newNodes];
          });
        });
      } else {
        setModelFiles((prev) => [...prev, ...files]);
      }
    },
    [nodes]
  );

  const handleRunChain = useCallback(async (explicitSourceId?: string) => {
    // PC-1003: the toolbar wires this as onClick={onRunChain}, which would pass
    // a MouseEvent as the first arg — only treat a real string as a source id.
    const sourceId = typeof explicitSourceId === 'string' ? explicitSourceId : undefined;
    const sourceNodes = nodes.filter((n) => isReadySource(n));
    const selectedSourceIds = sourceId
      ? (sourceNodes.some((n) => n.id === sourceId) ? [sourceId] : [])
      : selectedSourceNodeIds.size > 0
        ? Array.from(selectedSourceNodeIds).filter((id) =>
          sourceNodes.some((n) => n.id === id)
        )
        : sourceNodes.length > 0
          ? [sourceNodes[0].id]
          : [];

    if (selectedSourceIds.length === 0) {
      const firstSourceNode = nodes.find((n) => isSourceNode(n));
      setErrorModal({
        isOpen: true,
        title: 'No model source selected',
        message: 'Add an Excel Models node with a file, or a Model List with names, then run.',
        isExcelError: true,
        focusNodeId: firstSourceNode?.id,
      });
      return;
    }

    // PC-911: pre-validate every selected Excel id BEFORE entering the run
    // loop. A precondition failure (missing node, missing edge, missing
    // file) is not a runtime failure — it's something the user can fix in
    // one click, so it gets a toast with a 'Show me' action, not the
    // blocking modal.
    const fireActionableErrorToast = (err: ActionableError) => {
      const description = [err.message, err.fix].filter(Boolean).join(' — ');
      notify.error(err.title, {
        description,
        action: err.focusNodeId
          ? {
              label: 'Show me',
              onClick: () => focusNode(err.focusNodeId!),
            }
          : undefined,
      });
    };

    for (const excelNodeId of selectedSourceIds) {
      const validation = validateWorkflow(nodes, edges, excelNodeId);
      if (!validation.valid) {
        fireActionableErrorToast(validation.errors[0]);
        return;
      }
      const compiled = compileWorkflow(nodes, edges, excelNodeId);
      if ('error' in compiled) {
        fireActionableErrorToast(compiled.error);
        return;
      }
    }

    // Helper to run a single workflow and wait for completion
    const runSingleWorkflow = async (
      excelNodeId: string,
      progressContext: { currentExcel: number; totalExcels: number; excelLabel: string },
    ): Promise<{
      sessionId: string;
      zipBlob: Blob;
      folderName: string;
      succeededCount?: number;
      failedCount: number;
      failedModels: FailedModel[];
    }> => {
      // PC-911: outer handleRunChain pre-validates, so reaching this path
      // with !valid means state diverged between then and now. Format the
      // new ActionableError shape for the defensive error.
      const validation = validateWorkflow(nodes, edges, excelNodeId);
      if (!validation.valid) {
        throw new Error(
          `Validation failed: ${validation.errors.map((e) => e.title).join(', ')}`,
        );
      }

      const compiled = compileWorkflow(nodes, edges, excelNodeId);
      if ('error' in compiled) {
        throw new Error(`Compilation failed: ${compiled.error.title}`);
      }

      const response = await runWorkflow(compiled);
      const sessionId = response.session_id;

      // Poll for status
      const maxAttempts = 100;
      let attempts = 0;

      while (attempts < maxAttempts) {
        const status = await getWorkflowStatus(sessionId);
        // PC-907: surface live per-model progress regardless of overall status.
        // The backend writes file_details into `results` from the moment the
        // queued seed is emitted, so this can populate before the run finishes.
        if (status.results?.file_details) {
          setRunProgress({
            fileDetails: status.results.file_details,
            currentExcel: progressContext.currentExcel,
            totalExcels: progressContext.totalExcels,
            excelLabel: progressContext.excelLabel,
          });
          // PC-303: also stash the latest file_details under the session id
          // so the right-sidebar Run Details panel can keep rendering after
          // the run finishes.
          setLastRunDetails({
            fileDetails: status.results.file_details,
            sessionId,
          });
        }
        if (status.status === 'completed') {
          // Download the ZIP file
          const downloadUrl = getWorkflowDownloadUrl(sessionId);
          const zipResponse = await fetch(downloadUrl);
          const zipBlob = await zipResponse.blob();

          // Generate folder name from Excel filename
          const excelNode = nodes.find((n) => n.id === excelNodeId);
          const excelFile = (excelNode?.data as any)?.file as File | undefined;
          const folderName = excelFile
            ? excelFile.name.replace(/\.xlsx?$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_')
            : `workflow_${sessionId.substring(0, 8)}`;

          const succeededCount = status.results?.summary?.succeeded_count;
          const failedCount = status.results?.summary?.failed_count ?? 0;
          const failedModels = (status.results?.file_details ?? [])
            .filter((r) => r.status === 'error')
            .map((r) => ({
              model: r.model ?? '(unknown model)',
              error: r.error ?? null,
            }));

          return {
            sessionId,
            zipBlob,
            folderName,
            succeededCount,
            failedCount,
            failedModels,
          };
        } else if (status.status === 'error') {
          throw new Error(status.error || 'Unknown error occurred during processing');
        }
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      throw new Error('Processing timeout');
    };

    // PC-907: derive a friendly per-source label for the progress panel header.
    const excelLabelFor = (excelNodeId: string): string => {
      const node = nodes.find((n) => n.id === excelNodeId);
      const file = (node?.data as any)?.file as File | undefined;
      return file?.name ?? ((node?.data as any)?.label as string | undefined) ?? 'Model List';
    };

    setIsRunning(true);
    setRunProgress(null);
    // PC-303: a new run replaces the previous run's per-node events. Clear
    // the stash so the canvas / sidebar don't show stale data while polling
    // for the first tick of the new run.
    setLastRunDetails(null);
    try {
      if (selectedSourceIds.length === 1) {
        // Single workflow - use existing behavior
        const result = await runSingleWorkflow(selectedSourceIds[0], {
          currentExcel: 1,
          totalExcels: 1,
          excelLabel: excelLabelFor(selectedSourceIds[0]),
        });
        const { sessionId, zipBlob, succeededCount, failedCount, failedModels } = result;
        setSessionId(sessionId);

        // Prefer the structured succeeded_count from the backend; fall back to
        // counting non-_summary entries in the ZIP for legacy sessions.
        let chainFileCount = succeededCount;
        if (chainFileCount === undefined) {
          const zip = await JSZip.loadAsync(zipBlob);
          chainFileCount = Object.keys(zip.files).filter(
            (name) => !name.endsWith('/') && name !== '_summary.txt',
          ).length;
        }
        setSuccessFileCount(chainFileCount);
        setSuccessTotalModels((chainFileCount ?? 0) + failedCount);
        setSuccessFailedModels(failedModels);
        setShowSuccess(true);

        // Trigger download
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `workflow_chain_files_${sessionId}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Multiple workflows - run sequentially and combine
        const results: Array<{
          sessionId: string;
          zipBlob: Blob;
          folderName: string;
          succeededCount?: number;
          failedCount: number;
          failedModels: FailedModel[];
        }> = [];
        let totalSucceeded = 0;
        let totalFailed = 0;
        const combinedFailedModels: FailedModel[] = [];

        for (let i = 0; i < selectedSourceIds.length; i++) {
          const excelNodeId = selectedSourceIds[i];
          try {
            const result = await runSingleWorkflow(excelNodeId, {
              currentExcel: i + 1,
              totalExcels: selectedSourceIds.length,
              excelLabel: excelLabelFor(excelNodeId),
            });
            results.push(result);

            // Prefer structured counts; fall back to ZIP inspection (excluding _summary.txt).
            let succeededInRun = result.succeededCount;
            if (succeededInRun === undefined) {
              const zip = await JSZip.loadAsync(result.zipBlob);
              succeededInRun = Object.keys(zip.files).filter(
                (name) => !name.endsWith('/') && name !== '_summary.txt',
              ).length;
            }
            totalSucceeded += succeededInRun;
            totalFailed += result.failedCount;
            // Prefix with the Excel folder so the combined list is unambiguous.
            for (const f of result.failedModels) {
              combinedFailedModels.push({
                model: `${result.folderName}/${f.model}`,
                error: f.error,
              });
            }
          } catch (err) {
            const failingNode = nodes.find((n) => n.id === excelNodeId);
            const label = failingNode ? nodeLabel(failingNode) : '(unknown source node)';
            setErrorModal({
              isOpen: true,
              title: 'Workflow Failed',
              message: `Error running workflow for '${label}': ${err instanceof Error ? err.message : 'Unknown error'}`,
              isExcelError: false,
              focusNodeId: excelNodeId,
            });
            setIsRunning(false);
            return;
          }
        }

        // Combine all ZIPs into one
        const combinedZip = new JSZip();
        for (const result of results) {
          const zip = await JSZip.loadAsync(result.zipBlob);
          const filePromises: Promise<void>[] = [];
          zip.forEach((relativePath: string, file: JSZip.JSZipObject) => {
            if (!file.dir) {
              filePromises.push(
                file.async('blob').then((fileData) => {
                  combinedZip.file(`${result.folderName}/${relativePath}`, fileData);
                })
              );
            }
          });
          await Promise.all(filePromises);
        }

        const combinedBlob = await combinedZip.generateAsync({ type: 'blob' });
        setSuccessFileCount(totalSucceeded);
        setSuccessTotalModels(totalSucceeded + totalFailed);
        setSuccessFailedModels(combinedFailedModels);
        setShowSuccess(true);

        // Trigger download of combined ZIP
        const url = URL.createObjectURL(combinedBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `combined_workflow_chain_files_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // PC-911: only runtime failures from the backend reach here now.
      // Precondition errors are surfaced as toasts by the pre-validation
      // pass above. Single-source path doesn't know which source node was
      // running, but selectedSourceIds[0] is always set when we get here.
      const runningExcelId = selectedSourceIds[0];
      const failingNode = nodes.find((n) => n.id === runningExcelId);
      const label = failingNode ? nodeLabel(failingNode) : '(workflow)';
      setErrorModal({
        isOpen: true,
        title: 'Error Running Workflow',
        message: `${label}: ${err instanceof Error ? err.message : 'Unknown error occurred'}`,
        isExcelError: false,
        focusNodeId: runningExcelId,
      });
    } finally {
      setIsRunning(false);
      // PC-907: hide the live progress panel; SuccessCelebration / ErrorModal
      // now own the user's attention.
      setRunProgress(null);
    }
  }, [nodes, edges, selectedSourceNodeIds]);

  const refreshTemplates = useCallback(async () => {
    try {
      const list = await fetchTemplates();
      setTemplates(list);
    } catch (err) {
      // PC-911: a fetch failure here is almost always backend-down or
      // network. Surface the underlying error and give the user a one-click
      // way to try again without leaving the canvas.
      notify.error("Couldn't load templates", {
        description: err instanceof Error ? err.message : 'The templates service may be offline.',
        action: { label: 'Retry', onClick: () => { void refreshTemplates(); } },
      });
    }
  }, []);

  // Fetch templates on mount and migrate any leftover localStorage entries
  // from the pre-PC-202 storage. Single-shot — `migrateLocalStorageToServer`
  // sets a localStorage flag so the upload never repeats.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTemplatesLoading(true);
      try {
        const migrated = await migrateLocalStorageToServer();
        if (cancelled) return;
        const list = await fetchTemplates();
        if (cancelled) return;
        setTemplates(list);
        if (migrated > 0) {
          setTemplateNotification({
            isOpen: true,
            templateName: `Migrated ${migrated} template${migrated !== 1 ? 's' : ''} to the cloud`,
          });
        }
      } catch (err) {
        if (cancelled) return;
        // PC-911: same shape as refreshTemplates but the retry button calls
        // refreshTemplates directly — by mount-fail time the migration
        // step has already either succeeded or been bypassed, so a plain
        // re-fetch is the right retry.
        notify.error("Couldn't load templates", {
          description: err instanceof Error ? err.message : 'The templates service may be offline.',
          action: { label: 'Retry', onClick: () => { void refreshTemplates(); } },
        });
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveTemplate = useCallback(() => {
    setShowSaveTemplateModal(true);
  }, []);

  // Apply a saved snapshot (template, version, or imported file) to the canvas.
  // Centralised so load/restore/import all stay in sync — including the
  // viewport restore, which used to be silently dropped.
  const applySnapshot = useCallback(
    (snapshot: {
      nodes: WorkflowNode[];
      edges: WorkflowEdge[];
      viewport?: { x: number; y: number; zoom: number };
    }) => {
      const validEdges = filterValidEdges(snapshot.edges, snapshot.nodes);
      setNodes(snapshot.nodes);
      setEdges(validEdges as WorkflowEdge[]);
      // Stale node IDs would dangle in selection state.
      setSelectedNode(null);
      setSelectedSourceNodeIds(new Set());
      if (snapshot.viewport) {
        setViewport(snapshot.viewport);
        reactFlowInstanceRef.current?.setViewport(snapshot.viewport);
      }
      return validEdges.length;
    },
    []
  );

  const handleSaveTemplateConfirm = useCallback(
    async (name: string, options: SaveTemplateOptions) => {
      const payload = {
        name,
        nodes: nodes as WorkflowNode[],
        edges: edges as WorkflowEdge[],
        viewport,
        message: options.message,
      };
      try {
        let saved: WorkflowTemplate;
        if (options.mode === 'update' && loadedTemplate) {
          saved = await updateTemplate(loadedTemplate.id, payload);
        } else {
          saved = await createTemplate(payload);
        }
        // The newly-saved template is now the "current" one, so subsequent
        // saves default to versioning it.
        setLoadedTemplate({ id: saved.id, name: saved.name });
        await refreshTemplates();
        setTemplateNotification({
          isOpen: true,
          templateName: saved.name,
          nodeCount: nodes.length,
          edgeCount: edges.length,
        });
      } catch (err) {
        // PC-911: capture the exact args so 'Retry' re-runs the same save
        // without re-opening the Save modal.
        const retryOptions = options;
        notify.error("Couldn't save template", {
          description: err instanceof Error ? err.message : 'Unknown error',
          action: {
            label: 'Retry',
            onClick: () => { void handleSaveTemplateConfirm(name, retryOptions); },
          },
        });
      }
    },
    [nodes, edges, viewport, loadedTemplate, refreshTemplates]
  );

  const handleLoadTemplate = useCallback(() => {
    setShowLoadTemplateModal(true);
  }, []);

  const handleConfirmLoadTemplate = useCallback(
    (template: WorkflowTemplate) => {
      const validCount = applySnapshot(template);
      if (validCount < template.edges.length) {
        const dropped = template.edges.length - validCount;
        console.warn(
          `Filtered out ${dropped} invalid edges when loading template "${template.name}"`
        );
        notify.warning(
          `Filtered ${dropped} invalid edge${dropped === 1 ? '' : 's'} from "${template.name}"`,
          { description: 'Edges referencing missing nodes were skipped.' },
        );
      }
      setLoadedTemplate({ id: template.id, name: template.name });
      setShowLoadTemplateModal(false);
      setTemplateNotification({
        isOpen: true,
        templateName: template.name,
        nodeCount: template.nodes?.length,
        edgeCount: validCount,
      });
    },
    [applySnapshot]
  );

  const handleRestoreVersion = useCallback(
    (template: WorkflowTemplate, snapshot: WorkflowTemplateVersionSnapshot) => {
      const validCount = applySnapshot(snapshot);
      // The restored snapshot belongs to `template` — saving from here should
      // append a new version on top of that template.
      setLoadedTemplate({ id: template.id, name: template.name });
      setShowLoadTemplateModal(false);
      setTemplateNotification({
        isOpen: true,
        templateName: `${template.name} · v${snapshot.versionNumber}`,
        nodeCount: snapshot.nodes?.length,
        edgeCount: validCount,
      });
    },
    [applySnapshot]
  );

  const handleDeleteTemplate = useCallback(
    async (template: WorkflowTemplate) => {
      try {
        await deleteTemplateApi(template.id);
        await refreshTemplates();
        // If we just deleted the template the canvas was tracking, drop the
        // pointer so the next Save defaults to creating a new template.
        setLoadedTemplate((current) =>
          current?.id === template.id ? null : current
        );
      } catch (err) {
        notify.error("Couldn't delete template", {
          description: err instanceof Error ? err.message : 'Unknown error',
          action: {
            label: 'Retry',
            onClick: () => { void handleDeleteTemplate(template); },
          },
        });
      }
    },
    [refreshTemplates]
  );

  const handleExportTemplate = useCallback(() => {
    const template = {
      id: 'export',
      name: 'Exported Template',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: nodes as WorkflowNode[],
      edges: edges as WorkflowEdge[],
      viewport,
    };
    const json = exportTemplate(template);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workflow-template.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, viewport]);

  const handleImportTemplate = useCallback(() => {
    if (!fileInputRef.current) return;
    fileInputRef.current.click();
  }, []);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = event.target?.result as string;
          const template = importTemplate(json);
          const importedNodes = template.nodes as WorkflowNode[];
          const importedEdges = template.edges as WorkflowEdge[];
          const validCount = applySnapshot({
            nodes: importedNodes,
            edges: importedEdges,
            viewport: template.viewport,
          });
          if (validCount < importedEdges.length) {
            const dropped = importedEdges.length - validCount;
            console.warn(
              `Filtered out ${dropped} invalid edges when importing template`
            );
            notify.warning(
              `Filtered ${dropped} invalid edge${dropped === 1 ? '' : 's'} from imported template`,
              { description: 'Edges referencing missing nodes were skipped.' },
            );
          }
          // The imported file isn't tied to any saved template — saving from
          // here should default to creating a new one.
          setLoadedTemplate(null);
          setTemplateNotification({
            isOpen: true,
            templateName: template.name || 'Imported Template',
            nodeCount: importedNodes?.length,
            edgeCount: validCount,
          });
        } catch (err) {
          // PC-911: the only failure path here is parse / shape validation
          // (importTemplate throws on bad JSON; applySnapshot is sync and
          // doesn't throw). So the description is always "not a valid
          // export" — the user's underlying error message is technical
          // (e.g. "Unexpected token <") and doesn't help them.
          notify.error("Couldn't import template", {
            description: "The file isn't a valid PyChain template export.",
          });
        }
      };
      reader.readAsText(file);
    },
    [applySnapshot]
  );

  const canRun =
    hasReadyModelSource(nodes) &&
    (nodes || []).some((n) => n.type === 'foreachModel') &&
    (nodes || []).some((n) => n.type === 'chainFileOutput');

  // PC-1003: context value for the in-node ▶ run buttons. Memoized so source
  // nodes only re-render when the run state actually changes.
  const runContextValue = useMemo(
    () => ({
      onRunFromSource: (nodeId: string) => {
        void handleRunChain(nodeId);
      },
      canRun,
      isRunning,
    }),
    [handleRunChain, canRun, isRunning],
  );

  // PC-1003: Ctrl/Cmd+Enter runs the chain (mirrors the toolbar Run button). A
  // separate effect from the editing-shortcuts one because handleRunChain /
  // canRun are defined later in this component and can't be its dependencies.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!((e.ctrlKey || e.metaKey) && e.key === 'Enter')) return;
      const target = e.target as HTMLElement | null;
      const isInputLike =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.getAttribute('contenteditable') === 'true');
      if (isInputLike) return;
      e.preventDefault();
      if (canRun && !isRunning) {
        void handleRunChain();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canRun, isRunning, handleRunChain]);

  // PC-703: derive a per-node warning list from the current graph and inject
  // it into each node's data so BaseNode can render the warning badge. Spread
  // ...n preserves React Flow's `selected` / `position` / etc. The map -> map
  // pattern keeps reference equality stable when warnings haven't changed.
  const nodeWarnings = useMemo(() => {
    const map = new Map<string, string[]>();
    nodes.forEach((n) => {
      const w = validateNode(n, nodes, edges);
      if (w.length > 0) map.set(n.id, w);
    });
    return map;
  }, [nodes, edges]);

  // PC-303: aggregated per-node execution state derived from the latest run.
  // We read from `lastRunDetails` (which persists after the run finishes) so
  // node coloring stays meaningful while the user inspects results — not just
  // during the live polling window.
  const nodeStates = useMemo(
    () => aggregateNodeStates(lastRunDetails?.fileDetails),
    [lastRunDetails?.fileDetails],
  );

  const nodesWithWarnings = useMemo(
    () =>
      nodes.map((n) => {
        const disabled = !!n.data?.disabled;
        const w = disabled ? [] : (nodeWarnings.get(n.id) ?? []);
        const nodeState = nodeStates.get(n.id) ?? 'idle';
        const existingWarnings = (n.data as any)?.warnings as string[] | undefined;
        const existingState = (n.data as any)?.nodeState as string | undefined;
        const desiredClass = disabled ? 'pynode-disabled' : undefined;
        // Skip rewrap when nothing relevant changed — avoids needlessly breaking
        // React Flow's memoized node reconciliation.
        const warningsUnchanged = sameWarnings(existingWarnings, w);
        const stateUnchanged = (existingState ?? 'idle') === nodeState;
        const classUnchanged = (n.className ?? undefined) === desiredClass;
        if (warningsUnchanged && stateUnchanged && classUnchanged) return n;
        return {
          ...n,
          className: desiredClass,
          data: { ...n.data, warnings: w, nodeState },
        };
      }),
    [nodes, nodeWarnings, nodeStates],
  );

  const handleNavigate = useCallback((page: string) => {
    setCurrentPage(page as 'landing' | 'editor' | 'profile');
  }, []);

  return (
    <ReactFlowProvider>
      <div className="h-screen w-screen flex flex-col bg-gray-900">
        <TopBar
          onRunChain={handleRunChain}
          onSaveTemplate={handleSaveTemplate}
          onLoadTemplate={handleLoadTemplate}
          onExportTemplate={handleExportTemplate}
          onImportTemplate={handleImportTemplate}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={history.length > 0}
          canRedo={future.length > 0}
          isRunning={isRunning}
          canRun={canRun}
          onNavigate={handleNavigate}
          currentPage={currentPage}
          onShowShortcuts={() => setShowShortcuts(true)}
        />
        {currentPage === 'landing' && (
          <div className="flex-1 overflow-auto">
            <LandingPage onNavigate={handleNavigate} />
          </div>
        )}

        {currentPage === 'profile' && (
          <div className="flex-1 overflow-auto">
            <ProfilePage onNavigate={handleNavigate} />
          </div>
        )}

        {currentPage === 'editor' && (
          <WorkflowRunProvider value={runContextValue}>
            <div className="flex-1 flex overflow-hidden">
              <LeftSidebar
                onAddNode={handleAddNode}
                onFileUpload={handleFileUpload}
                excelNodes={nodes
                  .filter((n) => n.type === 'excelModels' && (n.data as any)?.file)
                  .map((n) => ({
                    id: n.id,
                    fileName: ((n.data as any)?.file as File)?.name || 'Untitled',
                  }))}
                modelFiles={modelFiles}
              />
              <div className="flex-1 relative">
                <WorkspaceCanvas
                  nodes={nodesWithWarnings}
                  edges={edges}
                  onNodesChange={handleNodesChange}
                  onEdgesChange={handleEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={onNodeClick}
                  onNodeDoubleClick={onNodeDoubleClick}
                  onNodeContextMenu={handleNodeContextMenu}
                  onAutoLayout={handleAutoLayout}
                  onViewportChange={setViewport}
                  onInit={(instance) => {
                    reactFlowInstanceRef.current = instance;
                  }}
                />
              </div>
              <RightSidebar
                selectedNode={selectedNode}
                nodes={nodes}
                edges={edges}
                runFileDetails={lastRunDetails?.fileDetails}
                runSessionId={lastRunDetails?.sessionId ?? null}
                onUpdateNode={(nodeId, data) => {
                  setNodes((nds) =>
                    nds.map((node) =>
                      node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
                    )
                  );
                  // Update selectedNode if it's the node being updated
                  setSelectedNode((current) => {
                    if (current && current.id === nodeId) {
                      return { ...current, data: { ...current.data, ...data } };
                    }
                    return current;
                  });
                }}
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
            {contextMenu && (() => {
              const node = nodes.find((n) => n.id === contextMenu.nodeId);
              if (!node) return null;
              return (
                <NodeContextMenu
                  x={contextMenu.x}
                  y={contextMenu.y}
                  node={node}
                  onClose={() => setContextMenu(null)}
                  onDuplicate={() => handleDuplicateNode(node.id)}
                  onCopy={() => handleCopyNode(node.id)}
                  onDelete={() => handleDeleteNode(node.id)}
                  onToggleDisable={() => handleToggleDisableNode(node.id)}
                />
              );
            })()}
            {runProgress && (
              <RunProgressPanel
                fileDetails={runProgress.fileDetails}
                currentExcel={runProgress.currentExcel}
                totalExcels={runProgress.totalExcels}
                excelLabel={runProgress.excelLabel}
              />
            )}
            <SuccessCelebration
              isOpen={showSuccess}
              onClose={() => {
                setShowSuccess(false);
                setSuccessFileCount(undefined);
                setSuccessTotalModels(undefined);
                setSuccessFailedModels([]);
              }}
              fileCount={successFileCount}
              totalModels={successTotalModels}
              failedModels={successFailedModels}
            />
            <ErrorModal
              isOpen={errorModal.isOpen}
              onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
              title={errorModal.title}
              message={errorModal.message}
              isExcelError={errorModal.isExcelError}
              focusNodeId={errorModal.focusNodeId}
            />
            <TemplateNotification
              isOpen={templateNotification.isOpen}
              onClose={() => setTemplateNotification({ isOpen: false })}
              templateName={templateNotification.templateName}
              nodeCount={templateNotification.nodeCount}
              edgeCount={templateNotification.edgeCount}
            />
            <SaveTemplateModal
              isOpen={showSaveTemplateModal}
              onClose={() => setShowSaveTemplateModal(false)}
              onSave={handleSaveTemplateConfirm}
              savedTemplateCount={templates.length}
              loadedTemplate={loadedTemplate}
            />
            <LoadTemplateModal
              isOpen={showLoadTemplateModal}
              templates={templates}
              isLoading={templatesLoading}
              onClose={() => setShowLoadTemplateModal(false)}
              onLoad={handleConfirmLoadTemplate}
              onDelete={handleDeleteTemplate}
              onRestoreVersion={handleRestoreVersion}
            />
            <DataMappingModal
              isOpen={mappingModal.isOpen}
              onClose={() => setMappingModal({ isOpen: false, nodeId: null })}
              nodeId={mappingModal.nodeId}
              nodes={nodes}
              edges={edges}
              onSave={handleSaveMapping}
              onExcelColumnChange={handleExcelColumnChange}
            />
            <ShortcutsModal
              isOpen={showShortcuts}
              onClose={() => setShowShortcuts(false)}
            />
          </WorkflowRunProvider>
        )}
      </div>
    </ReactFlowProvider>
  );
}



