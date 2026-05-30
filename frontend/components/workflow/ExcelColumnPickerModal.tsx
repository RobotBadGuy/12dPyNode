'use client';

import React, { useEffect, useState } from 'react';
import { X, Table2, Loader2 } from 'lucide-react';
import {
  parseExcelToRows,
  extractModelNames,
  classifyModelRows,
  columnHeaders,
  isHeaderRowSkipped,
  columnLabel,
} from '@/lib/workflow/excelPreview';

// PC-704 — visual Excel column picker. Reads the uploaded file on open, shows a
// scrollable preview, and lets the user click a column header to choose the
// model-name column. The skipped header row and the live model count mirror the
// backend exactly (via lib/workflow/excelPreview), so the preview = what runs.

const MAX_PREVIEW_ROWS = 12;

interface ExcelColumnPickerModalProps {
  isOpen: boolean;
  fileName?: string;
  file: File | null;
  selectedColumnIndex: number;
  onClose: () => void;
  onSelect: (columnIndex: number) => void;
}

export function ExcelColumnPickerModal({
  isOpen,
  fileName,
  file,
  selectedColumnIndex,
  onClose,
  onSelect,
}: ExcelColumnPickerModalProps) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(selectedColumnIndex);

  // Read the file whenever the modal opens (or the file changes). Guarded so a
  // resolve from a stale open can't clobber a newer one.
  useEffect(() => {
    if (!isOpen || !file) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRows(null);
    setPending(selectedColumnIndex);
    parseExcelToRows(file)
      .then((parsed) => {
        if (cancelled) return;
        setRows(parsed);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not read this Excel file.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, file, selectedColumnIndex]);

  // Escape-to-close, scoped to the open lifetime.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const headers = rows ? columnHeaders(rows) : [];
  const headerSkipped = rows ? isHeaderRowSkipped(rows, pending) : false;
  const modelCount = rows ? extractModelNames(rows, pending).length : 0;
  const selectedLabel = headers[pending] || (headers.length ? columnLabel(pending) : '');
  const previewRows = rows ? rows.slice(0, MAX_PREVIEW_ROWS) : [];

  // Per-row classification shared with extractModelNames (one source of truth —
  // no drift between the footer count and the per-row `#` markers, and the
  // column index is clamped the same way).
  const classifications = rows ? classifyModelRows(rows, pending) : [];
  // Running model number: increments only for kept rows, so the user sees
  // exactly which rows become models (and which are skipped as header/blank).
  let modelNo = 0;
  const rowLabel = (rowIndex: number): string => {
    const c = classifications[rowIndex];
    if (c?.kept) return String(++modelNo);
    if (c?.isHeader) return 'hdr';
    return '·';
  };

  const commit = () => {
    onSelect(pending);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pick model column"
    >
      <div
        className="w-full max-w-3xl mx-4 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
          <div className="flex items-center gap-2 min-w-0">
            <Table2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white">Pick model column</h2>
              {fileName && <p className="text-xs text-gray-400 truncate">{fileName}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close column picker"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-auto">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Reading spreadsheet…
            </div>
          )}
          {error && !loading && (
            <p className="text-sm text-rose-300 py-8 text-center">{error}</p>
          )}
          {!loading && !error && rows && headers.length === 0 && (
            <p className="text-sm text-gray-400 py-8 text-center">This sheet appears to be empty.</p>
          )}
          {!loading && !error && rows && headers.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mb-2">
                Click a column header to use it for model names.
              </p>
              <div className="overflow-x-auto rounded-md border border-gray-700/50">
                <table className="text-[11px] border-collapse w-full">
                  <thead>
                    <tr>
                      <th className="px-2 py-1.5 text-gray-500 font-medium border-b border-gray-700/50 sticky left-0 bg-gray-900">
                        #
                      </th>
                      {headers.map((h, i) => {
                        const isSel = i === pending;
                        return (
                          <th key={i} className="border-b border-gray-700/50 p-0">
                            <button
                              type="button"
                              onClick={() => setPending(i)}
                              className={`w-full h-full px-3 py-1.5 text-left transition-colors ${
                                isSel
                                  ? 'bg-emerald-500/20 text-emerald-200'
                                  : 'text-gray-300 hover:bg-gray-800'
                              }`}
                              title={`Use column ${columnLabel(i)}${h ? ` (${h})` : ''}`}
                            >
                              <span className="block text-[10px] uppercase tracking-wide text-gray-500">
                                {columnLabel(i)}
                              </span>
                              <span className="block font-semibold truncate max-w-[160px]">
                                {h || '—'}
                              </span>
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, r) => {
                      const skipped = r === 0 && headerSkipped;
                      return (
                        <tr
                          key={r}
                          className={skipped ? 'opacity-50' : 'hover:bg-gray-800/40'}
                        >
                          <td
                            className={`px-2 py-1 text-right tabular-nums border-b border-gray-800/60 sticky left-0 bg-gray-900 ${
                              skipped ? 'text-amber-300/70' : 'text-gray-500'
                            }`}
                            title={skipped ? 'Header row — skipped' : undefined}
                          >
                            {rowLabel(r)}
                          </td>
                          {headers.map((_, i) => (
                            <td
                              key={i}
                              className={`px-3 py-1 border-b border-gray-800/60 truncate max-w-[200px] ${
                                i === pending
                                  ? 'bg-emerald-500/10 text-emerald-100'
                                  : 'text-gray-300'
                              } ${skipped ? 'line-through' : ''}`}
                            >
                              {row[i] ?? ''}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length > MAX_PREVIEW_ROWS && (
                <p className="text-[11px] text-gray-500 mt-2">
                  Showing first {MAX_PREVIEW_ROWS} of {rows.length} rows.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-700/50">
          <p className="text-sm text-gray-300">
            {rows && headers.length > 0 ? (
              <>
                <span className="text-emerald-300 font-semibold">{modelCount}</span> model
                {modelCount === 1 ? '' : 's'} from{' '}
                <span className="text-gray-100">&ldquo;{selectedLabel}&rdquo;</span>
              </>
            ) : (
              <span className="text-gray-500">&nbsp;</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-sm text-gray-300 hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={!rows || headers.length === 0}
              className="px-4 py-1.5 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              Use column
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
