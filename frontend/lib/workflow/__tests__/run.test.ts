import { describe, it, expectTypeOf } from 'vitest';
import type { WorkflowStatusResponse } from '../run';

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
