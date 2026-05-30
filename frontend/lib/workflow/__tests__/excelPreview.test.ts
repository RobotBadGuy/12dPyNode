import { describe, it, expect } from 'vitest';
import {
  MODEL_HEADER_NAMES,
  isModelHeaderValue,
  extractModelNames,
  classifyModelRows,
  trimTrailingEmptyColumns,
  columnHeaders,
  isHeaderRowSkipped,
  columnLabel,
} from '../excelPreview';

// PC-704 — these helpers must mirror the backend `_read_model_names_from_excel`
// (workflow_runner.py) byte-for-byte: read column N with no header promotion,
// trim, drop empty/'nan', and skip ONLY physical row 0 when it is a known
// header. The backend re-reads the file at run time, so any drift here makes the
// preview lie about what will actually run.

describe('isModelHeaderValue', () => {
  it('matches the backend common-header list, case- and space-insensitively', () => {
    for (const h of MODEL_HEADER_NAMES) {
      expect(isModelHeaderValue(h)).toBe(true);
      expect(isModelHeaderValue(`  ${h.toUpperCase()}  `)).toBe(true);
    }
  });
  it('rejects non-header values', () => {
    expect(isModelHeaderValue('NWP-01')).toBe(false);
    expect(isModelHeaderValue('models')).toBe(false); // plural is not in the list
    expect(isModelHeaderValue('')).toBe(false);
    expect(isModelHeaderValue(null)).toBe(false);
  });
});

describe('extractModelNames', () => {
  it('skips row 0 when it is a known header for the selected column', () => {
    const rows = [['model_name'], ['A'], ['B']];
    expect(extractModelNames(rows, 0)).toEqual(['A', 'B']);
  });

  it('keeps row 0 when it is NOT a known header', () => {
    const rows = [['NWP-01'], ['NWP-02']];
    expect(extractModelNames(rows, 0)).toEqual(['NWP-01', 'NWP-02']);
  });

  it('drops blank and nan values (case-insensitive) and trims', () => {
    const rows = [['model'], [' A '], [''], ['NaN'], ['   '], ['B']];
    expect(extractModelNames(rows, 0)).toEqual(['A', 'B']);
  });

  it('preserves order and does NOT dedupe (matches the backend)', () => {
    const rows = [['model'], ['A'], ['B'], ['A']];
    expect(extractModelNames(rows, 0)).toEqual(['A', 'B', 'A']);
  });

  it('reads the selected column, and the header skip is column-specific', () => {
    // Row 0: col 0 is a known header (skipped); col 1 ("deck_w") is not.
    const rows = [
      ['model_name', 'deck_w'],
      ['A', '12.5'],
      ['B', '13.0'],
    ];
    expect(extractModelNames(rows, 0)).toEqual(['A', 'B']);
    expect(extractModelNames(rows, 1)).toEqual(['deck_w', '12.5', '13.0']);
  });

  it('clamps an out-of-range column index to the last column', () => {
    const rows = [['model_name', 'x'], ['A', 'y']];
    expect(extractModelNames(rows, 99)).toEqual(['x', 'y']);
  });

  it('treats a short row (missing the selected cell) as blank/dropped', () => {
    const rows = [['model_name', 'deck_w'], ['A'], ['B', 'b2']];
    // col 1: row0 "deck_w" kept (not a header), row1 missing -> dropped, row2 "b2".
    expect(extractModelNames(rows, 1)).toEqual(['deck_w', 'b2']);
  });

  it('only skips PHYSICAL row 0 (a header-looking value in row 1+ is kept)', () => {
    const rows = [[''], ['model'], ['A']];
    // row0 blank -> dropped by the blank check; row1 "model" is index 1, not 0,
    // so NOT skipped -> kept. (Mirrors the backend i==0 quirk exactly.)
    expect(extractModelNames(rows, 0)).toEqual(['model', 'A']);
  });

  it('returns [] for an empty grid', () => {
    expect(extractModelNames([], 0)).toEqual([]);
  });
});

describe('classifyModelRows', () => {
  it('flags the header row and kept rows for the selected column', () => {
    const rows = [['model_name', 'deck_w'], ['A', '1'], ['', '2'], ['B', '3']];
    expect(classifyModelRows(rows, 0)).toEqual([
      { value: 'model_name', kept: false, isHeader: true },
      { value: 'A', kept: true, isHeader: false },
      { value: '', kept: false, isHeader: false },
      { value: 'B', kept: true, isHeader: false },
    ]);
  });

  it('is the single source of truth: extractModelNames equals the kept values', () => {
    const rows = [['model'], ['A'], ['nan'], ['B'], ['A']];
    const kept = classifyModelRows(rows, 0).filter((c) => c.kept).map((c) => c.value);
    expect(extractModelNames(rows, 0)).toEqual(kept);
    expect(kept).toEqual(['A', 'B', 'A']);
  });

  it('returns [] for an empty grid', () => {
    expect(classifyModelRows([], 0)).toEqual([]);
  });
});

describe('trimTrailingEmptyColumns', () => {
  it('drops trailing all-empty columns (matches pandas dropping all-NaN tail columns)', () => {
    const rows = [['model_name', '', ''], ['A', '', ''], ['B', '', '']];
    expect(trimTrailingEmptyColumns(rows)).toEqual([['model_name'], ['A'], ['B']]);
  });

  it('preserves a middle empty column (only trailing emptiness is trimmed)', () => {
    const rows = [['a', '', 'c'], ['1', '', '3']];
    expect(trimTrailingEmptyColumns(rows)).toEqual([['a', '', 'c'], ['1', '', '3']]);
  });

  it('leaves a fully-populated grid unchanged', () => {
    const rows = [['a', 'b'], ['1', '2']];
    expect(trimTrailingEmptyColumns(rows)).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('collapses an all-empty grid to empty rows', () => {
    expect(trimTrailingEmptyColumns([['', ''], ['', '']])).toEqual([[], []]);
  });

  it('returns [] for an empty grid', () => {
    expect(trimTrailingEmptyColumns([])).toEqual([]);
  });
});

describe('columnHeaders', () => {
  it('returns trimmed row-0 labels by position, including blanks, length = column count', () => {
    const rows = [['model_name', '', 'skew'], ['A', '1', '2']];
    expect(columnHeaders(rows)).toEqual(['model_name', '', 'skew']);
  });

  it('handles ragged rows by using the widest row for the column count', () => {
    const rows = [['a'], ['x', 'y', 'z']];
    expect(columnHeaders(rows)).toEqual(['a', '', '']);
  });

  it('returns [] for an empty grid', () => {
    expect(columnHeaders([])).toEqual([]);
  });
});

describe('isHeaderRowSkipped', () => {
  it('is true only when row 0 of the selected column is a known header', () => {
    const rows = [['model_name', 'deck_w'], ['A', '1']];
    expect(isHeaderRowSkipped(rows, 0)).toBe(true);
    expect(isHeaderRowSkipped(rows, 1)).toBe(false);
  });
  it('is false for an empty grid', () => {
    expect(isHeaderRowSkipped([], 0)).toBe(false);
  });
});

describe('columnLabel', () => {
  it('produces spreadsheet-style labels beyond Z', () => {
    expect(columnLabel(0)).toBe('A');
    expect(columnLabel(25)).toBe('Z');
    expect(columnLabel(26)).toBe('AA');
    expect(columnLabel(27)).toBe('AB');
    expect(columnLabel(51)).toBe('AZ');
    expect(columnLabel(52)).toBe('BA');
  });
});
