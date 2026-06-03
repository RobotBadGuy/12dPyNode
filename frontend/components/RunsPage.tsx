'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  History,
  RefreshCw,
  Download,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  FileCode2,
} from 'lucide-react';
import { listRuns, downloadRunZip, type RunSummary } from '@/lib/workflow/runsApi';
import { getWorkflowStatus, getChainPreview, type FileDetail } from '@/lib/workflow/run';
import { formatRelativeTime, formatDuration } from '@/lib/workflow/runFormat';
import { ChainPreviewModal } from '@/components/workflow/ChainPreviewModal';
import { notify } from '@/lib/notify';

interface RunsPageProps {
  onNavigate: (page: string) => void;
}

type StatusFilter = 'all' | 'completed' | 'error' | 'processing';

interface PreviewState {
  title: string;
  subtitle?: string;
  fetcher: () => Promise<string>;
  downloadFileName?: string;
}

const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  error: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  processing: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  uploaded: 'bg-gray-700/50 text-gray-400 border-gray-600/30',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? STATUS_BADGE.uploaded;
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>{status}</span>
  );
}

export function RunsPage({ onNavigate }: RunsPageProps) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRuns(await listRuns(100));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load runs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return runs.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.templateName ?? '').toLowerCase().includes(q) ||
        (r.sourceName ?? '').toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [runs, statusFilter, search]);

  const handleDownload = useCallback(async (run: RunSummary) => {
    setDownloadingId(run.id);
    try {
      const ok = await downloadRunZip(run.id);
      if (!ok) {
        notify.error("This run's files have expired", {
          description: 'Generated output is cleaned up after the retention window.',
        });
      }
    } catch (err) {
      notify.error('Download failed', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const openPreview = useCallback((run: RunSummary, model: string) => {
    setPreview({
      title: model,
      subtitle: `${run.templateName || run.sourceName || 'Run'} · chain preview`,
      fetcher: () => getChainPreview(run.id, model),
      downloadFileName: `${model}.chain`,
    });
  }, []);

  const now = Date.now();

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('editor')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            aria-label="Back to editor"
            title="Back to editor"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <History className="w-6 h-6 text-emerald-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Run History</h1>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="flex items-center gap-2 bg-gray-200/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 text-gray-800 dark:text-gray-200 text-sm px-3 py-1.5 rounded-md transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by template or file…"
            aria-label="Search runs"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-200/60 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-md text-gray-800 dark:text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
          className="text-sm bg-gray-200/60 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 rounded-md text-gray-800 dark:text-gray-200 px-2 py-1.5 focus:outline-none focus:border-emerald-500/50"
        >
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="error">Error</option>
          <option value="processing">Processing</option>
        </select>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-600 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading runs…
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-rose-400/70" />
          <p className="text-gray-700 dark:text-gray-300">{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-3 text-sm text-emerald-400 hover:text-emerald-300"
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600 dark:text-gray-400">
          <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{runs.length === 0 ? 'No runs yet.' : 'No runs match your filters.'}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              now={now}
              downloading={downloadingId === run.id}
              onDownload={handleDownload}
              onPreview={openPreview}
            />
          ))}
        </ul>
      )}

      <ChainPreviewModal
        isOpen={preview !== null}
        title={preview?.title ?? ''}
        subtitle={preview?.subtitle}
        fetcher={preview?.fetcher ?? null}
        downloadFileName={preview?.downloadFileName}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

type DetailState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; models: FileDetail[] }
  | { kind: 'error'; message: string };

interface RunRowProps {
  run: RunSummary;
  now: number;
  downloading: boolean;
  onDownload: (run: RunSummary) => void;
  onPreview: (run: RunSummary, model: string) => void;
}

function RunRow({ run, now, downloading, onDownload, onPreview }: RunRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<DetailState>({ kind: 'idle' });

  const title = run.templateName || run.sourceName || 'Untitled run';
  const duration =
    run.status === 'completed' || run.status === 'error'
      ? formatDuration(run.created_at, run.updated_at)
      : null;
  // Only a completed run has generated chains to inspect.
  const canInspect = run.status === 'completed' && (run.modelCount ?? 0) > 0;

  const toggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && detail.kind === 'idle') {
      setDetail({ kind: 'loading' });
      try {
        const status = await getWorkflowStatus(run.id);
        setDetail({ kind: 'loaded', models: status.results?.file_details ?? [] });
      } catch (err) {
        setDetail({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Could not load run details.',
        });
      }
    }
  };

  return (
    <li className="bg-gray-200/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors p-3 flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={canInspect ? toggle : undefined}
          className={`flex items-start gap-2 min-w-0 flex-1 text-left ${canInspect ? '' : 'cursor-default'}`}
          aria-expanded={canInspect ? expanded : undefined}
        >
          {canInspect ? (
            expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400 mt-0.5 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400 mt-0.5 shrink-0" />
            )
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-gray-900 dark:text-white font-semibold truncate">{title}</span>
              <StatusBadge status={run.status} />
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>{formatRelativeTime(run.created_at, now)}</span>
              {duration && <span>· {duration}</span>}
              {run.sourceName && run.templateName && (
                <span className="truncate">· {run.sourceName}</span>
              )}
              {typeof run.modelCount === 'number' && (
                <span className="inline-flex items-center gap-2">
                  · {run.modelCount} model{run.modelCount === 1 ? '' : 's'}
                  {typeof run.succeededCount === 'number' && (
                    <span className="inline-flex items-center gap-0.5 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      {run.succeededCount}
                    </span>
                  )}
                  {typeof run.failedCount === 'number' && run.failedCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-rose-400">
                      <XCircle className="w-3 h-3" />
                      {run.failedCount}
                    </span>
                  )}
                </span>
              )}
            </div>
            {run.status === 'error' && run.error && (
              <p className="text-xs font-mono text-rose-600 dark:text-rose-300/90 mt-1 break-all">{run.error}</p>
            )}
          </div>
        </button>
        {run.status === 'completed' && (
          <button
            type="button"
            onClick={() => onDownload(run)}
            disabled={downloading}
            className="shrink-0 flex items-center gap-1.5 bg-emerald-600/90 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
            title="Download the generated ZIP again"
          >
            {downloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Download
          </button>
        )}
      </div>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700/50 bg-white/40 dark:bg-gray-900/40 px-3 py-2">
          {detail.kind === 'loading' && (
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading models…
            </div>
          )}
          {detail.kind === 'error' && (
            <p className="text-xs text-rose-600 dark:text-rose-300 py-2">{detail.message}</p>
          )}
          {detail.kind === 'loaded' && detail.models.length === 0 && (
            <p className="text-xs text-gray-500 py-2">No per-model details for this run.</p>
          )}
          {detail.kind === 'loaded' && detail.models.length > 0 && (
            <ul className="space-y-1">
              {detail.models.map((m, i) => {
                const model = m.model;
                const ok = m.status === 'success';
                return (
                  <li key={model ?? i} className="flex items-center gap-2 text-xs py-0.5">
                    {ok ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    )}
                    <span className="text-gray-800 dark:text-gray-200 truncate flex-1">{model ?? '(unnamed)'}</span>
                    {ok && model && (
                      <button
                        type="button"
                        onClick={() => onPreview(run, model)}
                        className="shrink-0 inline-flex items-center gap-1 text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200"
                        title="Preview the generated chain"
                      >
                        <FileCode2 className="w-3.5 h-3.5" />
                        Preview
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
