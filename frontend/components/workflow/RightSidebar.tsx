'use client';

import React, { useMemo } from 'react';
import { Node, Edge } from '@xyflow/react';
import { WorkflowNodeData, WorkflowNode, VariableBinding } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId, getTokenFromValueHandle, isParamHandle } from '@/lib/workflow/nodeSchemas';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { NodeRunDetails } from '@/components/workflow/NodeRunDetails';
import type { FileDetail } from '@/lib/workflow/run';
import { parseModelList } from '@/lib/workflow/modelSources';

interface RightSidebarProps {
  selectedNode: Node | null;
  nodes: WorkflowNode[];
  edges: Edge[];
  onUpdateNode: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  // PC-303: per-model events from the latest run, plus the session id needed
  // to fetch per-node XML on demand. Both can be undefined / null when no
  // run has produced any data yet.
  runFileDetails?: FileDetail[];
  runSessionId?: string | null;
  // PC-704: open the Excel column picker for the given node.
  onPickColumn?: (nodeId: string) => void;
}

// Shared outer shell for any of the editor branches that operate on a
// selected node. Renders the NodeRunDetails block (which is a no-op when
// the node has no events yet) above the editor content. Keeps the three
// editor returns from each having to repeat the same wrapper markup.
function EditorShell({
  selectedNodeId,
  runFileDetails,
  runSessionId,
  children,
}: {
  selectedNodeId: string;
  runFileDetails?: FileDetail[];
  runSessionId?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-l border-gray-200 dark:border-gray-700/50 h-full overflow-y-auto">
      <NodeRunDetails
        nodeId={selectedNodeId}
        fileDetails={runFileDetails}
        sessionId={runSessionId ?? null}
      />
      <div className="p-4">{children}</div>
    </div>
  );
}

export function RightSidebar({
  selectedNode,
  nodes,
  edges,
  onUpdateNode,
  runFileDetails,
  runSessionId,
  onPickColumn,
}: RightSidebarProps) {
  // Get all variables from SetVariable nodes for dropdowns
  const allVariables = useMemo(() => {
    const vars: VariableBinding[] = [];
    nodes
      .filter((n) => n.type === 'setVariable')
      .forEach((node) => {
        const data = node.data as { variables: VariableBinding[] };
        if (data.variables) {
          vars.push(...data.variables);
        }
      });
    return vars;
  }, [nodes]);

  // Check if a parameter is wired (has incoming param edge)
  const isParamWired = (nodeId: string, paramKey: string): { wired: boolean; sourceToken?: string } => {
    const paramHandleId = getParamHandleId(paramKey);
    const incomingEdge = edges.find(
      (e) => e.target === nodeId && e.targetHandle === paramHandleId
    );
    if (incomingEdge && incomingEdge.sourceHandle) {
      const token = getTokenFromValueHandle(incomingEdge.sourceHandle);
      if (token) {
        return { wired: true, sourceToken: token };
      }
    }
    return { wired: false };
  };

  if (!selectedNode) {
    return (
      <div className="w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-l border-gray-200 dark:border-gray-700/50 h-full p-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Properties</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Select a node to edit its properties</p>
      </div>
    );
  }

  const schema = nodeSchemas[selectedNode.type as keyof typeof nodeSchemas];
  if (!schema) {
    return (
      <div className="w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-l border-gray-200 dark:border-gray-700/50 h-full overflow-y-auto">
        <div className="p-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Properties</h3>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            No schema defined for node type: {selectedNode.type}
          </div>
        </div>
      </div>
    );
  }

  const nodeData = selectedNode.data as any;

  // PC-1002: Manual Model List editor — paste-friendly textarea, one name/line.
  if (selectedNode.type === 'manualModels') {
    const rawText = (nodeData.rawText as string) ?? '';
    const modelNames = (nodeData.modelNames as string[]) ?? [];

    const handleChange = (text: string) => {
      onUpdateNode(selectedNode.id, {
        rawText: text,
        modelNames: parseModelList(text),
      } as Partial<WorkflowNodeData>);
    };

    return (
      <EditorShell
        selectedNodeId={selectedNode.id}
        runFileDetails={runFileDetails}
        runSessionId={runSessionId}
      >
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Properties</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 block">Node Type</Label>
            <p className="text-sm text-gray-600 dark:text-gray-400">{selectedNode.type}</p>
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
              Model names (one per line)
            </Label>
            <textarea
              className="w-full h-48 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-2 text-sm text-gray-800 dark:text-gray-200 font-mono resize-y"
              placeholder={'Model-A\nModel-B\nModel-C'}
              value={rawText}
              onChange={(e) => handleChange(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              {modelNames.length} model{modelNames.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </EditorShell>
    );
  }

  // PC-704: Excel Models editor — file info + the column picker. Without this
  // branch the panel was blank for this node (empty schema).
  if (selectedNode.type === 'excelModels') {
    const file = nodeData.file as File | null | undefined;
    const columnName = (nodeData.columnName as string) ?? '';
    const modelNames = (nodeData.modelNames as string[]) ?? [];

    return (
      <EditorShell
        selectedNodeId={selectedNode.id}
        runFileDetails={runFileDetails}
        runSessionId={runSessionId}
      >
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Properties</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 block">Excel file</Label>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {file ? file.name : 'No file uploaded'}
            </p>
          </div>
          {file ? (
            <div>
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 block">Model column</Label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {columnName ? (
                  <>
                    Reading <span className="text-emerald-300">{modelNames.length}</span> model
                    {modelNames.length === 1 ? '' : 's'} from{' '}
                    <span className="text-gray-800 dark:text-gray-200">&ldquo;{columnName}&rdquo;</span>
                  </>
                ) : (
                  'No column selected yet.'
                )}
              </p>
              <Button
                type="button"
                onClick={() => onPickColumn?.(selectedNode.id)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Pick column…
              </Button>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Upload an Excel file (drag it onto the canvas or use the left panel) to choose a model
              column.
            </p>
          )}
        </div>
      </EditorShell>
    );
  }

  // Render SetVariable editor
  if (selectedNode.type === 'setVariable') {
    const variables = (nodeData.variables || []) as VariableBinding[];

    const handleAddVariable = () => {
      const newVar: VariableBinding = {
        name: `var${variables.length + 1}`,
        value: '',
        scope: 'per-run',
        type: 'string',
      };
      onUpdateNode(selectedNode.id, {
        variables: [...variables, newVar],
      } as Partial<WorkflowNodeData>);
    };

    const handleRemoveVariable = (index: number) => {
      const updated = variables.filter((_, i) => i !== index);
      onUpdateNode(selectedNode.id, {
        variables: updated,
      } as Partial<WorkflowNodeData>);
    };

    const handleUpdateVariable = (index: number, field: keyof VariableBinding, value: any) => {
      const updated = [...variables];
      updated[index] = { ...updated[index], [field]: value };
      onUpdateNode(selectedNode.id, {
        variables: updated,
      } as Partial<WorkflowNodeData>);
    };

    return (
      <EditorShell
        selectedNodeId={selectedNode.id}
        runFileDetails={runFileDetails}
        runSessionId={runSessionId}
      >
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Properties</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 block">Node Type</Label>
              <p className="text-sm text-gray-600 dark:text-gray-400">{selectedNode.type}</p>
            </div>
            <div>
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 block">Variables</Label>
              <div className="space-y-3 mt-2">
                {variables.map((variable, index) => (
                  <div key={index} className="p-3 bg-gray-200/60 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-gray-600 dark:text-gray-400">Variable {index + 1}</Label>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveVariable(index)}
                        className="h-6 w-6 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Name</Label>
                      <Input
                        value={variable.name}
                        onChange={(e) => handleUpdateVariable(index, 'name', e.target.value)}
                        className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm h-8"
                        placeholder="variable_name"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Type</Label>
                      <select
                        value={variable.type ?? 'string'}
                        onChange={(e) => handleUpdateVariable(index, 'type', e.target.value as 'string' | 'number' | 'boolean')}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm h-8 rounded-md px-2"
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Value</Label>
                      {(variable.type ?? 'string') === 'boolean' ? (
                        <select
                          value={String(variable.value) === 'true' || variable.value === true ? 'true' : 'false'}
                          onChange={(e) => handleUpdateVariable(index, 'value', e.target.value === 'true')}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm h-8 rounded-md px-2"
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (variable.type ?? 'string') === 'number' ? (
                        <Input
                          type="number"
                          value={String(variable.value)}
                          onChange={(e) => handleUpdateVariable(index, 'value', e.target.value)}
                          className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm h-8"
                          placeholder="0"
                        />
                      ) : (
                        <Input
                          value={String(variable.value)}
                          onChange={(e) => handleUpdateVariable(index, 'value', e.target.value)}
                          className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm h-8"
                          placeholder="value"
                        />
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Scope</Label>
                      <select
                        value={variable.scope}
                        onChange={(e) => handleUpdateVariable(index, 'scope', e.target.value as 'per-run' | 'per-model')}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm h-8 rounded-md px-2"
                      >
                        <option value="per-run">Per Run</option>
                        <option value="per-model">Per Model</option>
                      </select>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddVariable}
                  className="w-full border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Variable
                </Button>
              </div>
            </div>
          </div>
      </EditorShell>
    );
  }

  // Render Import node editor
  if (selectedNode.type === 'import') {
    const filePathWired = isParamWired(selectedNode.id, 'filePath');

    return (
      <EditorShell
        selectedNodeId={selectedNode.id}
        runFileDetails={runFileDetails}
        runSessionId={runSessionId}
      >
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Properties</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 block">Node Type</Label>
              <p className="text-sm text-gray-600 dark:text-gray-400">{selectedNode.type}</p>
            </div>
            <div>
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 block">File Type</Label>
              <select
                value={nodeData.fileType || 'dwg'}
                onChange={(e) =>
                  onUpdateNode(selectedNode.id, {
                    fileType: e.target.value as 'ifc' | 'dwg' | 'dgn',
                  } as Partial<WorkflowNodeData>)
                }
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm h-9 rounded-md px-3"
              >
                <option value="ifc">IFC</option>
                <option value="dwg">DWG</option>
                <option value="dgn">DGN</option>
              </select>
            </div>
            <div>
              <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                File Path
                {filePathWired.wired && (
                  <span className="ml-2 text-xs text-blue-400">
                    (wired from: {filePathWired.sourceToken})
                  </span>
                )}
              </Label>
              {filePathWired.wired ? (
                <div className="p-2 bg-gray-200/60 dark:bg-gray-800/50 rounded border border-blue-600/50 text-sm text-gray-600 dark:text-gray-400">
                  Wired from: <span className="text-blue-400">{filePathWired.sourceToken}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    type="text"
                    value={nodeData.filePath || ''}
                    onChange={(e) =>
                      onUpdateNode(selectedNode.id, {
                        filePath: e.target.value,
                      } as Partial<WorkflowNodeData>)
                    }
                    className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm h-9"
                    placeholder="Enter file path or {varName}"
                  />
                  {allVariables.length > 0 && (
                    <div>
                      <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Or select variable:</Label>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            onUpdateNode(selectedNode.id, {
                              filePath: `{${e.target.value}}`,
                            } as Partial<WorkflowNodeData>);
                          }
                        }}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm h-8 rounded-md px-2"
                      >
                        <option value="">-- Select Variable --</option>
                        {allVariables.map((v, idx) => (
                          <option key={`${v.name}-${idx}`} value={v.name}>
                            {v.name} ({v.scope})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
      </EditorShell>
    );
  }

  // Generic editor for other node types
  return (
    <EditorShell
      selectedNodeId={selectedNode.id}
      runFileDetails={runFileDetails}
      runSessionId={runSessionId}
    >
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Properties</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 block">Node Type</Label>
            <p className="text-sm text-gray-600 dark:text-gray-400">{selectedNode.type}</p>
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 block">Node ID</Label>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{selectedNode.id}</p>
          </div>
          {schema.parameters.map((param) => {
            const wired = isParamWired(selectedNode.id, param.key);
            const value = nodeData[param.key] ?? param.defaultValue;

            return (
              <div key={param.key}>
                <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                  {param.label}
                  {wired.wired && (
                    <span className="ml-2 text-xs text-blue-400">
                      (wired from: {wired.sourceToken})
                    </span>
                  )}
                </Label>
                {wired.wired ? (
                  <div className="p-2 bg-gray-200/60 dark:bg-gray-800/50 rounded border border-blue-600/50 text-sm text-gray-600 dark:text-gray-400">
                    Wired from: <span className="text-blue-400">{wired.sourceToken}</span>
                  </div>
                ) : param.kind === 'select' ? (
                  <select
                    value={value}
                    onChange={(e) =>
                      onUpdateNode(selectedNode.id, {
                        [param.key]: e.target.value,
                      } as Partial<WorkflowNodeData>)
                    }
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm h-9 rounded-md px-3"
                  >
                    {param.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : param.kind === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={value === true || value === 'true'}
                    onChange={(e) =>
                      onUpdateNode(selectedNode.id, {
                        [param.key]: e.target.checked,
                      } as Partial<WorkflowNodeData>)
                    }
                    className="w-4 h-4"
                  />
                ) : (
                  <div className="space-y-2">
                    <Input
                      type={param.kind === 'number' ? 'number' : 'text'}
                      value={value}
                      onChange={(e) =>
                        onUpdateNode(selectedNode.id, {
                          [param.key]: param.kind === 'number' ? Number(e.target.value) : e.target.value,
                        } as Partial<WorkflowNodeData>)
                      }
                      className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm h-9"
                      placeholder={param.kind === 'string' ? `Enter value or {varName}` : param.label}
                    />
                    {allVariables.length > 0 && param.kind === 'string' && (
                      <div>
                        <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Or select variable:</Label>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              onUpdateNode(selectedNode.id, {
                                [param.key]: `{${e.target.value}}`,
                              } as Partial<WorkflowNodeData>);
                            }
                          }}
                          className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm h-8 rounded-md px-2"
                        >
                          <option value="">-- Select Variable --</option>
                          {allVariables.map((v, idx) => (
                            <option key={`${v.name}-${idx}`} value={v.name}>
                              {v.name} ({v.scope})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
    </EditorShell>
  );
}


