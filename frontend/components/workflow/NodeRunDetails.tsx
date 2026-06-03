'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, ChevronDown, ChevronRight, FileCode2, Loader2 } from 'lucide-react';
import { eventsForNode } from '@/lib/workflow/runStatus';
import { getNodeXml, type FileDetail } from '@/lib/workflow/run';

interface NodeRunDetailsProps {
  nodeId: string;
  fileDetails: FileDetail[] | undefined;
  // Session id for the most recent run; required to fetch per-node XML.
  // Null means there is no completed-or-running session yet, in which case
  // the panel renders nothing.
  sessionId: string | null;
}

// PC-303 — render per-model events for one selected node, plus a fold-out
// XML viewer that fetches /api/workflow/node-xml on demand. Lives in the
// right sidebar above the schema editor.
export function NodeRunDetails({ nodeId, fileDetails, sessionId }: NodeRunDetailsProps) {
  const events = useMemo(() => eventsForNode(fileDetails, nodeId), [fileDetails, nodeId]);

  if (events.length === 0) {
    return null;
  }

  const succeeded = events.filter((e) => e.status === 'success').length;
  const failed = events.filter((e) => e.status === 'error').length;

  return (
    <div className="border-b border-gray-200 dark:border-gray-700/50 px-4 py-3 bg-white/40 dark:bg-gray-900/40">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Run Details</h4>
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {succeeded} ✓
          {failed > 0 && <span className="text-rose-400 ml-2">{failed} ✗</span>}
        </div>
      </div>

      <ul className="space-y-1 max-h-64 overflow-y-auto">
        {events.map((e) => (
          <ModelRow
            key={e.model}
            model={e.model}
            status={e.status}
            error={e.error}
            nodeId={nodeId}
            sessionId={sessionId}
          />
        ))}
      </ul>
    </div>
  );
}

interface ModelRowProps {
  model: string;
  status: 'success' | 'error';
  error?: string | null;
  nodeId: string;
  sessionId: string | null;
}

function ModelRow({ model, status, error, nodeId, sessionId }: ModelRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [xmlState, setXmlState] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'loaded'; text: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const handleViewXml = async () => {
    if (!sessionId) return;
    setXmlState({ kind: 'loading' });
    try {
      const text = await getNodeXml(sessionId, model, nodeId);
      setXmlState({ kind: 'loaded', text });
    } catch (err) {
      setXmlState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to load XML',
      });
    }
  };

  const isError = status === 'error';

  return (
    <li className="rounded border border-gray-200 dark:border-gray-700/40 bg-gray-200/60 dark:bg-gray-800/40">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-200/60 dark:hover:bg-gray-800/60 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-gray-600 dark:text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-400 flex-shrink-0" />
        )}
        {isError ? (
          <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        )}
        <span className="text-xs text-gray-800 dark:text-gray-200 truncate flex-1">{model}</span>
      </button>

      {expanded && (
        <div className="px-2 pb-2 pt-1 space-y-2">
          {isError && error && (
            <div className="text-xs font-mono text-rose-300 break-all bg-rose-500/10 border border-rose-500/30 rounded px-2 py-1">
              {error}
            </div>
          )}
          {sessionId && (
            <div>
              {(xmlState.kind === 'idle' || xmlState.kind === 'error') && (
                <button
                  type="button"
                  onClick={handleViewXml}
                  className="text-xs text-blue-300 hover:text-blue-200 inline-flex items-center gap-1"
                >
                  <FileCode2 className="w-3 h-3" />
                  {xmlState.kind === 'error' ? 'Retry View XML' : 'View XML'}
                </button>
              )}
              {xmlState.kind === 'loading' && (
                <span className="text-xs text-gray-600 dark:text-gray-400 inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading…
                </span>
              )}
              {xmlState.kind === 'loaded' && (
                <pre className="text-[10px] font-mono text-gray-800 dark:text-gray-200 bg-white/70 dark:bg-gray-950/70 border border-gray-200 dark:border-gray-700 rounded p-2 max-h-48 overflow-auto whitespace-pre">
                  {xmlState.text || '(no XML emitted by this node)'}
                </pre>
              )}
              {xmlState.kind === 'error' && (
                <div className="mt-1 text-xs text-rose-300">{xmlState.message}</div>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
