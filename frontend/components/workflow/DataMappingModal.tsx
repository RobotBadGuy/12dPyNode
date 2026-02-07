'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    X,
    GripVertical,
    Type,
    Hash,
    Brackets,
    List,
    ArrowRight,
    Database,
    Layers,
    Trash2
} from 'lucide-react';
import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable,
    DragStartEvent,
    DragEndEvent,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import { WorkflowNode, WorkflowEdge } from '@/lib/workflow/types';
import { nodeSchemas } from '@/lib/workflow/nodeSchemas';
import { cn } from '@/lib/utils';

interface DataMappingModalProps {
    isOpen: boolean;
    onClose: () => void;
    nodeId: string | null;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    onSave: (nodeId: string, updates: { data: any }) => void;
}

interface DataItem {
    id: string;
    label: string;
    type: 'text' | 'number' | 'array' | 'object';
    token: string;
    isList?: boolean;
}

interface NodeVariable {
    key: string;
    label: string;
    type: string;
    currentValue: string;
    mappedToken?: string;
}

export function DataMappingModal({
    isOpen,
    onClose,
    nodeId,
    nodes,
    edges,
    onSave
}: DataMappingModalProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeItem, setActiveItem] = useState<DataItem | null>(null);

    // Local state for mappings (buffer before save)
    const [localMappings, setLocalMappings] = useState<Record<string, string>>({});
    const [localValues, setLocalValues] = useState<Record<string, string>>({});

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor)
    );

    const targetNode = useMemo(() =>
        nodes.find(n => n.id === nodeId),
        [nodes, nodeId]);

    const sourceNodes = useMemo(() => {
        if (!nodeId) return [];
        // Find all edges connected to the target node
        // We want all predecessors, regardless of specific handle, to show their outputs
        const connectedEdges = edges.filter(e => e.target === nodeId);
        const sourceNodeIds = new Set(connectedEdges.map(e => e.source));
        return nodes.filter(n => sourceNodeIds.has(n.id));
    }, [nodes, edges, nodeId]);

    // Load initial state when node opens
    useEffect(() => {
        if (targetNode) {
            // Load existing mappings
            // @ts-ignore - mappings might not exist on type yet if not updated fully
            setLocalMappings(targetNode.data.mappings || {});

            // Initialize local values from node data
            const schema = nodeSchemas[targetNode.type];
            const values: Record<string, string> = {};

            if (targetNode.type === 'setVariable') {
                // Initialize from variables array
                const variables = ((targetNode.data as any).variables as any[]) || [];
                const safeVars = Array.isArray(variables) ? variables : [];
                safeVars.forEach((v, index) => {
                    values[`var-${index}`] = typeof v.value === 'string' ? v.value : JSON.stringify(v.value);
                });
            } else {
                // Standard schema initialization
                if (schema) {
                    schema.parameters.forEach(param => {
                        // Skip 'variables' param for SetVariable node to avoid overwrite
                        if (param.key === 'variables' && targetNode.type === 'setVariable') return;

                        // @ts-ignore
                        values[param.key] = targetNode.data[param.key] !== undefined
                            // @ts-ignore
                            ? String(targetNode.data[param.key])
                            : String(param.defaultValue ?? '');
                    });
                }
            }

            setLocalValues(values);
        }
    }, [targetNode, isOpen]);

    // Determine Incoming Data based on Source Node Type
    const incomingData = useMemo((): (DataItem & { sourceId: string })[] => {
        if (sourceNodes.length === 0) return [];

        const allItems: (DataItem & { sourceId: string })[] = [];

        sourceNodes.forEach(sourceNode => {
            const items: (DataItem & { sourceId: string })[] = [];

            // Rule 1: ExcelModels -> Returns Array of Models
            if (sourceNode.type === 'excelModels') {
                items.push({
                    id: `source-models-${sourceNode.id}`,
                    label: 'Model Names List',
                    type: 'array',
                    token: `{{ ${sourceNode.id}.models }}`,
                    isList: true,
                    sourceId: sourceNode.id
                });
            }

            // Rule 2: ForeachModel -> Returns Iterator Item Context
            else if (sourceNode.type === 'foreachModel') {
                items.push({
                    id: `iterator-item-${sourceNode.id}`,
                    label: 'Current Model Name',
                    type: 'text',
                    token: `{{ ${sourceNode.id}.item }}`,
                    isList: false,
                    sourceId: sourceNode.id
                });
                items.push({
                    id: `iterator-var-${sourceNode.id}`,
                    label: 'Current Modified Variable',
                    type: 'text',
                    token: `{{ ${sourceNode.id}.modified_variable }}`,
                    isList: false,
                    sourceId: sourceNode.id
                });
            }

            // Rule 3: SetVariable -> Returns user-defined variables
            else if (sourceNode.type === 'setVariable') {
                const variables = ((sourceNode.data as any).variables as any[]) || [];
                const safeVars = Array.isArray(variables) ? variables : [];
                safeVars.forEach((v, index) => {
                    if (v.name) {
                        items.push({
                            id: `var-${sourceNode.id}-${index}`,
                            label: v.name,
                            type: 'text', // Variables are usually treated as text
                            token: `{{ ${sourceNode.id}.${v.name} }}`,
                            isList: false,
                            sourceId: sourceNode.id
                        });
                    }
                });
            }

            // Generic Fallback
            const schema = nodeSchemas[sourceNode.type];
            if (schema?.valueOutputs) {
                schema.valueOutputs.forEach(output => {
                    items.push({
                        id: `output-${output.id}-${sourceNode.id}`,
                        label: output.label,
                        type: 'text',
                        token: `{{ ${sourceNode.id}.${output.token} }}`,
                        isList: false,
                        sourceId: sourceNode.id
                    });
                });
            }

            allItems.push(...items);
        });

        return allItems;
    }, [sourceNodes]);

    // Target Node Parameters
    const targetParams = useMemo((): NodeVariable[] => {
        if (!targetNode) return [];

        // Special handling for SetVariableNode
        if (targetNode.type === 'setVariable') {
            const variables = ((targetNode.data as any).variables as any[]) || [];
            // Safe cast to array if corrupted
            const safeVars = Array.isArray(variables) ? variables : [];

            return safeVars.map((v, index) => ({
                key: `var-${index}`,
                label: v.name || `Variable ${index + 1}`,
                type: 'string',
                currentValue: localValues[`var-${index}`] ?? v.value ?? '',
                mappedToken: undefined // SetVariable values are stored directly
            }));
        }

        const schema = nodeSchemas[targetNode.type];
        if (!schema) return [];

        return schema.parameters.map(param => {
            // Skip complex types that we can't map easily (like the variables list itself if schema still says so)
            if (param.key === 'variables' && targetNode.type === 'setVariable') return null;

            return {
                key: param.key,
                label: param.label,
                type: param.kind,
                currentValue: localValues[param.key] || '',
                mappedToken: localMappings[param.key]
            };
        }).filter(p => p !== null) as NodeVariable[];
    }, [targetNode, localValues, localMappings]);

    const handleDragStart = (event: DragStartEvent) => {
        const item = incomingData.find(i => i.id === event.active.id);
        if (item) {
            setActiveId(item.id);
            setActiveItem(item);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { over } = event;

        if (over && activeItem) {
            const paramKey = over.id as string;

            // Append token to current value
            const currentVal = localValues[paramKey] || '';
            const newVal = currentVal + (currentVal ? ' ' : '') + activeItem.token;

            handleValueChange(paramKey, newVal);

            // We also update localMappings just to keep track, but the value is the primary source now
            const newMappings = { ...localMappings, [paramKey]: activeItem.token };
            setLocalMappings(newMappings);
        }

        setActiveId(null);
        setActiveItem(null);
    };

    const handleRemoveMapping = (paramKey: string) => {
        handleValueChange(paramKey, '');

        const newMappings = { ...localMappings };
        delete newMappings[paramKey];
        setLocalMappings(newMappings);
    };

    const handleValueChange = (paramKey: string, value: string) => {
        setLocalValues(prev => ({ ...prev, [paramKey]: value }));
    };

    // Initialize local values
    useEffect(() => {
        if (targetNode) {
            // Load existing mappings
            // @ts-ignore
            setLocalMappings(targetNode.data.mappings || {});

            const values: Record<string, string> = {};

            if (targetNode.type === 'setVariable') {
                // Initialize from variables array
                const variables = ((targetNode.data as any).variables as any[]) || [];
                const safeVars = Array.isArray(variables) ? variables : [];
                safeVars.forEach((v, index) => {
                    values[`var-${index}`] = typeof v.value === 'string' ? v.value : JSON.stringify(v.value);
                });
            } else {
                // Standard schema initialization
                const schema = nodeSchemas[targetNode.type];
                if (schema) {
                    schema.parameters.forEach(param => {
                        // Skip 'variables' param for SetVariable node to avoid overwrite
                        if (param.key === 'variables' && targetNode.type === 'setVariable') return;

                        // @ts-ignore
                        values[param.key] = targetNode.data[param.key] !== undefined
                            // @ts-ignore
                            ? String(targetNode.data[param.key])
                            : String(param.defaultValue ?? '');
                    });
                }
            }

            setLocalValues(values);
        }
    }, [targetNode, isOpen]);

    const handleSaveInternal = () => {
        if (!targetNode || !nodeId) return;

        let updates: any = {};

        if (targetNode.type === 'setVariable') {
            // Reconstruct variables array
            const variables = ((targetNode.data as any).variables as any[]) || [];
            const safeVars = Array.isArray(variables) ? variables : [];

            const newVars = safeVars.map((v, index) => ({
                ...v,
                value: localValues[`var-${index}`] ?? v.value
            }));

            updates = {
                data: {
                    ...targetNode.data,
                    variables: newVars,
                }
            };
        } else {
            // Merge values and mappings into node data
            updates = {
                data: {
                    ...targetNode.data,
                    ...localValues, // Save manual values
                    mappings: localMappings // Save mappings
                }
            };
        }

        onSave(nodeId, updates);
        onClose();
    };

    if (!isOpen || !targetNode || !nodeId) return null;

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'text': return <Type className="w-4 h-4 text-blue-400" />;
            case 'number': return <Hash className="w-4 h-4 text-purple-400" />;
            case 'array': return <List className="w-4 h-4 text-orange-400" />;
            case 'object': return <Brackets className="w-4 h-4 text-green-400" />;
            default: return <Database className="w-4 h-4 text-slate-400" />;
        }
    };

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Modal */}
                <div className="relative bg-[#0f111a] rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col border border-slate-700/50 overflow-hidden ring-1 ring-white/10">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-[#161b2e]">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20">
                                <Layers className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-lg text-white font-semibold tracking-tight">Configure Node</h2>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <span className="font-mono text-slate-300">{targetNode.id}</span>
                                    <span>•</span>
                                    <span>{nodeSchemas[targetNode.type]?.parameters.length || 0} Parameters</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-700/50 rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 flex overflow-hidden text-slate-200">
                        {/* Left Panel - Source Data */}
                        <div className="w-1/3 border-r border-slate-700/50 flex flex-col bg-[#111420]">
                            <div className="px-6 py-4 border-b border-slate-700/30 bg-[#161b2e]/50">
                                <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <Database className="w-4 h-4 text-emerald-400" />
                                    Input Data
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    {sourceNodes.length} source nodeQuery(s) connected
                                </p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                {incomingData.length === 0 ? (
                                    <div className="text-center py-10 px-4">
                                        <p className="text-slate-500 text-sm">No mappable data found.</p>
                                        {sourceNodes.length === 0 && (
                                            <p className="text-xs text-slate-600 mt-2">Connect a node (SetVariable, etc.) to see its outputs here.</p>
                                        )}
                                    </div>
                                ) : (
                                    sourceNodes.map(node => {
                                        const nodeItems = incomingData.filter(i => i.sourceId === node.id);
                                        if (nodeItems.length === 0) return null;

                                        return (
                                            <div key={node.id} className="space-y-2">
                                                <div className="flex items-center justify-between px-2">
                                                    <p className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider truncate max-w-[200px]" title={node.id}>
                                                        {(node.data as any).label || node.type}
                                                    </p>
                                                    <span className="text-[10px] text-slate-600 font-mono">{node.id.slice(0, 8)}...</span>
                                                </div>
                                                {nodeItems.map((item) => (
                                                    <SourceVariableItem key={item.id} item={item} icon={getTypeIcon(item.type)} />
                                                ))}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Right Panel - Target Parameters */}
                        <div className="w-2/3 flex flex-col bg-[#0f111a]">
                            <div className="px-6 py-4 border-b border-slate-700/30 bg-[#161b2e]/50">
                                <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <List className="w-4 h-4 text-blue-400" />
                                    Parameters
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Drag variables from the left to map them to parameters below.
                                </p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="grid grid-cols-1 gap-6 max-w-3xl">
                                    {targetParams.map((param) => (
                                        <DroppableParameter
                                            key={param.key}
                                            param={param}
                                            onRemoveMapping={() => handleRemoveMapping(param.key)}
                                            onValueChange={(val) => handleValueChange(param.key, val)}
                                        />
                                    ))}

                                    {targetParams.length === 0 && (
                                        <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-lg">
                                            <p className="text-slate-500">This node has no configurable parameters.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700/50 bg-[#161b2e]">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveInternal}
                            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-500/20 text-sm font-medium active:scale-95"
                        >
                            Save Configuration
                        </button>
                    </div>
                </div>
            </div>

            <DragOverlay>
                {activeItem ? (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#2a3044] border border-blue-500/50 shadow-2xl scale-105 cursor-grabbing ring-2 ring-blue-500/30 z-[60]">
                        <GripVertical className="w-4 h-4 text-slate-400" />
                        <span className="text-white text-sm font-medium">{activeItem.label}</span>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

function SourceVariableItem({ item, icon }: { item: DataItem, icon: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: item.id,
        data: item
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg cursor-grab group",
                "bg-slate-800/40 border border-slate-700/50 hover:border-slate-600 transition-all",
                "hover:bg-slate-800 hover:shadow-md",
                isDragging ? "opacity-40 grayscale" : "opacity-100"
            )}
        >
            <GripVertical className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
            <div className="p-1.5 rounded bg-slate-900/50 border border-slate-700/50 group-hover:border-slate-600 transition-colors">
                {icon}
            </div>
            <div className="flex flex-col min-w-0">
                <span className="text-slate-200 text-sm font-medium truncate">{item.label}</span>
                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[150px]">{item.token}</span>
            </div>
        </div>
    );
}

function DroppableParameter({
    param,
    onRemoveMapping,
    onValueChange,
}: {
    param: NodeVariable,
    onRemoveMapping: () => void,
    onValueChange: (val: string) => void,
}) {
    const { isOver, setNodeRef } = useDroppable({
        id: param.key,
    });

    // Check if current value contains any tokens (basic check)
    const hasTokens = param.currentValue.includes('{{') && param.currentValue.includes('}}');

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300 pl-1">{param.label}</label>
                <div className="flex items-center gap-2">
                    {hasTokens && (
                        <span className="text-[10px] text-blue-400 flex items-center gap-1">
                            <Brackets className="w-3 h-3" /> Expresion
                        </span>
                    )}
                    <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50">
                        {param.type}
                    </span>
                </div>
            </div>

            <div
                ref={setNodeRef}
                className={cn(
                    "relative min-h-[48px] rounded-lg transition-all duration-200",
                    isOver ? "ring-2 ring-blue-500/50 bg-blue-500/5" : ""
                )}
            >
                <div className="relative group">
                    <input
                        type="text"
                        value={param.currentValue}
                        onChange={(e) => onValueChange(e.target.value)}
                        className={cn(
                            "w-full h-12 px-4 rounded-lg bg-slate-900/50 border border-slate-700 text-sm text-white placeholder-slate-600 transition-all font-mono",
                            "focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50",
                            "group-hover:border-slate-600",
                            hasTokens ? "text-blue-300" : ""
                        )}
                        placeholder="Enter value or drop variable..."
                    />
                    {!param.currentValue && !isOver && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
