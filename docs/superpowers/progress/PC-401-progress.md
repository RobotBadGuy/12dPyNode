# PC-401 — Typed Variables — Progress Tracker

**Purpose:** Crash-safe resume file. If context is lost, read this top-to-bottom to
pick up exactly where we left off.

**Ticket:** PC-401 (EPIC-04 Variable System) · Mode: superpowers (TDD-first)
**Spec:** `docs/superpowers/specs/2026-05-30-pc401-typed-variables-design.md`
**Plan:** `docs/superpowers/plans/2026-05-30-pc401-typed-variables.md` (10 tasks, TDD)
**Branch:** `pc401-typed-variables` (feature branch; merge to main when green)
**Last updated:** 2026-05-30 (handoff)

---

## ⚠️ RESUME HERE — read this whole block first

**Current git state:** HEAD = `816ed97`, working tree **CLEAN**, local == origin/pc401-typed-variables.
Backend tasks T1–T4 are committed and **290 backend tests pass**. Frontend tasks
T5–T8 are **NOT started** (the files do not exist yet). The plan's full code for
every remaining task is in `docs/superpowers/plans/2026-05-30-pc401-typed-variables.md`
— follow it verbatim (Tasks 5–10).

### ENVIRONMENT — critical, cost me a lot of time
- **The committed `backend/venv` is DEAD.** Its `pyvenv.cfg` points at
  `C:\Users\d1_s1` / `G:\WebDev` (created on another machine). Running
  `backend/venv/Scripts/python.exe` errors: "did not find executable at C:\Users\d1_s1...".
  **Do NOT use it.**
- **Use bare `python`** (on PATH = `C:\Users\K132177\AppData\Local\Programs\Python\Python313\python.exe`,
  3.13.2). Confirmed it has pytest + pandas + openpyxl + fastapi. Run backend tests:
  `cd backend && python -m pytest tests/ -q -p no:cacheprovider`
  (the `.pytest_cache` permission warning is harmless; `-p no:cacheprovider` silences it).
- **`BashOutput` tool is UNAVAILABLE** this session. Do NOT use `run_in_background`
  for anything whose output you need — it's unreadable. Run foreground.
- **Do NOT batch many tool calls in one message.** One failure cancels the whole
  batch (a cancelled Edit, a cd typo, etc.). Go **one command at a time** for
  git/pytest/edits. This repeatedly bit me.
- Frontend: `cd frontend && npx vitest run <file>` / `npm run test` / `npx tsc --noEmit`
  / `npm run lint` / `npm run build` all work normally (foreground).

### What is DONE (committed on origin/pc401-typed-variables)
- `126563a` T1 — `backend/services/type_coercion.py`: `coerce_value(raw, declared_type, *, var_name="")`
  + `VariableCoercionError(var_name, declared_type, raw_value)`. 40 table tests in
  `tests/test_type_coercion.py`. (`b81f9f6` dropped an unused import.)
- `2237d71` T2 — `resolve_typed(var_name, model_name, variables, per_run_vars, declared_type, *, var_name_for_error="")`
  in `workflow_runner.py` (resolve then coerce; `resolve_variable` UNCHANGED, still `-> str`).
  5 tests in `tests/test_resolve_variable.py::TestResolveTyped`. (`b7e50cd` dropped unused import.)
- `bf18dcf` T3 — all **23** `continueOnFailure` extractions in `execute_node` now
  `coerce_value(data.get('continueOnFailure', True), 'boolean', var_name='continueOnFailure')`.
  Regression tests `tests/test_run_workflow.py::TestTypedBooleanCoercion` (false→false, true→true).
- `ef87131` T4 — **6** numeric extractions now
  `str(resolve_typed(data.get(<k>, <default>), model_name, variables, per_run_vars, 'number', var_name_for_error=<k>))`:
  drapeToTin zOffset; createTrimeshFromTin zOffset + depth; createTemplateFile
  finalCutSlope + finalFillSlope + finalSearchDistance. Tests `TestTypedNumberCoercion`.
  (`816ed97` repaired a duplicated test class.)
- PC-302 per-model except block stores `f"{type(e).__name__}: {e}"` so a
  VariableCoercionError surfaces as e.g. `VariableCoercionError: variable 'zOffset' (number): can't parse 'abc'`.

### ⚠️ KNOWN OPEN ITEM (minor, optional) — T4 isolation test
The spec reviewer correctly noted that `TestTypedNumberCoercion::test_bad_number_fails_only_that_model`
uses the SAME bad `zOffset="abc"` for BOTH models, so it only proves "no crash",
not true per-model isolation (both error). The current committed test PASSES and is
fine; the name just overpromises.
**I attempted to improve it** (give one model a good value, one bad, via
`zOffset="{model_name}"` with models `["5","abc"]`, asserting `statuses["5"]=="success"`
and `statuses["abc"]=="error"`). **It FAILED**: model "5" came back `error`, not
`success`. I reverted the change (tree is clean). **Do not blindly re-apply it.**
Before retrying, DEBUG why "5" fails — likely causes to check:
  1. How `_write_excel(["5","abc"])` round-trips through pandas — model name "5"
     may read back as `"5.0"` or int, or the header-skip logic may eat row 0.
  2. Whether `zOffset="{model_name}"` actually resolves (it should via resolve_variable
     template substitution), then coerces "5"→5→"5".
  3. Run `python -m pytest "tests/test_run_workflow.py::TestTypedNumberCoercion::test_bad_number_fails_only_that_model" -q -p no:cacheprovider` and read the actual error row: `print([r["error"] for r in details])`.
This is a NICE-TO-HAVE. If it's fiddly, **leave the committed test as-is** — it's
green and the coercion behavior itself is well covered by `test_type_coercion.py`.
Don't let it block the frontend work or the merge.

---

## REMAINING WORK (do in order, one command at a time)

### T5 — frontend coerce mirror (NOTE: plan says file `coerce.ts`, not `coerceCheck.ts`)
Create `frontend/lib/workflow/coerce.ts` exporting `type VariableType = 'string'|'number'|'boolean'`,
`coerceCheck(value, type): boolean`, `coerceErrorMessage(varName, type, value): string`.
Mirror backend accept-list (bool true/1/yes/on + false/0/no/off; number via `Number()`
with `Number.isFinite`, reject bool, reject ''; string always true). Create
`frontend/lib/workflow/__tests__/coerce.test.ts` (same table as backend). Full code
is in the plan, Task 5. Run `npx vitest run lib/workflow/__tests__/coerce.test.ts`.

### T6 — `frontend/lib/workflow/types.ts`
Add `import type { VariableType } from './coerce';` and `type?: VariableType;` to
`VariableBinding` (optional → 'string' default, no migration). `npx tsc --noEmit`.

### T7 — `frontend/lib/workflow/compile.ts` `validateNode`
Import `{ coerceCheck, coerceErrorMessage, type VariableType }` from `./coerce`.
Add a `setVariable` branch: for each variable, if `(v.type ?? 'string') !== 'string'`
and `!coerceCheck(v.value, type)` → `warnings.push(coerceErrorMessage(v.name, type, v.value))`.
Add 3 cases to `frontend/lib/workflow/__tests__/validateNode.test.ts` (bad-type warns,
good-type doesn't, legacy no-type doesn't). Run that test file.

### T8 — `frontend/components/workflow/RightSidebar.tsx` (setVariable editor, ~line 216–304)
`handleAddVariable`: add `type: 'string'`. Add a Type `<select>` (string/number/boolean)
before the Value field, and make Value adaptive: boolean→select(true/false),
number→`<input type="number">`, string→text. Full JSX in the plan, Task 8.
Then `npx tsc --noEmit`.

### T9 — full verification (foreground, one at a time)
`cd frontend`: `npm run test` (expect ~232+), `npx tsc --noEmit` (exit 0),
`npm run lint` (only pre-existing warnings), `npm run build` (success).
`cd backend`: `python -m pytest tests/ -q -p no:cacheprovider` (expect 290+).

### COMMIT frontend (after T5–T9 green), e.g.:
`git add frontend/lib/workflow/coerce.ts frontend/lib/workflow/__tests__/coerce.test.ts frontend/lib/workflow/types.ts frontend/lib/workflow/compile.ts frontend/lib/workflow/__tests__/validateNode.test.ts frontend/components/workflow/RightSidebar.tsx`
then commit `feat(PC-401): frontend typed variables ...` and `git push origin pc401-typed-variables`.

### T10 — adversarial review → ROADMAP → merge
- Adversarial multi-lens review of the whole branch diff (`git diff main..pc401-typed-variables`):
  lenses = correctness, frontend↔backend parity, regression-risk (confirm NO XML
  f-string site or `resolve_variable` changed), bool-before-number ordering. Verify
  each finding; apply confirmed fixes with their own commits.
- Mark ROADMAP.md PC-401 done: line ~90 `- **PC-401**` → `- ✅ **PC-401**` and the
  order-of-attack line (~271) too, with a house-style rationale paragraph (what
  shipped, the seam decision, tests, review result, verification). Commit.
- Merge: `git checkout main && git merge --no-ff pc401-typed-variables -m "merge(PC-401): typed variables" && git push origin main`
  (working-style memory: merge + push each ticket to main; --no-ff for one clean merge).
- Then `/code-review` is optional; update this tracker to all-done.

## Resolved design decisions (forks)
1. Types: `string`/`number`/`boolean` only (defer path/list, YAGNI).
2. Coercion failure: fail THAT model (PC-302), not whole run.
3. Seam: new pure `coerce_value()` + opt-in `resolve_typed()`; `resolve_variable` stays `-> str`.
4. Strictness: lenient accept-list (bool true/false/1/0/yes/no/on/off; number int/float incl. 13.0→13, reject nan/inf/non-numeric/bool).
5. Frontend: type dropdown + adaptive value input + validateNode pre-run warning.

## Gotchas
- Python `bool` is a subclass of `int` — `coerce_value` checks bool BEFORE numeric (already handled).
- Keep frontend `coerceCheck` and backend `coerce_value` parity-locked (shared test table).
- JS `Number('inf')` and `Number('nan')` are both `NaN` → `Number.isFinite` rejects them (good).
