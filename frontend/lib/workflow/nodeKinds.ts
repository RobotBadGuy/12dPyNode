// The node types that shape the graph but emit no XML themselves. Mirrors
// `control_flow_types` in backend/services/workflow_runner.py. Disabling one
// of these is nonsensical, so the context menu hides "Disable" for them.
export const CONTROL_FLOW_NODE_TYPES = new Set<string>([
  'excelModels',
  'foreachModel',
  'chainFileOutput',
  'setVariable',
]);

export function isControlFlowNode(type?: string): boolean {
  return !!type && CONTROL_FLOW_NODE_TYPES.has(type);
}
