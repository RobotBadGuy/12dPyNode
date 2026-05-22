import { describe, it, expect } from 'vitest';
import { duplicateNode, removeNode, setNodeDisabled } from '../nodeOps';
import type { WorkflowNode, WorkflowEdge } from '../types';

function node(id: string, type = 'import', extra: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id,
    type: type as WorkflowNode['type'],
    position: { x: 100, y: 200 },
    data: { fileType: 'dwg' } as WorkflowNode['data'],
    ...extra,
  } as WorkflowNode;
}
function edge(source: string, target: string): WorkflowEdge {
  return { id: `${source}-${target}`, source, target } as WorkflowEdge;
}

describe('duplicateNode', () => {
  it('clones with a new id, +40/+40 offset, selected, data preserved', () => {
    const original = node('a');
    const copy = duplicateNode(original, () => 'new-id');
    expect(copy.id).toBe('new-id');
    expect(copy.position).toEqual({ x: 140, y: 240 });
    expect(copy.selected).toBe(true);
    expect(copy.data).toEqual(original.data);
    expect(copy.type).toBe(original.type);
  });

  it('does not mutate or alias the original node data', () => {
    const original = node('a');
    const copy = duplicateNode(original, () => 'new-id');
    (copy.data as Record<string, unknown>).fileType = 'ifc';
    expect((original.data as Record<string, unknown>).fileType).toBe('dwg');
    expect(original.position).toEqual({ x: 100, y: 200 });
  });
});

describe('removeNode', () => {
  it('drops the node and exactly the edges touching it', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('a', 'c')];
    const result = removeNode(nodes, edges, 'b');
    expect(result.nodes.map((n) => n.id)).toEqual(['a', 'c']);
    expect(result.edges.map((e) => e.id)).toEqual(['a-c']);
  });
});

describe('setNodeDisabled', () => {
  it('sets the disabled flag on the target node only', () => {
    const nodes = [node('a'), node('b')];
    const result = setNodeDisabled(nodes, 'b', true);
    expect(result.find((n) => n.id === 'b')!.data.disabled).toBe(true);
    expect(result.find((n) => n.id === 'a')!.data.disabled).toBeUndefined();
  });

  it('can clear the disabled flag', () => {
    const nodes = [node('a', 'import', { data: { disabled: true } as WorkflowNode['data'] })];
    const result = setNodeDisabled(nodes, 'a', false);
    expect(result[0].data.disabled).toBe(false);
  });
});
