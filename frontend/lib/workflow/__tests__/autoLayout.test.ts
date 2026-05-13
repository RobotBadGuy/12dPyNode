import { describe, expect, it } from 'vitest';
import { autoLayout } from '../autoLayout';
import type { WorkflowEdge, WorkflowNode } from '../types';

function makeNode(id: string, overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id,
    type: 'cleanModel',
    position: { x: 0, y: 0 },
    data: { label: id },
    ...overrides,
  } as WorkflowNode;
}

function makeEdge(id: string, source: string, target: string): WorkflowEdge {
  return {
    id,
    source,
    target,
    sourceHandle: 'flow:out',
    targetHandle: 'flow:in',
  } as WorkflowEdge;
}

describe('autoLayout', () => {
  it('returns [] for an empty graph', () => {
    expect(autoLayout([], [])).toEqual([]);
  });

  it('produces finite positions for a single isolated node', () => {
    const result = autoLayout([makeNode('a')], []);
    expect(result).toHaveLength(1);
    expect(Number.isFinite(result[0].position.x)).toBe(true);
    expect(Number.isFinite(result[0].position.y)).toBe(true);
  });

  it('lays out a linear chain left-to-right (LR default)', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')];
    const result = autoLayout(nodes, edges);
    const byId = Object.fromEntries(result.map((n) => [n.id, n.position]));
    expect(byId.a.x).toBeLessThan(byId.b.x);
    expect(byId.b.x).toBeLessThan(byId.c.x);
  });

  it('lays out a diamond with the join node rightmost', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')];
    const edges = [
      makeEdge('e1', 'a', 'b'),
      makeEdge('e2', 'a', 'c'),
      makeEdge('e3', 'b', 'd'),
      makeEdge('e4', 'c', 'd'),
    ];
    const result = autoLayout(nodes, edges);
    const byId = Object.fromEntries(result.map((n) => [n.id, n.position]));
    expect(byId.a.x).toBeLessThan(byId.b.x);
    expect(byId.a.x).toBeLessThan(byId.c.x);
    expect(byId.b.x).toBeLessThan(byId.d.x);
    expect(byId.c.x).toBeLessThan(byId.d.x);
    expect(byId.b.y).not.toEqual(byId.c.y);
  });

  it('handles disconnected components without throwing', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')];
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'c', 'd')];
    const result = autoLayout(nodes, edges);
    expect(result).toHaveLength(4);
    for (const n of result) {
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    }
  });

  it('preserves every non-position field on each node', () => {
    const original = makeNode('a', {
      type: 'foreachModel',
      selected: true,
      data: { label: 'A', custom: 42 } as any,
      measured: { width: 300, height: 120 },
    } as Partial<WorkflowNode>);
    const result = autoLayout([original], []);
    expect(result[0].id).toBe('a');
    expect(result[0].type).toBe('foreachModel');
    expect((result[0] as any).selected).toBe(true);
    expect(result[0].data).toEqual({ label: 'A', custom: 42 });
    expect((result[0] as any).measured).toEqual({ width: 300, height: 120 });
  });

  it('uses measured dimensions when present (wider nodes get more rank separation)', () => {
    const narrowNodes = [
      makeNode('a', { measured: { width: 100, height: 60 } } as any),
      makeNode('b', { measured: { width: 100, height: 60 } } as any),
    ];
    const wideNodes = [
      makeNode('a', { measured: { width: 600, height: 60 } } as any),
      makeNode('b', { measured: { width: 600, height: 60 } } as any),
    ];
    const edges = [makeEdge('e1', 'a', 'b')];
    const narrow = autoLayout(narrowNodes, edges);
    const wide = autoLayout(wideNodes, edges);
    const narrowSpan = narrow[1].position.x - narrow[0].position.x;
    const wideSpan = wide[1].position.x - wide[0].position.x;
    expect(wideSpan).toBeGreaterThan(narrowSpan);
  });

  it('does not throw on a self-loop edge', () => {
    const nodes = [makeNode('a')];
    const edges = [makeEdge('e1', 'a', 'a')];
    expect(() => autoLayout(nodes, edges)).not.toThrow();
    const result = autoLayout(nodes, edges);
    expect(Number.isFinite(result[0].position.x)).toBe(true);
  });

  it('skips edges whose endpoints are missing from the node list', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [
      makeEdge('e1', 'a', 'b'),
      makeEdge('e2', 'a', 'ghost'),
      makeEdge('e3', 'ghost', 'b'),
    ];
    expect(() => autoLayout(nodes, edges)).not.toThrow();
    const result = autoLayout(nodes, edges);
    const byId = Object.fromEntries(result.map((n) => [n.id, n.position]));
    expect(byId.a.x).toBeLessThan(byId.b.x);
  });

  it('supports TB direction (top-to-bottom) via options', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('e1', 'a', 'b')];
    const result = autoLayout(nodes, edges, { direction: 'TB' });
    const byId = Object.fromEntries(result.map((n) => [n.id, n.position]));
    expect(byId.a.y).toBeLessThan(byId.b.y);
  });
});
