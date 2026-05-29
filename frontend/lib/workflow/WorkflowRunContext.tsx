'use client';

import { createContext, useContext } from 'react';

/**
 * PC-1003: lets the in-node ▶ "run" button (rendered inside source-node
 * components) invoke the page-level run handler. Threading a callback through
 * `node.data` would be memo-unsafe and would leak a non-serializable function
 * into template snapshots, so we use a small context instead. Provided once in
 * `app/page.tsx`; consumed via `useWorkflowRun()` in the source-node components.
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
