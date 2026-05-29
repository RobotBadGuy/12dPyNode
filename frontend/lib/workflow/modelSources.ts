import { WorkflowNode } from './types';

// PC-1001/PC-1002: node types that PRODUCE the model-name list a run iterates
// over. A run needs exactly one of these as its entry point. Mirrors the
// backend branch in run_workflow (Excel file vs workflow_graph.modelNames).
export const SOURCE_NODE_TYPES = new Set<string>(['excelModels', 'manualModels']);

export function isSourceNode(node: Pick<WorkflowNode, 'type'>): boolean {
  return !!node.type && SOURCE_NODE_TYPES.has(node.type);
}

export interface ResolvedModelSource {
  kind: 'excel' | 'manual';
  modelNames: string[];
  file?: File;
  selectedColumnIndex?: number;
}

// Resolve a source node's contribution to a run. Returns null for non-source
// nodes. Readiness (does it actually have a file / names?) is the caller's call
// via isReadySource — getModelSource just reports what's there.
export function getModelSource(node: WorkflowNode): ResolvedModelSource | null {
  const data = (node.data ?? {}) as Record<string, unknown>;
  if (node.type === 'excelModels') {
    return {
      kind: 'excel',
      modelNames: (data.modelNames as string[]) ?? [],
      file: (data.file as File) ?? undefined,
      selectedColumnIndex: (data.selectedColumnIndex as number) ?? 0,
    };
  }
  if (node.type === 'manualModels') {
    return {
      kind: 'manual',
      modelNames: (data.modelNames as string[]) ?? [],
    };
  }
  return null;
}

// A source is "ready" to drive a run when it can produce a request: an Excel
// source needs a loaded file (the backend re-parses it); a manual source needs
// at least one name. (Matches the pre-PC-1001 canRun gate for Excel.)
export function isReadySource(node: WorkflowNode): boolean {
  const source = getModelSource(node);
  if (!source) return false;
  if (source.kind === 'excel') return !!source.file;
  return source.modelNames.length > 0;
}

// Does the graph contain at least one ready source? Optionally constrained to a
// specific node id. Used by canRun and validateWorkflow so they agree.
export function hasReadyModelSource(nodes: WorkflowNode[], sourceNodeId?: string): boolean {
  const candidates = sourceNodeId ? nodes.filter((n) => n.id === sourceNodeId) : nodes;
  return candidates.some((n) => isReadySource(n));
}

// Split a paste-friendly textarea value into clean model names: one per line,
// trimmed, blanks dropped. No dedupe (Excel doesn't dedupe either).
export function parseModelList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

// PC-1004: the model a "Test run" should generate — the first real model name,
// skipping a header-looking first entry to mirror the backend's header-row skip
// in run_workflow (so it matches the model the backend would run first).
// Returns undefined for an empty list.
const TEST_RUN_HEADER_NAMES = ['filename', 'name', 'model', 'model_name', 'model name'];

export function firstModelForTestRun(modelNames: string[]): string | undefined {
  if (modelNames.length === 0) return undefined;
  const start = TEST_RUN_HEADER_NAMES.includes(modelNames[0].trim().toLowerCase()) ? 1 : 0;
  return modelNames[start];
}
