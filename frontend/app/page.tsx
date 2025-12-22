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
import { WorkflowNode, WorkflowEdge } from '@/lib/workflow/types';
import { compileWorkflow, validateWorkflow } from '@/lib/workflow/compile';
import { runWorkflow, getWorkflowStatus, getWorkflowDownloadUrl } from '@/lib/workflow/run';
import {
  saveTemplate,
  loadAllTemplates,
  exportTemplate,
  importTemplate,
} from '@/lib/workflow/templates';
import * as XLSX from 'xlsx';

export default function WorkspacePage() {
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [modelFiles, setModelFiles] = useState<File[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Undo/redo history
  const [history, setHistory] = useState<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }[]>([]);

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

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Y
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
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

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
    // Simple selection only; deletion is handled via Delete/Backspace keys in the canvas
    setSelectedNode(node);
  }, []);

  const handleAddNode = useCallback(
    (type: string, position: { x: number; y: number }) => {
      // Initialize node data based on type
      let nodeData: any = {};

      if (type === 'excelModels') {
        nodeData = { file: excelFile, columnName: '', modelNames: [] };
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
      } else if (type === 'chainFileOutput') {
        nodeData = { modelName: '', projectFolder: '', modelType: 'Model' };
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
    [excelFile, edges]
  );

  const handleFileUpload = useCallback(
    (type: 'excel' | 'model', files: File[]) => {
      if (type === 'excel') {
        setExcelFile(files[0]);
        // Parse Excel and update ExcelModels node if it exists
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

          // Read sheet as raw rows so we don't depend on a header row
          const rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, {
            header: 1,
            defval: '',
          }) as any[][];

          // Take first column of each non-empty row as model name
          const modelNames = rows
            .map((row) => (Array.isArray(row) ? String((row[0] ?? '')).trim() : ''))
            .filter((name) => !!name);

          // Update existing ExcelModels node(s) or create one if none exist
          setNodes((nds) => {
            let updated = false;
            const updatedNodes = nds.map((node) => {
              if (node.type === 'excelModels') {
                updated = true;
                return {
                  ...node,
                  data: {
                    ...node.data,
                    file: files[0],
                    modelNames,
                    // First row's first cell used as column name (or empty if none)
                    columnName:
                      rows.length > 0 && Array.isArray(rows[0])
                        ? String((rows[0][0] ?? '')).trim()
                        : '',
                  },
                };
              }
              return node;
            });

            if (!updated) {
              // No ExcelModels node yet – create one automatically
              const newNode: WorkflowNode = {
                id: `excelModels_${Date.now()}`,
                type: 'excelModels',
                position: { x: 100, y: 100 },
                data: {
                  file: files[0],
                  modelNames,
                  columnName:
                    rows.length > 0 && Array.isArray(rows[0])
                      ? String((rows[0][0] ?? '')).trim()
                      : '',
                } as any,
              };
              return [...updatedNodes, newNode];
            }

            return updatedNodes;
          });
        };
        reader.readAsArrayBuffer(files[0]);
      } else {
        setModelFiles((prev) => [...prev, ...files]);
      }
    },
    []
  );

  const handleRunChain = useCallback(async () => {
    const validation = validateWorkflow(nodes, edges);
    if (!validation.valid) {
      alert('Workflow validation failed:\n' + validation.errors.join('\n'));
      return;
    }

    const compiled = compileWorkflow(nodes, edges);
    if ('error' in compiled) {
      alert('Compilation error: ' + compiled.error);
      return;
    }

    setIsRunning(true);
    try {
      const response = await runWorkflow(compiled);
      setSessionId(response.session_id);

      // Poll for status
      const pollStatus = async () => {
        const maxAttempts = 100;
        let attempts = 0;

        const poll = async () => {
          try {
            const status = await getWorkflowStatus(response.session_id);
            if (status.status === 'completed') {
              setIsRunning(false);
              try {
                // Trigger download of the generated ZIP file
                const downloadUrl = getWorkflowDownloadUrl(response.session_id);
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = `workflow_chain_files_${response.session_id}.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              } catch (_e) {
                // Fallback to a simple message if automatic download fails
                alert('Processing complete! Download available at the workflow download URL.');
              }
            } else if (status.status === 'error') {
              setIsRunning(false);
              alert('Processing failed: ' + (status.error || 'Unknown error'));
            } else if (attempts < maxAttempts) {
              attempts++;
              setTimeout(poll, 3000);
            } else {
              setIsRunning(false);
              alert('Processing timed out');
            }
          } catch (err) {
            setIsRunning(false);
            alert(
              'Error checking status: ' +
                (err instanceof Error ? err.message : 'Unknown error')
            );
          }
        };

        poll();
      };

      pollStatus();
    } catch (err) {
      setIsRunning(false);
      alert(
        'Error running workflow: ' +
          (err instanceof Error ? err.message : 'Unknown error')
      );
    }
  }, [nodes, edges]);

  const handleSaveTemplate = useCallback(() => {
    const name = prompt('Enter template name:');
    if (!name) return;

    const viewport = { x: 0, y: 0, zoom: 1 }; // TODO: capture actual viewport
    saveTemplate(name, nodes as WorkflowNode[], edges as WorkflowEdge[], viewport);
    alert('Template saved!');
  }, [nodes, edges]);

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
      setNodes(template.nodes as WorkflowNode[]);
      setEdges(template.edges as WorkflowEdge[]);
      alert('Template loaded!');
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
          setNodes(template.nodes as WorkflowNode[]);
          setEdges(template.edges as WorkflowEdge[]);
          alert('Template imported!');
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
    (nodes || []).some((n) => n.type === 'excelModels') &&
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
            excelFile={excelFile}
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
      </div>
    </ReactFlowProvider>
  );
}



