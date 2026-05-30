# PC-401 — Typed Variables — Progress Tracker

**Purpose:** Crash-safe resume file. If context is lost, read this top-to-bottom to
pick up exactly where we left off. Updated + committed before starting each task item.

**Ticket:** PC-401 (EPIC-04 Variable System) · Mode: superpowers (TDD-first)
**Spec:** `docs/superpowers/specs/2026-05-30-pc401-typed-variables-design.md`
**Plan:** `docs/superpowers/plans/2026-05-30-pc401-typed-variables.md` (10 tasks, TDD)
**Branch:** `pc401-typed-variables` (feature branch; push continuously; merge to main when green)
**Last updated:** 2026-05-30

---

## Status at a glance

| # | Step | Status |
|---|------|--------|
| 1 | Explore variable system context | ✅ done |
| 2 | Brainstorm design forks (5 resolved) | ✅ done |
| 3 | Present design, get approval (4 sections) | ✅ done |
| 4 | Write design spec | ✅ done (committed: pending) |
| 5 | Spec self-review | ✅ done (clean) |
| 6 | User reviews spec | ✅ approved |
| 7 | writing-plans → implementation plan | ✅ done |
| 8 | Implement (TDD): backend coercion | ⬜ not started |
| 9 | Implement (TDD): execute_node wiring | ⬜ not started |
| 10 | Implement (TDD): frontend editor + validation | ⬜ not started |
| 11 | Verify (pytest/vitest/tsc/lint/build) | ⬜ not started |
| 12 | Adversarial review → fixes | ⬜ not started |
| 13 | Update ROADMAP.md ✅, final commit + push | ⬜ not started |

## Resolved design decisions (forks)
1. **Type set:** `string` / `number` / `boolean`. Defer `path`/`list` (YAGNI).
2. **Coercion failure:** fail *that model* (PC-302 error row), not the whole run.
3. **Seam:** new pure `coerce_value()` + opt-in `resolve_typed()`; `resolve_variable`
   stays `-> str` (XML f-string sites untouched).
4. **Strictness:** lenient accept-list (bool: true/false/1/0/yes/no/on/off; number:
   int/float incl. `13.0`→`13`, reject nan/inf/non-numeric).
5. **Frontend:** type dropdown + adaptive value input + `validateNode` pre-run warning.

## Key files (from spec §8)
- Backend new: `backend/services/type_coercion.py`, `tests/test_type_coercion.py`
- Backend edit: `workflow_runner.py` (resolve_typed + execute_node), `test_resolve_variable.py`, `test_run_workflow.py`
- Frontend: `types.ts`, `compile.ts` (coerceCheck+validateNode), `RightSidebar.tsx`, new `coerceCheck.test.ts`, `validateNode.test.ts`

## Resume notes / next action
> **NEXT:** plan written. Execute task-by-task from
> `docs/superpowers/plans/2026-05-30-pc401-typed-variables.md` (subagent-driven
> recommended). Start with Task 1 (pure coerce_value, TDD).

## Gotchas to remember
- Python `bool` is a subclass of `int` — `coerce_value` must check bool BEFORE numeric
  parsing, or `True` becomes `1` under `number`.
- `cleanModel` line ~300 is the only site defaulting to string `'True'` — the canonical
  regression-guard test target.
- Keep frontend `coerceCheck` and backend `coerce_value` parity-locked via a shared
  test table.
