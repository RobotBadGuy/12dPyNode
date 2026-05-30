# PC-905 — Auto-save & Draft Recovery (Design)

**Date:** 2026-05-30
**Ticket:** PC-905 `[P1] [Size: M] [Mode: superpowers]`
**Status:** Approved (brainstorm) → ready for implementation

## Problem

A browser crash or accidental refresh wipes in-progress work, because the
working graph (`nodes`/`edges`/`viewport`) lives only in React state in
`app/page.tsx` and resets to empty on every load. Saving to a Supabase template
is a deliberate, named action; users lose anything not yet saved.

## Goal

Silently persist the working graph to `localStorage` on a debounce, and on the
next load offer (via a modal) to restore it. Never lose work; never silently
clobber the canvas.

## Model: "last working session"

The draft is simply the **latest working graph**, auto-saved. It is **cleared
when work is safely persisted** (a successful template save) or explicitly
discarded. So a leftover draft means "you have work that wasn't saved as a
template." We deliberately do **not** dirty-diff the graph against the loaded
template — that comparison (normalising out React Flow's volatile `selected` /
`measured` fields, etc.) is the fragile complexity the ticket warns about, and
it isn't needed to meet the goal.

**Accepted tradeoff:** if a user *loads* a template, makes no edits, and
refreshes, they are still offered to restore (restoring just re-applies the same
graph). Harmless and safe. A future ticket can add dirty-awareness if the
redundant prompt proves annoying.

## Data

`localStorage` key: `pychain_workflow_draft` (one draft = current working state).
Existing keys (`pychain_workflow_templates*`) are untouched.

```ts
interface WorkflowDraft {
  version: 1;                 // forward-compat; unknown version => ignored
  savedAt: number;            // epoch ms (passed in, not read from Date inside pure code)
  nodes: WorkflowNode[];      // every data.file nulled (see Serialization)
  edges: WorkflowEdge[];
  viewport: { x: number; y: number; zoom: number };
  basedOnTemplate: { id: string; name: string } | null; // = loadedTemplate at save time
}
```

- **Variables** are not a separate state — they live in `setVariable` nodes, so
  persisting `nodes` captures them.
- **Excel `File` objects** can't be serialised. `serializeDraft` nulls every
  `data.file` so a `File` never round-trips to `{}` (which would make
  `isReadySource` think a file is present). The parsed names
  (`modelNames`/`columnName`/`availableColumns`/`selectedColumnIndex`) survive.
  On restore an Excel node needs its file re-uploaded before a run — the same
  constraint templates already have.

## Components / units

### `lib/workflow/draftStorage.ts` (pure core + guarded I/O — TDD keystone)

Pure (unit-tested, no DOM/Date inside):
- `serializeDraft(nodes, edges, viewport, basedOnTemplate, now): WorkflowDraft`
  — deep-clone nodes, set `data.file = null` on each, stamp `savedAt = now`.
- `isDraftEmpty(draft): boolean` — `nodes.length === 0`.
- `shouldOfferRestore(draft: WorkflowDraft | null, currentNodeCount: number): boolean`
  — true iff `draft` non-null, non-empty, **and** `currentNodeCount === 0`
  (never clobber a populated canvas).
- `formatDraftAge(savedAt, now): string` — "just now" / "N minutes ago" /
  "N hours ago" / "N days ago".

Guarded I/O (thin; try/catch → silent no-op / null):
- `loadDraft(): WorkflowDraft | null` — parse + version check; corrupt/SSR/absent → null.
- `saveDraft(draft): void` — JSON.stringify to the key; quota/SSR errors swallowed.
- `clearDraft(): void`.

### `components/workflow/RestoreDraftModal.tsx`

`ShortcutsModal`-style modal: heading "Restore previous session?", a line "N
nodes from <time ago>", **Restore** / **Discard** buttons. Esc / backdrop = keep
the draft for later (dismiss without deciding).

### `app/page.tsx` wiring

1. **Auto-save** — debounced (~1000 ms) `useEffect` on `[nodes, edges, viewport]`:
   - Skip the initial mount tick (don't overwrite the draft before the restore
     decision; don't persist the initial empty state).
   - Stay suppressed while the restore modal is open/pending.
   - When `nodes.length === 0`, `clearDraft()` instead of writing an empty draft.
   - Otherwise `saveDraft(serializeDraft(nodes, edges, viewport, loadedTemplate, Date.now()))`.
2. **Restore-on-load** — mount `useEffect`: read `loadDraft()`; if
   `shouldOfferRestore(draft, nodes.length)` → store it in state and open the modal.
3. **Restore** = `applySnapshot({nodes, edges, viewport})` (reuse existing) +
   `setLoadedTemplate(draft.basedOnTemplate)` + close modal + resume auto-save.
4. **Discard** = `clearDraft()` + close modal.
5. **Clear-on-save** — after a successful `handleSaveTemplateConfirm` (create or
   update), `clearDraft()`.

## Error handling

- All `localStorage` access guarded (`typeof window`, try/catch). Failures are
  silent best-effort (auto-save never interrupts the user; load failure = no draft).
- Corrupt JSON or unknown `version` → `loadDraft` returns null.

## Testing

- `lib/workflow/__tests__/draftStorage.test.ts` (jsdom for the I/O round-trip):
  `serializeDraft` nulls `data.file` and preserves structure/parsed names;
  `isDraftEmpty`; `shouldOfferRestore` truth table (non-empty+empty-canvas → true;
  empty draft → false; populated canvas → false; null draft → false);
  `formatDraftAge` buckets; `save`→`load`→`clear` round-trip; corrupt/version-mismatch
  → null.
- The modal + page wiring follow the existing no-RTL precedent (PC-1003/4/5,
  PC-704/910/904): verified by tsc + lint + build + adversarial review; the
  in-browser interaction is not automatable in this dev env (logged to memory;
  PC-505 Playwright is the eventual fix).

## Files

- NEW `frontend/lib/workflow/draftStorage.ts`
- NEW `frontend/lib/workflow/__tests__/draftStorage.test.ts`
- NEW `frontend/components/workflow/RestoreDraftModal.tsx`
- MOD `frontend/app/page.tsx` (auto-save effect, restore-on-load effect, modal
  mount, restore/discard handlers, clear-on-save)

## Build sequence (plan)

1. TDD `draftStorage.ts` (write `draftStorage.test.ts` first, then implement).
2. `RestoreDraftModal.tsx`.
3. Wire `app/page.tsx`: auto-save effect → restore-on-load effect → modal mount
   → restore/discard handlers → clear-on-save.
4. Verify: vitest + tsc + lint + build.
5. Adversarial multi-agent review → apply confirmed fixes.
6. Update ROADMAP, commit, push.

## Out of scope (YAGNI)

- Dirty-diff/content-hash awareness (the redundant-prompt tradeoff above).
- Multiple/named drafts (one draft = current working state).
- Persisting Excel `File` bytes (only parsed data survives, like templates).
- A "New/Clear workflow" action (none exists today; not needed for this feature).
