import type { WorkflowNode, WorkflowEdge } from './types';

// PC-905 — auto-save & draft recovery.
//
// The draft is the latest working graph, persisted to localStorage so a refresh
// or crash doesn't lose in-progress work. It is cleared when work is safely
// persisted (a successful template save) or explicitly discarded, so a leftover
// draft means "you have work that wasn't saved as a template". On the next load
// app/page.tsx offers (via a modal) to restore it.
//
// The pure functions take `now` / counts as arguments (no Date / DOM inside) so
// they are deterministic and unit-testable; only the load/save/clear wrappers
// touch localStorage, and they are guarded so failures are silent no-ops.

export const DRAFT_STORAGE_KEY = 'pychain_workflow_draft';
const DRAFT_VERSION = 1;

export interface WorkflowDraft {
  version: number;
  savedAt: number; // epoch ms
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: { x: number; y: number; zoom: number };
  // The template the canvas was tracking when saved, so restore can re-link it
  // (a subsequent "Save Changes" targets the right template).
  basedOnTemplate: { id: string; name: string } | null;
}

/**
 * Build a JSON-safe draft from the current working state. Every node's
 * `data.file` is nulled first: a `File` would `JSON.stringify` to `{}` (a truthy
 * value that fools `isReadySource`), so we drop it and keep only the parsed
 * names. Excel nodes therefore restore with their structure intact but need the
 * file re-uploaded before a run — the same constraint templates already have.
 */
export function serializeDraft(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  viewport: { x: number; y: number; zoom: number },
  basedOnTemplate: { id: string; name: string } | null,
  now: number,
): WorkflowDraft {
  const cleanedNodes = nodes.map((n) => {
    const data = (n.data ?? {}) as Record<string, unknown>;
    if ('file' in data && data.file != null) {
      return { ...n, data: { ...data, file: null } };
    }
    return n;
  });
  return {
    version: DRAFT_VERSION,
    savedAt: now,
    // Deep clone via JSON so the stored draft can't share references with live
    // React state (and to drop any residual non-serialisable values).
    nodes: JSON.parse(JSON.stringify(cleanedNodes)) as WorkflowNode[],
    edges: JSON.parse(JSON.stringify(edges)) as WorkflowEdge[],
    viewport,
    basedOnTemplate,
  };
}

export function isDraftEmpty(draft: WorkflowDraft): boolean {
  return !draft.nodes || draft.nodes.length === 0;
}

/**
 * Offer a restore only when there is real work to recover (a non-empty draft)
 * AND the canvas is currently empty — never clobber a populated canvas.
 */
export function shouldOfferRestore(
  draft: WorkflowDraft | null,
  currentNodeCount: number,
): boolean {
  if (!draft || isDraftEmpty(draft)) return false;
  return currentNodeCount === 0;
}

/** Human-readable "time ago" for the restore prompt. Floors (age never rounds up). */
export function formatDraftAge(savedAt: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - savedAt) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}

export function loadDraft(): WorkflowDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkflowDraft;
    if (!parsed || parsed.version !== DRAFT_VERSION || !Array.isArray(parsed.nodes)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(draft: WorkflowDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Quota exceeded or serialization error — best-effort, never interrupt.
  }
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
