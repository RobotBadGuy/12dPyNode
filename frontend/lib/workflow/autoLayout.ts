import dagre from 'dagre';
import type { WorkflowEdge, WorkflowNode } from './types';

export interface AutoLayoutOptions {
  direction?: 'LR' | 'TB';
  rankSep?: number;
  nodeSep?: number;
  defaultWidth?: number;
  defaultHeight?: number;
}

const DEFAULTS: Required<AutoLayoutOptions> = {
  direction: 'LR',
  rankSep: 80,
  nodeSep: 40,
  defaultWidth: 288,
  defaultHeight: 140,
};

function getDimensions(
  node: WorkflowNode,
  fallbackW: number,
  fallbackH: number,
): { width: number; height: number } {
  const measured = (node as unknown as { measured?: { width?: number; height?: number } }).measured;
  return {
    width: measured?.width ?? fallbackW,
    height: measured?.height ?? fallbackH,
  };
}

export function autoLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options?: AutoLayoutOptions,
): WorkflowNode[] {
  if (nodes.length === 0) return [];

  const opts = { ...DEFAULTS, ...options };
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: opts.direction,
    ranksep: opts.rankSep,
    nodesep: opts.nodeSep,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeIds = new Set<string>();
  for (const node of nodes) {
    const { width, height } = getDimensions(node, opts.defaultWidth, opts.defaultHeight);
    g.setNode(node.id, { width, height });
    nodeIds.add(node.id);
  }

  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const laid = g.node(node.id);
    const { width, height } = getDimensions(node, opts.defaultWidth, opts.defaultHeight);
    return {
      ...node,
      position: {
        x: laid.x - width / 2,
        y: laid.y - height / 2,
      },
    };
  });
}
