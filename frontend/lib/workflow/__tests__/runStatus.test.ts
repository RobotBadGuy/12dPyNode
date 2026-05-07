import { describe, it, expect } from 'vitest';
import { aggregateNodeStates, eventsForNode } from '../runStatus';
import type { FileDetail, NodeEvent } from '../run';

function ev(model: string, nodeId: string, status: 'success' | 'error', error?: string): NodeEvent {
  return {
    model,
    node_id: nodeId,
    node_type: 'createView',
    status,
    error: error ?? null,
  };
}

function row(model: string, status: FileDetail['status'], events?: NodeEvent[]): FileDetail {
  return {
    model,
    filename: null,
    project_folder: '/p',
    output_path: null,
    status,
    error: status === 'error' ? 'X' : null,
    node_events: events,
  };
}

describe('aggregateNodeStates', () => {
  it('returns an empty map for undefined / empty input', () => {
    expect(aggregateNodeStates(undefined).size).toBe(0);
    expect(aggregateNodeStates([]).size).toBe(0);
  });

  it('marks a node as success when every attempted model reported success and no models are queued', () => {
    const details: FileDetail[] = [
      row('A', 'success', [ev('A', 'view', 'success')]),
      row('B', 'success', [ev('B', 'view', 'success')]),
    ];
    const map = aggregateNodeStates(details);
    expect(map.get('view')).toBe('success');
  });

  it("marks a node as error when ANY model failed for it (overrides success)", () => {
    const details: FileDetail[] = [
      row('A', 'success', [ev('A', 'view', 'success')]),
      row('B', 'error', [ev('B', 'view', 'error', 'TypeError: x')]),
    ];
    expect(aggregateNodeStates(details).get('view')).toBe('error');
  });

  it("marks a node as running while models are still queued, even if completed ones succeeded", () => {
    const details: FileDetail[] = [
      row('A', 'success', [ev('A', 'view', 'success')]),
      row('B', 'queued'),
      row('C', 'queued'),
    ];
    expect(aggregateNodeStates(details).get('view')).toBe('running');
  });

  it("error wins over running (a downstream queued model can't 'unfail' a node)", () => {
    const details: FileDetail[] = [
      row('A', 'error', [ev('A', 'view', 'error', 'X: y')]),
      row('B', 'queued'),
    ];
    expect(aggregateNodeStates(details).get('view')).toBe('error');
  });

  it("doesn't surface a state for nodes that have no events yet", () => {
    const details: FileDetail[] = [
      row('A', 'success', [ev('A', 'view', 'success')]),
    ];
    const map = aggregateNodeStates(details);
    // 'view' was reported on, 'untouched' was not.
    expect(map.has('view')).toBe(true);
    expect(map.has('untouched')).toBe(false);
  });

  it('aggregates independently across multiple node ids', () => {
    const details: FileDetail[] = [
      row('A', 'success', [ev('A', 'view', 'success'), ev('A', 'clean', 'success')]),
      row('B', 'error', [ev('B', 'view', 'success'), ev('B', 'clean', 'error', 'X: y')]),
    ];
    const map = aggregateNodeStates(details);
    expect(map.get('view')).toBe('success');
    expect(map.get('clean')).toBe('error');
  });
});

describe('eventsForNode', () => {
  it('returns one entry per (model, node_id) match in input order', () => {
    const details: FileDetail[] = [
      row('A', 'success', [ev('A', 'view', 'success')]),
      row('B', 'error', [ev('B', 'view', 'error', 'X: y')]),
      row('C', 'success', [ev('C', 'other', 'success')]),
    ];
    const events = eventsForNode(details, 'view');
    expect(events).toEqual([
      { model: 'A', status: 'success', error: null },
      { model: 'B', status: 'error', error: 'X: y' },
    ]);
  });

  it('returns [] for an unknown node id', () => {
    const details: FileDetail[] = [
      row('A', 'success', [ev('A', 'view', 'success')]),
    ];
    expect(eventsForNode(details, 'no-such')).toEqual([]);
  });

  it('returns [] for undefined input', () => {
    expect(eventsForNode(undefined, 'any')).toEqual([]);
  });
});
