'use client';
import React from 'react';
import { FileInput, X } from 'lucide-react';
import type { ChainImportReport as Report } from '@/lib/workflow/chainImport';

interface Props {
  report: Report;
  fileName: string;
  onClose: () => void;
}

// PC-1101 — summary shown after importing a .chain: how many commands became
// real nodes, what was placeholdered, and the resolved-literal caveat.
export function ChainImportReport({ report, fileName, onClose }: Props) {
  const placeholderTotal = report.placeholders.reduce((s, p) => s + p.count, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <FileInput className="w-5 h-5 text-emerald-500" /> Imported {fileName}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Reconstructed <strong>{report.mapped}</strong> of <strong>{report.total}</strong> commands as nodes.
        </p>
        {placeholderTotal > 0 && (
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            <p>
              {placeholderTotal} command{placeholderTotal === 1 ? '' : 's'} couldn&rsquo;t be mapped and were
              kept as sticky-note placeholders (raw XML preserved):
            </p>
            <ul className="mt-1 list-disc pl-5">
              {report.placeholders.map((p) => (
                <li key={p.element}>
                  <code>{p.element}</code> &times;{p.count}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          Values are this chain&rsquo;s resolved literals. Attach a model source (Excel / Model&nbsp;List) and
          re-introduce variables to re-template.
        </p>
      </div>
    </div>
  );
}
