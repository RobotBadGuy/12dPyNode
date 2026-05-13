# PC-902 Auto-layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Auto-layout" button to the workspace canvas that re-flows the current React Flow graph into a clean left-to-right DAG using `dagre`, with undo/redo and toast integration.

**Architecture:** Pure-function `autoLayout(nodes, edges, options?)` in `frontend/lib/workflow/autoLayout.ts` (vitest-testable, no React). UI is a single `<Panel position="top-right">` button inside `WorkspaceCanvas`. The handler in `app/page.tsx` snapshots history → `setNodes(autoLayout(...))` → `fitView()` → toast.

**Tech Stack:** Next.js / React 19, `@xyflow/react` 12, `dagre` (new), `sonner` via existing `lib/notify.ts`, vitest.

**Reference:** `docs/superpowers/specs/2026-05-13-pc-902-auto-layout-design.md`

---

### Task 1: Add dagre dependency

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install dagre + types**

Run from `frontend/`:

```bash
npm install dagre@^0.8.5
npm install --save-dev @types/dagre@^0.7.52
```

- [ ] **Step 2: Verify package.json updated**

`frontend/package.json` `dependencies` should now contain `"dagre": "^0.8.5"` and `devDependencies` should contain `"@types/dagre": "^0.7.52"`. `package-lock.json` should also be updated.

- [ ] **Step 3: Smoke-test the import**

Run from `frontend/`:

```bash
node -e "const d=require('dagre'); const g=new d.graphlib.Graph(); g.setGraph({}); g.setDefaultEdgeLabel(()=>({})); g.setNode('a',{width:10,height:10}); d.layout(g); console.log(g.node('a'));"
```

Expected: prints an object with `x`, `y`, `width: 10`, `height: 10`. Confirms the API surface the implementation uses is real.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(PC-902): add dagre + @types/dagre"
```

---

### Task 2: Write failing tests for `autoLayout`

**Files:**
- Create: `frontend/lib/workflow/__tests__/autoLayout.test.ts`

- [ ] **Step 1: Create the test file**

Write `frontend/lib/workflow/__tests__/autoLayout.test.ts` with the full content below. The tests assume an `autoLayout` function exported from `../autoLayout` that does not yet exist — they MUST fail to compile / run on first invocation.

```typescript
import { describe, expect, it } from 'vitest';
import { autoLayout } from '../autoLayout';
import type { WorkflowEdge, WorkflowNode } from '../types';

function makeNode(id: string, overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id,
    type: 'cleanModel',
    position: { x: 0, y: 0 },
    data: { label: id },
    ...overrides,
  } as WorkflowNode;
}

function makeEdge(id: string, source: string, target: string): WorkflowEdge {
  return {
    id,
    source,
    target,
    sourceHandle: 'flow:out',
    targetHandle: 'flow:in',
  } as WorkflowEdge;
}

describe('autoLayout', () => {
  it('returns [] for an empty graph', () => {
    expect(autoLayout([], [])).toEqual([]);
  });

  it('produces finite positions for a single isolated node', () => {
    const result = autoLayout([makeNode('a')], []);
    expect(result).toHaveLength(1);
    expect(Number.isFinite(result[0].position.x)).toBe(true);
    expect(Number.isFinite(result[0].position.y)).toBe(true);
  });

  it('lays out a linear chain left-to-right (LR default)', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')];
    const result = autoLayout(nodes, edges);
    const byId = Object.fromEntries(result.map((n) => [n.id, n.position]));
    expect(byId.a.x).toBeLessThan(byId.b.x);
    expect(byId.b.x).toBeLessThan(byId.c.x);
  });

  it('lays out a diamond with the join node rightmost', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')];
    const edges = [
      makeEdge('e1', 'a', 'b'),
      makeEdge('e2', 'a', 'c'),
      makeEdge('e3', 'b', 'd'),
      makeEdge('e4', 'c', 'd'),
    ];
    const result = autoLayout(nodes, edges);
    const byId = Object.fromEntries(result.map((n) => [n.id, n.position]));
    expect(byId.a.x).toBeLessThan(byId.b.x);
    expect(byId.a.x).toBeLessThan(byId.c.x);
    expect(byId.b.x).toBeLessThan(byId.d.x);
    expect(byId.c.x).toBeLessThan(byId.d.x);
    expect(byId.b.y).not.toEqual(byId.c.y);
  });

  it('handles disconnected components without throwing', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')];
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'c', 'd')];
    const result = autoLayout(nodes, edges);
    expect(result).toHaveLength(4);
    for (const n of result) {
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    }
  });

  it('preserves every non-position field on each node', () => {
    const original = makeNode('a', {
      type: 'foreachModel',
      selected: true,
      data: { label: 'A', custom: 42 } as any,
      measured: { width: 300, height: 120 },
    } as Partial<WorkflowNode>);
    const result = autoLayout([original], []);
    expect(result[0].id).toBe('a');
    expect(result[0].type).toBe('foreachModel');
    expect((result[0] as any).selected).toBe(true);
    expect(result[0].data).toEqual({ label: 'A', custom: 42 });
    expect((result[0] as any).measured).toEqual({ width: 300, height: 120 });
  });

  it('uses measured dimensions when present (wider nodes get more rank separation)', () => {
    const narrowNodes = [
      makeNode('a', { measured: { width: 100, height: 60 } } as any),
      makeNode('b', { measured: { width: 100, height: 60 } } as any),
    ];
    const wideNodes = [
      makeNode('a', { measured: { width: 600, height: 60 } } as any),
      makeNode('b', { measured: { width: 600, height: 60 } } as any),
    ];
    const edges = [makeEdge('e1', 'a', 'b')];
    const narrow = autoLayout(narrowNodes, edges);
    const wide = autoLayout(wideNodes, edges);
    const narrowSpan = narrow[1].position.x - narrow[0].position.x;
    const wideSpan = wide[1].position.x - wide[0].position.x;
    expect(wideSpan).toBeGreaterThan(narrowSpan);
  });

  it('does not throw on a self-loop edge', () => {
    const nodes = [makeNode('a')];
    const edges = [makeEdge('e1', 'a', 'a')];
    expect(() => autoLayout(nodes, edges)).not.toThrow();
    const result = autoLayout(nodes, edges);
    expect(Number.isFinite(result[0].position.x)).toBe(true);
  });

  it('skips edges whose endpoints are missing from the node list', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [
      makeEdge('e1', 'a', 'b'),
      makeEdge('e2', 'a', 'ghost'),
      makeEdge('e3', 'ghost', 'b'),
    ];
    expect(() => autoLayout(nodes, edges)).not.toThrow();
    const result = autoLayout(nodes, edges);
    const byId = Object.fromEntries(result.map((n) => [n.id, n.position]));
    expect(byId.a.x).toBeLessThan(byId.b.x);
  });

  it('supports TB direction (top-to-bottom) via options', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('e1', 'a', 'b')];
    const result = autoLayout(nodes, edges, { direction: 'TB' });
    const byId = Object.fromEntries(result.map((n) => [n.id, n.position]));
    expect(byId.a.y).toBeLessThan(byId.b.y);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `frontend/`:

```bash
npm run test -- autoLayout
```

Expected: FAIL — vitest reports the import of `../autoLayout` cannot be resolved (module does not yet exist).

---

### Task 3: Implement `autoLayout`

**Files:**
- Create: `frontend/lib/workflow/autoLayout.ts`

- [ ] **Step 1: Write the module**

Create `frontend/lib/workflow/autoLayout.ts` with the following content:

```typescript
import dagre from 'dagre';
import type { WorkflowEdge, WorkflowNode } from './types';

export interface AutoLayoutOptions {
  direction?: 'LR' | 'TB';
  rankSep?: number;
  nodeSep?: number;
  defaultWidth?: number;
  defaultHeight?: number;
}

const DEFAULTS: Required<AutoLayoutOptions> = {
  direction: 'LR',
  rankSep: 80,
  nodeSep: 40,
  defaultWidth: 288,
  defaultHeight: 140,
};

function getDimensions(
  node: WorkflowNode,
  fallbackW: number,
  fallbackH: number,
): { width: number; height: number } {
  const measured = (node as unknown as { measured?: { width?: number; height?: number } }).measured;
  return {
    width: measured?.width ?? fallbackW,
    height: measured?.height ?? fallbackH,
  };
}

export function autoLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options?: AutoLayoutOptions,
): WorkflowNode[] {
  if (nodes.length === 0) return [];

  const opts = { ...DEFAULTS, ...options };
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: opts.direction,
    ranksep: opts.rankSep,
    nodesep: opts.nodeSep,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const nodeIds = new Set<string>();
  for (const node of nodes) {
    const { width, height } = getDimensions(node, opts.defaultWidth, opts.defaultHeight);
    g.setNode(node.id, { width, height });
    nodeIds.add(node.id);
  }

  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const laid = g.node(node.id);
    const { width, height } = getDimensions(node, opts.defaultWidth, opts.defaultHeight);
    return {
      ...node,
      position: {
        x: laid.x - width / 2,
        y: laid.y - height / 2,
      },
    };
  });
}
```

- [ ] **Step 2: Run the tests**

Run from `frontend/`:

```bash
npm run test -- autoLayout
```

Expected: PASS — all 10 tests green.

- [ ] **Step 3: Run typecheck**

Run from `frontend/`:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/workflow/autoLayout.ts frontend/lib/workflow/__tests__/autoLayout.test.ts
git commit -m "feat(PC-902): add autoLayout pure function (dagre-based)"
```

---

### Task 4: Add Auto-layout button to canvas

**Files:**
- Modify: `frontend/components/workflow/WorkspaceCanvas.tsx`

- [ ] **Step 1: Add the `onAutoLayout` prop**

Find the `WorkspaceCanvasProps` interface (around line 49). Add `onAutoLayout?: () => void;` after `onInit?:`:

```typescript
interface WorkspaceCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onNodeDoubleClick?: (event: React.MouseEvent, node: Node) => void;
  onViewportChange?: (viewport: Viewport) => void;
  onInit?: (instance: ReactFlowInstance) => void;
  onAutoLayout?: () => void;
}
```

Also add `onAutoLayout` to the destructured parameters in the function signature (after `onInit,`).

- [ ] **Step 2: Add the `Panel` import**

In the import block at the top of the file, extend the `@xyflow/react` import to include `Panel`:

```typescript
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  Node,
  Connection,
  Viewport,
  ReactFlowInstance,
} from '@xyflow/react';
```

- [ ] **Step 3: Add the LayoutGrid icon import**

Add a new import line near the top of the file:

```typescript
import { LayoutGrid } from 'lucide-react';
```

- [ ] **Step 4: Render the button inside `<ReactFlow>`**

Locate the `<MiniMap>` element near the end of the file. Immediately after the closing `/>` of `<MiniMap ... />` (and still inside `<ReactFlow>`), insert:

```tsx
{onAutoLayout && nodes.length > 0 && (
  <Panel position="top-right">
    <button
      type="button"
      onClick={onAutoLayout}
      className="flex items-center gap-2 bg-gray-900/80 border border-gray-700 hover:bg-gray-800 text-gray-200 text-sm font-medium px-3 py-2 rounded-md shadow"
      title="Auto-layout (re-flow the graph)"
      aria-label="Auto-layout"
    >
      <LayoutGrid className="w-4 h-4" />
      Auto-layout
    </button>
  </Panel>
)}
```

- [ ] **Step 5: Typecheck**

Run from `frontend/`:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/workflow/WorkspaceCanvas.tsx
git commit -m "feat(PC-902): add Auto-layout button to canvas panel"
```

---

### Task 5: Wire up `handleAutoLayout` in page.tsx

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Confirm imports + ref**

At the top of `frontend/app/page.tsx`, verify these imports exist (add if missing):

```typescript
import { autoLayout } from '@/lib/workflow/autoLayout';
import { notify } from '@/lib/notify';
```

Confirm there is already a ref capturing the React Flow instance (set via `onInit`). Search for `reactFlowInstanceRef` or `useRef<ReactFlowInstance`. If one exists, reuse it. If none exists, add this declaration near the other refs at the top of the component:

```typescript
const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
```

…and wire it via the canvas `onInit` prop (`onInit={(instance) => { reactFlowInstanceRef.current = instance; }}`) — but DO NOT clobber any existing `onInit` logic; merge into the existing handler.

- [ ] **Step 2: Add the handler next to `handleRedo`**

Locate `handleRedo` (around line 155). Immediately after it, add `handleAutoLayout`:

```typescript
const handleAutoLayout = useCallback(() => {
  if (nodes.length === 0) {
    notify.info('Nothing to lay out');
    return;
  }
  setHistory((prev) => [...prev, { nodes, edges }]);
  setFuture([]);
  const next = autoLayout(nodes, edges);
  setNodes(next);
  requestAnimationFrame(() => {
    reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 300 });
  });
  notify.success('Workflow auto-laid out');
}, [nodes, edges]);
```

- [ ] **Step 3: Pass the prop into `<WorkspaceCanvas>`**

Find the `<WorkspaceCanvas ... />` JSX element. Add `onAutoLayout={handleAutoLayout}` to its props.

- [ ] **Step 4: Typecheck**

Run from `frontend/`:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run the full vitest suite**

Run from `frontend/`:

```bash
npm run test
```

Expected: all green (existing tests + new `autoLayout` tests).

- [ ] **Step 6: Lint**

Run from `frontend/`:

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 7: Manual smoke test**

Run the dev server (`npm run dev`), open http://localhost:3000, build a small graph (excelModels → foreachModel → cleanModel → chainFileOutput), drag the nodes into a messy arrangement, and click **Auto-layout** in the top-right of the canvas. Verify:

1. Nodes re-flow into a clean left-to-right DAG.
2. Edges follow.
3. The viewport recenters/zoom-to-fit.
4. A green toast "Workflow auto-laid out" appears.
5. `Ctrl+Z` restores the previous positions in one step.
6. With an empty canvas (no nodes), the button is hidden.

- [ ] **Step 8: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat(PC-902): wire handleAutoLayout into workspace page"
```

---

### Task 6: Mark PC-902 shipped in ROADMAP.md

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 1: Update the PC-902 entry**

In `ROADMAP.md`, locate the PC-902 bullet (around line 181):

```markdown
- **PC-902** `[P1]` `[Size: S]` `[Mode: regular]` — Mini-map and auto-layout button.
  *Rationale:* React Flow ships a `MiniMap` component out of the box — instant orientation aid for large workflows. Add an "Auto-layout" toolbar button using `dagre` or `elkjs` that re-flows messy graphs into a clean DAG. Both are cheap, both punch above their weight.
```

Replace with a shipped entry that records the actual implementation:

```markdown
- ✅ **PC-902** — Mini-map and auto-layout button.
  *Rationale:* The `<MiniMap>` was already present in `WorkspaceCanvas.tsx` with custom node colors per type. This ticket added the auto-layout half: new pure function `frontend/lib/workflow/autoLayout.ts` runs `dagre` (~40 KB, MIT) over all edges to compute a left-to-right DAG, respecting each node's measured dimensions and falling back to a 288×140 default. A `<Panel position="top-right">` in the canvas renders an "Auto-layout" button (hidden when the graph is empty); `handleAutoLayout` in `app/page.tsx` snapshots history (so `Ctrl+Z` reverts in one step), applies the new positions, then `fitView`s with a 300 ms tween and fires a `notify.success` toast. Self-loops and edges with missing endpoints are skipped defensively. Tested in `frontend/lib/workflow/__tests__/autoLayout.test.ts` (empty graph, single node, linear chain, diamond, disconnected components, field preservation, measured-vs-default dimensions, self-loop, dangling edge, TB direction).
```

- [ ] **Step 2: Update the Suggested Order of Attack**

In the same file, locate `Phase 2 — Cheap, high-impact UX wins` section and update PC-902's line from:

```markdown
6. **PC-902** — Mini-map + auto-layout. ~1 afternoon, instant credibility win.
```

to:

```markdown
6. ✅ **PC-902** — Mini-map + auto-layout.
```

- [ ] **Step 3: Commit**

```bash
git add ROADMAP.md
git commit -m "docs(PC-902): mark Mini-map + auto-layout shipped"
```

---

## Self-Review

**Spec coverage:**
- "Mini-map already shipped" callout → covered by Task 6 wording.
- `dagre` dependency → Task 1.
- `autoLayout` pure function with options interface → Task 3.
- All 9 test cases from spec + TB direction case → Task 2 (10 tests).
- `<Panel position="top-right">` button hidden on empty graph → Task 4.
- `handleAutoLayout` with history snapshot, `fitView`, toast → Task 5.
- Roadmap update → Task 6.
- No backend changes, no CLAUDE.md change → none planned (correct).

**Placeholder scan:** No TBDs, no "add error handling later," no "similar to Task N." Each step has either an exact command, exact code, or both.

**Type consistency:** `autoLayout(nodes, edges, options?)` signature is identical between Task 2 (test imports) and Task 3 (implementation). `AutoLayoutOptions` field names (`direction`, `rankSep`, `nodeSep`, `defaultWidth`, `defaultHeight`) match the spec verbatim. `onAutoLayout` prop name is identical in Task 4 (canvas) and Task 5 (page).
