'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Copy, Download, Loader2, Check, FileCode2 } from 'lucide-react';
import { notify } from '@/lib/notify';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'loaded'; text: string }
  | { kind: 'error'; message: string };

export interface ChainPreviewModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  // Called once when the modal opens; returns the text to display. The caller
  // sets this on the action (not every render) so its identity is stable.
  fetcher: (() => Promise<string>) | null;
  // Filename for the "Download" button; defaults to preview.txt.
  downloadFileName?: string;
  onClose: () => void;
}

// PC-304 — generic text-preview modal. Used for whole-file chain previews
// (getChainPreview) and per-node XML slices (getNodeXml). Owns its fetch so
// callers just provide a fetcher + labels.
export function ChainPreviewModal({
  isOpen,
  title,
  subtitle,
  fetcher,
  downloadFileName,
  onClose,
}: ChainPreviewModalProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // Move focus into the dialog on open and restore it to the trigger on close.
  // (A full Tab focus-trap is left to a shared modal primitive — consistent with
  // the app's other dialogs.)
  useEffect(() => {
    if (!isOpen) return;
    lastFocusedRef.current = (document.activeElement as HTMLElement | null) ?? null;
    containerRef.current?.focus();
    return () => {
      lastFocusedRef.current?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !fetcher) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    setCopied(false);
    fetcher()
      .then((text) => {
        if (!cancelled) setState({ kind: 'loaded', text });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ kind: 'error', message: err instanceof Error ? err.message : 'Failed to load' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, fetcher]);

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

  const text = state.kind === 'loaded' ? state.text : '';
  const hasText = state.kind === 'loaded' && text.length > 0;

  const handleCopy = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      notify.error('Clipboard is unavailable on this connection');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify.error('Could not copy to clipboard');
    }
  };

  const handleDownload = () => {
    // Strip path separators / Windows-reserved characters so a model name or
    // node label can't mangle (or silently truncate) the download filename.
    const safeName =
      (downloadFileName || 'preview.txt').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'preview.txt';
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = safeName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="w-full max-w-3xl mx-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700/50">
          <div className="flex items-center gap-2 min-w-0">
            <FileCode2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">{title}</h2>
              {subtitle && <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!hasText}
              className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-40 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!hasText}
              className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-40 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-auto p-4">
          {state.kind === 'loading' && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 py-10">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          )}
          {state.kind === 'error' && (
            <p className="text-sm text-rose-300 py-10 text-center">{state.message}</p>
          )}
          {state.kind === 'loaded' && (
            <pre className="text-[11px] font-mono text-gray-800 dark:text-gray-200 whitespace-pre overflow-auto">
              {text || '(no content)'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
