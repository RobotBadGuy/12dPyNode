# PC-901 — Toast notification system

**Date:** 2026-05-10
**Roadmap item:** [PC-901] `[P1]` `[Size: S]` `[Mode: regular]`
**Scope guarantee:** frontend-only. No backend changes, no schema/API changes, no `CLAUDE.md` architecture update required. Foundation for PC-911 (actionable error messages).

---

## Goals

- Add a lightweight, accessible toast surface (`sonner`) for non-blocking events the current UI can't surface well: warnings, non-fatal errors, and informational confirmations.
- Replace the lone `alert()` call in `app/page.tsx`.
- Stop dropping `console.warn` signals on the floor — surface them to the user.
- Demote the heavyweight `ErrorModal` from non-fatal template errors (load/save/delete failures) to lighter-weight toasts.
- Establish a thin wrapper (`lib/notify.ts`) that PC-911 can build on without committing every call site to a specific library.

## Non-goals

- **Replacing `TemplateNotification`.** The bespoke sparkles-and-progress-bar success toast for template save/load/import/restore/migration earns its weight; it's not worth flattening for consistency. Five call sites stay as-is.
- **Replacing `ErrorModal` for fatal cases.** The Excel-error variant (rich CTA + scroll-to-node) and run-time fatal errors (where the run stopped and the user must read) keep the modal — they want full attention, not a corner toast.
- **Replacing `SuccessCelebration`.** Owns the post-run hero moment; out of scope.
- **Rewriting error message *content*.** Making errors plain-English, node-aware, and actionable is PC-911's job. PC-901 only adds the surface; PC-911 fills it.
- **Action buttons (Retry / View logs).** The wrapper exposes the slot, but no PC-901 call site uses it. Reserved for PC-911.

---

## Library + setup

- Add `sonner` (~3kb gzipped, React 19 compatible) to `frontend/package.json`.
- Mount `<Toaster />` once in `frontend/app/layout.tsx` so toasts work from anywhere on the page.
- Configure: `theme="dark"`, `richColors` (auto green/red/amber backgrounds), `position="bottom-right"`. Bottom-right is deliberate — it avoids colliding with `TemplateNotification` (top-right) and the floating `RunProgressPanel` (bottom-right when running, but the run blocks toast spam from this surface anyway).
- `closeButton` enabled so users can dismiss without waiting for the timeout.

## Wrapper API — `frontend/lib/notify.ts`

```ts
import { toast } from 'sonner';

export const notify = {
  success: (message: string, opts?: { description?: string }) =>
    toast.success(message, opts),
  error: (
    message: string,
    opts?: {
      description?: string;
      action?: { label: string; onClick: () => void };
    },
  ) => toast.error(message, opts),
  warning: (message: string, opts?: { description?: string }) =>
    toast.warning(message, opts),
  info: (message: string, opts?: { description?: string }) =>
    toast.info(message, opts),
};
```

**Why a wrapper, given how thin it is:**

- One place to centralise defaults if we ever want app-wide tweaks (durations, position overrides, prefixes).
- Lets PC-911 layer on `action` without hunting individual `toast(...)` calls — the type signature already documents the slot.
- If we ever need to swap libraries (or stub in tests) it's a one-file change.
- The cost is ~15 lines. Not over-engineered for the leverage it provides.

---

## Concrete migration sites

All seven live in `frontend/app/page.tsx`. Line numbers are approximate (HEAD-relative; will drift as the file changes).

| # | Approx line | Today | After |
|---|---|---|---|
| 1 | ~1213 | `alert('Error importing template: ...')` | `notify.error("Couldn't import template", { description: err.message })` |
| 2 | ~1102 | `console.warn('Filtered out N invalid edges when loading template "..."')` | `notify.warning(\`Filtered \${dropped} invalid edge\${s} from "\${name}"\`)` |
| 3 | ~1199 | `console.warn('Filtered out N invalid edges when importing template')` | same shape as #2 |
| 4 | ~986  | `setErrorModal({ title: 'Could Not Load Templates', message })` (refresh failure) | `notify.error("Couldn't load templates", { description })` |
| 5 | ~1015 | `setErrorModal({ title: 'Could Not Load Templates', message })` (initial mount fetch) | same as #4 |
| 6 | ~1084 | `setErrorModal({ title: 'Could Not Save Template', message })` | `notify.error("Couldn't save template", { description })` |
| 7 | ~1146 | `setErrorModal({ title: 'Could Not Delete Template', message })` | `notify.error("Couldn't delete template", { description })` |

For #2 and #3, the existing `console.warn` is preserved alongside the new toast — losing the dev-console signal would regress debuggability.

For #4–#7, the `ErrorModal` import / state stays; we're not deleting it, we're just stopping these four call sites from using it. The Excel-error and fatal-run cases (`:735`, `:922`, `:967`) continue to call `setErrorModal`.

## Intentionally NOT in scope (stays as-is)

- `setErrorModal` at `:735` — "No Excel Models Selected" with `isExcelError: true`. Blocking precondition with rich CTA.
- `setErrorModal` at `:922` — workflow run failure mid-batch. Fatal, run-stopper.
- `setErrorModal` at `:967` — outer workflow run catch. Fatal.
- `TemplateNotification` (5 call sites). Bespoke success UI.
- `SuccessCelebration` post-run modal.
- `console.error` in `lib/workflow/templates.ts:60` — fires inside the one-shot localStorage migration loop. The aggregate result is already surfaced via `TemplateNotification` ("Migrated N templates to the cloud"); per-template failures inside that batch don't need their own toast surface.

---

## Tests

`frontend/lib/__tests__/notify.test.ts` (new):

- Mock `sonner`'s `toast` module (`vi.mock('sonner', ...)`).
- Assert each `notify.*` method delegates to the matching `toast.*` with the same `(message, opts)` signature.
- Assert the `action` slot on `error` flows through unchanged.

That's the entire test surface. The seven call-site changes are mechanical (`setErrorModal({...})` → `notify.error(...)`); their behaviour is "a toast appears" which jsdom + Sonner is awkward to assert and not worth the harness wrestling for a Size:S task. PC-503's existing pattern — test the pure module, skip the integration — applies.

No backend tests; no CI changes.

---

## File-level diff summary

**New files (2):**

- `frontend/lib/notify.ts` — wrapper module (~20 lines).
- `frontend/lib/__tests__/notify.test.ts` — wrapper tests (~40 lines).

**Modified files (3):**

- `frontend/package.json` — add `"sonner": "^1.x"` (latest stable at time of PR).
- `frontend/app/layout.tsx` — import + mount `<Toaster />`.
- `frontend/app/page.tsx` — seven call-site swaps + matching imports.

**Total expected change:** ~80 lines added, ~30 lines removed (the `setErrorModal({...})` blocks are 5–6 lines each; the toast replacements are 1–2 lines).

---

## Risks and mitigations

- **Sonner + React 19 compatibility.** Sonner's stable releases support React 19. Verify with `npm ls react` after install; if there's a peer-dep complaint, pin a known-good Sonner version.
- **Two notification systems coexisting.** Acceptable per the brainstorm decision. The split is *semantic*: bespoke celebratory UI vs. utilitarian toasts. Document the split in a one-line comment at the top of `lib/notify.ts` so future devs don't accidentally route template-success through `notify.success`.
- **PC-911 churn on these call sites.** Expected and fine — PC-911 will edit message text, not the wrapper or the call-site shape.

---

## Acceptance criteria

- [ ] `npm install` succeeds; no peer-dep warnings on Sonner.
- [ ] Toaster renders once at the root (no duplicates from React Strict Mode).
- [ ] All seven call sites listed above route through `notify`.
- [ ] No remaining `alert(` in `frontend/app/`.
- [ ] `console.warn` for filtered-edge cases still fires (dev signal preserved) AND a user-visible warning toast appears.
- [ ] `npm run lint`, `npm run test`, `npm run build` all green.
- [ ] Manual smoke: load a template with deliberately broken edges → both console.warn and toast appear; save/delete with backend off → red toast, app keeps working.
