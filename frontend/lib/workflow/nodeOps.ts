import type { WorkflowNode, WorkflowEdge } from './types';

/**
 * Clone a single node for "Duplicate": fresh id (from the injected factory),
 * offset by +40/+40 so it doesn't sit exactly on the original, and selected so
 * the user can immediately drag it. Deep-cloned so nested data isn't aliased.
 */
export function duplicateNode(node: WorkflowNode, makeId: () => string): WorkflowNode {
  const clone = structuredClone(node);
  return {
    ...clone,
    id: makeId(),
    position: { x: node.position.x + 40, y: node.position.y + 40 },
    selected: true,
  };
}

/** Remove a node and every edge that references it (as source or target). */
export function removeNode(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  nodeId: string,
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  return {
    nodes: nodes.filter((n) => n.id !== nodeId),
    edges: edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
  };
}

/** Return a new node list with `disabled` set on the target node only. */
export function setNodeDisabled(
  nodes: WorkflowNode[],
  nodeId: string,
  disabled: boolean,
): WorkflowNode[] {
  return nodes.map((n) =>
    n.id === nodeId ? { ...n, data: { ...n.data, disabled } } : n,
  );
}
