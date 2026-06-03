'use client';

import React, { useEffect, useState } from 'react';
import {
  FolderOpen,
  Trash2,
  X,
  FileText,
  Loader2,
  History,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  WorkflowTemplate,
  WorkflowTemplateVersion,
  WorkflowTemplateVersionSnapshot,
} from '@/lib/workflow/types';
import { fetchTemplateVersions, fetchTemplateVersion } from '@/lib/workflow/templatesApi';

interface LoadTemplateModalProps {
  isOpen: boolean;
  templates: WorkflowTemplate[];
  isLoading: boolean;
  onClose: () => void;
  onLoad: (template: WorkflowTemplate) => void;
  onDelete: (template: WorkflowTemplate) => Promise<void>;
  // PC-203: when a user clicks Restore on a version, the parent gets the
  // full snapshot and applies it to the canvas (same shape as `onLoad`).
  onRestoreVersion: (
    template: WorkflowTemplate,
    snapshot: WorkflowTemplateVersionSnapshot,
  ) => void;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface VersionListState {
  loading: boolean;
  error: string | null;
  versions: WorkflowTemplateVersion[];
  restoringVersion: number | null;
}

const EMPTY_VERSION_STATE: VersionListState = {
  loading: false,
  error: null,
  versions: [],
  restoringVersion: null,
};

export function LoadTemplateModal({
  isOpen,
  templates,
  isLoading,
  onClose,
  onLoad,
  onDelete,
  onRestoreVersion,
}: LoadTemplateModalProps) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [versionsByTemplate, setVersionsByTemplate] = useState<
    Record<string, VersionListState>
  >({});

  // The modal stays mounted across open/close cycles, so wipe transient
  // state whenever it's hidden.
  useEffect(() => {
    if (!isOpen) {
      setPendingDeleteId(null);
      setDeletingId(null);
      setExpandedHistoryId(null);
      setVersionsByTemplate({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmDelete = async (template: WorkflowTemplate) => {
    setDeletingId(template.id);
    try {
      await onDelete(template);
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  };

  const handleToggleHistory = async (template: WorkflowTemplate) => {
    if (expandedHistoryId === template.id) {
      setExpandedHistoryId(null);
      return;
    }
    setExpandedHistoryId(template.id);
    // Always refetch on expand: template.updatedAt changes when a new version
    // is saved, so a cached entry can lag behind. Cheap GET — no harm.
    setVersionsByTemplate((prev) => ({
      ...prev,
      [template.id]: { ...EMPTY_VERSION_STATE, loading: true },
    }));
    try {
      const versions = await fetchTemplateVersions(template.id);
      setVersionsByTemplate((prev) => ({
        ...prev,
        [template.id]: { ...EMPTY_VERSION_STATE, versions },
      }));
    } catch (err) {
      setVersionsByTemplate((prev) => ({
        ...prev,
        [template.id]: {
          ...EMPTY_VERSION_STATE,
          error: err instanceof Error ? err.message : 'Failed to load history',
        },
      }));
    }
  };

  const handleRestoreVersion = async (
    template: WorkflowTemplate,
    version: WorkflowTemplateVersion,
  ) => {
    setVersionsByTemplate((prev) => ({
      ...prev,
      [template.id]: {
        ...(prev[template.id] ?? EMPTY_VERSION_STATE),
        restoringVersion: version.versionNumber,
      },
    }));
    try {
      const snapshot = await fetchTemplateVersion(template.id, version.versionNumber);
      // Clear the spinner before handing off so the button doesn't appear
      // stuck if the parent leaves the modal open.
      setVersionsByTemplate((prev) => ({
        ...prev,
        [template.id]: {
          ...(prev[template.id] ?? EMPTY_VERSION_STATE),
          restoringVersion: null,
        },
      }));
      onRestoreVersion(template, snapshot);
    } catch (err) {
      setVersionsByTemplate((prev) => ({
        ...prev,
        [template.id]: {
          ...(prev[template.id] ?? EMPTY_VERSION_STATE),
          restoringVersion: null,
          error: err instanceof Error ? err.message : 'Failed to restore version',
        },
      }));
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border-2 border-blue-500/50 p-6 max-w-lg w-full max-h-[80vh] flex flex-col animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-blue-400" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Load Template</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-600 dark:text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading templates…
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No templates saved yet.</p>
              <p className="text-sm mt-1">
                Build a workflow and click <span className="text-blue-300">Save Template</span> to keep it.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {templates.map((template) => {
                const isPendingDelete = pendingDeleteId === template.id;
                const isDeleting = deletingId === template.id;
                const isHistoryOpen = expandedHistoryId === template.id;
                const historyState = versionsByTemplate[template.id] ?? EMPTY_VERSION_STATE;
                return (
                  <li
                    key={template.id}
                    className="group bg-gray-200/60 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-gray-900 dark:text-white font-semibold truncate">{template.name}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          Updated {formatRelative(template.updatedAt)} ·{' '}
                          {template.nodes?.length ?? 0} node
                          {(template.nodes?.length ?? 0) !== 1 ? 's' : ''}
                        </div>
                      </div>

                      {isPendingDelete ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            onClick={() => setPendingDeleteId(null)}
                            disabled={isDeleting}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => handleConfirmDelete(template)}
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Delete'
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => onLoad(template)}
                          >
                            Load
                          </Button>
                          <button
                            onClick={() => handleToggleHistory(template)}
                            className={`p-2 transition-colors ${
                              isHistoryOpen
                                ? 'text-blue-300'
                                : 'text-gray-600 dark:text-gray-400 hover:text-blue-300'
                            }`}
                            aria-label={`${isHistoryOpen ? 'Hide' : 'Show'} version history of ${template.name}`}
                            title="Version history"
                          >
                            {isHistoryOpen ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <History className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setPendingDeleteId(template.id)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-400 transition-colors"
                            aria-label={`Delete ${template.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isHistoryOpen && (
                      <div className="mt-3 pl-3 border-l-2 border-blue-500/30 space-y-1">
                        {historyState.loading ? (
                          <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 py-2">
                            <Loader2 className="w-3 h-3 animate-spin mr-2" />
                            Loading history…
                          </div>
                        ) : historyState.error ? (
                          <div className="text-xs text-red-400 py-2">{historyState.error}</div>
                        ) : historyState.versions.length === 0 ? (
                          <div className="text-xs text-gray-500 py-2 italic">
                            No version history yet.
                          </div>
                        ) : (
                          historyState.versions.map((version) => {
                            const isRestoring = historyState.restoringVersion === version.versionNumber;
                            return (
                              <div
                                key={version.id}
                                className="flex items-start justify-between gap-2 py-1.5 text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="text-gray-800 dark:text-gray-200">
                                    <span className="text-blue-300 font-mono">
                                      v{version.versionNumber}
                                    </span>
                                    <span className="text-gray-500"> · </span>
                                    <span className="text-gray-600 dark:text-gray-400">
                                      {formatRelative(version.createdAt)}
                                    </span>
                                    {version.author && (
                                      <>
                                        <span className="text-gray-500"> · </span>
                                        <span className="text-gray-600 dark:text-gray-400">{version.author}</span>
                                      </>
                                    )}
                                  </div>
                                  {version.message && (
                                    <div className="text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                                      {version.message}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleRestoreVersion(template, version)}
                                  disabled={isRestoring}
                                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-blue-300 hover:bg-blue-500/10 disabled:opacity-50 transition-colors"
                                  title={`Restore v${version.versionNumber}`}
                                >
                                  {isRestoring ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="w-3 h-3" />
                                  )}
                                  Restore
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
