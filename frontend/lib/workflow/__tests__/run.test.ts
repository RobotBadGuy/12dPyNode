import { describe, it, expect, expectTypeOf } from 'vitest';
import { buildRunFormData } from '../run';
import type { WorkflowStatusResponse } from '../run';
import type { CompiledWorkflow } from '../types';

const baseGraph = { nodes: [], edges: [] };

describe('buildRunFormData', () => {
  it('includes excel_file + selected_column_index in excel mode', () => {
    const compiled: CompiledWorkflow = {
      excelFile: new File(['x'], 'm.xlsx'),
      modelNames: ['A'],
      selectedColumnIndex: 2,
      graph: baseGraph,
      variables: [],
    };
    const fd = buildRunFormData(compiled);
    expect(fd.has('excel_file')).toBe(true);
    expect(fd.get('selected_column_index')).toBe('2');
    expect(fd.has('workflow_graph')).toBe(true);
    expect(fd.has('variables')).toBe(true);
  });

  it('omits excel_file in manual mode and carries modelNames in the graph', () => {
    const compiled: CompiledWorkflow = {
      modelNames: ['A', 'B'],
      graph: { ...baseGraph, modelNames: ['A', 'B'] },
      variables: [],
    };
    const fd = buildRunFormData(compiled);
    expect(fd.has('excel_file')).toBe(false);
    expect(fd.has('selected_column_index')).toBe(false);
    expect(fd.has('workflow_graph')).toBe(true);
  });

  it('throws when there is neither an excel file nor manual names', () => {
    const compiled: CompiledWorkflow = {
      modelNames: [],
      graph: baseGraph,
      variables: [],
    };
    expect(() => buildRunFormData(compiled)).toThrow(/model source/i);
  });
});

describe('WorkflowStatusResponse type', () => {
  it('accepts the legacy shape (no PC-302 fields)', () => {
    const legacy: WorkflowStatusResponse = {
      status: 'completed',
      results: {
        files: ['A.chain'],
        file_details: [
          {
            filename: 'A.chain',
            project_folder: '/proj',
            output_path: '/abs/A.chain',
          },
        ],
        zip_path: '/abs/zip',
        summary: { total_files: 1, project_folder: '/proj' },
      },
    };
    expectTypeOf(legacy).toEqualTypeOf<WorkflowStatusResponse>();
  });

  it('accepts the PC-302 shape with model/status/error and counts', () => {
    const next: WorkflowStatusResponse = {
      status: 'completed',
      results: {
        files: ['A.chain'],
        file_details: [
          {
            model: 'A',
            filename: 'A.chain',
            project_folder: '/proj',
            output_path: '/abs/A.chain',
            status: 'success',
            error: null,
          },
          {
            model: 'B',
            filename: null,
            project_folder: '/proj',
            output_path: null,
            status: 'error',
            error: 'FileNotFoundError: missing.dwg',
          },
        ],
        zip_path: '/abs/zip',
        summary: {
          total_files: 1,
          succeeded_count: 1,
          failed_count: 1,
          project_folder: '/proj',
        },
      },
    };
    expectTypeOf(next).toEqualTypeOf<WorkflowStatusResponse>();
  });
});
