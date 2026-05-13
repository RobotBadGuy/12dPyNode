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
    const width = node.measured?.width ?? opts.defaultWidth;
    const height = node.measured?.height ?? opts.defaultHeight;
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
    return {
      ...node,
      position: {
        x: laid.x - laid.width / 2,
        y: laid.y - laid.height / 2,
      },
    };
  });
}
