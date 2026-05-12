import { describe, it, expect } from 'vitest';
import { nodeLabel } from '../errors';
import type { WorkflowNode } from '../types';

function makeNode(
  id: string,
  type: string | undefined,
  data: Record<string, unknown> = {},
): WorkflowNode {
  return {
    id,
    type: type as WorkflowNode['type'],
    data: data as WorkflowNode['data'],
    position: { x: 0, y: 0 },
  } as WorkflowNode;
}

describe('nodeLabel', () => {
  it('prefers an explicit data.label when it is a non-empty string', () => {
    const node = makeNode('n1', 'excelModels', { label: 'Bridge models' });
    expect(nodeLabel(node)).toBe('Bridge models');
  });

  it('trims whitespace on data.label', () => {
    const node = makeNode('n1', 'excelModels', { label: '  Bridge models  ' });
    expect(nodeLabel(node)).toBe('Bridge models');
  });

  it('falls back to the palette label when data.label is empty', () => {
    const node = makeNode('n1', 'excelModels', { label: '   ' });
    expect(nodeLabel(node)).toBe('Excel Models');
  });

  it('falls back to the palette label when data.label is missing', () => {
    const node = makeNode('n1', 'foreachModel');
    expect(nodeLabel(node)).toBe('Foreach Model');
  });

  it('falls back to the raw type when the type is not in the palette', () => {
    const node = makeNode('n1', 'somethingNew');
    expect(nodeLabel(node)).toBe('somethingNew');
  });

  it('returns "(unknown node)" when there is no type at all', () => {
    const node = makeNode('n1', undefined);
    expect(nodeLabel(node)).toBe('(unknown node)');
  });
});
