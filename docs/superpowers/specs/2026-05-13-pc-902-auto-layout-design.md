# PC-902 — Auto-layout button

**Date:** 2026-05-13
**Roadmap item:** [PC-902] `[P1]` `[Size: S]` `[Mode: regular]`
**Scope guarantee:** frontend-only. No backend changes, no schema/API changes, no `CLAUDE.md` architecture update required.

---

## Context

The roadmap entry for PC-902 names two pieces — **mini-map** and **auto-layout**. The mini-map already shipped: `frontend/components/workflow/WorkspaceCanvas.tsx:174-188` renders `<MiniMap>` with custom node colors. This ticket therefore reduces to **auto-layout only**. The roadmap rationale stays accurate — instant orientation aids for messy graphs.

## Goals

- Add a single **Auto-layout** button to the canvas that re-flows the current nodes/edges into a clean DAG.
- Integrate with the existing undo/redo history so users can revert with `Ctrl+Z`.
- Keep the dependency footprint small. No layout library is installed today.
- Surface a brief toast confirmation (or "nothing to lay out" for an empty graph) using the existing `notify` wrapper from PC-901.

## Non-goals

- **Direction toggle / settings panel.** One direction, one button. If two users ask for vertical, revisit.
- **Animated transition.** Layout is instantaneous — `setNodes(...)` followed by `fitView()`. Skipping animation keeps the implementation trivial and avoids motion-sickness edge cases.
- **Layout-on-paste / layout-on-import.** Auto-layout is a user-triggered action only. The current paste/import flows preserve original positions and that's the right default.
- **Partial / selection-only layout.** Always lays out the entire graph.
- **Sticky-note nodes (PC-908) special-casing.** PC-908 hasn't shipped yet; add handling when it lands.
- **Backend changes.** None.

---

## Library

**`dagre`** (`^0.8.5`, ~40 KB minified, no runtime dependencies, MIT). It computes a DAG layout by assigning ranks (longest-path) then ordering within ranks to minimize crossings. The API is one function call: `dagre.layout(graph)`.

Why not `elkjs`: ~1.4 MB, Web Worker oriented, and its richer feature set (nested layouts, multiple algorithms) is unused here.

Add `dagre` + `@types/dagre` to `frontend/package.json`.

---

## Module — `frontend/lib/workflow/autoLayout.ts`

Pure function. No React, no React Flow imports. Easy to test in vitest.

```ts
import dagre from 'dagre';
import type { WorkflowNode, WorkflowEdge } from './types';

export interface AutoLayoutOptions {
  /** 'LR' (left-right) | 'TB' (top-bottom). Default 'LR'. */
  direction?: 'LR' | 'TB';
  /** Horizontal spacing between ranks. Default 80. */
  rankSep?: number;
  /** Vertical spacing between nodes in the same rank. Default 40. */
  nodeSep?: number;
  /** Fallback width/height when a node has no measured dimensions yet. */
  defaultWidth?: number;   // default 288 (matches BaseNode w-72)
  defaultHeight?: number;  // default 140
}

export function autoLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options?: AutoLayoutOptions,
): WorkflowNode[];
```

**Implementation notes:**

- Empty `nodes` → return `[]` immediately (don't construct a dagre graph).
- Read each node's measured dimensions when available via `node.measured?.width` / `node.measured?.height` (React Flow populates this after the first render). Fall back to `defaultWidth` / `defaultHeight`.
- Feed *all* edges into dagre, not just flow edges. Param/value edges still represent visual relationships the user wants to keep nearby. Filtering would let parameter-only branches drift away from their consumers.
- Self-loops and edges referencing missing node IDs are skipped (defensive — dagre throws on dangling refs).
- Dagre returns the **center** of each node; convert to top-left for React Flow: `position.x = layoutNode.x - width/2`.
- Preserve every other field on each node (spread `...node`). Only `position` changes.

---

## UI wiring

### `WorkspaceCanvas.tsx`

- Add `onAutoLayout?: () => void` to `WorkspaceCanvasProps`.
- Inside `<ReactFlow>`, add a `<Panel position="top-right">` containing a single `<Button>` with the `LayoutGrid` lucide icon and the text "Auto-layout". Style matches the existing `<Controls>` panel (`bg-gray-900/80 border-gray-700`).
- Hide the button when `nodes.length === 0` (no-op anyway, and an empty canvas shouldn't show stale affordances).

### `app/page.tsx`

- Add a `handleAutoLayout` callback alongside `handleUndo` / `handleRedo`:

  ```ts
  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) {
      notify.info('Nothing to lay out');
      return;
    }
    setHistory((prev) => [...prev, { nodes, edges }]);
    setFuture([]);
    const next = autoLayout(nodes, edges);
    setNodes(next);
    // Defer fitView to next tick so React Flow sees the new positions first.
    requestAnimationFrame(() => {
      reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 300 });
    });
    notify.success('Workflow auto-laid out');
  }, [nodes, edges]);
  ```

- Pass `onAutoLayout={handleAutoLayout}` to `<WorkspaceCanvas>`.
- `reactFlowInstanceRef` already exists (captured via `onInit` for viewport restoration).

### History interaction

Auto-layout writes one history entry — the pre-layout `{nodes, edges}` snapshot. `Ctrl+Z` restores the previous positions in one step. Matches every other mutation pathway in `app/page.tsx`.

### Toast interaction

Uses `notify.success` and `notify.info` from `frontend/lib/notify.ts` (PC-901). No new wrapper API needed.

---

## Tests — `frontend/lib/workflow/__tests__/autoLayout.test.ts`

Pure-function tests (vitest). No React, no DOM.

1. **Empty graph** → returns `[]`.
2. **Single isolated node** → keeps node, position is finite numbers, all other fields preserved.
3. **Linear chain** (`A → B → C`) → `x(A) < x(B) < x(C)` for `LR`; `y` values within a small band.
4. **Diamond** (`A → B, A → C, B → D, C → D`) → `A` leftmost, `D` rightmost, `B` and `C` share a rank (similar x, different y).
5. **Disconnected components** → both components get finite positions; no overlap of their bounding boxes.
6. **Preserves non-position fields** — `id`, `type`, `data`, `selected`, `measured`, etc. all survive unchanged.
7. **Uses measured dimensions when present** — a node with `measured: {width: 500, height: 200}` produces different spacing than the default-width case for the same graph.
8. **Self-loop edge** → does not throw; node still gets a position.
9. **Edge referencing missing node id** → does not throw; layout completes for the remaining valid edges.

No component-level test for the canvas button — wiring is trivial and would mostly test React Flow internals.

---

## File touch list

| File | Change |
|------|--------|
| `frontend/package.json` | Add `dagre` + `@types/dagre`. |
| `frontend/lib/workflow/autoLayout.ts` | **New.** Pure layout function. |
| `frontend/lib/workflow/__tests__/autoLayout.test.ts` | **New.** Vitest cases above. |
| `frontend/components/workflow/WorkspaceCanvas.tsx` | Add `onAutoLayout` prop + `<Panel>` with button. |
| `frontend/app/page.tsx` | Add `handleAutoLayout`; wire prop to canvas. |
| `ROADMAP.md` | Mark PC-902 as shipped with implementation summary. |

No backend files. No `CLAUDE.md` change.

---

## Risks & mitigations

- **Dagre's "center" vs React Flow's "top-left" coordinate convention.** Standard footgun. Address explicitly in the conversion step and in test #2 (sanity-check that positions look right).
- **Measured dimensions aren't ready on first render.** If a user clicks Auto-layout before any node has rendered (unlikely — the button only appears with `nodes.length > 0`), we fall back to `defaultWidth`/`defaultHeight`. The result is slightly tighter packing for one frame; the next click after measurement will be perfect. Acceptable.
- **Param/value edges affecting layout.** Treating all edges equally means a parameter-only sub-chain may shift the visual rank of its consumer. This is *desired* — keeps related nodes adjacent. If it ever looks wrong on real graphs, the fix is to weight flow edges higher (`minlen`). Not doing now.
- **Library typings.** `@types/dagre` is community-maintained but stable. Verified the API surface we need (`new dagre.graphlib.Graph()`, `setDefaultEdgeLabel`, `setNode`, `setEdge`, `layout`, `node(id)`) is fully typed.
