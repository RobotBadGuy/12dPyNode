# PC-903 Right-Click Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app right-click context menu on workflow nodes with Duplicate, Copy, Delete, and Disable/Enable, where "disabled" is honored end-to-end (dimmed in the UI, ignored by the client validator, skipped by the backend runner).

**Architecture:** A custom `position: fixed` menu component driven by `app/page.tsx` state, reusing the existing copy/paste/undo plumbing. Action logic lives in a new pure module (`nodeOps.ts`) so it's unit-testable without React Testing Library (not installed). "Disabled" is a `data.disabled` flag: the UI dims the node via a CSS class attached at the single `nodesWithWarnings` memo chokepoint (no per-node-file churn), and the backend skips it in the one shared `_execute_node_with_capture` helper that both execution-order loops call.

**Tech Stack:** Next.js 15 / React 19, `@xyflow/react` v12, TypeScript, vitest + jsdom (frontend tests); FastAPI / Python, pytest (backend tests). No new dependencies.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `frontend/lib/workflow/nodeKinds.ts` | **New.** `CONTROL_FLOW_NODE_TYPES` set + `isControlFlowNode` — single source for "which node types can't be disabled." |
| `frontend/lib/workflow/nodeOps.ts` | **New.** Pure graph operations: `duplicateNode`, `removeNode`, `setNodeDisabled`. |
| `frontend/lib/workflow/types.ts` | Add `NodeDataExtras { disabled?: boolean }` and intersect into `WorkflowNode.data`. |
| `frontend/lib/workflow/compile.ts` | `validateNode` / `validateWorkflow` ignore disabled nodes. |
| `frontend/components/workflow/NodeContextMenu.tsx` | **New.** The positioned menu (presentational + self-dismissal). |
| `frontend/components/workflow/WorkspaceCanvas.tsx` | Add `onNodeContextMenu` prop wired to `<ReactFlow>`. |
| `frontend/app/page.tsx` | Menu state, open handler, four action handlers, disabled decoration in the memo, render the menu. |
| `frontend/app/globals.css` | `.pynode-disabled` dim + "Disabled" pill. |
| `frontend/lib/workflow/__tests__/nodeKinds.test.ts` | **New.** Tests for `isControlFlowNode`. |
| `frontend/lib/workflow/__tests__/nodeOps.test.ts` | **New.** Tests for the pure ops. |
| `frontend/lib/workflow/__tests__/compile.test.ts` | Add disabled-node cases. |
| `backend/tests/test_per_node_events.py` | Add disabled-skip + regression tests. |
| `backend/services/workflow_runner.py` | Early `return` for disabled nodes in `_execute_node_with_capture`. |
| `ROADMAP.md` | Mark PC-903 shipped. |
| `CLAUDE.md` | One-line note that disabled nodes are skipped during emission. |

---

## Task 1: `disabled` data field + `nodeKinds` helper

**Files:**
- Modify: `frontend/lib/workflow/types.ts` (around `:375`)
- Create: `frontend/lib/workflow/nodeKinds.ts`
- Test: `frontend/lib/workflow/__tests__/nodeKinds.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/lib/workflow/__tests__/nodeKinds.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isControlFlowNode, CONTROL_FLOW_NODE_TYPES } from '../nodeKinds';

describe('isControlFlowNode', () => {
  it('is true for the four control-flow types', () => {
    expect(isControlFlowNode('excelModels')).toBe(true);
    expect(isControlFlowNode('foreachModel')).toBe(true);
    expect(isControlFlowNode('chainFileOutput')).toBe(true);
    expect(isControlFlowNode('setVariable')).toBe(true);
  });

  it('is false for command nodes and undefined', () => {
    expect(isControlFlowNode('import')).toBe(false);
    expect(isControlFlowNode('createView')).toBe(false);
    expect(isControlFlowNode(undefined)).toBe(false);
  });

  it('exposes the set with exactly four members', () => {
    expect(CONTROL_FLOW_NODE_TYPES.size).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `npm run test -- nodeKinds`
Expected: FAIL — cannot find module `../nodeKinds`.

- [ ] **Step 3: Create `nodeKinds.ts`**

Create `frontend/lib/workflow/nodeKinds.ts`:

```ts
// The node types that shape the graph but emit no XML themselves. Mirrors
// `control_flow_types` in backend/services/workflow_runner.py. Disabling one
// of these is nonsensical, so the context menu hides "Disable" for them.
export const CONTROL_FLOW_NODE_TYPES = new Set<string>([
  'excelModels',
  'foreachModel',
  'chainFileOutput',
  'setVariable',
]);

export function isControlFlowNode(type?: string): boolean {
  return !!type && CONTROL_FLOW_NODE_TYPES.has(type);
}
```

- [ ] **Step 4: Add the `disabled` field to the node type**

In `frontend/lib/workflow/types.ts`, replace the `WorkflowNode` interface (currently at `:375`):

```ts
export interface WorkflowNode extends Node {
  type: NodeType;
  data: WorkflowNodeData;
}
```

with:

```ts
// Optional fields that can ride on ANY node's data regardless of node type.
// PC-903: `disabled` excludes the node from generation while keeping it on the
// canvas. (Transient UI fields like warnings/nodeState are still read via casts.)
export interface NodeDataExtras {
  disabled?: boolean;
}

export interface WorkflowNode extends Node {
  type: NodeType;
  data: WorkflowNodeData & NodeDataExtras;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run (from `frontend/`): `npm run test -- nodeKinds`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/workflow/nodeKinds.ts frontend/lib/workflow/__tests__/nodeKinds.test.ts frontend/lib/workflow/types.ts
git commit -m "feat(PC-903): add disabled node-data field and control-flow node helper"
```

---

## Task 2: Pure node operations (`nodeOps.ts`)

**Files:**
- Create: `frontend/lib/workflow/nodeOps.ts`
- Test: `frontend/lib/workflow/__tests__/nodeOps.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/lib/workflow/__tests__/nodeOps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { duplicateNode, removeNode, setNodeDisabled } from '../nodeOps';
import type { WorkflowNode, WorkflowEdge } from '../types';

function node(id: string, type = 'import', extra: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id,
    type: type as WorkflowNode['type'],
    position: { x: 100, y: 200 },
    data: { fileType: 'dwg' } as WorkflowNode['data'],
    ...extra,
  } as WorkflowNode;
}
function edge(source: string, target: string): WorkflowEdge {
  return { id: `${source}-${target}`, source, target } as WorkflowEdge;
}

describe('duplicateNode', () => {
  it('clones with a new id, +40/+40 offset, selected, data preserved', () => {
    const original = node('a');
    const copy = duplicateNode(original, () => 'new-id');
    expect(copy.id).toBe('new-id');
    expect(copy.position).toEqual({ x: 140, y: 240 });
    expect(copy.selected).toBe(true);
    expect(copy.data).toEqual(original.data);
    expect(copy.type).toBe(original.type);
  });

  it('does not mutate or alias the original node data', () => {
    const original = node('a');
    const copy = duplicateNode(original, () => 'new-id');
    (copy.data as Record<string, unknown>).fileType = 'ifc';
    expect((original.data as Record<string, unknown>).fileType).toBe('dwg');
    expect(original.position).toEqual({ x: 100, y: 200 });
  });
});

describe('removeNode', () => {
  it('drops the node and exactly the edges touching it', () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [edge('a', 'b'), edge('b', 'c'), edge('a', 'c')];
    const result = removeNode(nodes, edges, 'b');
    expect(result.nodes.map((n) => n.id)).toEqual(['a', 'c']);
    expect(result.edges.map((e) => e.id)).toEqual(['a-c']);
  });
});

describe('setNodeDisabled', () => {
  it('sets the disabled flag on the target node only', () => {
    const nodes = [node('a'), node('b')];
    const result = setNodeDisabled(nodes, 'b', true);
    expect(result.find((n) => n.id === 'b')!.data.disabled).toBe(true);
    expect(result.find((n) => n.id === 'a')!.data.disabled).toBeUndefined();
  });

  it('can clear the disabled flag', () => {
    const nodes = [node('a', 'import', { data: { disabled: true } as WorkflowNode['data'] })];
    const result = setNodeDisabled(nodes, 'a', false);
    expect(result[0].data.disabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `npm run test -- nodeOps`
Expected: FAIL — cannot find module `../nodeOps`.

- [ ] **Step 3: Create `nodeOps.ts`**

Create `frontend/lib/workflow/nodeOps.ts`:

```ts
import type { WorkflowNode, WorkflowEdge } from './types';

/**
 * Clone a single node for "Duplicate": fresh id (from the injected factory),
 * offset by +40/+40 so it doesn't sit exactly on the original, and selected so
 * the user can immediately drag it. Deep-cloned so nested data isn't aliased.
 */
export function duplicateNode(node: WorkflowNode, makeId: () => string): WorkflowNode {
  const clone = structuredClone(node);
  return {
    ...clone,
    id: makeId(),
    position: { x: node.position.x + 40, y: node.position.y + 40 },
    selected: true,
  };
}

/** Remove a node and every edge that references it (as source or target). */
export function removeNode(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  nodeId: string,
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  return {
    nodes: nodes.filter((n) => n.id !== nodeId),
    edges: edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
  };
}

/** Return a new node list with `disabled` set on the target node only. */
export function setNodeDisabled(
  nodes: WorkflowNode[],
  nodeId: string,
  disabled: boolean,
): WorkflowNode[] {
  return nodes.map((n) =>
    n.id === nodeId ? { ...n, data: { ...n.data, disabled } } : n,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `frontend/`): `npm run test -- nodeOps`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/workflow/nodeOps.ts frontend/lib/workflow/__tests__/nodeOps.test.ts
git commit -m "feat(PC-903): add pure node operations (duplicate/remove/setDisabled)"
```

---

## Task 3: Client validation ignores disabled nodes

**Files:**
- Modify: `frontend/lib/workflow/compile.ts` (`validateNode` at `:150`, `validateWorkflow` at `:86`)
- Test: `frontend/lib/workflow/__tests__/compile.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/lib/workflow/__tests__/compile.test.ts` (the file already has `makeNode`/`makeEdge` helpers and imports `validateWorkflow`; add `validateNode` to the import on line 2):

```ts
// at top, extend the existing import:
// import { compileWorkflow, validateWorkflow, validateNode } from '../compile';

describe('disabled nodes', () => {
  it('validateNode returns no warnings for a disabled node', () => {
    // An import node with no params would normally warn; disabled suppresses it.
    const n = makeNode('x', 'import', { disabled: true });
    expect(validateNode(n, [n], [])).toEqual([]);
  });

  it('validateNode still warns for the same node when not disabled', () => {
    const n = makeNode('x', 'import', {});
    expect(validateNode(n, [n], []).length).toBeGreaterThan(0);
  });

  it('validateWorkflow treats a disabled chainFileOutput as absent', () => {
    const nodes: WorkflowNode[] = [
      makeNode('1', 'excelModels', { file: fakeFile, modelNames: ['M1'] }),
      makeNode('2', 'foreachModel'),
      makeNode('3', 'chainFileOutput', { disabled: true }),
    ];
    const edges: WorkflowEdge[] = [makeEdge('1', '2')];
    const result = validateWorkflow(nodes, edges);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.title === 'Add a Chain File Output node')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `frontend/`): `npm run test -- compile`
Expected: FAIL — the disabled `validateNode` returns warnings; the disabled `chainFileOutput` still counts so no error is raised.

- [ ] **Step 3: Implement — short-circuit disabled in `validateNode`**

In `frontend/lib/workflow/compile.ts`, at the very start of `validateNode` (just after the function signature, before `const warnings`):

```ts
export function validateNode(
  node: WorkflowNode,
  _allNodes: WorkflowNode[],
  allEdges: WorkflowEdge[],
): string[] {
  // PC-903: a disabled node won't run, so it shouldn't nag with warnings.
  if (node.data?.disabled) return [];

  const warnings: string[] = [];
  // ...unchanged below
```

- [ ] **Step 4: Implement — filter disabled in `validateWorkflow`**

In `validateWorkflow`, replace the first line of the body (`const errors: ActionableError[] = [];`) so disabled nodes are dropped before any structural check:

```ts
export function validateWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  excelNodeId?: string,
): { valid: boolean; errors: ActionableError[] } {
  // PC-903: disabled nodes are treated as absent — so e.g. disabling the only
  // Chain File Output still correctly raises "Add a Chain File Output node".
  nodes = nodes.filter((n) => !n.data?.disabled);

  const errors: ActionableError[] = [];
  // ...unchanged below
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `frontend/`): `npm run test -- compile`
Expected: PASS (all existing compile tests plus the 3 new ones).

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/workflow/compile.ts frontend/lib/workflow/__tests__/compile.test.ts
git commit -m "feat(PC-903): client validation ignores disabled nodes"
```

---

## Task 4: `NodeContextMenu` component

**Files:**
- Create: `frontend/components/workflow/NodeContextMenu.tsx`

> No automated test: React Testing Library is not installed, and this is a thin presentational component. Its only branching logic (`isControlFlowNode`) is covered by Task 1. Verified manually in Task 6. This mirrors PC-902, which did not unit-test its canvas button.

- [ ] **Step 1: Create the component**

Create `frontend/components/workflow/NodeContextMenu.tsx`:

```tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { Copy, CopyPlus, Trash2, EyeOff, Eye } from 'lucide-react';
import type { WorkflowNode } from '@/lib/workflow/types';
import { isControlFlowNode } from '@/lib/workflow/nodeKinds';

const MENU_WIDTH = 180;
const MENU_EST_HEIGHT = 168; // generous; only used to keep the menu on-screen

interface NodeContextMenuProps {
  x: number;
  y: number;
  node: WorkflowNode;
  onClose: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onToggleDisable: () => void;
}

export function NodeContextMenu({
  x,
  y,
  node,
  onClose,
  onDuplicate,
  onCopy,
  onDelete,
  onToggleDisable,
}: NodeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on outside-click, Escape, or scroll/zoom. Listeners are scoped to
  // the menu's open lifetime (this component is only mounted while open).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onClose, { passive: true });
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onClose);
    };
  }, [onClose]);

  // Clamp to the viewport so the menu never renders off the right/bottom edge.
  const left = Math.min(x, window.innerWidth - MENU_WIDTH - 8);
  const top = Math.min(y, window.innerHeight - MENU_EST_HEIGHT - 8);

  const isDisabled = !!node.data?.disabled;
  const canDisable = !isControlFlowNode(node.type);

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const itemClass =
    'w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-800 transition-colors';

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 py-1 rounded-md border border-gray-700/50 bg-gray-900/95 backdrop-blur-xl shadow-xl"
      style={{ left, top, width: MENU_WIDTH }}
    >
      <button type="button" role="menuitem" className={itemClass} onClick={run(onDuplicate)}>
        <CopyPlus className="w-4 h-4" /> Duplicate
      </button>
      <button type="button" role="menuitem" className={itemClass} onClick={run(onCopy)}>
        <Copy className="w-4 h-4" /> Copy
      </button>
      {canDisable && (
        <button type="button" role="menuitem" className={itemClass} onClick={run(onToggleDisable)}>
          {isDisabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {isDisabled ? 'Enable' : 'Disable'}
        </button>
      )}
      <div className="my-1 border-t border-gray-700/50" />
      <button
        type="button"
        role="menuitem"
        className={`${itemClass} text-rose-300 hover:bg-rose-500/10`}
        onClick={run(onDelete)}
      >
        <Trash2 className="w-4 h-4" /> Delete
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors from `NodeContextMenu.tsx`. (`CopyPlus`, `Eye`, `EyeOff`, `Copy`, `Trash2` are all valid `lucide-react` exports.)

- [ ] **Step 3: Commit**

```bash
git add frontend/components/workflow/NodeContextMenu.tsx
git commit -m "feat(PC-903): add NodeContextMenu component"
```

---

## Task 5: Wire `onNodeContextMenu` into the canvas

**Files:**
- Modify: `frontend/components/workflow/WorkspaceCanvas.tsx` (props interface `:51`, component params `:66`, `<ReactFlow>` `:141`)

> No automated test: trivial prop wiring (same rationale as Task 4 / PC-902).

- [ ] **Step 1: Add the prop to the interface**

In `WorkspaceCanvasProps` (`:51`), add after `onNodeDoubleClick`:

```ts
  onNodeContextMenu?: (event: React.MouseEvent, node: Node) => void;
```

- [ ] **Step 2: Destructure it**

In the `WorkspaceCanvas({ ... })` parameter list (`:66`), add `onNodeContextMenu,` after `onNodeDoubleClick,`.

- [ ] **Step 3: Wire it to `<ReactFlow>`**

In the `<ReactFlow>` JSX, add this prop right after the `onNodeDoubleClick={onNodeDoubleClick}` line (`:149`):

```tsx
        onNodeContextMenu={(event, node) => {
          event.preventDefault(); // suppress the native browser context menu
          onNodeContextMenu?.(event, node);
        }}
```

- [ ] **Step 4: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/workflow/WorkspaceCanvas.tsx
git commit -m "feat(PC-903): forward onNodeContextMenu from the canvas"
```

---

## Task 6: Wire state, handlers, and rendering in `page.tsx`

**Files:**
- Modify: `frontend/app/page.tsx` (imports; state near `:135`; handlers near `:165`; memo at `:1350`; render near `:1420`)

> No automated test (page-level wiring, no RTL). Verified manually in Step 8.

- [ ] **Step 1: Add imports**

Near the other `@/lib/workflow` imports (top of file), add:

```ts
import { NodeContextMenu } from '@/components/workflow/NodeContextMenu';
import { duplicateNode, removeNode, setNodeDisabled } from '@/lib/workflow/nodeOps';
```

- [ ] **Step 2: Add menu state**

Next to the other `useState` declarations (e.g. after the `viewport` state around `:142`), add:

```ts
  const [contextMenu, setContextMenu] =
    useState<{ nodeId: string; x: number; y: number } | null>(null);
```

- [ ] **Step 3: Add the open handler**

Add near `onNodeClick` (`:467`):

```ts
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);                // reflect target in the right sidebar
    setSelectedExcelNodeIds(new Set());   // single-node intent: drop multi-select
    setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
  }, []);
```

- [ ] **Step 4a: Add a module-scope id generator**

At module scope (top of the file, outside the `Home`/page component — next to the other top-level declarations), add a stable id factory so it doesn't need to appear in any `useCallback` dependency array:

```ts
// Stable across renders so it never needs to be a hook dependency. Mirrors the
// inline scheme handlePaste already uses.
function newNodeId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `node_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
```

- [ ] **Step 4b: Add the four action handlers**

Add after `handleAutoLayout` (`:177`). These reuse the pure ops from Task 2 and follow the existing history-snapshot pattern:

```ts
  const handleDuplicateNode = useCallback((nodeId: string) => {
    const original = nodes.find((n) => n.id === nodeId);
    if (!original) return;
    setHistory((prev) => [...prev, { nodes, edges }]);
    setFuture([]);
    const copy = duplicateNode(original, newNodeId);
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), copy]);
    notify.success('Node duplicated');
  }, [nodes, edges]);

  const handleCopyNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const { x, y } = node.position;
    clipboardRef.current = {
      nodes: [structuredClone(node)],
      edges: [],
      bounds: { minX: x, minY: y, maxX: x, maxY: y },
    };
    notify.info('Copied');
  }, [nodes]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setHistory((prev) => [...prev, { nodes, edges }]);
    setFuture([]);
    const next = removeNode(nodes, edges, nodeId);
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelectedNode((cur) => (cur && cur.id === nodeId ? null : cur));
    notify.success('Node deleted');
  }, [nodes, edges]);

  const handleToggleDisableNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const next = !node.data?.disabled;
    setHistory((prev) => [...prev, { nodes, edges }]);
    setFuture([]);
    setNodes((nds) => setNodeDisabled(nds, nodeId, next));
    setSelectedNode((cur) =>
      cur && cur.id === nodeId ? { ...cur, data: { ...cur.data, disabled: next } } : cur,
    );
    notify.info(next ? 'Node disabled' : 'Node enabled');
  }, [nodes, edges]);
```

- [ ] **Step 5: Decorate disabled nodes in the `nodesWithWarnings` memo**

Replace the memo body (`:1350`–`:1368`) so disabled nodes get the dim class and have warnings suppressed:

```ts
  const nodesWithWarnings = useMemo(
    () =>
      nodes.map((n) => {
        const disabled = !!n.data?.disabled;
        const w = disabled ? [] : (nodeWarnings.get(n.id) ?? []);
        const nodeState = nodeStates.get(n.id) ?? 'idle';
        const existingWarnings = (n.data as any)?.warnings as string[] | undefined;
        const existingState = (n.data as any)?.nodeState as string | undefined;
        const desiredClass = disabled ? 'pynode-disabled' : undefined;
        const warningsUnchanged = sameWarnings(existingWarnings, w);
        const stateUnchanged = (existingState ?? 'idle') === nodeState;
        const classUnchanged = (n.className ?? undefined) === desiredClass;
        // Skip rewrap when nothing relevant changed — preserves React Flow's
        // memoized node reconciliation.
        if (warningsUnchanged && stateUnchanged && classUnchanged) return n;
        return {
          ...n,
          className: desiredClass,
          data: { ...n.data, warnings: w, nodeState },
        };
      }),
    [nodes, nodeWarnings, nodeStates],
  );
```

- [ ] **Step 6: Pass the handler to the canvas**

In the `<WorkspaceCanvas ... />` JSX (`:1420`), add after `onNodeDoubleClick={onNodeDoubleClick}`:

```tsx
                  onNodeContextMenu={handleNodeContextMenu}
```

- [ ] **Step 7: Render the menu**

Inside the `currentPage === 'editor'` fragment, as a sibling after the `<input ... className="hidden" />` block (around `:1463`), add:

```tsx
            {contextMenu && (() => {
              const node = nodes.find((n) => n.id === contextMenu.nodeId);
              if (!node) return null;
              return (
                <NodeContextMenu
                  x={contextMenu.x}
                  y={contextMenu.y}
                  node={node}
                  onClose={() => setContextMenu(null)}
                  onDuplicate={() => handleDuplicateNode(node.id)}
                  onCopy={() => handleCopyNode(node.id)}
                  onDelete={() => handleDeleteNode(node.id)}
                  onToggleDisable={() => handleToggleDisableNode(node.id)}
                />
              );
            })()}
```

- [ ] **Step 8: Manual verification + typecheck**

Run (from `frontend/`): `npx tsc --noEmit` — expect no errors.
Then `npm run dev`, open the canvas, and confirm:
- Right-click a command node → menu appears at the cursor; native browser menu does not.
- **Duplicate** → a selected copy appears offset +40/+40; `Ctrl+Z` removes it.
- **Copy** then `Ctrl+V` → pastes the node.
- **Delete** → node and its edges vanish; `Ctrl+Z` restores them.
- **Disable** → node dims with a "Disabled" pill (after Task 7's CSS); menu now shows **Enable**; warning badge gone.
- Right-click a **Foreach Model** node → no Disable item.
- Outside-click / `Escape` / scroll closes the menu.

- [ ] **Step 9: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat(PC-903): wire context menu state, actions, and disabled decoration"
```

---

## Task 7: Disabled-node styling

**Files:**
- Modify: `frontend/app/globals.css` (near the existing node animations, `:445`)

- [ ] **Step 1: Add the CSS**

Append after the `.node-glow-pulse` block (`:453`):

```css
/* PC-903: a disabled node is dimmed/desaturated and tagged, so the muted look
   reads as intentional rather than as an unselected node. The class is attached
   to the React Flow node wrapper in app/page.tsx. */
.pynode-disabled {
  opacity: 0.45;
  filter: grayscale(0.85);
  transition: opacity 150ms ease, filter 150ms ease;
}
.pynode-disabled::after {
  content: 'Disabled';
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
  padding: 1px 8px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #fde68a;                      /* amber-200 */
  background: rgba(120, 53, 15, 0.92); /* amber-900-ish */
  border: 1px solid rgba(245, 158, 11, 0.6);
  border-radius: 9999px;
  pointer-events: none;
  white-space: nowrap;
}
```

- [ ] **Step 2: Manual verification**

With `npm run dev` running: disable a node → it dims/desaturates and shows the amber "Disabled" pill centered above it; enable → returns to normal with a smooth fade.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/globals.css
git commit -m "feat(PC-903): add disabled-node dim + pill styling"
```

---

## Task 8: Backend skips disabled nodes

**Files:**
- Modify: `backend/services/workflow_runner.py` (`_execute_node_with_capture`, `:726`)
- Test: `backend/tests/test_per_node_events.py`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_per_node_events.py` (reuses the module's existing `_node` / `_flow_edge` helpers and `monkeypatch` pattern):

```python
def test_disabled_node_is_skipped(monkeypatch):
    """A disabled middle node emits nothing and records no event, while the
    flow still routes through it to the downstream node."""
    nodes = [_node("a"), _node("b"), _node("c")]
    nodes[1]["data"]["disabled"] = True  # disable 'b'
    edges = [_flow_edge("a", "b"), _flow_edge("b", "c")]

    def patched_execute_node(node, model_name, variables, per_run_vars, xml_content, output_folder):
        xml_content.append(f"<{node['id']}>line")

    monkeypatch.setattr(workflow_runner, "execute_node", patched_execute_node)

    events: list = []
    xml_by_node: dict = {}
    out = build_command_chain(
        nodes, edges, "M", [], {}, "Model", "/tmp",
        node_events_out=events,
        node_xml_out=xml_by_node,
    )

    assert [e["node_id"] for e in events] == ["a", "c"]   # 'b' skipped
    assert "b" not in xml_by_node
    assert out == ["<a>line", "<c>line"]


def test_non_disabled_node_still_runs(monkeypatch):
    """Regression: the same graph without the disabled flag runs all three."""
    nodes = [_node("a"), _node("b"), _node("c")]
    edges = [_flow_edge("a", "b"), _flow_edge("b", "c")]

    def patched_execute_node(node, model_name, variables, per_run_vars, xml_content, output_folder):
        xml_content.append(f"<{node['id']}>line")

    monkeypatch.setattr(workflow_runner, "execute_node", patched_execute_node)

    events: list = []
    out = build_command_chain(
        nodes, edges, "M", [], {}, "Model", "/tmp",
        node_events_out=events,
    )
    assert [e["node_id"] for e in events] == ["a", "b", "c"]
    assert out == ["<a>line", "<b>line", "<c>line"]
```

- [ ] **Step 2: Run tests to verify the first fails**

Run (from `backend/`): `python -m pytest tests/test_per_node_events.py -v -k "disabled or non_disabled"`
Expected: `test_disabled_node_is_skipped` FAILS (events include `b`, output includes `<b>line`); `test_non_disabled_node_still_runs` already PASSES (regression guard).

- [ ] **Step 3: Implement the skip**

In `backend/services/workflow_runner.py`, in `_execute_node_with_capture` (`:726`), add the guard right after `node_id` / `node_type` / `node_label` are derived (after `:741`, before `xml_start = len(xml_content)`):

```python
    # PC-903 — a disabled node is a no-op: skip emission entirely but keep its
    # place in flow ordering, so execution still routes through it. Both
    # execution-order loops in build_command_chain funnel through here, so this
    # single guard covers the foreach and no-foreach paths.
    if (node.get('data') or {}).get('disabled'):
        return
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `backend/`): `python -m pytest tests/test_per_node_events.py -v`
Expected: PASS (all existing tests in the file plus the 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add backend/services/workflow_runner.py backend/tests/test_per_node_events.py
git commit -m "feat(PC-903): backend skips disabled nodes during emission"
```

---

## Task 9: Documentation — mark shipped

**Files:**
- Modify: `ROADMAP.md` (`:184` and `:226`)
- Modify: `CLAUDE.md` (Execution model → "Execution order", item 4)

- [ ] **Step 1: Update the ROADMAP entry**

Replace the PC-903 bullet at `ROADMAP.md:184-185` with a shipped entry (✅) summarizing the implementation:

```markdown
- ✅ **PC-903** — Right-click context menu on nodes.
  *Rationale:* `frontend/components/workflow/NodeContextMenu.tsx` renders a cursor-positioned menu (clamped on-screen, dismissed on outside-click / Escape / scroll) wired through React Flow's `onNodeContextMenu` (with `preventDefault` to suppress the native menu). Items: **Duplicate** (clone +40/+40, selected, one-step undo), **Copy** (into the existing paste clipboard), **Delete** (node + its edges), and **Disable/Enable**. Action logic lives in the pure `frontend/lib/workflow/nodeOps.ts` (`duplicateNode` / `removeNode` / `setNodeDisabled`) so it's unit-tested without RTL. "Disable" is end-to-end: a `data.disabled` flag dims the node via a `.pynode-disabled` class attached at the single `nodesWithWarnings` memo chokepoint (no per-node-file churn), suppresses its warnings, is treated as absent by `validateNode`/`validateWorkflow`, and is skipped by the backend in `_execute_node_with_capture` (covering both execution-order loops) so it becomes a no-op while flow still routes through it. Disable is hidden for control-flow node types (`excelModels`, `foreachModel`, `chainFileOutput`, `setVariable`) via `frontend/lib/workflow/nodeKinds.ts`. "Show generated XML" was deferred to PC-304. Tested in `nodeKinds.test.ts`, `nodeOps.test.ts`, the disabled cases in `compile.test.ts`, and `backend/tests/test_per_node_events.py`.
```

- [ ] **Step 2: Update the Suggested Order of Attack line**

Change `ROADMAP.md:226` from:

```markdown
7. **PC-903** — Right-click context menu.
```

to:

```markdown
7. ✅ **PC-903** — Right-click context menu.
```

- [ ] **Step 3: Add the CLAUDE.md note**

In `CLAUDE.md`, in the "Graph → XML compilation" section, item 4 ("Execution order"), append one sentence at the end of that item:

```markdown
Nodes with `data.disabled` (PC-903) are skipped during emission but remain in flow ordering, so they're a no-op the chain routes through.
```

- [ ] **Step 4: Commit**

```bash
git add ROADMAP.md CLAUDE.md
git commit -m "docs(PC-903): mark right-click context menu shipped"
```

---

## Task 10: Full verification

- [ ] **Step 1: Frontend — tests, lint, typecheck, build**

Run (from `frontend/`):

```bash
npm run test
npm run lint
npx tsc --noEmit
npm run build
```

Expected: all green. New tests (`nodeKinds`, `nodeOps`, disabled `compile` cases) pass; no lint/type errors; production build succeeds.

- [ ] **Step 2: Backend — full suite**

Run (from `backend/`):

```bash
python -m pytest tests/ -v --tb=short
```

Expected: all tests pass, including the two new ones in `test_per_node_events.py`.

- [ ] **Step 3: Final manual smoke test**

With both servers running, exercise the full menu once more on a real graph (duplicate, copy/paste, delete, disable→run→confirm the disabled node's commands are absent from the generated `.chain`, enable→run→confirm they return).

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** menu items (Tasks 4/6), Disable end-to-end — type (1), pure op (2), validation (3), visual (6/7), backend (8), control-flow gating (1/4); "Show XML" deferred (no task, by design); docs (9). All spec sections map to a task.
- **`disabled` access is consistent everywhere:** read as `node.data?.disabled` (frontend) / `(node.get('data') or {}).get('disabled')` (backend); written via `setNodeDisabled` / the toggle handler. The type lives in `WorkflowNode.data` via `NodeDataExtras`.
- **No new dependencies.** All icons used (`Copy`, `CopyPlus`, `Trash2`, `Eye`, `EyeOff`, `LayoutGrid`) are existing `lucide-react` exports.
