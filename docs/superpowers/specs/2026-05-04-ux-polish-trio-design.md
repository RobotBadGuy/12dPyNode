# UX Polish Trio — PC-701 + PC-702 + PC-703

**Date:** 2026-05-04
**Roadmap items:** [PC-701] `[P1]`, [PC-702] `[P2]`, [PC-703] `[P2]`
**Scope guarantee:** all three are frontend-only, share no backend dependencies, and ship together as one PR. Total expected change: ~400 lines of code + ~80 lines of tests, no schema/API changes, no `CLAUDE.md` architecture updates required.

---

## Goals

- Make ~30 palette node types findable in seconds instead of by scrolling collapsed sections.
- Surface the keyboard shortcuts that already exist in `app/page.tsx` (Ctrl+Z/Y/C/V) so users discover them.
- Show users *which* node is incomplete *before* they hit Run, so the error modal stops being the first signal.

## Non-goals

- Fuzzy matching in the palette (substring + curated keywords is enough for this size; revisit if the palette grows).
- A `required` flag on `ParameterDefinition` (would touch every entry in `nodeSchemas.ts`; hardcode the few rules in `validateNode` instead).
- A "Fix all warnings" panel or auto-fix actions.
- Replacing the existing `validateWorkflow` global checks at run time — `validateNode` is additive and runs continuously, not at submission.
- Backend changes. No new endpoints, no new types in `lib/workflow/types.ts` exposed to the API.
- Any change to `BaseNode`'s existing `nodeState` (`idle/running/success/error`) semantics. Warnings are a separate visual layer.

---

## PC-701 — Searchable node palette

### Current state

`frontend/components/workflow/LeftSidebar.tsx` lists ~30 node types as hardcoded `<Button>` elements grouped into 10 collapsible sections (`core`, `models`, `views`, `tin`, `design`, `quantities`, `strings`, `functions`, `conditionals`, `output`). All sections start **closed**. To add a node, the user must guess its category, expand the section, then scroll. Section labels and node labels are duplicated across the JSX.

### Approach

Extract the palette into a single data array and render both the sectioned view and the search-filtered view from the same source.

- New module `frontend/lib/workflow/palette.ts` exporting:
  ```ts
  export type PaletteCategory = 'core' | 'models' | 'views' | 'tin' | 'design'
    | 'quantities' | 'strings' | 'functions' | 'conditionals' | 'output';
  export interface PaletteItem {
    type: string;        // node type id (matches handleAddNode)
    label: string;       // display name (current button text)
    category: PaletteCategory;
    keywords?: string[]; // optional extra search terms (e.g. ['surface'] on triangulateManualOption)
  }
  export const PALETTE_ITEMS: PaletteItem[] = [...];
  export const CATEGORY_LABELS: Record<PaletteCategory, string> = {...};
  ```
- Add a small pure helper `filterPaletteItems(items, query): PaletteItem[]` — case-insensitive substring match against `label` + `keywords`. Empty query returns `items` unchanged.
- `LeftSidebar.tsx` rewrite:
  - Search input above "Add Nodes" with a clear (×) button. Local `query` state.
  - **Empty query** → render existing collapsible-sections view, but driven by `PALETTE_ITEMS.filter(i => i.category === cat)` instead of inline JSX.
  - **Non-empty query** → render a single flat list grouped by category subheaders. Skip headers for empty categories. Show "No matches for '{query}'" when the result is empty.
  - Section open-state behavior unchanged.

**Keyword seeds** (only where the label alone is non-obvious — not exhaustive): `triangulateManualOption: ['surface', 'tin']`, `convertLinesToVariable: ['string']`, `ifFunctionExists: ['conditional', 'branch']`, `chainFileOutput: ['export', 'save']`. Easy to extend later.

### Files

- `frontend/lib/workflow/palette.ts` (new, ~80 lines)
- `frontend/components/workflow/LeftSidebar.tsx` (rewrite the "Add Nodes" block; rest of file unchanged)
- `frontend/lib/workflow/__tests__/palette.test.ts` (new) — covers `filterPaletteItems`: empty query, label match, keyword match, no match, case-insensitivity.

---

## PC-702 — Keyboard shortcut cheatsheet

### Current state

`app/page.tsx:270-298` registers `Ctrl/⌘+Z`, `Ctrl/⌘+Y`, `Ctrl/⌘+C`, `Ctrl/⌘+V` with an input-focus guard. React Flow handles `Delete` and pan/zoom. Nothing tells the user any of this exists.

### Approach

A `?` key opens a centered modal listing shortcuts. A `?` icon button in the `TopBar` provides discoverability for users who'd never guess the keypress.

- New component `frontend/components/workflow/ShortcutsModal.tsx`:
  - Props: `isOpen`, `onClose`.
  - Renders a backdrop + centered card. `Esc` closes. Click on backdrop closes.
  - Single source array inside the file:
    ```ts
    interface Shortcut { keys: string[]; description: string }
    interface ShortcutGroup { category: string; items: Shortcut[] }
    const SHORTCUTS: ShortcutGroup[] = [...];
    ```
  - Render with `Cmd` vs `Ctrl` chosen at module load via `navigator.platform.includes('Mac')`. Falls back to `Ctrl` server-side (Next.js).
- `app/page.tsx`:
  - New state `showShortcuts`.
  - In the existing `keydown` handler, after the input-focus guard, branch on `e.key === '?'` (Shift+/ — no modifier required) → `setShowShortcuts(true)`.
  - Render `<ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />` next to the other modals.
- `components/workflow/TopBar.tsx`:
  - Add a small `?` icon button (lucide `HelpCircle`) that calls a new `onShowShortcuts` prop.
  - `app/page.tsx` passes `onShowShortcuts={() => setShowShortcuts(true)}`.

**Initial entries:**
- Editing: `Ctrl/⌘+Z` Undo, `Ctrl/⌘+Y` Redo, `Ctrl/⌘+C` Copy selection, `Ctrl/⌘+V` Paste
- Canvas (React Flow built-ins): `Delete` Remove selection, `Space + drag` Pan, `Scroll` Zoom
- Help: `?` Open this dialog

### Files

- `frontend/components/workflow/ShortcutsModal.tsx` (new, ~80 lines)
- `frontend/app/page.tsx` (~10 lines added: state, key handler branch, modal render)
- `frontend/components/workflow/TopBar.tsx` (~5 lines: icon button + prop)

No tests — pure presentational component. Smoke-tested manually.

---

## PC-703 — Validation badges on nodes

### Current state

`compileWorkflow` and `validateWorkflow` (`frontend/lib/workflow/compile.ts`) return *global* errors only — "Foreach Model node is required", "Excel Models node must connect to Foreach Model node". A node with an empty required parameter (e.g. `chainFileOutput.modelName`) only surfaces as a runtime XML failure. `BaseNode` already supports `nodeState: 'idle' | 'running' | 'success' | 'error'` for run-time states; warnings are a *static* signal, separate.

### Approach

Add a continuously-computed per-node warning list, derived from a small hardcoded ruleset, and render it as an amber badge on each affected node.

**New function** in `frontend/lib/workflow/compile.ts`:
```ts
export function validateNode(
  node: WorkflowNode,
  allNodes: WorkflowNode[],
  allEdges: WorkflowEdge[]
): string[]
```

Returns warnings for these cases (and only these):
1. `excelModels` with no `data.file` → `"No Excel file loaded"`
2. `chainFileOutput` with empty `data.modelName` → `"Model name is required"`
3. `chainFileOutput` with empty `data.projectFolder` → `"Project folder is required"`
4. **Generic param-handle check:** for any node, look up `nodeSchemas[node.type]`. For each `param:<key>` handle defined on the node, if `data[key]` is empty/falsy AND no edge in `allEdges` has `target === node.id` and `targetHandle === 'param:<key>'`, emit `"Missing parameter: <label>"` (using `parameter.label` from the schema).

Rule 4 is intentionally generic so it adapts as new params are added without further changes here. Rules 1–3 cover cases that aren't `param:` handles.

**Wiring:**

- In `app/page.tsx`, compute warnings once per render:
  ```ts
  const nodeWarnings = useMemo(() => {
    const map = new Map<string, string[]>();
    nodes.forEach(n => {
      const w = validateNode(n, nodes, edges);
      if (w.length > 0) map.set(n.id, w);
    });
    return map;
  }, [nodes, edges]);
  ```
- Wrap nodes before passing to `WorkspaceCanvas`:
  ```ts
  const nodesWithWarnings = useMemo(
    () => nodes.map(n => ({
      ...n,
      data: { ...n.data, warnings: nodeWarnings.get(n.id) ?? [] }
    })),
    [nodes, nodeWarnings]
  );
  ```
  Pass `nodesWithWarnings` instead of `nodes` to `<WorkspaceCanvas>`.
- `BaseNode.tsx`: new optional prop `warnings?: string[]`. If `warnings.length > 0` AND `nodeState === 'idle'`, render an amber `AlertTriangle` (lucide) badge in the **top-left** corner (`-top-2 -left-2`) — mirrors the existing success/error badges in the top-right so they don't overlap. The badge uses a native `title` attribute listing each warning on its own line — no popover library, no extra dependency.
- Each individual node component (e.g. `ChainFileOutputNode.tsx`) reads `data.warnings` from props and forwards it to `<BaseNode warnings={...}>`. To keep this from being 30+ identical edits, do it via `BaseNode` consuming `data.warnings` indirectly is awkward — **decision: edit each node component to forward `props.data.warnings`**. It's mechanical (~one-line change per file) and explicit.

**Edge case — selection state on rewrap:** the `nodesWithWarnings` map produces new node object references on every change, which would break React Flow's selection diff if positions/selected flags weren't preserved. Spreading `...n` carries those forward. Verified the same pattern already works for `applySnapshot`.

### Files

- `frontend/lib/workflow/compile.ts` (~50 lines added: `validateNode` + helper for the param check)
- `frontend/lib/workflow/__tests__/validateNode.test.ts` (new) — one test per rule + a no-warning baseline
- `frontend/components/workflow/nodes/BaseNode.tsx` (~20 lines: prop + badge JSX + lucide `AlertTriangle` import)
- `frontend/components/workflow/nodes/*.tsx` (one-line forwarding edit per file — ~30 files)
- `frontend/app/page.tsx` (~15 lines: two `useMemo`s + pass `nodesWithWarnings` to canvas)
- `frontend/lib/workflow/types.ts` — **no edit needed**. Every node-data interface already declares `[key: string]: unknown` (CLAUDE.md convention), so `data.warnings: string[]` will type-check on every node type without a base interface.

---

## Acceptance criteria

- **PC-701**: typing "tin" in the palette search shows every TIN-related node across categories. Clearing the search restores the collapsed-sections view. Adding a node from a search result still positions it correctly at viewport center.
- **PC-702**: pressing `?` (with no input focused) opens the modal. The modal lists all current shortcuts. `Esc` closes it. The TopBar `?` button opens it too. Shortcut keys render as `⌘` on Mac and `Ctrl` on Windows.
- **PC-703**: dropping a fresh `chainFileOutput` shows an amber warning badge with two warnings listed in the tooltip. Filling in `modelName` removes one warning; filling in `projectFolder` removes the other and the badge disappears. A node currently in `running`/`success`/`error` state does not show the warning badge (avoids visual collision).
- All three: `npm run lint`, `npm run test`, and `tsc --noEmit` pass. CI green.

## Test plan

- Vitest: `palette.test.ts` (filter helper), `validateNode.test.ts` (per-rule cases).
- Manual smoke in `npm run dev`:
  - Search "out" → matches Chain Output. Search "xyz" → "No matches". Clear search → sections collapse back.
  - `?` opens modal, `Esc` closes, TopBar button opens.
  - Fresh chainFileOutput shows badge with two warnings; fixing them clears the badge.

## Risks

- **Many small `nodes/*.tsx` edits** for PC-703 are mechanical but easy to miss one. Mitigation: a follow-up grep `param:` and confirm every node component renders `<BaseNode warnings={data.warnings}>`.
- **`?` key conflict**: some browser extensions hijack `?`. Acceptable — the TopBar button is the fallback discovery path.
- **Memoization bug surface**: `nodesWithWarnings` re-allocates objects whenever warnings change, which could flicker selection. Verified spread of `...n` carries `selected`. Worth a quick manual test of "select a node, edit a sibling's param, confirm selection survives."
