'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { SuccessCelebration } from '@/components/workflow/SuccessCelebration';
import { ErrorModal } from '@/components/workflow/ErrorModal';
import { TemplateNotification } from '@/components/workflow/TemplateNotification';
import { SaveTemplateModal } from '@/components/workflow/SaveTemplateModal';
import { DataMappingModal } from '@/components/workflow/DataMappingModal';
import { WorkflowNode, WorkflowEdge, ExcelModelsNodeData } from '@/lib/workflow/types';
import { compileWorkflow, validateWorkflow } from '@/lib/workflow/compile';
import { runWorkflow, getWorkflowStatus, getWorkflowDownloadUrl } from '@/lib/workflow/run';
import {
  saveTemplate,
  loadAllTemplates,
  exportTemplate,
  importTemplate,
} from '@/lib/workflow/templates';
import { filterValidEdges } from '@/lib/workflow/nodeSchemas';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

export default function WorkspacePage() {
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedExcelNodeIds, setSelectedExcelNodeIds] = useState<Set<string>>(new Set());
  const [modelFiles, setModelFiles] = useState<File[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successFileCount, setSuccessFileCount] = useState<number | undefined>(undefined);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string; isExcelError?: boolean }>({
    isOpen: false,
    title: '',
    message: '',
    isExcelError: false,
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
  const [mappingModal, setMappingModal] = useState<{ isOpen: boolean; nodeId: string | null }>({
    isOpen: false,
    nodeId: null,
  });
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
    // Handle multi-select for ExcelModels nodes with Ctrl/Cmd+click
    if (node.type === 'excelModels') {
      if (event.ctrlKey || event.metaKey) {
        // Toggle selection
        setSelectedExcelNodeIds((prev) => {
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
        setSelectedExcelNodeIds(new Set([node.id]));
        setSelectedNode(node);
      }
    } else {
      // For non-ExcelModels nodes, just set as selected
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
        nodeData = { file: null, columnName: '', modelNames: [] };
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

  const handleFileUpload = useCallback(
    (type: 'excel' | 'model', files: File[]) => {
      if (type === 'excel') {
        // Helper to parse a single Excel file
        const parseExcelFile = (file: File): Promise<{ modelNames: string[]; columnName: string }> => {
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

                const modelNames = rows
                  .map((row) => (Array.isArray(row) ? String((row[0] ?? '')).trim() : ''))
                  .filter((name) => !!name);

                const columnName =
                  rows.length > 0 && Array.isArray(rows[0])
                    ? String((rows[0][0] ?? '')).trim()
                    : '';

                resolve({ modelNames, columnName });
              } catch (err) {
                reject(err);
              }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
          });
        };

        // Always create one ExcelModels node per uploaded Excel file
        Promise.all(files.map(parseExcelFile)).then((results) => {
          setNodes((nds) => {
            const newNodes: WorkflowNode[] = [];
            files.forEach((file, index) => {
              const { modelNames, columnName } = results[index];
              const newNode: WorkflowNode = {
                id: `excelModels_${Date.now()}_${index}`,
                type: 'excelModels',
                position: { x: 100 + index * 20, y: 100 + index * 20 },
                data: {
                  file,
                  modelNames,
                  columnName,
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

  const handleRunChain = useCallback(async () => {
    // Get selected ExcelModels nodes (or default to first one if none selected)
    const excelNodes = nodes.filter((n): n is WorkflowNode & { data: ExcelModelsNodeData } =>
      n.type === 'excelModels' && 'file' in n.data && !!(n.data as any).file
    );
    const selectedExcelIds = selectedExcelNodeIds.size > 0
      ? Array.from(selectedExcelNodeIds).filter((id) =>
        excelNodes.some((n) => n.id === id)
      )
      : excelNodes.length > 0
        ? [excelNodes[0].id]
        : [];

    if (selectedExcelIds.length === 0) {
      setErrorModal({
        isOpen: true,
        title: 'No Excel Models Selected',
        message: 'Please select at least one Excel Models node with a file loaded.',
        isExcelError: true,
      });
      return;
    }

    // Helper to run a single workflow and wait for completion
    const runSingleWorkflow = async (excelNodeId: string): Promise<{ sessionId: string; zipBlob: Blob; folderName: string }> => {
      const validation = validateWorkflow(nodes, edges, excelNodeId);
      if (!validation.valid) {
        throw new Error(`Validation failed for ${excelNodeId}: ${validation.errors.join(', ')}`);
      }

      const compiled = compileWorkflow(nodes, edges, excelNodeId);
      if ('error' in compiled) {
        throw new Error(`Compilation failed for ${excelNodeId}: ${compiled.error}`);
      }

      const response = await runWorkflow(compiled);
      const sessionId = response.session_id;

      // Poll for status
      const maxAttempts = 100;
      let attempts = 0;

      while (attempts < maxAttempts) {
        const status = await getWorkflowStatus(sessionId);
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

          return { sessionId, zipBlob, folderName };
        } else if (status.status === 'error') {
          throw new Error(status.error || 'Unknown error occurred during processing');
        }
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      throw new Error('Processing timeout');
    };

    setIsRunning(true);
    try {
      if (selectedExcelIds.length === 1) {
        // Single workflow - use existing behavior
        const { sessionId, zipBlob, folderName } = await runSingleWorkflow(selectedExcelIds[0]);
        setSessionId(sessionId);

        // Get file count (approximate from ZIP)
        const zip = await JSZip.loadAsync(zipBlob);
        const fileCount = Object.keys(zip.files).filter((name) => !name.endsWith('/')).length;
        setSuccessFileCount(fileCount);
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
        const results: Array<{ sessionId: string; zipBlob: Blob; folderName: string }> = [];
        let totalFileCount = 0;

        for (const excelNodeId of selectedExcelIds) {
          try {
            const result = await runSingleWorkflow(excelNodeId);
            results.push(result);
            const zip = await JSZip.loadAsync(result.zipBlob);
            totalFileCount += Object.keys(zip.files).filter((name) => !name.endsWith('/')).length;
          } catch (err) {
            setErrorModal({
              isOpen: true,
              title: 'Workflow Failed',
              message: `Error running workflow for ${excelNodeId}: ${err instanceof Error ? err.message : 'Unknown error'}`,
              isExcelError: false,
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
        setSuccessFileCount(totalFileCount);
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
      setErrorModal({
        isOpen: true,
        title: 'Error Running Workflow',
        message: err instanceof Error ? err.message : 'Unknown error occurred',
        isExcelError: false,
      });
    } finally {
      setIsRunning(false);
    }
  }, [nodes, edges, selectedExcelNodeIds]);

  const handleSaveTemplate = useCallback(() => {
    setShowSaveTemplateModal(true);
  }, []);

  const handleSaveTemplateConfirm = useCallback(
    (name: string) => {
      const viewport = { x: 0, y: 0, zoom: 1 }; // TODO: capture actual viewport
      saveTemplate(name, nodes as WorkflowNode[], edges as WorkflowEdge[], viewport);

      // Show success notification
      setTemplateNotification({
        isOpen: true,
        templateName: name,
        nodeCount: nodes.length,
        edgeCount: edges.length,
      });
    },
    [nodes, edges]
  );

  const handleLoadTemplate = useCallback(() => {
    const templates = loadAllTemplates();
    if (templates.length === 0) {
      alert('No templates found');
      return;
    }

    const templateNames = templates.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
    const choice = prompt(`Select template (1-${templates.length}):\n${templateNames}`);
    const index = parseInt(choice || '0') - 1;

    if (index >= 0 && index < templates.length) {
      const template = templates[index];
      const loadedNodes = template.nodes as WorkflowNode[];
      const loadedEdges = template.edges as WorkflowEdge[];

      // Filter out invalid edges
      const validEdges = filterValidEdges(loadedEdges, loadedNodes);

      if (validEdges.length < loadedEdges.length) {
        console.warn(
          `Filtered out ${loadedEdges.length - validEdges.length} invalid edges when loading template "${template.name}"`
        );
      }

      setNodes(loadedNodes);
      setEdges(validEdges as WorkflowEdge[]);

      // Show modern notification
      setTemplateNotification({
        isOpen: true,
        templateName: template.name,
        nodeCount: loadedNodes?.length,
        edgeCount: validEdges?.length,
      });
    }
  }, []);

  const handleExportTemplate = useCallback(() => {
    const viewport = { x: 0, y: 0, zoom: 1 };
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
  }, [nodes, edges]);

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
          const loadedNodes = template.nodes as WorkflowNode[];
          const loadedEdges = template.edges as WorkflowEdge[];

          // Filter out invalid edges
          const validEdges = filterValidEdges(loadedEdges, loadedNodes);

          if (validEdges.length < loadedEdges.length) {
            console.warn(
              `Filtered out ${loadedEdges.length - validEdges.length} invalid edges when importing template`
            );
          }

          setNodes(loadedNodes);
          setEdges(validEdges as WorkflowEdge[]);
          // Clear selections so future Excel uploads behave predictably
          setSelectedNode(null);
          setSelectedExcelNodeIds(new Set());

          // Show modern notification
          setTemplateNotification({
            isOpen: true,
            templateName: template.name || 'Imported Template',
            nodeCount: loadedNodes?.length,
            edgeCount: validEdges?.length,
          });
        } catch (err) {
          alert(
            'Error importing template: ' +
            (err instanceof Error ? err.message : 'Unknown error')
          );
        }
      };
      reader.readAsText(file);
    },
    []
  );

  const canRun =
    (nodes || []).some((n) => n.type === 'excelModels' && (n.data as any)?.file) &&
    (nodes || []).some((n) => n.type === 'foreachModel') &&
    (nodes || []).some((n) => n.type === 'chainFileOutput');

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
        />
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
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              onViewportChange={setViewport}
            />
          </div>
          <RightSidebar
            selectedNode={selectedNode}
            nodes={nodes}
            edges={edges}
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
        <SuccessCelebration
          isOpen={showSuccess}
          onClose={() => setShowSuccess(false)}
          fileCount={successFileCount}
        />
        <ErrorModal
          isOpen={errorModal.isOpen}
          onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
          title={errorModal.title}
          message={errorModal.message}
          isExcelError={errorModal.isExcelError}
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
          existingTemplateNames={loadAllTemplates().map((t) => t.name)}
        />
        <DataMappingModal
          isOpen={mappingModal.isOpen}
          onClose={() => setMappingModal({ isOpen: false, nodeId: null })}
          nodeId={mappingModal.nodeId}
          nodes={nodes}
          edges={edges}
          onSave={handleSaveMapping}
        />
      </div>
    </ReactFlowProvider>
  );
}



