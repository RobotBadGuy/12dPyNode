'use client';

import { createContext, useContext } from 'react';
import { NodeType, WorkflowNode } from '@/lib/workflow/types';
import { isReadySource } from '@/lib/workflow/modelSources';

/**
 * PC-1003: lets the in-node ▶ "run" button (rendered inside source-node
 * components) invoke the page-level run handler. Threading a callback through
 * `node.data` would be memo-unsafe and would leak a non-serializable function
 * into template snapshots, so we use a small context instead. Provided once in
 * `app/page.tsx`; consumed via the `useSourceRunButton` hook below.
 */
export interface WorkflowRunContextValue {
  /** Run the chain from a single source node, identified by its id. */
  onRunFromSource: (nodeId: string) => void;
  /** Graph-level precondition: a Foreach Model and a Chain File Output exist. */
  canRun: boolean;
  /** A run is currently in flight (global lock — disables every ▶). */
  isRunning: boolean;
}

const WorkflowRunContext = createContext<WorkflowRunContextValue>({
  onRunFromSource: () => {},
  canRun: false,
  isRunning: false,
});

export const WorkflowRunProvider = WorkflowRunContext.Provider;

export function useWorkflowRun(): WorkflowRunContextValue {
  return useContext(WorkflowRunContext);
}

/**
 * PC-1003: shared logic for a source node's ▶ run button, so `excelModels` and
 * `manualModels` stay in sync. Centralizes the readiness check, the disabled
 * gate, and the tooltip. `notReadyMessage` is the source-specific hint shown
 * when the node itself has no models yet (e.g. no Excel file / no names).
 */
export function useSourceRunButton(
  id: string,
  type: NodeType,
  data: Record<string, unknown>,
  notReadyMessage: string,
): { onRun: () => void; runDisabled: boolean; runTooltip: string } {
  const { onRunFromSource, canRun, isRunning } = useWorkflowRun();
  const ready = isReadySource({ id, type, data } as unknown as WorkflowNode);
  const runDisabled = isRunning || !canRun || !ready;
  // Tooltip order mirrors runDisabled's left-to-right evaluation: the
  // run-in-progress lock, then the graph-level precondition, then this source's
  // own readiness — so the message names the condition actually blocking the run.
  const runTooltip = isRunning
    ? 'A run is already in progress'
    : !canRun
      ? 'Add a Foreach Model and Chain Output node to run'
      : !ready
        ? notReadyMessage
        : 'Run the chain from this source';
  return { onRun: () => onRunFromSource(id), runDisabled, runTooltip };
}
