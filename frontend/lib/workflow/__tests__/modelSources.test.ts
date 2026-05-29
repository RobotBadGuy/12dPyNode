import { describe, it, expect } from 'vitest';
import {
  SOURCE_NODE_TYPES,
  isSourceNode,
  getModelSource,
  isReadySource,
  hasReadyModelSource,
  parseModelList,
  firstModelForTestRun,
} from '../modelSources';
import type { WorkflowNode } from '../types';

function node(id: string, type: string, data: Record<string, unknown> = {}): WorkflowNode {
  return { id, type: type as WorkflowNode['type'], data: data as WorkflowNode['data'], position: { x: 0, y: 0 } } as WorkflowNode;
}

const file = new File(['x'], 'm.xlsx');

describe('parseModelList', () => {
  it('splits on newlines, trims, and drops blanks', () => {
    expect(parseModelList('A\n  B \n\n\r\nC')).toEqual(['A', 'B', 'C']);
  });
  it('returns [] for empty/whitespace input', () => {
    expect(parseModelList('   \n  ')).toEqual([]);
  });
});

describe('isSourceNode', () => {
  it('is true for source types and false otherwise', () => {
    expect(SOURCE_NODE_TYPES.has('excelModels')).toBe(true);
    expect(isSourceNode(node('1', 'excelModels'))).toBe(true);
    expect(isSourceNode(node('2', 'manualModels'))).toBe(true);
    expect(isSourceNode(node('3', 'foreachModel'))).toBe(false);
  });
});

describe('getModelSource', () => {
  it('resolves an excel source', () => {
    const s = getModelSource(node('1', 'excelModels', { file, modelNames: ['A'], selectedColumnIndex: 2 }));
    expect(s).toEqual({ kind: 'excel', modelNames: ['A'], file, selectedColumnIndex: 2 });
  });
  it('resolves a manual source', () => {
    const s = getModelSource(node('1', 'manualModels', { modelNames: ['A', 'B'] }));
    expect(s).toEqual({ kind: 'manual', modelNames: ['A', 'B'] });
  });
  it('returns null for a non-source node', () => {
    expect(getModelSource(node('1', 'foreachModel'))).toBeNull();
  });
});

describe('isReadySource / hasReadyModelSource', () => {
  it('excel is ready only with a file', () => {
    expect(isReadySource(node('1', 'excelModels', { file, modelNames: [] }))).toBe(true);
    expect(isReadySource(node('1', 'excelModels', { file: null, modelNames: ['A'] }))).toBe(false);
  });
  it('manual is ready only with at least one name', () => {
    expect(isReadySource(node('1', 'manualModels', { modelNames: ['A'] }))).toBe(true);
    expect(isReadySource(node('1', 'manualModels', { modelNames: [] }))).toBe(false);
  });
  it('hasReadyModelSource scans the graph and can target an id', () => {
    const nodes = [node('1', 'manualModels', { modelNames: [] }), node('2', 'manualModels', { modelNames: ['A'] })];
    expect(hasReadyModelSource(nodes)).toBe(true);
    expect(hasReadyModelSource(nodes, '1')).toBe(false);
    expect(hasReadyModelSource(nodes, '2')).toBe(true);
  });
});

describe('firstModelForTestRun', () => {
  it('returns the first name when there is no header', () => {
    expect(firstModelForTestRun(['A', 'B', 'C'])).toBe('A');
  });
  it('skips a common-header first entry (mirrors the backend)', () => {
    expect(firstModelForTestRun(['Model', 'A', 'B'])).toBe('A');
    expect(firstModelForTestRun(['Filename', 'X'])).toBe('X');
  });
  it('returns undefined for an empty list', () => {
    expect(firstModelForTestRun([])).toBeUndefined();
  });
});
