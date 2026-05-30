'use client';

import React, { useEffect } from 'react';
import { History, X } from 'lucide-react';

interface RestoreDraftModalProps {
  isOpen: boolean;
  nodeCount: number;
  ageLabel: string; // pre-formatted, e.g. "5 minutes ago"
  onRestore: () => void;
  onDiscard: () => void;
  // Esc / backdrop: keep the draft and decide later (does NOT discard).
  onDismiss: () => void;
}

// PC-905 — shown on load when an unsaved working session is found. Restore
// re-applies it; Discard deletes it; dismissing (Esc/backdrop) keeps it.
export function RestoreDraftModal({
  isOpen,
  nodeCount,
  ageLabel,
  onRestore,
  onDiscard,
  onDismiss,
}: RestoreDraftModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onDismiss]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Restore previous session"
    >
      <div
        className="w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Restore previous session?</h2>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5">
          <p className="text-sm text-gray-300">
            We found unsaved work from{' '}
            <span className="text-gray-100">{ageLabel}</span> —{' '}
            <span className="text-emerald-300 font-semibold">{nodeCount}</span> node
            {nodeCount === 1 ? '' : 's'}. Restore it to the canvas?
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Excel files need to be re-uploaded after restoring.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-700/50">
          <button
            type="button"
            onClick={onDiscard}
            className="px-3 py-1.5 rounded-md text-sm text-rose-300 hover:bg-rose-500/10 transition-colors"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onRestore}
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}
