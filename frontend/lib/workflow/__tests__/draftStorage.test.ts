// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  DRAFT_STORAGE_KEY,
  serializeDraft,
  isDraftEmpty,
  shouldOfferRestore,
  formatDraftAge,
  loadDraft,
  saveDraft,
  clearDraft,
  type WorkflowDraft,
} from '../draftStorage';
import type { WorkflowEdge, WorkflowNode } from '../types';

function node(id: string, data: Record<string, unknown> = {}): WorkflowNode {
  return {
    id,
    type: 'cleanModel',
    position: { x: 0, y: 0 },
    data: data as WorkflowNode['data'],
  } as WorkflowNode;
}

const viewport = { x: 1, y: 2, zoom: 1.5 };

afterEach(() => {
  window.localStorage.clear();
});

describe('serializeDraft', () => {
  it('nulls every node File so it never round-trips to {} while keeping parsed data', () => {
    const excel = node('e', {
      file: new File(['x'], 'models.xlsx'),
      modelNames: ['A', 'B'],
      columnName: 'model',
      selectedColumnIndex: 0,
    });
    const draft = serializeDraft([excel], [], viewport, null, 1000);
    const d = draft.nodes[0].data as Record<string, unknown>;
    expect(d.file).toBeNull();
    expect(d.modelNames).toEqual(['A', 'B']);
    expect(d.columnName).toBe('model');
    // Confirm it is JSON-safe (a real File would serialize to "{}").
    expect(() => JSON.stringify(draft)).not.toThrow();
    expect(JSON.parse(JSON.stringify(draft)).nodes[0].data.file).toBeNull();
  });

  it('stamps version/savedAt and records the basedOnTemplate + viewport', () => {
    const draft = serializeDraft([node('a')], [], viewport, { id: 't1', name: 'Bridge' }, 4242);
    expect(draft.version).toBe(1);
    expect(draft.savedAt).toBe(4242);
    expect(draft.basedOnTemplate).toEqual({ id: 't1', name: 'Bridge' });
    expect(draft.viewport).toEqual(viewport);
  });

  it('leaves non-Excel nodes untouched (no spurious file key churn)', () => {
    const draft = serializeDraft([node('a', { label: 'X' })], [], viewport, null, 1);
    expect(draft.nodes[0].data).toEqual({ label: 'X' });
  });

  it('preserves edges', () => {
    const edge = { id: 'x', source: 'a', target: 'b' } as WorkflowEdge;
    const draft = serializeDraft([node('a'), node('b')], [edge], viewport, null, 1);
    expect(draft.edges).toEqual([edge]);
  });
});

describe('isDraftEmpty', () => {
  it('is true only when there are no nodes', () => {
    expect(isDraftEmpty(serializeDraft([], [], viewport, null, 1))).toBe(true);
    expect(isDraftEmpty(serializeDraft([node('a')], [], viewport, null, 1))).toBe(false);
  });
});

describe('shouldOfferRestore', () => {
  const nonEmpty = serializeDraft([node('a')], [], viewport, null, 1);
  const empty = serializeDraft([], [], viewport, null, 1);

  it('offers only a non-empty draft onto an empty canvas', () => {
    expect(shouldOfferRestore(nonEmpty, 0)).toBe(true);
  });
  it('never clobbers a populated canvas', () => {
    expect(shouldOfferRestore(nonEmpty, 3)).toBe(false);
  });
  it('does not offer an empty draft', () => {
    expect(shouldOfferRestore(empty, 0)).toBe(false);
  });
  it('does not offer a null draft', () => {
    expect(shouldOfferRestore(null, 0)).toBe(false);
  });
});

describe('formatDraftAge', () => {
  const now = 10_000_000_000;
  it('buckets by seconds/minutes/hours/days with floor semantics', () => {
    expect(formatDraftAge(now - 30_000, now)).toBe('just now'); // 30s
    expect(formatDraftAge(now, now)).toBe('just now'); // 0s
    expect(formatDraftAge(now + 5_000, now)).toBe('just now'); // clock skew -> clamped
    expect(formatDraftAge(now - 60_000, now)).toBe('1 minute ago');
    expect(formatDraftAge(now - 90_000, now)).toBe('1 minute ago'); // floor, not round
    expect(formatDraftAge(now - 50 * 60_000, now)).toBe('50 minutes ago');
    expect(formatDraftAge(now - 3_600_000, now)).toBe('1 hour ago');
    expect(formatDraftAge(now - 2 * 3_600_000, now)).toBe('2 hours ago');
    expect(formatDraftAge(now - 2 * 86_400_000, now)).toBe('2 days ago');
  });
});

describe('loadDraft / saveDraft / clearDraft', () => {
  it('round-trips a draft through localStorage', () => {
    const draft = serializeDraft([node('a', { label: 'X' })], [], viewport, { id: 't', name: 'N' }, 7);
    saveDraft(draft);
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull();
    expect(loadDraft()).toEqual(draft);
  });

  it('clearDraft removes the entry', () => {
    saveDraft(serializeDraft([node('a')], [], viewport, null, 1));
    clearDraft();
    expect(loadDraft()).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(loadDraft()).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, 'not json{');
    expect(loadDraft()).toBeNull();
  });

  it('returns null for an unknown version', () => {
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ version: 999, savedAt: 1, nodes: [node('a')], edges: [], viewport, basedOnTemplate: null }),
    );
    expect(loadDraft()).toBeNull();
  });

  it('returns null when the stored shape is malformed (nodes not an array)', () => {
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ version: 1, savedAt: 1, nodes: 'oops', edges: [], viewport, basedOnTemplate: null }),
    );
    expect(loadDraft()).toBeNull();
  });
});
