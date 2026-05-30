import * as XLSX from 'xlsx';

// PC-704 — Excel parsing helpers shared by the column picker preview and the
// model-name extraction on the ExcelModels node.
//
// These mirror the backend `_read_model_names_from_excel` in
// `backend/services/workflow_runner.py` EXACTLY. The backend re-reads the
// uploaded file at run time and is the source of truth; the frontend only sends
// the file + selected column index. So the preview's row count, "header"
// marker, and the per-model handle list must match the backend or the preview
// would misrepresent what actually runs.

// The backend `common_headers` list, verbatim. A physical row 0 whose value (in
// the selected column) matches one of these — case- and whitespace-insensitive
// — is treated as a header and excluded from the model list.
export const MODEL_HEADER_NAMES = [
  'filename',
  'name',
  'model',
  'model_name',
  'model name',
];

export function isModelHeaderValue(value: unknown): boolean {
  return MODEL_HEADER_NAMES.includes(String(value ?? '').trim().toLowerCase());
}

// Widest row wins — mirrors how pandas pads a ragged sheet to a rectangle.
function columnCount(rows: string[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

function clampColumnIndex(columnIndex: number, rows: string[][]): number {
  const count = columnCount(rows);
  if (count === 0) return 0;
  return Math.min(Math.max(columnIndex, 0), count - 1);
}

export interface ModelRowClassification {
  /** Trimmed value of the selected column in this row. */
  value: string;
  /** True when this row contributes a model name. */
  kept: boolean;
  /** True when this is physical row 0 recognized as a header (and skipped). */
  isHeader: boolean;
}

/**
 * Per-row classification for the selected column — the single source of truth
 * for which rows become model names, replicating the backend loop: trim, drop
 * empty/'nan', skip physical row 0 only when it is a known header. Both
 * `extractModelNames` and the picker's per-row markers derive from this so they
 * can never drift apart. Uses the clamped column index throughout.
 */
export function classifyModelRows(
  rows: string[][],
  columnIndex: number,
): ModelRowClassification[] {
  if (rows.length === 0) return [];
  const col = clampColumnIndex(columnIndex, rows);
  return rows.map((row, i) => {
    const value = String(row[col] ?? '').trim();
    const isHeader = i === 0 && isModelHeaderValue(value);
    const kept = !!value && value.toLowerCase() !== 'nan' && !isHeader;
    return { value, kept, isHeader };
  });
}

/**
 * Extract the model names from the selected column. Order is preserved;
 * duplicates are NOT removed (the backend doesn't dedupe either).
 */
export function extractModelNames(rows: string[][], columnIndex: number): string[] {
  return classifyModelRows(rows, columnIndex)
    .filter((c) => c.kept)
    .map((c) => c.value);
}

/**
 * Drop trailing columns that are empty in every row, mirroring pandas which
 * omits all-NaN trailing columns from the frame. Keeps the frontend column
 * count aligned with the backend so the picker can't offer a "phantom" trailing
 * column the backend would clamp away. Middle empty columns are preserved.
 */
export function trimTrailingEmptyColumns(rows: string[][]): string[][] {
  const width = columnCount(rows);
  let lastUsed = -1;
  for (let c = 0; c < width; c++) {
    if (rows.some((row) => String(row[c] ?? '').trim() !== '')) lastUsed = c;
  }
  return rows.map((row) => row.slice(0, lastUsed + 1));
}

/**
 * The trimmed row-0 label for every column, by position (blanks preserved so
 * indices stay aligned with the real sheet columns the backend reads). Length
 * equals the column count.
 */
export function columnHeaders(rows: string[][]): string[] {
  const count = columnCount(rows);
  const first = rows[0] ?? [];
  const headers: string[] = [];
  for (let i = 0; i < count; i++) headers.push(String(first[i] ?? '').trim());
  return headers;
}

/** Will physical row 0 be skipped as a header for the selected column? */
export function isHeaderRowSkipped(rows: string[][], columnIndex: number): boolean {
  if (rows.length === 0) return false;
  const col = clampColumnIndex(columnIndex, rows);
  return isModelHeaderValue(rows[0][col]);
}

/** Spreadsheet-style column label: 0->A, 25->Z, 26->AA, 27->AB, ... */
export function columnLabel(index: number): string {
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/**
 * Read the first sheet of an Excel file into a rectangular-ish string grid
 * (every row, every column, raw — no trimming). The single impure entry point;
 * the pure helpers above operate on its output.
 */
export function parseExcelToRows(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any[]>(firstSheet, {
          header: 1,
          defval: '',
        }) as any[][];
        const grid = rows.map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? '')) : []));
        // Match pandas, which drops trailing all-empty columns from the frame.
        resolve(trimTrailingEmptyColumns(grid));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
