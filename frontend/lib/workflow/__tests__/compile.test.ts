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

// A minimal valid File stub for testing
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

  it('returns error when excel node missing', () => {
    const nodes: WorkflowNode[] = [
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = compileWorkflow(nodes, []);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Excel');
    }
  });

  it('returns error when excel file not loaded', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', { file: null, modelNames: [] }),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = compileWorkflow(nodes, []);
    expect('error' in result).toBe(true);
  });

  it('returns error when foreach node missing', () => {
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
      expect(result.error).toContain('Foreach');
    }
  });

  it('returns error when chain output node missing', () => {
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
      expect(result.error).toContain('Chain File Output');
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

  it('returns errors for missing excel node', () => {
    const nodes: WorkflowNode[] = [
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = validateWorkflow(nodes, []);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Excel Models node is required');
  });

  it('returns errors for missing foreach node', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = validateWorkflow(nodes, []);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Foreach Model node is required');
  });

  it('returns errors for missing chain output node', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels'),
      makeNode('2', 'foreachModel'),
    ];
    const edges: WorkflowEdge[] = [makeEdge('1', '2')];
    const result = validateWorkflow(nodes, edges);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'At least one Chain File Output node is required',
    );
  });

  it('returns error when excel not connected to foreach', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels'),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    // No edge between excel and foreach
    const edges: WorkflowEdge[] = [makeEdge('2', '3')];
    const result = validateWorkflow(nodes, edges);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Excel Models node must connect to Foreach Model node',
    );
  });

  it('returns multiple errors when graph is empty', () => {
    const result = validateWorkflow([], []);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
