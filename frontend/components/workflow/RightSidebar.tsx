'use client';

import React, { useMemo } from 'react';
import { Node, Edge } from '@xyflow/react';
import { WorkflowNodeData, WorkflowNode, VariableBinding } from '@/lib/workflow/types';
import { nodeSchemas, getParamHandleId, getTokenFromValueHandle, isParamHandle } from '@/lib/workflow/nodeSchemas';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface RightSidebarProps {
  selectedNode: Node | null;
  nodes: WorkflowNode[];
  edges: Edge[];
  onUpdateNode: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
}

export function RightSidebar({ selectedNode, nodes, edges, onUpdateNode }: RightSidebarProps) {
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
      <div className="w-80 bg-gray-900/95 backdrop-blur-xl border-l border-gray-700/50 h-full p-4">
        <h3 className="text-lg font-bold text-white mb-2">Properties</h3>
        <p className="text-sm text-gray-400">Select a node to edit its properties</p>
      </div>
    );
  }

  const schema = nodeSchemas[selectedNode.type as keyof typeof nodeSchemas];
  if (!schema) {
    return (
      <div className="w-80 bg-gray-900/95 backdrop-blur-xl border-l border-gray-700/50 h-full overflow-y-auto">
        <div className="p-4">
          <h3 className="text-lg font-bold text-white mb-4">Properties</h3>
          <div className="text-sm text-gray-400">
            No schema defined for node type: {selectedNode.type}
          </div>
        </div>
      </div>
    );
  }

  // Get the latest node data from nodes array to ensure we have the most up-to-date data
  const currentNode = nodes.find((n) => n.id === selectedNode.id);
  const nodeData = (currentNode?.data || selectedNode.data) as any;

  // Render SetVariable editor
  if (selectedNode.type === 'setVariable') {
    const variables = (nodeData.variables || []) as VariableBinding[];

    const handleAddVariable = () => {
      const newVar: VariableBinding = {
        name: `var${variables.length + 1}`,
        value: '',
        scope: 'per-run',
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
      <div className="w-80 bg-gray-900/95 backdrop-blur-xl border-l border-gray-700/50 h-full overflow-y-auto">
        <div className="p-4">
          <h3 className="text-lg font-bold text-white mb-4">Properties</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold text-gray-300 mb-1 block">Node Type</Label>
              <p className="text-sm text-gray-400">{selectedNode.type}</p>
            </div>
            <div>
              <Label className="text-sm font-semibold text-gray-300 mb-1 block">Variables</Label>
              <div className="space-y-3 mt-2">
                {variables.map((variable, index) => (
                  <div key={index} className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-gray-400">Variable {index + 1}</Label>
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
                      <Label className="text-xs text-gray-400 mb-1 block">Name</Label>
                      <Input
                        value={variable.name}
                        onChange={(e) => handleUpdateVariable(index, 'name', e.target.value)}
                        className="bg-gray-900 border-gray-700 text-white text-sm h-8"
                        placeholder="variable_name"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400 mb-1 block">Value</Label>
                      <Input
                        value={String(variable.value)}
                        onChange={(e) => handleUpdateVariable(index, 'value', e.target.value)}
                        className="bg-gray-900 border-gray-700 text-white text-sm h-8"
                        placeholder="value"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400 mb-1 block">Scope</Label>
                      <select
                        value={variable.scope}
                        onChange={(e) => handleUpdateVariable(index, 'scope', e.target.value as 'per-run' | 'per-model')}
                        className="w-full bg-gray-900 border border-gray-700 text-white text-sm h-8 rounded-md px-2"
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
                  className="w-full border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Variable
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render ExcelModels node editor
  if (selectedNode.type === 'excelModels') {
    // Get the freshest data for this node
    const currentNode = nodes.find((n) => n.id === selectedNode.id);
    const nodeData = (currentNode?.data || selectedNode.data) as any;
    const currentFile = nodeData.file as File | null | undefined;

    // All ExcelModels nodes that currently have a file loaded
    const excelNodesWithFiles = nodes.filter(
      (n) => n.type === 'excelModels' && (n.data as any)?.file
    );

    return (
      <div className="w-80 bg-gray-900/95 backdrop-blur-xl border-l border-gray-700/50 h-full overflow-y-auto">
        <div className="p-4 space-y-4">
          <h3 className="text-lg font-bold text-white mb-2">Properties</h3>

          <div>
            <Label className="text-sm font-semibold text-gray-300 mb-1 block">Node Type</Label>
            <p className="text-sm text-gray-400">{selectedNode.type}</p>
          </div>

          <div>
            <Label className="text-sm font-semibold text-gray-300 mb-1 block">Node ID</Label>
            <p className="text-sm text-gray-400 font-mono">{selectedNode.id}</p>
          </div>

          <div>
            <Label className="text-sm font-semibold text-gray-300 mb-1 block">
              Current Excel File
            </Label>
            <p className="text-sm text-gray-400">
              {currentFile ? currentFile.name : 'No file loaded'}
            </p>
          </div>

          {excelNodesWithFiles.length > 0 && (
            <div>
              <Label className="text-sm font-semibold text-gray-300 mb-1 block">
                Change referenced file
              </Label>
              <select
                defaultValue=""
                onChange={(e) => {
                  const sourceId = e.target.value;
                  if (!sourceId) return;
                  const sourceNode = nodes.find((n) => n.id === sourceId);
                  if (!sourceNode) return;
                  const sourceData = sourceNode.data as any;
                  // Copy file + parsed Excel data from the chosen node
                  onUpdateNode(selectedNode.id, {
                    file: sourceData.file ?? null,
                    modelNames: Array.isArray(sourceData.modelNames)
                      ? sourceData.modelNames
                      : [],
                    columnName: sourceData.columnName ?? '',
                  } as Partial<WorkflowNodeData>);
                  // Reset back to placeholder
                  e.currentTarget.value = '';
                }}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm h-9 rounded-md px-3"
              >
                <option value="">-- Select loaded Excel file --</option>
                {excelNodesWithFiles.map((n) => {
                  const data = n.data as any;
                  const file = data.file as File | undefined;
                  const label = file?.name || `Excel node ${n.id}`;
                  return (
                    <option key={n.id} value={n.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Selecting a file will copy its loaded Excel data into this node.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render Import node editor
  if (selectedNode.type === 'import') {
    const actualFilePathWired = isParamWired(selectedNode.id, 'actualFilePath');

    return (
      <div className="w-80 bg-gray-900/95 backdrop-blur-xl border-l border-gray-700/50 h-full overflow-y-auto">
        <div className="p-4">
          <h3 className="text-lg font-bold text-white mb-4">Properties</h3>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold text-gray-300 mb-1 block">Node Type</Label>
              <p className="text-sm text-gray-400">{selectedNode.type}</p>
            </div>
            <div>
              <Label className="text-sm font-semibold text-gray-300 mb-1 block">File Type</Label>
              <select
                value={nodeData.fileType || 'dwg'}
                onChange={(e) =>
                  onUpdateNode(selectedNode.id, {
                    fileType: e.target.value as 'ifc' | 'dwg' | 'dgn',
                  } as Partial<WorkflowNodeData>)
                }
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm h-9 rounded-md px-3"
              >
                <option value="ifc">IFC</option>
                <option value="dwg">DWG</option>
                <option value="dgn">DGN</option>
              </select>
            </div>
            <div>
              <Label className="text-sm font-semibold text-gray-300 mb-1 block">
                Actual File Path
                {actualFilePathWired.wired && (
                  <span className="ml-2 text-xs text-blue-400">
                    (wired from: {actualFilePathWired.sourceToken})
                  </span>
                )}
              </Label>
              {actualFilePathWired.wired ? (
                <div className="p-2 bg-gray-800/50 rounded border border-blue-600/50 text-sm text-gray-400">
                  Wired from: <span className="text-blue-400">{actualFilePathWired.sourceToken}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    type="text"
                    value={nodeData.actualFilePath || ''}
                    onChange={(e) =>
                      onUpdateNode(selectedNode.id, {
                        actualFilePath: e.target.value,
                      } as Partial<WorkflowNodeData>)
                    }
                    className="bg-gray-800 border-gray-700 text-white text-sm h-9"
                    placeholder="Enter file path or variable name"
                  />
                  {allVariables.length > 0 && (
                    <div>
                      <Label className="text-xs text-gray-400 mb-1 block">Or select variable:</Label>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            const currentValue = nodeData.actualFilePath || '';
                            const varReference = `{${e.target.value}}`;
                            onUpdateNode(selectedNode.id, {
                              actualFilePath: currentValue + varReference,
                            } as Partial<WorkflowNodeData>);
                            // Reset dropdown
                            e.target.value = '';
                          }
                        }}
                        className="w-full bg-gray-800 border border-gray-700 text-white text-sm h-8 rounded-md px-2"
                      >
                        <option value="">-- Select Variable --</option>
                        {allVariables.map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name} ({v.scope})
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">Inserts {'{'}varName{'}'} reference</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Generic editor for other node types
  return (
    <div className="w-80 bg-gray-900/95 backdrop-blur-xl border-l border-gray-700/50 h-full overflow-y-auto">
      <div className="p-4">
        <h3 className="text-lg font-bold text-white mb-4">Properties</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold text-gray-300 mb-1 block">Node Type</Label>
            <p className="text-sm text-gray-400">{selectedNode.type}</p>
          </div>
          <div>
            <Label className="text-sm font-semibold text-gray-300 mb-1 block">Node ID</Label>
            <p className="text-sm text-gray-400 font-mono">{selectedNode.id}</p>
          </div>
          {schema.parameters.map((param) => {
            const wired = isParamWired(selectedNode.id, param.key);
            const value = nodeData[param.key] ?? param.defaultValue;

            return (
              <div key={param.key}>
                <Label className="text-sm font-semibold text-gray-300 mb-1 block">
                  {param.label}
                  {wired.wired && (
                    <span className="ml-2 text-xs text-blue-400">
                      (wired from: {wired.sourceToken})
                    </span>
                  )}
                </Label>
                {wired.wired ? (
                  <div className="p-2 bg-gray-800/50 rounded border border-blue-600/50 text-sm text-gray-400">
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
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm h-9 rounded-md px-3"
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
                    checked={value}
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
                      className="bg-gray-800 border-gray-700 text-white text-sm h-9"
                      placeholder={param.label}
                    />
                    {allVariables.length > 0 && param.kind === 'string' && (
                      <div>
                        <Label className="text-xs text-gray-400 mb-1 block">Or select variable:</Label>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              const currentValue = String(value || '');
                              const varReference = `{${e.target.value}}`;
                              onUpdateNode(selectedNode.id, {
                                [param.key]: currentValue + varReference,
                              } as Partial<WorkflowNodeData>);
                              // Reset dropdown
                              e.target.value = '';
                            }
                          }}
                          className="w-full bg-gray-800 border border-gray-700 text-white text-sm h-8 rounded-md px-2"
                        >
                          <option value="">-- Select Variable --</option>
                          {allVariables.map((v) => (
                            <option key={v.name} value={v.name}>
                              {v.name} ({v.scope})
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">Inserts {'{'}varName{'}'} reference</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


