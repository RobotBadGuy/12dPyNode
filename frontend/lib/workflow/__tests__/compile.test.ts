import { describe, it, expect } from 'vitest';
import { compileWorkflow, validateWorkflow } from '../compile';
import type { WorkflowNode, WorkflowEdge } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────

function makeNode(
  id: string,
  type: string,
  data: Record<string, unknown> = {},
): WorkflowNode {
  return {
    id,
    type: type as WorkflowNode['type'],
    data: data as WorkflowNode['data'],
    position: { x: 0, y: 0 },
  } as WorkflowNode;
}

function makeEdge(source: string, target: string): WorkflowEdge {
  return { id: `${source}-${target}`, source, target } as WorkflowEdge;
}

const fakeFile = new File(['col1\nA\nB'], 'models.xlsx', {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});

// ── compileWorkflow ────────────────────────────────────────────────────

describe('compileWorkflow', () => {
  it('returns compiled workflow for valid graph', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', {
        file: fakeFile,
        modelNames: ['M1', 'M2'],
        selectedColumnIndex: 0,
      }),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const edges: WorkflowEdge[] = [makeEdge('1', '2'), makeEdge('2', '3')];

    const result = compileWorkflow(nodes, edges);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.modelNames).toEqual(['M1', 'M2']);
      expect(result.excelFile).toBe(fakeFile);
      expect(result.graph.nodes).toHaveLength(3);
      expect(result.variables).toEqual([]);
    }
  });

  it('returns "Load an Excel file" when no excel node has a file', () => {
    const nodes: WorkflowNode[] = [
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = compileWorkflow(nodes, []);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.title).toBe('Load an Excel file');
      expect(result.error.fix).toMatch(/upload area/);
      expect(result.error.focusNodeId).toBeUndefined();
    }
  });

  it('returns "Load an Excel file" with focusNodeId when the excel node is present but file is missing', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', { file: null, modelNames: [] }),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = compileWorkflow(nodes, []);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.title).toBe('Load an Excel file');
      expect(result.error.focusNodeId).toBe('1');
      expect(result.error.message).toContain('Excel Models');
    }
  });

  it('returns "Excel file has no model column" when modelNames is empty', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', {
        file: fakeFile,
        modelNames: [],
        selectedColumnIndex: 0,
      }),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = compileWorkflow(nodes, []);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.title).toBe('Excel file has no model column');
      expect(result.error.focusNodeId).toBe('1');
      expect(result.error.fix).toMatch(/pick the column/i);
    }
  });

  it('returns "Add a Foreach Model node" when foreach is missing', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', {
        file: fakeFile,
        modelNames: ['M1'],
        selectedColumnIndex: 0,
      }),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = compileWorkflow(nodes, []);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.title).toBe('Add a Foreach Model node');
    }
  });

  it('returns "Add a Chain File Output node" when chain output is missing', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', {
        file: fakeFile,
        modelNames: ['M1'],
        selectedColumnIndex: 0,
      }),
      makeNode('2', 'foreachModel'),
    ];
    const result = compileWorkflow(nodes, []);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.title).toBe('Add a Chain File Output node');
    }
  });

  it('extracts variables from setVariable nodes', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', {
        file: fakeFile,
        modelNames: ['M1'],
        selectedColumnIndex: 0,
      }),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
      makeNode('4', 'setVariable', {
        variables: [
          { name: 'project_folder', value: 'C:\\Projects', scope: 'per-run' },
        ],
      }),
    ];
    const edges: WorkflowEdge[] = [makeEdge('1', '2'), makeEdge('2', '3')];

    const result = compileWorkflow(nodes, edges);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('project_folder');
    }
  });
});

// ── validateWorkflow ───────────────────────────────────────────────────

describe('validateWorkflow', () => {
  it('returns valid for complete graph', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels'),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const edges: WorkflowEdge[] = [makeEdge('1', '2'), makeEdge('2', '3')];

    const result = validateWorkflow(nodes, edges);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns "Add an Excel Models node" for missing excel node', () => {
    const nodes: WorkflowNode[] = [
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = validateWorkflow(nodes, []);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.title)).toContain(
      'Add an Excel Models node',
    );
  });

  it('returns "Add a Foreach Model node" for missing foreach', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = validateWorkflow(nodes, []);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.title)).toContain(
      'Add a Foreach Model node',
    );
  });

  it('returns "Add a Chain File Output node" for missing chain output', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels'),
      makeNode('2', 'foreachModel'),
    ];
    const edges: WorkflowEdge[] = [makeEdge('1', '2')];
    const result = validateWorkflow(nodes, edges);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.title)).toContain(
      'Add a Chain File Output node',
    );
  });

  it('returns "Excel isn\'t wired to Foreach" with focusNodeId when the edge is missing', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels'),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const edges: WorkflowEdge[] = [makeEdge('2', '3')];
    const result = validateWorkflow(nodes, edges);
    expect(result.valid).toBe(false);
    const wiringError = result.errors.find((e) =>
      e.title.includes("isn't wired"),
    );
    expect(wiringError).toBeDefined();
    expect(wiringError?.focusNodeId).toBe('2');
    expect(wiringError?.message).toContain('Excel Models');
    expect(wiringError?.message).toContain('Foreach Model');
  });

  it('names nodes by their user-set data.label in the wiring error', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', { label: 'Bridge models' }),
      makeNode('2', 'foreachModel', { label: 'Each bridge' }),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = validateWorkflow(nodes, []);
    const wiringError = result.errors.find((e) =>
      e.title.includes("isn't wired"),
    );
    expect(wiringError?.message).toContain('Bridge models');
    expect(wiringError?.message).toContain('Each bridge');
  });

  it('returns multiple errors when graph is empty', () => {
    const result = validateWorkflow([], []);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    for (const err of result.errors) {
      expect(typeof err.title).toBe('string');
      expect(typeof err.message).toBe('string');
    }
  });
});
