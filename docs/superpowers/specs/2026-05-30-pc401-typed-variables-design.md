# PC-401 — Typed Variables (Design Spec)

**Status:** Approved (brainstorming complete) — ready for implementation plan
**Date:** 2026-05-30
**Epic:** EPIC-04 — Variable System
**Mode:** superpowers (TDD-first)

---

## 1. Problem

Every variable value in PyChain is coerced to `str` today. The backend
`resolve_variable` (`backend/services/workflow_runner.py:143`) always returns a
string, and node params are extracted ad hoc. This causes a class of **silent
chain-file corruption**:

- `cleanModel` extracts `continue_on_failure = data.get('continueOnFailure', 'True')`
  (`workflow_runner.py:300`) — the default is the **string** `'True'`, not a bool.
  Generators do `failure_str = 'true' if continue_on_failure else 'false'`, so any
  non-empty string (including `'false'` / `'False'` arriving from a template, a
  manual variable binding, or a `param:` edge) is truthy → emits
  `<Continue_on_failure>true</Continue_on_failure>` when the user meant false.
- Numbers hit the `'13.0'` vs `'13'` class already seen in PC-704 (pandas float
  stringification) — a numeric value can carry an unwanted `.0`.

The roadmap flags this ticket as TDD-first because "a regression here corrupts
every chain file silently."

## 2. Goals / Non-goals

**Goals**
- A variable binding can declare a `type`: `string` | `number` | `boolean`.
- Coercion happens **once, centrally**, in a pure, table-tested function.
- The documented `continueOnFailure` foot-gun is fixed end-to-end.
- An uncoercible value fails **that model only** with a clear message (reusing
  PC-302 per-model isolation), never silently emitting wrong XML.
- The SetVariable editor lets a user pick a type, with an adaptive value input and
  a pre-run validation warning.
- Zero migration: existing graphs/templates/drafts (no `type` field) keep working.

**Non-goals (deferred — YAGNI)**
- `path` and `list` types. No node consumes a list variable; path normalization on
  Windows backslashes is risky with no concrete driver. Revisit when a node needs
  them. (Mirrors EPIC-04 dropping speculative PC-402/403.)
- Changing `resolve_variable`'s return type or any XML-emitting call site.

## 3. Key decisions (resolved forks)

| Fork | Decision |
|------|----------|
| Type set | `string` / `number` / `boolean` only. Defer `path`/`list`. |
| Coercion failure | Fail **the model** with a typed error → PC-302 error row in `_summary.txt`; siblings still succeed. Pre-run frontend warning too. |
| Coercion seam | New pure `coerce_value()` + opt-in `resolve_typed()` at call sites. `resolve_variable` stays `-> str`; ~80 XML f-string sites untouched. |
| Strictness | Lenient, well-defined accept-list (see §4). |
| Frontend scope | Type dropdown + adaptive value input + `validateNode` pre-run warning. |

## 4. Coercion rules (the contract)

Pure function `coerce_value(raw, declared_type, *, var_name="")`:

- **string** → `str(raw)`. Never fails.
- **boolean** (case-insensitive, surrounding whitespace stripped):
  - real Python/JSON `bool` → passes through
  - `true`, `1`, `yes`, `on` → `True`
  - `false`, `0`, `no`, `off` → `False`
  - anything else (`maybe`, `""`, `2`) → raise `VariableCoercionError`
- **number** (surrounding whitespace stripped):
  - parses int/float; `"13.0"` → `13` (int when `float.is_integer()`, mirroring
    PC-704 `_normalize_model_key`); `"1.5"` → `1.5`; `"-4"` → `-4`
  - rejects `abc`, `""`, `nan`, `inf`, `1,000` → raise `VariableCoercionError`
- **unknown `declared_type`** → treat as `string` (forward-compatible with a future
  `path`/`list`; never crashes on an unrecognised type).

`VariableCoercionError(ValueError)` carries `var_name`, `declared_type`,
`raw_value` so the per-model message reads e.g.
`variable 'depth' (number): can't parse "abc"`.

**Frontend parity:** a pure `coerceCheck(value, type)` in `compile.ts` (or a small
sibling module) mirrors this accept-list. Backend and frontend are unit-tested
against the **same table** so they can't drift (the PC-704 `excelPreview` ↔ backend
parity approach).

## 5. Backend architecture

### 5.1 New file `backend/services/type_coercion.py`
- `class VariableCoercionError(ValueError)` with `var_name` / `declared_type` /
  `raw_value` attributes.
- `def coerce_value(raw, declared_type, *, var_name="") -> str | int | float | bool`
  implementing §4. Pure, no I/O, no DOM — fully table-testable.

### 5.2 `workflow_runner.py`
- `resolve_variable(...)` — **unchanged** (still returns `str`).
- New thin wrapper `resolve_typed(raw, model_name, variables, per_run_vars, declared_type, *, var_name="")`:
  calls `resolve_variable(...)` then `coerce_value(...)`. This is what nodes call
  when they need a typed value.
- `execute_node(...)` extraction lines change so typed params go through coercion:
  - **Boolean params** — the ~40 `continueOnFailure` sites. Replace
    `data.get('continueOnFailure', True/'True')` with a coerced extraction so the
    generator always receives a real `bool`. Fixes the `cleanModel` string-`'True'`
    bug and the `"false"`-string-truthy bug uniformly.
  - **Numeric params** — `zOffset`, `depth`, `finalCutSlope`, `finalFillSlope`,
    `finalSearchDistance`, and any other number-typed schema params: resolve, then
    coerce to number, then stringify for XML (so `'13.0'` can't leak).
- The coercion type for a **node-schema param** comes from the node schema's
  `kind` (`boolean` / `number`). The coercion type for a **variable reference**
  comes from that binding's declared `type`. Both feed the same `coerce_value`.

### 5.3 Error propagation
`VariableCoercionError` raised inside `execute_node` propagates out and is caught
by PC-302's existing per-model try/except in `run_workflow`. That model gets an
`error`-status `file_details` row; other models still ZIP normally; `_summary.txt`
records the failure. **No new error plumbing.**

### 5.4 Command generators
Unchanged. They already accept real `bool` / `str` / numeric types. We fix what
`execute_node` *passes*, not the generator signatures.

## 6. Frontend architecture

### 6.1 `lib/workflow/types.ts`
```ts
export type VariableType = 'string' | 'number' | 'boolean';
export interface VariableBinding {
  name: string;
  value: string | number | boolean;
  scope: 'per-run' | 'per-model';
  type?: VariableType;        // absent => 'string' (back-compat, no migration)
  source?: 'excel' | 'manual' | 'computed';
}
```

### 6.2 `components/workflow/RightSidebar.tsx` (SetVariable editor)
- Each variable row gains a **Type** `<select>` (string/number/boolean), defaulting
  to `string`. `handleAddVariable` sets `type: 'string'`.
- The **Value** input adapts to the selected type:
  - `boolean` → select (true / false)
  - `number` → `<input type="number">`
  - `string` → text input (today's behavior)

### 6.3 `lib/workflow/compile.ts`
- `validateNode` gains a check: a `setVariable` variable whose `value` fails
  `coerceCheck(value, type)` produces a per-node warning → existing amber
  `AlertTriangle` badge (PC-703).
- `coerceCheck(value, type)` is a pure helper mirroring §4 (parity-locked with the
  backend via a shared test table).
- **No change** to variable collection, `run.ts`, or the request JSON shape — the
  `type` field rides along in the existing `variables.json`.

## 7. Testing (TDD-first)

Write tests before implementation.

**Backend**
- `tests/test_type_coercion.py` (new): exhaustive table for `coerce_value` — every
  boolean spelling (pass + fail), `13.0`→`13`, `1.5`, `-4`, whitespace trimming,
  and each failure (`abc` / `nan` / `inf` / `maybe` / `""` / `1,000`) raising
  `VariableCoercionError` with the right attributes.
- `tests/test_resolve_variable.py`: add `resolve_typed` cases (resolve-then-coerce;
  template → number; per-model boolean).
- `tests/test_run_workflow.py`:
  - a model with a bad typed value → `error` row while siblings succeed (PC-302
    integration);
  - **regression guard:** a `cleanModel` whose `continueOnFailure` is supplied as
    the string `"false"` → emits `<Continue_on_failure>false</Continue_on_failure>`.

**Frontend**
- `lib/workflow/__tests__/coerceCheck.test.ts` (new): same table as backend,
  parity-locked.
- `lib/workflow/__tests__/validateNode.test.ts`: a bad typed variable → warning.

## 8. Files touched

**Backend**
- `backend/services/type_coercion.py` (new)
- `backend/services/workflow_runner.py` (`resolve_typed` wrapper; `execute_node`
  boolean + numeric extraction sites)
- `backend/tests/test_type_coercion.py` (new)
- `backend/tests/test_resolve_variable.py`
- `backend/tests/test_run_workflow.py`

**Frontend**
- `frontend/lib/workflow/types.ts`
- `frontend/lib/workflow/compile.ts` (`coerceCheck` + `validateNode`)
- `frontend/components/workflow/RightSidebar.tsx`
- `frontend/lib/workflow/__tests__/coerceCheck.test.ts` (new)
- `frontend/lib/workflow/__tests__/validateNode.test.ts`

**Docs**
- `ROADMAP.md` (mark PC-401 ✅ on completion)

## 9. Risks & mitigations

- **Seam regression (the big one).** Mitigated by *not* changing `resolve_variable`
  or any XML f-string site; coercion is opt-in at the ~40 boolean / handful of
  numeric extraction points, each covered by the regression guard test.
- **Frontend/backend drift.** Mitigated by the shared coercion table tested on both
  sides.
- **Back-compat.** `type` optional + defaults to `string`; no migration; existing
  templates/drafts/imports unaffected.
- **`bool` is an `int` in Python.** `coerce_value` must check `bool` *before* numeric
  parsing so `True` doesn't become `1` under `number`, and number coercion must
  reject bools if a number is expected from a bool source (define order explicitly
  in the helper).

## 10. Out of scope / follow-ups
- `path` / `list` types (revisit when a node needs them).
- Typed per-row values in the manual Model List (that's PC-1006).
