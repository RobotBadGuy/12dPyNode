'use client';

import React, { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import type { FileDetail } from '@/lib/workflow/run';

export interface RunProgressPanelProps {
  fileDetails: FileDetail[];
  currentExcel: number;       // 1-based
  totalExcels: number;
  excelLabel: string;
}

// PC-907: floating bottom-right card showing live per-model progress while a
// run is in flight. Mounts when the parent has a non-null runProgress; the
// caller is responsible for unmounting once the run finishes (SuccessCelebration
// then takes over with the final tally).
export function RunProgressPanel({
  fileDetails,
  currentExcel,
  totalExcels,
  excelLabel,
}: RunProgressPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const total = fileDetails.length;
  const completed = fileDetails.filter((r) => r.status === 'success' || r.status === 'error').length;
  const succeeded = fileDetails.filter((r) => r.status === 'success').length;
  const failed = fileDetails.filter((r) => r.status === 'error').length;

  // The first queued row is the one currently being processed (run_workflow's
  // loop is in-order). All later queued rows render as inert "queued".
  const firstQueuedIndex = fileDetails.findIndex((r) => r.status === 'queued');

  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  const multiExcel = totalExcels > 1;
  const headerLabel = multiExcel
    ? `${excelLabel} (${currentExcel}/${totalExcels})`
    : excelLabel;

  return (
    <div className="fixed bottom-4 right-4 z-30 w-96 max-w-[calc(100vw-2rem)] bg-gradient-to-br from-white via-gray-100 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-200/60 dark:hover:bg-gray-800/50 transition-colors"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
          <div className="text-left min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{headerLabel}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {completed} / {total} models
              {failed > 0 && (
                <span className="text-rose-400 ml-1">· {failed} failed</span>
              )}
            </div>
          </div>
        </div>
        {collapsed ? (
          <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
        )}
      </button>

      <div
        className="h-1 bg-gray-100 dark:bg-gray-800 overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {!collapsed && (
        <ul className="max-h-72 overflow-y-auto py-1">
          {fileDetails.map((row, index) => {
            const isInProgress = index === firstQueuedIndex;
            return (
              <li
                key={`${row.model ?? '(unknown)'}-${index}`}
                className="flex items-start gap-2 px-4 py-1.5 text-sm"
              >
                <RowIcon status={row.status} inProgress={isInProgress} />
                <div className="min-w-0 flex-1">
                  <div className="text-gray-800 dark:text-gray-200 truncate">{row.model ?? '(unknown)'}</div>
                  {row.status === 'error' && row.error && (
                    <div className="text-xs font-mono text-rose-300 break-all mt-0.5">
                      {row.error}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!collapsed && total > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700/50 text-xs text-gray-600 dark:text-gray-400 flex justify-between">
          <span>{succeeded} succeeded</span>
          <span>{total - completed} queued</span>
        </div>
      )}
    </div>
  );
}

function RowIcon({
  status,
  inProgress,
}: {
  status?: FileDetail['status'];
  inProgress: boolean;
}) {
  if (status === 'success') {
    return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />;
  }
  if (status === 'error') {
    return <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />;
  }
  if (inProgress) {
    return <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0 mt-0.5" />;
  }
  return (
    <span
      aria-hidden
      className="w-4 h-4 flex items-center justify-center text-gray-500 flex-shrink-0 mt-0.5"
    >
      ·
    </span>
  );
}
