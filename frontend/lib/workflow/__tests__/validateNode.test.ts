import { describe, it, expect } from 'vitest';
import { validateNode } from '../compile';
import { WorkflowNode, WorkflowEdge } from '../types';

function makeNode(type: string, data: Record<string, unknown> = {}): WorkflowNode {
  return {
    id: `${type}_1`,
    type,
    position: { x: 0, y: 0 },
    data,
  } as unknown as WorkflowNode;
}

describe('validateNode', () => {
  it('setVariable with a value that does not match its type warns', () => {
    const node = makeNode('setVariable', {
      variables: [{ name: 'depth', value: 'abc', scope: 'per-run', type: 'number' }],
    });
    const warnings = validateNode(node, [node], []);
    expect(warnings.some((w) => w.includes('depth') && w.includes('number'))).toBe(true);
  });

  it('setVariable with a matching typed value does not warn', () => {
    const node = makeNode('setVariable', {
      variables: [{ name: 'depth', value: '1.5', scope: 'per-run', type: 'number' }],
    });
    const warnings = validateNode(node, [node], []);
    expect(warnings.some((w) => w.includes('depth'))).toBe(false);
  });

  it('setVariable with no type (legacy) never warns on coercion', () => {
    const node = makeNode('setVariable', {
      variables: [{ name: 'x', value: 'anything', scope: 'per-run' }],
    });
    const warnings = validateNode(node, [node], []);
    expect(warnings.some((w) => w.includes('x'))).toBe(false);
  });

  it('warns when excelModels has no file', () => {
    const node = makeNode('excelModels', { file: null });
    expect(validateNode(node, [node], [])).toContain('No Excel file loaded');
  });

  it('does not warn when excelModels has a file', () => {
    const fakeFile = new File([''], 'test.xlsx');
    const node = makeNode('excelModels', {
      file: fakeFile,
      selectedColumnIndex: 0,
    });
    expect(validateNode(node, [node], [])).toEqual([]);
  });

  it('warns on chainFileOutput when modelName and projectFolder are empty', () => {
    const node = makeNode('chainFileOutput', {
      modelName: '',
      projectFolder: '',
      modelType: 'Model',
    });
    const warnings = validateNode(node, [node], []);
    expect(warnings).toContain('Model name is required');
    expect(warnings).toContain('Project folder is required');
  });

  it('clears chainFileOutput warnings when both fields are filled', () => {
    const node = makeNode('chainFileOutput', {
      modelName: 'Bench',
      projectFolder: 'project',
      modelType: 'Model',
    });
    expect(validateNode(node, [node], [])).toEqual([]);
  });

  it('warns when a schema-defined param is empty and has no incoming edge', () => {
    const node = makeNode('drapeToTin', {
      dataToDrape: '',
      zOffset: '0',
      tinName: '',
    });
    const warnings = validateNode(node, [node], []);
    expect(warnings.some((w) => w.includes('Data to Drape'))).toBe(true);
    expect(warnings.some((w) => w.includes('TIN Name'))).toBe(true);
  });

  it('does not warn for a param when an incoming param edge satisfies it', () => {
    const node = makeNode('drapeToTin', {
      dataToDrape: '',
      zOffset: '0',
      tinName: 'mainSurface',
    });
    const edges: WorkflowEdge[] = [
      {
        id: 'e1',
        source: 'src',
        target: node.id,
        sourceHandle: 'value:linesData',
        targetHandle: 'param:dataToDrape',
      } as unknown as WorkflowEdge,
    ];
    const warnings = validateNode(node, [node], edges);
    expect(warnings.some((w) => w.includes('Data to Drape'))).toBe(false);
  });

  it('returns empty array for a fully-configured node', () => {
    const node = makeNode('cleanModel', {
      modelName: 'Bench',
      commandName: 'Clean model',
      comments: 'note',
      continueOnFailure: true,
    });
    expect(validateNode(node, [node], [])).toEqual([]);
  });
});
