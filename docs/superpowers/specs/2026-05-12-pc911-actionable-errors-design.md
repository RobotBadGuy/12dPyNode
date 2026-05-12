# PC-911 — Actionable Error Messages

**Status:** Design approved 2026-05-12.
**Scope:** Frontend-only sweep. Backend HTTPException strings and per-model
`generate_chain_file` failure strings are deferred.

## Goal

Sweep through user-facing error sites in the frontend and rewrite each so that
the user sees:

1. The offending node by **label** (not raw `excelModels_1741...` id).
2. What's wrong, in **plain English**.
3. A **suggested fix** — one sentence, optionally with a button that scrolls
   the canvas to the relevant node.

Pairs with PC-901's `notify` wrapper, which already exposes an
`action: { label, onClick }` slot on `error` toasts for exactly this purpose.

## Out of scope

- **Backend HTTPException strings** in `backend/main.py`. The frontend wraps
  them generically and the user-visible wording is downstream of this work.
- **Per-model `generate_chain_file` errors** surfaced in
  `SuccessCelebration`'s failed-models list. The right fix needs a backend
  failure taxonomy that doesn't exist yet; defer to a follow-up ticket once
  there's evidence users find the current strings confusing.
- **New dependencies.** Sonner / lucide-react / React Flow are sufficient.

## Architecture

One small module plus targeted rewrites of three existing surfaces.

### 1. `frontend/lib/workflow/errors.ts` (new)

A single type and a `nodeLabel` helper. Thin on purpose — this is a vocabulary,
not a framework.

```ts
export interface ActionableError {
  title: string;         // e.g. "Workflow can't run yet"
  message: string;       // plain English; names the offending node when applicable
  fix?: string;          // one-sentence suggestion
  focusNodeId?: string;  // canvas id of the node the user should look at
}

export function nodeLabel(node: WorkflowNode): string {
  // Prefer the user-renamed label; fall back to the schema's display name;
  // last resort is the raw type. NEVER the React Flow id.
  const label = (node.data as Record<string, unknown>)?.label;
  if (typeof label === 'string' && label.trim()) return label.trim();
  const schema = node.type ? nodeSchemas[node.type] : undefined;
  if (schema?.name) return schema.name;
  return node.type ?? '(unknown node)';
}
```

### 2. `frontend/lib/workflow/focusNode.ts` (new)

Extracts the scroll-and-highlight pattern that today is inlined in
`components/workflow/ErrorModal.tsx:84-91`. One implementation, used by both
the existing `ErrorModal` "Find Upload" button and the new toast action button.

```ts
export function focusNode(nodeId: string, durationMs = 2000): void {
  const el = document.querySelector(`[data-node-id="${nodeId}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('ring-4', 'ring-amber-500', 'ring-opacity-75');
  setTimeout(() => {
    el.classList.remove('ring-4', 'ring-amber-500', 'ring-opacity-75');
  }, durationMs);
}
```

Note: the existing `ErrorModal` selects by `[data-node-type="excelModels"]`.
That's only correct because there's one Excel node and the modal can't be more
specific. The new helper selects by `data-node-id`, which is unambiguous. This
means every node DOM wrapper needs `data-node-id={node.id}` on it — most React
Flow nodes already expose this via `node.id`, but we need to verify
`BaseNode.tsx` and add it if missing.

### 3. Rewrite `validateWorkflow` and `compileWorkflow`

In `frontend/lib/workflow/compile.ts`:

- `validateWorkflow` returns `{ valid: boolean; errors: ActionableError[] }`
  instead of `{ valid: boolean; errors: string[] }`.
- `compileWorkflow` returns `CompiledWorkflow | { error: ActionableError }`
  instead of `{ error: string }`.

Rewrites:

| Current string | New title / message / fix |
|---|---|
| `"Excel file node is required"` (compileWorkflow) | title `Add an Excel Models node` / fix `Drag 'Excel Models' from the left palette onto the canvas.` |
| `"No model names found in Excel file"` (compileWorkflow) | title `Excel file has no model column` / message `'{label}' loaded a file but no model column was selected.` / fix `Open '{label}' and pick the column that contains model names (improved by PC-704).` / `focusNodeId` |
| `"Excel Models node is required"` (validateWorkflow) | same as the compileWorkflow Excel-missing case |
| `"Foreach Model node is required"` | title `Add a Foreach Model node` / fix `Drag 'Foreach Model' from the palette and connect the Excel node's right handle to it.` |
| `"At least one Chain File Output node is required"` | title `Add a Chain File Output node` / fix `Drag 'Chain File Output' from the palette and connect a Foreach output to it.` |
| `"Excel Models node must connect to Foreach Model node"` | title `Excel isn't wired to Foreach` / message `'{excelLabel}' isn't connected to '{foreachLabel}'.` / fix `Drag an edge from the Excel node's right handle to the Foreach node's left handle.` / `focusNodeId` (foreach) |

### 4. Surface routing

Two surfaces, used consistently:

- **Toast** (via `notify.error`) — when the user hasn't started a run yet and
  the error is a precondition failure. Toast `action` button: `Show me` →
  `focusNode(focusNodeId)`. Used by:
  - `validateWorkflow` / `compileWorkflow` failures at Run-click time
    (today: `runSingleWorkflow` throws + `setErrorModal` at line 968).
  - Template load/save/delete/import failures (today: already `notify.error`,
    we sharpen wording + add retry action where the handler is in scope).

- **Modal** (`ErrorModal`) — blocking failures that happen *after* a real run
  attempt, or the very first "you can't run yet" gate. Used by:
  - `"No Excel Models Selected"` (today: line 736). Body rewritten so the
    `message` reads as plain English and the title is consistent with the
    new vocabulary. Existing Quick Fix box stays.
  - `runSingleWorkflow` post-run failure (today: line 923, 968). Body uses
    node labels via `nodeLabel(...)`, not raw `excelNodeId`. The `errorModal`
    state grows an optional `focusNodeId`; the modal's close handler calls
    `focusNode(focusNodeId)` when set, so dismissing the modal lands the
    user looking at the offending node.

Rationale for the split: a toast with an action button is the right surface
for *fixable* preconditions (the user has the canvas open behind it and the
"Show me" button is one click away). The modal is the right surface for
*terminal* failures where the user has lost data and needs to read the message
before doing anything else.

### 5. Template toast sharpening

In `app/page.tsx`:

- L987, L1014 (`Couldn't load templates`) — add description
  `The templates service may be offline. Refresh to try again.`
- L1081 (`Couldn't save template`) — add `action: { label: 'Retry', onClick: () => handleSaveTemplate(...originalArgs) }`. The retry closure captures the same args the failed call used so the user doesn't have to re-fill the Save modal.
- L1146 (`Couldn't delete template`) — add `action: { label: 'Retry', onClick: () => handleDeleteTemplate(template.id) }`.
- L1216 (`Couldn't import template`) — distinguish parse errors from network
  errors. Parse: `The file isn't a valid PyChain template export.` Network:
  current description.

## Data flow

1. User clicks Run.
2. `handleRunChain` calls `validateWorkflow(nodes, edges, excelNodeId)`.
3. If `!valid`, take `errors[0]` (the first blocking issue — users hit one
   wall at a time) and fire a toast: `notify.error(err.title, { description: [err.message, err.fix].filter(Boolean).join(' — '), action: err.focusNodeId ? { label: 'Show me', onClick: () => focusNode(err.focusNodeId!) } : undefined })`. Return without running.
4. Same shape for `compileWorkflow` failure.
5. If the run reaches the backend and then fails, the existing modal path
   wakes up — body rewritten to use `nodeLabel(...)`.

The validateNode / canvas-badge path (PC-703) is unaffected. Per-node warnings
remain `string[]` because that surface doesn't need actions — the badge
already points at the right node by virtue of being on it. Keeping that
unchanged minimises scope.

## Testing

- `frontend/lib/workflow/__tests__/errors.test.ts` (new) — `nodeLabel`
  fallback chain (label → schema name → type → "(unknown node)").
- `frontend/lib/workflow/__tests__/compile.test.ts` (existing) — update
  assertions to the new `ActionableError[]` / `ActionableError` shape; add a
  case per rewritten error verifying that `title`, `fix`, and (where
  applicable) `focusNodeId` are populated.
- No backend tests — backend untouched.
- Manual smoke: open the app, click Run with each precondition missing in
  turn (no Excel, no Foreach, no Chain output, Excel-Foreach disconnected),
  verify the toast wording and the "Show me" button. Then with everything
  wired up, force a backend failure (e.g. break a `setVariable` value) and
  confirm the modal uses the node label.

## Risks

- **Callers of `validateWorkflow` / `compileWorkflow` outside `app/page.tsx`.**
  The grep shows only `app/page.tsx` consumes these. The test files in
  `frontend/lib/workflow/__tests__/` will be updated as part of this work.
- **`data.label` on nodes.** Not every node has one today. The
  `nodeLabel` helper falls back through `nodeSchemas[type].name` for nodes
  without a user-set label, so the rewrite never produces "{undefined} isn't
  connected to ...".
- **`data-node-id` attribute on DOM.** Need to verify `BaseNode.tsx` (or its
  parent React Flow wrapper) emits it. If missing, add to `BaseNode.tsx` —
  cheap, and unblocks the focus helper.
