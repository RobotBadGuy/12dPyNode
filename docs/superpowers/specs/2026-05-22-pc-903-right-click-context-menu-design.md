# PC-903 — Right-click context menu

**Date:** 2026-05-22
**Roadmap item:** [PC-903] `[P1]` `[Size: S]` `[Mode: regular]`
**Scope:** frontend + a small backend skip in `workflow_runner.py`. New node-data field (`disabled`); no API/route changes, no migration.

---

## Context

There is no context menu on the canvas today — React Flow's `onNodeContextMenu` callback is unused, so right-clicking a node shows the native browser menu. This ticket adds an in-app menu with the standard node actions.

Most of the plumbing already exists in `frontend/app/page.tsx`:

- **Copy/paste** — `handleCopy` (`page.tsx:180`) clones selected nodes into `clipboardRef`; `handlePaste` (`page.tsx:225`) re-ids and offsets them.
- **Undo/redo** — `history` / `future` snapshot stacks; every mutation pushes `{ nodes, edges }` and clears `future`.
- **Delete** — currently only via React Flow's `deleteKeyCode={['Backspace','Delete']}`.
- **Per-node decoration chokepoint** — the `nodesWithWarnings` memo (`page.tsx:1350`) is the single place every node passes through before reaching the canvas. Attaching a CSS class here dims disabled nodes without editing the ~32 individual node components.

"Disable" is a brand-new concept: no `data.disabled` exists anywhere in the codebase.

## Goals

- Right-clicking a node opens an in-app menu at the cursor with: **Duplicate**, **Copy**, **Delete**, **Disable / Enable**.
- Each action integrates with the existing undo/redo history (one `Ctrl+Z` reverts it) and fires a `notify` toast.
- A disabled node is visually dimmed, excluded from client-side validation, and **skipped by the backend runner** — a true no-op in the flow, like commenting out a step.
- No new dependencies. Custom positioned component, consistent with the codebase's hand-rolled modals.

## Non-goals

- **"Show generated XML for this node."** Deferred to PC-304 (pre-run Chain XML preview). PC-303 already shows per-node XML *after a run* in the right sidebar; a pre-run preview is PC-304's job, not this ticket's.
- **Multi-select bulk actions.** The menu operates on the single right-clicked node. Opening the menu selects that node (clearing any multi-selection) so the target is unambiguous.
- **Pane (canvas-background) context menu** and **edge context menu.** Nodes only.
- **Disabling control-flow nodes.** The Disable item is hidden for `excelModels`, `foreachModel`, `chainFileOutput`, and `setVariable` — disabling scaffolding is nonsensical. Duplicate/Copy/Delete remain universal (parity with existing copy-paste, which already allows any node).

---

## Component — `frontend/components/workflow/NodeContextMenu.tsx` (new)

A `position: fixed` menu rendered at the cursor. Pure presentational + self-dismissal; all mutations are delegated to callbacks passed from `page.tsx`.

```tsx
interface NodeContextMenuProps {
  x: number;
  y: number;
  node: WorkflowNode;        // the right-clicked node (for label + disabled state)
  onClose: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onToggleDisable: () => void;
}
```

**Behaviour:**

- Renders a vertical list of items. Each item runs its callback then calls `onClose`.
- The disable row reads `node.data.disabled` to show **"Disable"** or **"Enable"** with the matching icon (`EyeOff` / `Eye` from lucide).
- The disable row is **omitted entirely** when `node.type` is one of the control-flow types (`excelModels`, `foreachModel`, `chainFileOutput`, `setVariable`). A shared `CONTROL_FLOW_NODE_TYPES` constant backs this (see below).
- **Delete** is styled as the destructive item (rose text), matching `Trash2` usage elsewhere.
- **Position clamping:** given a fixed menu width (180px) and measured/estimated height, clamp `x`/`y` against `window.innerWidth`/`innerHeight` so the menu never renders off-screen near the right/bottom edges.
- **Dismissal:** a `useEffect` (active only while mounted) closes the menu on `mousedown` outside the menu element, `Escape`, and `wheel`. The component is only mounted when `contextMenu !== null`, so listeners are scoped to its open lifetime.

Styling matches existing dark surfaces: `bg-gray-900/95 border border-gray-700/50 rounded-md shadow-xl`, items `hover:bg-gray-800 text-gray-200 text-sm px-3 py-1.5`.

### Shared constant — `frontend/lib/workflow/nodeKinds.ts` (new, tiny)

The set `{ excelModels, foreachModel, chainFileOutput, setVariable }` is the backend's `control_flow_types` (`workflow_runner.py:683`). Extract it once on the frontend so the menu's "hide Disable" rule and any future logic share a single source of truth:

```ts
export const CONTROL_FLOW_NODE_TYPES = new Set([
  'excelModels', 'foreachModel', 'chainFileOutput', 'setVariable',
]);
export const isControlFlowNode = (type?: string) =>
  !!type && CONTROL_FLOW_NODE_TYPES.has(type);
```

---

## Wiring — `WorkspaceCanvas.tsx`

- Add `onNodeContextMenu?: (event: React.MouseEvent, node: Node) => void` to `WorkspaceCanvasProps`.
- Pass to `<ReactFlow onNodeContextMenu={(e, node) => { e.preventDefault(); onNodeContextMenu?.(e, node); }}>`. The `preventDefault()` suppresses the native browser menu.

The menu itself is **not** rendered inside `WorkspaceCanvas` — it lives in `page.tsx` so it can reach the existing handlers and history state directly.

---

## Wiring — `app/page.tsx`

### State

```ts
const [contextMenu, setContextMenu] =
  useState<{ nodeId: string; x: number; y: number } | null>(null);
```

### Open handler

```ts
const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
  setSelectedNode(node);                 // reflect in right sidebar; clears ambiguity
  setSelectedExcelNodeIds(new Set());    // drop any multi-selection
  setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
}, []);
```

### Action handlers

All four push one history entry (`setHistory((prev) => [...prev, { nodes, edges }]); setFuture([])`) and fire a `notify` toast, mirroring `handleAutoLayout`.

- **`handleDuplicateNode(nodeId)`** — find the node, deep-clone it, assign a fresh id (`crypto.randomUUID()` with the same timestamp fallback `handlePaste` uses), set `position` to `+40,+40`, `selected: true`; deselect all others; append. No edges are duplicated (single-node action). `notify.success('Node duplicated')`.
- **`handleCopyNode(nodeId)`** — write just that node into `clipboardRef` using the same shape as `handleCopy` (`{ nodes: [clone], edges: [], bounds }`), so a subsequent `Ctrl+V` paste works unchanged. No history entry (copy doesn't mutate the graph). `notify.info('Copied')`.
- **`handleDeleteNode(nodeId)`** — `setNodes` to drop the node; `setEdges` to drop every edge whose `source` or `target` is `nodeId`. Clear `selectedNode` if it was this node. `notify.success('Node deleted')`.
- **`handleToggleDisableNode(nodeId)`** — flip `data.disabled`; update the `selectedNode` mirror too (same pattern as the `onUpdateNode` prop at `page.tsx:1441`). Toast reflects the new state (`'Node disabled'` / `'Node enabled'`).

### Disabled-node decoration

Extend the existing `nodesWithWarnings` memo (`page.tsx:1350`) so a disabled node also gets a `className` and suppresses its warning badge:

- When `n.data.disabled` is truthy: set `className: 'pynode-disabled'` and force `warnings: []` (a disabled node shouldn't nag — it isn't going to run).
- Otherwise unchanged. The early-return fast path stays; the `disabled` flag joins the change-detection check so toggling re-wraps the node.

React Flow merges `node.className` onto the `.react-flow__node` wrapper, so dimming covers the whole node including its handles.

### Render

```tsx
{contextMenu && (() => {
  const node = nodes.find((n) => n.id === contextMenu.nodeId);
  if (!node) return null;
  return (
    <NodeContextMenu
      x={contextMenu.x} y={contextMenu.y} node={node}
      onClose={() => setContextMenu(null)}
      onDuplicate={() => handleDuplicateNode(node.id)}
      onCopy={() => handleCopyNode(node.id)}
      onDelete={() => handleDeleteNode(node.id)}
      onToggleDisable={() => handleToggleDisableNode(node.id)}
    />
  );
})()}
```

Rendered inside the `currentPage === 'editor'` branch, as a sibling of the canvas/sidebars.

---

## Disable semantics — end-to-end

### Type — `frontend/lib/workflow/types.ts`

Add `disabled?: boolean` to the node data interfaces. The interfaces already carry `[key: string]: unknown`, so this is additive and non-breaking; declaring it explicitly makes it first-class for the handlers and the memo. (If a shared base data type exists it goes there; otherwise add to each command-node interface — confirmed during implementation.)

### Client validation — `frontend/lib/workflow/compile.ts`

- `validateNode` returns `[]` immediately for a node with `data.disabled` — no warning badges on something that won't run.
- `validateWorkflow` filters disabled nodes out of its input up front, so they're treated as absent. Consequence (correct): disabling your only `chainFileOutput` still raises "no output node," because the disabled one no longer counts.

### Backend — `backend/services/workflow_runner.py`

`build_command_chain` has two execution-order loops (the foreach path at `:684`–`:690` and the no-foreach fallback at `:715`–`:721`), but **both** funnel every node through one helper: `_execute_node_with_capture` (`:726`). Add the skip there — a single chokepoint that covers both paths:

```python
# PC-903 — a disabled node is a no-op: skip emission but keep its place
# in flow ordering, so execution still routes through it.
if (node.get('data') or {}).get('disabled'):
    return
```

Placed at the top of `_execute_node_with_capture`, after `node_id` is derived. The disabled node still participates in flow-edge ordering (Kahn sort runs over edges, which are untouched), so execution routes *through* it — it simply emits nothing. It composes correctly with per-node XML capture (`node_xml_out`) and per-node events (`node_events_out`): an early `return` records neither, so a disabled node shows no run entry, which is correct.

### Visual — `frontend/app/globals.css`

A `.pynode-disabled` rule alongside the existing `.node-spin` / `.node-badge-enter` block:

- `opacity: 0.45; filter: grayscale(0.85);` on the node wrapper.
- A small "Disabled" pill via `::after` (absolute, top-center, `pointer-events: none`) so the dimming reads as intentional rather than as an unselected/faded node. Transition opacity for a smooth toggle.

---

## Tests

### Frontend — vitest

Logic-first; the menu component itself is thin. Where a handler is awkward to test through the full page, extract the pure part (e.g. an edge-pruning helper) and test that.

- **`compile.test.ts` additions:** `validateNode` returns `[]` for a disabled node; `validateWorkflow` ignores disabled nodes (disabling the sole `chainFileOutput` still errors; disabling an invalid node clears its error).
- **Duplicate** produces a node with a new id, `+40,+40` offset, `selected: true`, and identical `data` otherwise.
- **Delete** removes the node and exactly the edges touching it, leaving unrelated edges intact.
- **`nodeKinds` / `isControlFlowNode`** returns true for the four control-flow types, false otherwise (guards the "hide Disable" rule).

If React Testing Library is already wired (PC-911 added `jsdom`), add one `NodeContextMenu` render test: the Disable row is absent for `foreachModel` and present (labelled "Enable" when `data.disabled`) for a command node. If RTL is not set up, skip the component render test rather than introduce new test infra in a Size-S ticket.

### Backend — pytest (`backend/tests/test_run_workflow.py`)

- A graph `foreach → import → chainFileOutput` where `import` has `data.disabled: true`: the generated chain contains the scaffolding and the output but **none** of the import command lines, and `node_xml_out` has no entry (or an empty one) for the disabled node.
- The same graph without `disabled` still emits the import lines (regression guard that the skip is conditional).

---

## File touch list

| File | Change |
|------|--------|
| `frontend/components/workflow/NodeContextMenu.tsx` | **New.** Positioned menu component. |
| `frontend/lib/workflow/nodeKinds.ts` | **New.** `CONTROL_FLOW_NODE_TYPES` + `isControlFlowNode`. |
| `frontend/components/workflow/WorkspaceCanvas.tsx` | Add `onNodeContextMenu` prop; wire to `<ReactFlow>` with `preventDefault`. |
| `frontend/app/page.tsx` | Context-menu state + open handler; `handleDuplicateNode` / `handleCopyNode` / `handleDeleteNode` / `handleToggleDisableNode`; extend `nodesWithWarnings` for disabled className/warning-suppression; render `<NodeContextMenu>`. |
| `frontend/lib/workflow/types.ts` | Add `disabled?: boolean` to node data. |
| `frontend/lib/workflow/compile.ts` | `validateNode` / `validateWorkflow` ignore disabled nodes. |
| `frontend/app/globals.css` | `.pynode-disabled` dim + "Disabled" pill. |
| `frontend/lib/workflow/__tests__/*.test.ts` | Tests above. |
| `backend/services/workflow_runner.py` | Skip `data.disabled` nodes via an early `return` in `_execute_node_with_capture` (covers both execution-order loops). |
| `backend/tests/test_run_workflow.py` | Disabled-node skip + regression test. |
| `ROADMAP.md` | Mark PC-903 shipped with implementation summary. |

`CLAUDE.md` gets a one-line note under "Execution order" that disabled nodes are skipped during emission (mirrors the existing control-flow-skip sentence).

---

## Risks & mitigations

- **Menu position off-screen near edges.** Clamp `x`/`y` to the viewport. Covered in the component spec.
- **Dismissal listener leaks / double-close.** Listeners are attached in a `useEffect` that only runs while the menu is mounted (mounted ⇔ `contextMenu !== null`) and are removed on unmount. No global always-on listener.
- **Disabling a mid-flow node breaking the chain.** It doesn't: ordering is computed from edges (untouched); only emission is skipped, so the flow routes through the disabled node as a no-op. The backend test asserts the surrounding nodes still emit.
- **`disabled` leaking into templates/exports.** Desired — a saved template should remember which steps were disabled. `disabled` rides along in `node.data`, which templates already serialize wholesale. No special handling needed.
- **Native browser menu still appearing.** `event.preventDefault()` in the React Flow handler suppresses it; verified this is the documented React Flow pattern.
