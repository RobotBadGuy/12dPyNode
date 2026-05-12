# PC-911 Actionable Error Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sweep frontend error sites so the user sees the offending node by label, a plain-English problem statement, and a one-sentence fix — with a "Show me" button that scrolls the canvas to the relevant node when applicable.

**Architecture:** Introduce a small vocabulary (`ActionableError`) and two helpers (`nodeLabel`, `focusNode`). Rewrite `validateWorkflow` / `compileWorkflow` to return the new shape. Split surface routing in `handleRunChain` — toasts (with a "Show me" action) fire for pre-run validation/compilation failures; the existing `ErrorModal` stays for the "no Excel selected" gate and post-run backend failures, both now using node labels. Sharpen template toasts with retry actions where the handler is in scope. Backend untouched.

**Tech Stack:** TypeScript, React, Next.js App Router, React Flow (`@xyflow/react`), Sonner via the `notify` wrapper at `frontend/lib/notify.ts`, Vitest + Testing Library.

**Spec:** [`docs/superpowers/specs/2026-05-12-pc911-actionable-errors-design.md`](../specs/2026-05-12-pc911-actionable-errors-design.md)

---

## File Map

**Create:**
- `frontend/lib/workflow/errors.ts` — `ActionableError` interface + `nodeLabel(node)` helper.
- `frontend/lib/workflow/focusNode.ts` — `focusNode(nodeId, highlightMs?)` DOM helper.
- `frontend/lib/workflow/__tests__/errors.test.ts` — unit tests for `nodeLabel`.
- `frontend/lib/workflow/__tests__/focusNode.test.ts` — unit tests for `focusNode`.

**Modify:**
- `frontend/lib/workflow/compile.ts` — rewrite `validateWorkflow` and `compileWorkflow` return types.
- `frontend/lib/workflow/__tests__/compile.test.ts` — update assertions for the new shape; add cases per rewritten error.
- `frontend/components/workflow/ErrorModal.tsx` — accept `focusNodeId` prop; replace the dead `[data-node-type=...]` selector with a call to `focusNode(focusNodeId)`.
- `frontend/app/page.tsx` — pre-validate before running so validation/compilation failures fire toasts (not the modal); rewrite the `setErrorModal` bodies to use `nodeLabel`; pass `focusNodeId` to the modal where applicable; sharpen the five template `notify.error` sites with retry actions.
- `ROADMAP.md` — mark PC-911 ✅ once everything ships.

**Not modified:**
- Backend (`backend/**`) — out of scope.
- `validateNode` and the warning-badge surface (PC-703) — separate code path; not part of this sweep.

---

## Task 1: ActionableError type + nodeLabel helper

**Files:**
- Create: `frontend/lib/workflow/errors.ts`
- Create: `frontend/lib/workflow/__tests__/errors.test.ts`

`nodeLabel` resolves the user-facing name of a node in priority order: explicit `data.label` → palette label (from `PALETTE_ITEMS`) → raw type → `"(unknown node)"`. We use it everywhere we name a node in an error message so the user never sees raw React Flow ids like `excelModels_1741…`.

- [ ] **Step 1: Write the failing test**

Create `frontend/lib/workflow/__tests__/errors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { nodeLabel } from '../errors';
import type { WorkflowNode } from '../types';

function makeNode(
  id: string,
  type: string | undefined,
  data: Record<string, unknown> = {},
): WorkflowNode {
  return {
    id,
    type: type as WorkflowNode['type'],
    data: data as WorkflowNode['data'],
    position: { x: 0, y: 0 },
  } as WorkflowNode;
}

describe('nodeLabel', () => {
  it('prefers an explicit data.label when it is a non-empty string', () => {
    const node = makeNode('n1', 'excelModels', { label: 'Bridge models' });
    expect(nodeLabel(node)).toBe('Bridge models');
  });

  it('trims whitespace on data.label', () => {
    const node = makeNode('n1', 'excelModels', { label: '  Bridge models  ' });
    expect(nodeLabel(node)).toBe('Bridge models');
  });

  it('falls back to the palette label when data.label is empty', () => {
    const node = makeNode('n1', 'excelModels', { label: '   ' });
    expect(nodeLabel(node)).toBe('Excel Models');
  });

  it('falls back to the palette label when data.label is missing', () => {
    const node = makeNode('n1', 'foreachModel');
    expect(nodeLabel(node)).toBe('Foreach Model');
  });

  it('falls back to the raw type when the type is not in the palette', () => {
    const node = makeNode('n1', 'somethingNew');
    expect(nodeLabel(node)).toBe('somethingNew');
  });

  it('returns "(unknown node)" when there is no type at all', () => {
    const node = makeNode('n1', undefined);
    expect(nodeLabel(node)).toBe('(unknown node)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `frontend/`: `npm run test -- errors.test.ts`
Expected: FAIL — the `errors` module does not exist yet (`Cannot find module '../errors'`).

- [ ] **Step 3: Write the minimal implementation**

Create `frontend/lib/workflow/errors.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run from `frontend/`: `npm run test -- errors.test.ts`
Expected: PASS — all six cases green.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/workflow/errors.ts frontend/lib/workflow/__tests__/errors.test.ts
git commit -m "feat(PC-911): add ActionableError type and nodeLabel helper"
```

---

## Task 2: focusNode DOM helper

**Files:**
- Create: `frontend/lib/workflow/focusNode.ts`
- Create: `frontend/lib/workflow/__tests__/focusNode.test.ts`

React Flow already emits `data-id="<nodeId>"` on each rendered node wrapper (`.react-flow__node`), so we don't need any DOM changes. The helper just queries that attribute, scrolls into view, and pulses an amber highlight. The existing `ErrorModal.tsx:84` queries `[data-node-type="excelModels"]` which is **dead code** — that attribute is not emitted anywhere in the codebase (verified by grep). Task 4 fixes the modal to call this helper instead.

- [ ] **Step 1: Write the failing test**

Create `frontend/lib/workflow/__tests__/focusNode.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { focusNode } from '../focusNode';

describe('focusNode', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is a no-op when the target node is not in the DOM', () => {
    expect(() => focusNode('missing-id')).not.toThrow();
  });

  it('scrolls the matching node into view', () => {
    const el = document.createElement('div');
    el.setAttribute('data-id', 'n1');
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;
    document.body.appendChild(el);

    focusNode('n1');

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });

  it('adds ring classes immediately and removes them after the highlight duration', () => {
    const el = document.createElement('div');
    el.setAttribute('data-id', 'n2');
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    focusNode('n2', 500);

    expect(el.classList.contains('ring-4')).toBe(true);
    expect(el.classList.contains('ring-amber-500')).toBe(true);
    expect(el.classList.contains('ring-opacity-75')).toBe(true);

    vi.advanceTimersByTime(500);

    expect(el.classList.contains('ring-4')).toBe(false);
    expect(el.classList.contains('ring-amber-500')).toBe(false);
    expect(el.classList.contains('ring-opacity-75')).toBe(false);
  });

  it('escapes ids that contain CSS-sensitive characters', () => {
    const el = document.createElement('div');
    el.setAttribute('data-id', 'node.with:weird-id');
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    expect(() => focusNode('node.with:weird-id')).not.toThrow();
    expect(el.classList.contains('ring-4')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `frontend/`: `npm run test -- focusNode.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `frontend/lib/workflow/focusNode.ts`:

```ts
/**
 * Scroll the React Flow node with the given id into view and briefly pulse
 * an amber ring around it. React Flow already emits data-id on its node
 * wrappers, so no DOM changes are needed on our side.
 *
 * Safe to call on the server (no-ops when document is undefined) and safe to
 * call with an id that isn't currently mounted.
 */
export function focusNode(nodeId: string, highlightMs = 2000): void {
  if (typeof document === 'undefined') return;
  const selector = `[data-id="${CSS.escape(nodeId)}"]`;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('ring-4', 'ring-amber-500', 'ring-opacity-75');
  window.setTimeout(() => {
    el.classList.remove('ring-4', 'ring-amber-500', 'ring-opacity-75');
  }, highlightMs);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `frontend/`: `npm run test -- focusNode.test.ts`
Expected: PASS — all four cases green.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/workflow/focusNode.ts frontend/lib/workflow/__tests__/focusNode.test.ts
git commit -m "feat(PC-911): add focusNode helper for canvas scroll-and-highlight"
```

---

## Task 3: Rewrite validateWorkflow and compileWorkflow to return ActionableError

**Files:**
- Modify: `frontend/lib/workflow/compile.ts:5-106`
- Modify: `frontend/lib/workflow/__tests__/compile.test.ts` (whole file — assertions change)

The current functions return `{ valid; errors: string[] }` and `{ error: string }`. We replace those payloads with `ActionableError[]` / `ActionableError`. `validateNode` (per-node warning badges) is untouched.

- [ ] **Step 1: Rewrite the existing tests to assert the new shape**

Replace the contents of `frontend/lib/workflow/__tests__/compile.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { compileWorkflow, validateWorkflow } from '../compile';
import type { WorkflowNode, WorkflowEdge } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────

function makeNode(
  id: string,
  type: string,
  data: Record<string, unknown> = {},
): WorkflowNode {
  return {
    id,
    type: type as WorkflowNode['type'],
    data: data as WorkflowNode['data'],
    position: { x: 0, y: 0 },
  } as WorkflowNode;
}

function makeEdge(source: string, target: string): WorkflowEdge {
  return { id: `${source}-${target}`, source, target } as WorkflowEdge;
}

const fakeFile = new File(['col1\nA\nB'], 'models.xlsx', {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});

// ── compileWorkflow ────────────────────────────────────────────────────

describe('compileWorkflow', () => {
  it('returns compiled workflow for valid graph', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', {
        file: fakeFile,
        modelNames: ['M1', 'M2'],
        selectedColumnIndex: 0,
      }),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const edges: WorkflowEdge[] = [makeEdge('1', '2'), makeEdge('2', '3')];

    const result = compileWorkflow(nodes, edges);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.modelNames).toEqual(['M1', 'M2']);
      expect(result.excelFile).toBe(fakeFile);
      expect(result.graph.nodes).toHaveLength(3);
      expect(result.variables).toEqual([]);
    }
  });

  it('returns "Load an Excel file" when no excel node has a file', () => {
    const nodes: WorkflowNode[] = [
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = compileWorkflow(nodes, []);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.title).toBe('Load an Excel file');
      expect(result.error.fix).toMatch(/upload area/);
      expect(result.error.focusNodeId).toBeUndefined();
    }
  });

  it('returns "Load an Excel file" with focusNodeId when the excel node is present but file is missing', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', { file: null, modelNames: [] }),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = compileWorkflow(nodes, []);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.title).toBe('Load an Excel file');
      expect(result.error.focusNodeId).toBe('1');
      expect(result.error.message).toContain('Excel Models');
    }
  });

  it('returns "Excel file has no model column" when modelNames is empty', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', {
        file: fakeFile,
        modelNames: [],
        selectedColumnIndex: 0,
      }),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = compileWorkflow(nodes, []);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.title).toBe('Excel file has no model column');
      expect(result.error.focusNodeId).toBe('1');
      expect(result.error.fix).toMatch(/pick the column/i);
    }
  });

  it('returns "Add a Foreach Model node" when foreach is missing', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', {
        file: fakeFile,
        modelNames: ['M1'],
        selectedColumnIndex: 0,
      }),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = compileWorkflow(nodes, []);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.title).toBe('Add a Foreach Model node');
    }
  });

  it('returns "Add a Chain File Output node" when chain output is missing', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', {
        file: fakeFile,
        modelNames: ['M1'],
        selectedColumnIndex: 0,
      }),
      makeNode('2', 'foreachModel'),
    ];
    const result = compileWorkflow(nodes, []);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error.title).toBe('Add a Chain File Output node');
    }
  });

  it('extracts variables from setVariable nodes', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', {
        file: fakeFile,
        modelNames: ['M1'],
        selectedColumnIndex: 0,
      }),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
      makeNode('4', 'setVariable', {
        variables: [
          { name: 'project_folder', value: 'C:\\Projects', scope: 'per-run' },
        ],
      }),
    ];
    const edges: WorkflowEdge[] = [makeEdge('1', '2'), makeEdge('2', '3')];

    const result = compileWorkflow(nodes, edges);
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('project_folder');
    }
  });
});

// ── validateWorkflow ───────────────────────────────────────────────────

describe('validateWorkflow', () => {
  it('returns valid for complete graph', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels'),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const edges: WorkflowEdge[] = [makeEdge('1', '2'), makeEdge('2', '3')];

    const result = validateWorkflow(nodes, edges);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns "Add an Excel Models node" for missing excel node', () => {
    const nodes: WorkflowNode[] = [
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = validateWorkflow(nodes, []);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.title)).toContain(
      'Add an Excel Models node',
    );
  });

  it('returns "Add a Foreach Model node" for missing foreach', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels'),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = validateWorkflow(nodes, []);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.title)).toContain(
      'Add a Foreach Model node',
    );
  });

  it('returns "Add a Chain File Output node" for missing chain output', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels'),
      makeNode('2', 'foreachModel'),
    ];
    const edges: WorkflowEdge[] = [makeEdge('1', '2')];
    const result = validateWorkflow(nodes, edges);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.title)).toContain(
      'Add a Chain File Output node',
    );
  });

  it('returns "Excel isn\'t wired to Foreach" with focusNodeId when the edge is missing', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels'),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput'),
    ];
    const edges: WorkflowEdge[] = [makeEdge('2', '3')];
    const result = validateWorkflow(nodes, edges);
    expect(result.valid).toBe(false);
    const wiringError = result.errors.find((e) =>
      e.title.includes("isn't wired"),
    );
    expect(wiringError).toBeDefined();
    expect(wiringError?.focusNodeId).toBe('2');
    expect(wiringError?.message).toContain('Excel Models');
    expect(wiringError?.message).toContain('Foreach Model');
  });

  it('names nodes by their user-set data.label in the wiring error', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', { label: 'Bridge models' }),
      makeNode('2', 'foreachModel', { label: 'Each bridge' }),
      makeNode('3', 'chainFileOutput'),
    ];
    const result = validateWorkflow(nodes, []);
    const wiringError = result.errors.find((e) =>
      e.title.includes("isn't wired"),
    );
    expect(wiringError?.message).toContain('Bridge models');
    expect(wiringError?.message).toContain('Each bridge');
  });

  it('returns multiple errors when graph is empty', () => {
    const result = validateWorkflow([], []);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    for (const err of result.errors) {
      expect(typeof err.title).toBe('string');
      expect(typeof err.message).toBe('string');
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `frontend/`: `npm run test -- compile.test.ts`
Expected: FAIL — assertions reference `.title`, `.focusNodeId`, etc. on what's still a string.

- [ ] **Step 3: Rewrite compile.ts**

Replace the contents of `frontend/lib/workflow/compile.ts` with:

```ts
import { WorkflowNode, WorkflowEdge, CompiledWorkflow, VariableBinding } from './types';
import { ExcelModelsNodeData } from './types';
import { nodeSchemas, getParamHandleId } from './nodeSchemas';
import { ActionableError, nodeLabel } from './errors';

export function compileWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  excelNodeId?: string,
): CompiledWorkflow | { error: ActionableError } {
  const excelNodes = nodes.filter((n) => n.type === 'excelModels') as Array<
    WorkflowNode & { data: ExcelModelsNodeData }
  >;

  const excelNode = excelNodeId
    ? (excelNodes.find((n) => n.id === excelNodeId) as
        | (WorkflowNode & { data: ExcelModelsNodeData })
        | undefined)
    : excelNodes[0];

  if (!excelNode || !excelNode.data.file) {
    return {
      error: {
        title: 'Load an Excel file',
        message: excelNode
          ? `'${nodeLabel(excelNode)}' doesn't have an Excel file loaded yet.`
          : 'No Excel Models node has a file loaded.',
        fix: "Click the upload area inside the Excel Models node, or drag a .xlsx file onto it.",
        focusNodeId: excelNode?.id,
      },
    };
  }

  if (!excelNode.data.modelNames || excelNode.data.modelNames.length === 0) {
    return {
      error: {
        title: 'Excel file has no model column',
        message: `'${nodeLabel(excelNode)}' loaded a file but no model column was selected.`,
        fix: 'Open this node and pick the column that contains model names. (PC-704 will improve this.)',
        focusNodeId: excelNode.id,
      },
    };
  }

  const foreachNode = nodes.find((n) => n.type === 'foreachModel');
  if (!foreachNode) {
    return {
      error: {
        title: 'Add a Foreach Model node',
        message: 'No Foreach Model node is on the canvas yet.',
        fix: "Drag 'Foreach Model' from the left palette and connect the Excel node's right handle to its left handle.",
      },
    };
  }

  const chainOutputNodes = nodes.filter((n) => n.type === 'chainFileOutput');
  if (chainOutputNodes.length === 0) {
    return {
      error: {
        title: 'Add a Chain File Output node',
        message: 'No Chain File Output node is on the canvas yet.',
        fix: "Drag 'Chain Output' from the left palette and connect a Foreach output to it.",
      },
    };
  }

  const variables: VariableBinding[] = [];
  nodes
    .filter((n) => n.type === 'setVariable')
    .forEach((node) => {
      const data = node.data as { variables: VariableBinding[] };
      if (data.variables) {
        variables.push(...data.variables);
      }
    });

  return {
    excelFile: excelNode.data.file,
    modelNames: excelNode.data.modelNames,
    selectedColumnIndex: excelNode.data.selectedColumnIndex ?? 0,
    graph: { nodes, edges },
    variables,
  };
}

export function validateWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  excelNodeId?: string,
): { valid: boolean; errors: ActionableError[] } {
  const errors: ActionableError[] = [];

  const excelNodes = nodes.filter((n) => n.type === 'excelModels');
  const excelNode = excelNodeId
    ? excelNodes.find((n) => n.id === excelNodeId)
    : excelNodes[0];
  if (!excelNode) {
    errors.push({
      title: 'Add an Excel Models node',
      message: 'No Excel Models node is on the canvas yet.',
      fix: "Drag 'Excel Models' from the left palette onto the canvas, then load an .xlsx file.",
    });
  }

  const foreachNode = nodes.find((n) => n.type === 'foreachModel');
  if (!foreachNode) {
    errors.push({
      title: 'Add a Foreach Model node',
      message: 'No Foreach Model node is on the canvas yet.',
      fix: "Drag 'Foreach Model' from the left palette and connect the Excel node's right handle to its left handle.",
    });
  }

  const chainOutputNodes = nodes.filter((n) => n.type === 'chainFileOutput');
  if (chainOutputNodes.length === 0) {
    errors.push({
      title: 'Add a Chain File Output node',
      message: 'No Chain File Output node is on the canvas yet.',
      fix: "Drag 'Chain Output' from the left palette and connect a Foreach output to it.",
    });
  }

  if (excelNode && foreachNode) {
    const excelToForeach = edges.find(
      (e) => e.source === excelNode.id && e.target === foreachNode.id,
    );
    if (!excelToForeach) {
      errors.push({
        title: "Excel isn't wired to Foreach",
        message: `'${nodeLabel(excelNode)}' isn't connected to '${nodeLabel(foreachNode)}'.`,
        fix: "Drag an edge from the Excel node's right handle to the Foreach node's left handle.",
        focusNodeId: foreachNode.id,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Returns an array of human-readable warning messages for a single node, based
 * on the node's data and the surrounding graph (so we can tell whether a
 * required parameter is satisfied by an incoming param edge).
 *
 * Empty array means "no warnings". Used by the canvas to surface incomplete
 * configuration before the user hits Run. NOTE: intentionally string[] not
 * ActionableError[] — the warning badge surface doesn't need actions, the
 * badge is already attached to the offending node.
 */
export function validateNode(
  node: WorkflowNode,
  _allNodes: WorkflowNode[],
  allEdges: WorkflowEdge[],
): string[] {
  const warnings: string[] = [];
  const data = (node.data ?? {}) as Record<string, unknown>;

  if (node.type === 'excelModels' && !data.file) {
    warnings.push('No Excel file loaded');
  }

  if (node.type === 'chainFileOutput') {
    if (!isNonEmptyString(data.modelName)) {
      warnings.push('Model name is required');
    }
    if (!isNonEmptyString(data.projectFolder)) {
      warnings.push('Project folder is required');
    }
  }

  const schema = node.type ? nodeSchemas[node.type] : undefined;
  if (schema) {
    for (const param of schema.parameters) {
      if (param.kind === 'variable-list') continue;
      const value = data[param.key];
      if (isEmptyValue(value)) {
        const handleId = getParamHandleId(param.key);
        const hasIncomingEdge = allEdges.some(
          (e) => e.target === node.id && e.targetHandle === handleId,
        );
        if (!hasIncomingEdge) {
          warnings.push(`Missing parameter: ${param.label}`);
        }
      }
    }
  }

  return warnings;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `frontend/`: `npm run test -- compile.test.ts errors.test.ts`
Expected: PASS — all compile and errors test cases green.

- [ ] **Step 5: Verify the full test suite still passes**

Run from `frontend/`: `npm run test`
Expected: PASS — no other test references the old string-shaped `errors` field. (Verified by grep: only `app/page.tsx` consumes these functions outside the test file, and that gets rewritten in Task 5.)

If any other test fails because it still expects strings: fix it inline to use the new shape, do not skip it.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/workflow/compile.ts frontend/lib/workflow/__tests__/compile.test.ts
git commit -m "feat(PC-911): validateWorkflow/compileWorkflow return ActionableError"
```

---

## Task 4: ErrorModal accepts focusNodeId and uses focusNode

**Files:**
- Modify: `frontend/components/workflow/ErrorModal.tsx`

The modal currently has a broken "Find Upload" button (line 84 queries `[data-node-type="excelModels"]`, an attribute no component emits). Replace the inline scroll/highlight code with a call to the new `focusNode` helper, driven by a new optional `focusNodeId` prop. Keep all visual behavior identical for the existing `isExcelError` path; the button now also works for non-Excel cases when `focusNodeId` is supplied (e.g. post-run failure pointing at a setVariable node).

- [ ] **Step 1: Update ErrorModal.tsx**

Replace the contents of `frontend/components/workflow/ErrorModal.tsx` with:

```tsx
'use client';

import React from 'react';
import { AlertCircle, Upload, X, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { focusNode } from '@/lib/workflow/focusNode';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  isExcelError?: boolean;
  /**
   * Optional React Flow node id. When supplied, the modal exposes a button
   * that closes the modal and scrolls the canvas to this node.
   */
  focusNodeId?: string;
}

export function ErrorModal({
  isOpen,
  onClose,
  title,
  message,
  isExcelError,
  focusNodeId,
}: ErrorModalProps) {
  if (!isOpen) return null;

  const showFocusButton = isExcelError || !!focusNodeId;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border-2 border-red-500/50 p-8 max-w-md w-full animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
            <div className="relative bg-gradient-to-br from-red-500 to-orange-600 rounded-full p-4">
              <AlertCircle className="w-16 h-16 text-white" />
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-bold text-center text-white mb-2">
          {isExcelError ? '📊 Oops!' : '⚠️ Error'}
        </h2>

        <p className="text-center text-gray-300 mb-6 leading-relaxed">
          {message}
        </p>

        {isExcelError && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-300 font-semibold mb-2">
                  Quick Fix:
                </p>
                <ol className="text-xs text-amber-200/90 space-y-1 list-decimal list-inside">
                  <li>Go to the Excel Models node in your workflow</li>
                  <li>Click the upload area or drag &amp; drop your .xlsx file</li>
                  <li>Wait for the file to load, then try running again</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {isExcelError && (
          <div className="flex justify-center mb-6">
            <div className="animate-bounce">
              <Upload className="w-8 h-8 text-amber-400" />
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
          {showFocusButton && (
            <Button
              onClick={() => {
                onClose();
                if (focusNodeId) focusNode(focusNodeId);
              }}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isExcelError ? 'Find Upload' : 'Show me'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full frontend test suite and the typechecker**

Run from `frontend/`:
- `npm run test`
- `npx tsc --noEmit`

Expected: PASS for both. (No tests target ErrorModal directly today. The typechecker confirms the new optional prop is wired correctly.)

- [ ] **Step 3: Commit**

```bash
git add frontend/components/workflow/ErrorModal.tsx
git commit -m "feat(PC-911): ErrorModal uses focusNode helper, accepts focusNodeId"
```

---

## Task 5: Rewrite handleRunChain to surface validation as toast, runtime as modal

**Files:**
- Modify: `frontend/app/page.tsx` (imports near line 29; `handleRunChain` body roughly lines 722-980; `errorModal` state declaration at line 87)

Today every pre-run check (validation, compilation) inside `runSingleWorkflow` throws, gets caught by the outer try/catch at line 967, and lands in `ErrorModal`. The new shape: pre-validate **before** entering the run loop and fire a toast — `ErrorModal` only fires for the "no Excel selected" gate (which is still a precondition, but the existing dazzle is good and we want to keep it) and for genuine runtime failures from the backend.

- [ ] **Step 1: Add imports near line 29**

In `frontend/app/page.tsx`, locate the existing import:

```ts
import { compileWorkflow, validateWorkflow, validateNode } from '@/lib/workflow/compile';
```

Add directly below it:

```ts
import { ActionableError, nodeLabel } from '@/lib/workflow/errors';
import { focusNode } from '@/lib/workflow/focusNode';
```

- [ ] **Step 2: Extend the errorModal state shape**

Locate the `errorModal` state declaration (around line 87):

```ts
const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; message: string; isExcelError?: boolean }>({
  isOpen: false,
  title: '',
  message: '',
});
```

Replace with:

```ts
const [errorModal, setErrorModal] = useState<{
  isOpen: boolean;
  title: string;
  message: string;
  isExcelError?: boolean;
  focusNodeId?: string;
}>({
  isOpen: false,
  title: '',
  message: '',
});
```

- [ ] **Step 3: Add the toast helper and pre-validation pass at the top of handleRunChain**

Locate `handleRunChain` (starts around line 722). Replace the body up through the existing "No Excel Models Selected" check with the following — keep the rest of the function (the `runSingleWorkflow` definition and the run loop) unchanged from line 745 onward:

```ts
  const handleRunChain = useCallback(async () => {
    const excelNodes = nodes.filter((n): n is WorkflowNode & { data: ExcelModelsNodeData } =>
      n.type === 'excelModels' && 'file' in n.data && !!(n.data as any).file
    );
    const selectedExcelIds = selectedExcelNodeIds.size > 0
      ? Array.from(selectedExcelNodeIds).filter((id) =>
        excelNodes.some((n) => n.id === id)
      )
      : excelNodes.length > 0
        ? [excelNodes[0].id]
        : [];

    if (selectedExcelIds.length === 0) {
      // Stays modal — first thing the user sees, and the Quick Fix box is
      // the right teaching surface for the very-first-run case. We give it
      // a focusNodeId pointing at the first excelModels node (if any) so the
      // existing "Find Upload" button actually works now.
      const firstExcelNode = nodes.find((n) => n.type === 'excelModels');
      setErrorModal({
        isOpen: true,
        title: 'No Excel Models Selected',
        message: 'Please select at least one Excel Models node with a file loaded.',
        isExcelError: true,
        focusNodeId: firstExcelNode?.id,
      });
      return;
    }

    // PC-911: pre-validate every selected Excel id BEFORE entering the run
    // loop. A precondition failure (missing node, missing edge, missing
    // file) is not a runtime failure — it's something the user can fix in
    // one click, so it gets a toast with a 'Show me' action, not the
    // blocking modal.
    const fireActionableErrorToast = (err: ActionableError) => {
      const description = [err.message, err.fix].filter(Boolean).join(' — ');
      notify.error(err.title, {
        description,
        action: err.focusNodeId
          ? {
              label: 'Show me',
              onClick: () => focusNode(err.focusNodeId!),
            }
          : undefined,
      });
    };

    for (const excelNodeId of selectedExcelIds) {
      const validation = validateWorkflow(nodes, edges, excelNodeId);
      if (!validation.valid) {
        fireActionableErrorToast(validation.errors[0]);
        return;
      }
      const compiled = compileWorkflow(nodes, edges, excelNodeId);
      if ('error' in compiled) {
        fireActionableErrorToast(compiled.error);
        return;
      }
    }
```

- [ ] **Step 4: Rewrite the inner runSingleWorkflow throws to use ActionableError titles**

Inside `runSingleWorkflow` (still defined inside `handleRunChain`), locate these throws (currently around lines 759 and 764):

```ts
      const validation = validateWorkflow(nodes, edges, excelNodeId);
      if (!validation.valid) {
        throw new Error(`Validation failed for ${excelNodeId}: ${validation.errors.join(', ')}`);
      }

      const compiled = compileWorkflow(nodes, edges, excelNodeId);
      if ('error' in compiled) {
        throw new Error(`Compilation failed for ${excelNodeId}: ${compiled.error}`);
      }
```

Replace with:

```ts
      // PC-911: outer handleRunChain pre-validates, so reaching this path
      // with !valid means state diverged between then and now. Format the
      // new ActionableError shape for the defensive error.
      const validation = validateWorkflow(nodes, edges, excelNodeId);
      if (!validation.valid) {
        throw new Error(
          `Validation failed: ${validation.errors.map((e) => e.title).join(', ')}`,
        );
      }

      const compiled = compileWorkflow(nodes, edges, excelNodeId);
      if ('error' in compiled) {
        throw new Error(`Compilation failed: ${compiled.error.title}`);
      }
```

- [ ] **Step 5: Rewrite the multi-Excel inner-catch setErrorModal (around line 922)**

Locate:

```ts
          } catch (err) {
            setErrorModal({
              isOpen: true,
              title: 'Workflow Failed',
              message: `Error running workflow for ${excelNodeId}: ${err instanceof Error ? err.message : 'Unknown error'}`,
              isExcelError: false,
            });
            setIsRunning(false);
            return;
          }
```

Replace with:

```ts
          } catch (err) {
            const failingNode = nodes.find((n) => n.id === excelNodeId);
            const label = failingNode ? nodeLabel(failingNode) : '(unknown Excel node)';
            setErrorModal({
              isOpen: true,
              title: 'Workflow Failed',
              message: `Error running workflow for '${label}': ${err instanceof Error ? err.message : 'Unknown error'}`,
              isExcelError: false,
              focusNodeId: excelNodeId,
            });
            setIsRunning(false);
            return;
          }
```

- [ ] **Step 6: Rewrite the outer catch setErrorModal (around line 967)**

Locate:

```ts
    } catch (err) {
      setErrorModal({
        isOpen: true,
        title: 'Error Running Workflow',
        message: err instanceof Error ? err.message : 'Unknown error occurred',
        isExcelError: false,
      });
    } finally {
```

Replace with:

```ts
    } catch (err) {
      // PC-911: only runtime failures from the backend reach here now.
      // Precondition errors are surfaced as toasts by the pre-validation
      // pass above. Single-Excel path doesn't know which Excel node was
      // running, but selectedExcelIds[0] is always set when we get here.
      const runningExcelId = selectedExcelIds[0];
      const failingNode = nodes.find((n) => n.id === runningExcelId);
      const label = failingNode ? nodeLabel(failingNode) : '(workflow)';
      setErrorModal({
        isOpen: true,
        title: 'Error Running Workflow',
        message: `${label}: ${err instanceof Error ? err.message : 'Unknown error occurred'}`,
        isExcelError: false,
        focusNodeId: runningExcelId,
      });
    } finally {
```

- [ ] **Step 7: Wire focusNodeId through to ErrorModal at the bottom of the JSX**

Locate the `<ErrorModal ... />` usage (around line 1386):

```tsx
<ErrorModal
  isOpen={errorModal.isOpen}
  onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
  title={errorModal.title}
  message={errorModal.message}
  isExcelError={errorModal.isExcelError}
/>
```

Replace with:

```tsx
<ErrorModal
  isOpen={errorModal.isOpen}
  onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
  title={errorModal.title}
  message={errorModal.message}
  isExcelError={errorModal.isExcelError}
  focusNodeId={errorModal.focusNodeId}
/>
```

- [ ] **Step 8: Run typecheck and tests**

Run from `frontend/`:
- `npx tsc --noEmit`
- `npm run test`

Expected: both PASS. No tests target `handleRunChain` directly (it's a closure inside a React component), but typecheck catches any plumbing mistakes.

- [ ] **Step 9: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat(PC-911): toast precondition errors, modal runtime errors with node labels"
```

---

## Task 6: Sharpen template toasts (load / save / delete / import)

**Files:**
- Modify: `frontend/app/page.tsx` (around lines 987, 1014, 1081, 1146, 1216)

Five `notify.error` calls all share the same shape `{ description: err.message }`. Sharpen each with either a retry action (when we can re-run the failed operation cleanly) or a clearer description (when the error is purely client-side, e.g. JSON parse).

- [ ] **Step 1: Sharpen `refreshTemplates` toast (around line 987)**

Locate the `refreshTemplates` function:

```ts
  const refreshTemplates = useCallback(async () => {
    try {
      const list = await fetchTemplates();
      setTemplates(list);
    } catch (err) {
      notify.error("Couldn't load templates", {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, []);
```

Replace with:

```ts
  const refreshTemplates = useCallback(async () => {
    try {
      const list = await fetchTemplates();
      setTemplates(list);
    } catch (err) {
      // PC-911: a fetch failure here is almost always backend-down or
      // network. Surface the underlying error and give the user a one-click
      // way to try again without leaving the canvas.
      notify.error("Couldn't load templates", {
        description: err instanceof Error ? err.message : 'The templates service may be offline.',
        action: { label: 'Retry', onClick: () => { void refreshTemplates(); } },
      });
    }
  }, []);
```

- [ ] **Step 2: Sharpen the mount-time fetch toast (around line 1014)**

Locate the on-mount catch block:

```ts
      } catch (err) {
        if (cancelled) return;
        notify.error("Couldn't load templates", {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
```

Replace with:

```ts
      } catch (err) {
        if (cancelled) return;
        // PC-911: same shape as refreshTemplates but the retry button calls
        // refreshTemplates directly — by mount-fail time the migration
        // step has already either succeeded or been bypassed, so a plain
        // re-fetch is the right retry.
        notify.error("Couldn't load templates", {
          description: err instanceof Error ? err.message : 'The templates service may be offline.',
          action: { label: 'Retry', onClick: () => { void refreshTemplates(); } },
        });
      } finally {
```

- [ ] **Step 3: Sharpen the save toast with a retry action (around line 1081)**

Locate the save handler's catch block:

```ts
      try {
        let saved: WorkflowTemplate;
        if (options.mode === 'update' && loadedTemplate) {
          saved = await updateTemplate(loadedTemplate.id, payload);
        } else {
          saved = await createTemplate(payload);
        }
        // ...
      } catch (err) {
        notify.error("Couldn't save template", {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
```

Replace with:

```ts
      try {
        let saved: WorkflowTemplate;
        if (options.mode === 'update' && loadedTemplate) {
          saved = await updateTemplate(loadedTemplate.id, payload);
        } else {
          saved = await createTemplate(payload);
        }
        // ...
      } catch (err) {
        // PC-911: capture the exact args so 'Retry' re-runs the same save
        // without re-opening the Save modal.
        const retryOptions = options;
        notify.error("Couldn't save template", {
          description: err instanceof Error ? err.message : 'Unknown error',
          action: {
            label: 'Retry',
            onClick: () => { void handleSaveTemplateConfirm(retryOptions); },
          },
        });
      }
```

> **Note:** the enclosing handler is `handleSaveTemplateConfirm` (declared at `page.tsx:1054`). The self-reference inside its own definition resolves at call time (when the user clicks Retry), so it works even though the const isn't initialized at the moment the arrow body is parsed. If TypeScript complains in strict mode, lift the call through a `useRef` or wrap in `() => setTimeout(() => handleSaveTemplateConfirm(retryOptions), 0)`.

- [ ] **Step 4: Sharpen the delete toast with a retry action (around line 1146)**

Locate the delete handler:

```ts
  const handleDeleteTemplate = useCallback(
    async (template: WorkflowTemplate) => {
      try {
        await deleteTemplateApi(template.id);
        await refreshTemplates();
        setLoadedTemplate((current) =>
          current?.id === template.id ? null : current
        );
      } catch (err) {
        notify.error("Couldn't delete template", {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [refreshTemplates]
  );
```

Replace the catch block with:

```ts
      } catch (err) {
        notify.error("Couldn't delete template", {
          description: err instanceof Error ? err.message : 'Unknown error',
          action: {
            label: 'Retry',
            onClick: () => { void handleDeleteTemplate(template); },
          },
        });
      }
```

- [ ] **Step 5: Sharpen the import toast (around line 1216)**

Locate the import file handler's catch block:

```ts
        } catch (err) {
          notify.error("Couldn't import template", {
            description: err instanceof Error ? err.message : 'Unknown error',
          });
        }
```

Replace with:

```ts
        } catch (err) {
          // PC-911: the only failure path here is parse / shape validation
          // (importTemplate throws on bad JSON; applySnapshot is sync and
          // doesn't throw). So the description is always "not a valid
          // export" — the user's underlying error message is technical
          // (e.g. "Unexpected token <") and doesn't help them.
          notify.error("Couldn't import template", {
            description: "The file isn't a valid PyChain template export.",
          });
        }
```

- [ ] **Step 6: Run typecheck and tests**

Run from `frontend/`:
- `npx tsc --noEmit`
- `npm run test`

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat(PC-911): sharpen template toasts with retry actions and clearer descriptions"
```

---

## Task 7: Verification — lint, typecheck, tests, manual smoke

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run from `frontend/`: `npm run test`
Expected: PASS — including the two new test files and the rewritten `compile.test.ts`.

- [ ] **Step 2: Run the typechecker**

Run from `frontend/`: `npx tsc --noEmit`
Expected: PASS with no errors.

- [ ] **Step 3: Run the linter**

Run from `frontend/`: `npm run lint`
Expected: PASS with no errors.

- [ ] **Step 4: Build the production bundle**

Run from `frontend/`: `npm run build`
Expected: PASS — Next.js production build succeeds.

- [ ] **Step 5: Manual smoke test in the dev server**

This must be done by a human (the agent cannot interact with the browser).

Start the dev server: `npm run dev` from `frontend/`, and the backend: `python main.py` from `backend/`.

Walk through the following six scenarios and confirm the wording and actions match:

1. **Empty canvas → click Run**
   - Expect: toast `Add an Excel Models node` with description `Drag 'Excel Models' from the left palette onto the canvas, then load an .xlsx file.`
   - No "Show me" button (no node to point at).
2. **Drop an Excel Models node, no file, click Run**
   - Expect: `ErrorModal` with the "No Excel Models Selected" Quick Fix box. Click `Find Upload`: it should scroll to and pulse the Excel node.
3. **Load Excel, no Foreach, click Run**
   - Expect: toast `Add a Foreach Model node`.
4. **Add Foreach but don't wire it to the Excel node, click Run**
   - Expect: toast `Excel isn't wired to Foreach` with a `Show me` button. Click it: scrolls to the Foreach node and pulses it amber.
5. **Full graph runs successfully, then break a setVariable so the backend fails**
   - Expect: `ErrorModal` whose message starts with the Excel node's label (or the user-set `data.label` if renamed), not a raw `excelModels_1741...` id.
6. **Templates: disconnect the backend and try Save / Delete / Load**
   - Expect: each toast has a `Retry` button. Retry triggers the same action again.

Tick each scenario off in a comment when running this task.

- [ ] **Step 6: Mark PC-911 as shipped in the ROADMAP**

Edit `ROADMAP.md`. Replace the existing PC-911 entry (around line 208):

```markdown
- **PC-911** `[P1]` `[Size: S]` `[Mode: regular]` — Actionable error messages.
  *Rationale:* Sweep through error sites and rewrite each to (a) name the offending node by label, (b) say what's wrong in plain English, (c) suggest a fix or link to the relevant docs. E.g. "Excel file has no model column" → "Open the `excelModels` node and click 'Pick column' (PC-704)." Pairs with PC-901's toast surface.
```

with:

```markdown
- ✅ **PC-911** — Actionable error messages.
  *Rationale:* `frontend/lib/workflow/errors.ts` introduces the `ActionableError` vocabulary (`title` / `message` / `fix` / `focusNodeId`) and a `nodeLabel(node)` helper that resolves the user-facing name in priority order (`data.label` → `PALETTE_ITEMS` lookup → raw type). `validateWorkflow` and `compileWorkflow` in `compile.ts` now return that shape; every rewritten error names the offending node by label and suggests a concrete next step. `handleRunChain` pre-validates every selected Excel id before entering the run loop, so precondition failures fire a `notify.error` toast with a `Show me` action that scrolls the canvas to the relevant node via `focusNode.ts`. Genuine runtime failures (backend errors after a real run attempt) keep the existing `ErrorModal` but now use node labels and forward a `focusNodeId` so the modal's button is also wired to `focusNode` (the old `[data-node-type=...]` selector was dead code). Five template `notify.error` sites (load / mount-fetch / save / delete / import) gained retry actions or sharpened descriptions. Tested in `frontend/lib/workflow/__tests__/errors.test.ts`, `focusNode.test.ts`, and the rewritten `compile.test.ts`. Phase 6 in the order-of-attack (Suggested Order, Phase 2).
```

Also update the "Suggested Order of Attack" Phase 2 entry (around line 224):

Replace:
```markdown
5. **PC-911** — Actionable error messages. Pairs with PC-901.
```
with:
```markdown
5. ✅ **PC-911** — Actionable error messages. Pairs with PC-901.
```

- [ ] **Step 7: Commit the roadmap update**

```bash
git add ROADMAP.md
git commit -m "docs(PC-911): mark actionable error messages shipped"
```

---

## Self-Review Checklist (for the executor — do this before closing the plan)

1. Every error string previously returned by `validateWorkflow` / `compileWorkflow` has a matching `ActionableError` in `compile.ts` (cross-check the table in the spec, Section 3).
2. Every `notify.error` call in `app/page.tsx` either has an `action` or a sharpened description (or both).
3. `ErrorModal` no longer references `data-node-type`; the dead selector is gone.
4. `data-id` is what React Flow emits — verified by reading `@xyflow/react` behavior. No DOM additions were needed.
5. The pre-validation pass in `handleRunChain` runs **before** `setIsRunning(true)` — failing fast doesn't leave the run-state flag set.
6. Run `npm run test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` from `frontend/` — all green.
