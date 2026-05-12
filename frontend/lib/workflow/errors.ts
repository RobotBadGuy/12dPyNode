import type { WorkflowNode } from './types';
import { PALETTE_ITEMS } from './palette';

/**
 * Structured error shape used by validateWorkflow / compileWorkflow and the
 * surface routing in app/page.tsx. The intent: every user-facing error names
 * the offending node by label, says what's wrong in plain English, and
 * suggests a concrete fix. Optional focusNodeId lets a toast or modal
 * provide a "Show me" button that scrolls the canvas to the right place.
 */
export interface ActionableError {
  title: string;
  message: string;
  fix?: string;
  focusNodeId?: string;
}

const PALETTE_LABEL_BY_TYPE: Map<string, string> = new Map(
  PALETTE_ITEMS.map((item) => [item.type, item.label]),
);

/**
 * Resolves the user-facing name of a node. Priority:
 *   1. data.label (non-empty string, trimmed) — user-renamed
 *   2. PALETTE_ITEMS lookup by type — default display name
 *   3. raw node.type — for unknown types
 *   4. "(unknown node)" — for nodes with no type
 *
 * We never expose raw React Flow ids (e.g. "excelModels_1741...") to users.
 */
export function nodeLabel(node: WorkflowNode): string {
  const data = node.data as Record<string, unknown> | undefined;
  const dataLabel = data?.label;
  if (typeof dataLabel === 'string' && dataLabel.trim()) {
    return dataLabel.trim();
  }
  if (typeof node.type === 'string' && node.type) {
    const paletteLabel = PALETTE_LABEL_BY_TYPE.get(node.type);
    return paletteLabel ?? node.type;
  }
  return '(unknown node)';
}
