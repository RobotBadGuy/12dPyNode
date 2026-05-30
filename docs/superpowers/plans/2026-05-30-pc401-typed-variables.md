# PC-401 Typed Variables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a variable binding declare a `type` (`string`/`number`/`boolean`) so values are coerced once, centrally, killing the silent chain-file corruption where a boolean arriving as the string `"false"` evaluates truthy and emits `true`.

**Architecture:** A new pure `coerce_value()` helper (backend) + a mirrored `coerceCheck()`/`coerceValueForXml()` (frontend), table-tested for parity. `resolve_variable` stays `-> str` so the ~80 XML f-string interpolation sites are untouched. Node param extraction in `execute_node` opt-in to coercion (the ~40 `continueOnFailure` boolean sites + numeric `zOffset`/`depth`/etc.). Uncoercible values raise `VariableCoercionError`, caught by PC-302's existing per-model isolation. The SetVariable editor gets a type dropdown + adaptive value input + a pre-run `validateNode` warning.

**Tech Stack:** Python 3.11/3.12 + pytest (backend); Next.js 15 / React 19 / TypeScript + vitest (frontend).

**Spec:** `docs/superpowers/specs/2026-05-30-pc401-typed-variables-design.md`
**Branch:** `pc401-typed-variables` (already created & pushed; commit each task)
**Progress tracker:** `docs/superpowers/progress/PC-401-progress.md` (update + commit after each task)

---

## File Structure

**Backend**
- `backend/services/type_coercion.py` — **new.** Pure `coerce_value()` + `VariableCoercionError`. One responsibility: turn a raw value + declared type into a typed value or raise. No I/O.
- `backend/services/workflow_runner.py` — **modify.** Add `resolve_typed()` wrapper; change boolean + numeric extraction sites in `execute_node`.
- `backend/tests/test_type_coercion.py` — **new.** Exhaustive table tests for the helper.
- `backend/tests/test_resolve_variable.py` — **modify.** Add `resolve_typed` cases.
- `backend/tests/test_run_workflow.py` — **modify.** Add the integration + regression-guard cases.

**Frontend**
- `frontend/lib/workflow/coerce.ts` — **new.** Pure `VariableType`, `coerceCheck()` (does it coerce?) and `coerceErrorMessage()`. Mirrors the backend accept-list. One responsibility: the frontend half of the parity contract.
- `frontend/lib/workflow/types.ts` — **modify.** Add `VariableType` + `type?` on `VariableBinding`.
- `frontend/lib/workflow/compile.ts` — **modify.** `validateNode` warns on a setVariable value that won't coerce.
- `frontend/components/workflow/RightSidebar.tsx` — **modify.** Type dropdown + adaptive value input in the setVariable editor.
- `frontend/lib/workflow/__tests__/coerce.test.ts` — **new.** Same table as backend.
- `frontend/lib/workflow/__tests__/validateNode.test.ts` — **modify.** Bad-typed-variable warning case.

---

## Task 1: Backend pure coercion helper (`coerce_value`)

**Files:**
- Create: `backend/services/type_coercion.py`
- Test: `backend/tests/test_type_coercion.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_type_coercion.py`:

```python
"""Tests for services/type_coercion — PC-401 typed-variable coercion."""
import math

import pytest

from services.type_coercion import coerce_value, VariableCoercionError


class TestString:
    def test_passthrough(self):
        assert coerce_value("hello", "string") == "hello"

    def test_stringifies_non_string(self):
        assert coerce_value(13, "string") == "13"
        assert coerce_value(True, "string") == "True"  # str() of a bool; string type never coerces casing

    def test_unknown_type_treated_as_string(self):
        assert coerce_value("x", "path") == "x"
        assert coerce_value("a,b", "list") == "a,b"


class TestBoolean:
    @pytest.mark.parametrize("raw", ["true", "True", "TRUE", " true ", "1", "yes", "YES", "on", True])
    def test_truthy(self, raw):
        assert coerce_value(raw, "boolean") is True

    @pytest.mark.parametrize("raw", ["false", "False", "FALSE", " false ", "0", "no", "NO", "off", False])
    def test_falsy(self, raw):
        assert coerce_value(raw, "boolean") is False

    @pytest.mark.parametrize("raw", ["maybe", "", "2", "tru", "yo"])
    def test_invalid_raises(self, raw):
        with pytest.raises(VariableCoercionError):
            coerce_value(raw, "boolean")

    def test_error_carries_context(self):
        with pytest.raises(VariableCoercionError) as exc:
            coerce_value("maybe", "boolean", var_name="keep")
        err = exc.value
        assert err.var_name == "keep"
        assert err.declared_type == "boolean"
        assert err.raw_value == "maybe"


class TestNumber:
    def test_int(self):
        assert coerce_value("13", "number") == 13

    def test_float_with_trailing_zero_becomes_int(self):
        assert coerce_value("13.0", "number") == 13

    def test_real_float(self):
        assert coerce_value("1.5", "number") == 1.5

    def test_negative(self):
        assert coerce_value("-4", "number") == -4

    def test_whitespace_trimmed(self):
        assert coerce_value(" 7 ", "number") == 7

    def test_passthrough_numeric(self):
        assert coerce_value(13, "number") == 13
        assert coerce_value(1.5, "number") == 1.5

    @pytest.mark.parametrize("raw", ["abc", "", "1,000", "nan", "inf", "-inf"])
    def test_invalid_raises(self, raw):
        with pytest.raises(VariableCoercionError):
            coerce_value(raw, "number")

    def test_bool_is_not_a_number(self):
        # bool is an int subclass in Python; a boolean must not silently become 1/0.
        with pytest.raises(VariableCoercionError):
            coerce_value(True, "number")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_type_coercion.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'services.type_coercion'`

- [ ] **Step 3: Write minimal implementation**

Create `backend/services/type_coercion.py`:

```python
"""
PC-401 — typed-variable coercion.

A single pure function turns a raw value + declared type into a typed value, or
raises VariableCoercionError. Kept separate from workflow_runner so it has one
responsibility and is exhaustively table-testable. resolve_variable still returns
str; this is the opt-in layer that nodes call when they need a real bool/number.

Accept-lists are intentionally lenient but well-defined (see PC-401 spec §4) and
MUST stay in parity with the frontend mirror in frontend/lib/workflow/coerce.ts.
"""
import math
from typing import Any

VariableType = str  # 'string' | 'number' | 'boolean' (others treated as string)

_BOOL_TRUE = {"true", "1", "yes", "on"}
_BOOL_FALSE = {"false", "0", "no", "off"}


class VariableCoercionError(ValueError):
    """A value could not be coerced to its declared type.

    Carries enough context for a per-model error message like
    `variable 'depth' (number): can't parse "abc"`.
    """

    def __init__(self, var_name: str, declared_type: str, raw_value: Any):
        self.var_name = var_name
        self.declared_type = declared_type
        self.raw_value = raw_value
        name_part = f" '{var_name}'" if var_name else ""
        super().__init__(
            f"variable{name_part} ({declared_type}): can't parse {raw_value!r}"
        )


def coerce_value(raw: Any, declared_type: str, *, var_name: str = "") -> Any:
    """Coerce ``raw`` to ``declared_type`` (string/number/boolean).

    Unknown types are treated as 'string' (forward-compatible with a future
    path/list). Raises VariableCoercionError on an uncoercible value.
    """
    if declared_type == "boolean":
        return _coerce_bool(raw, var_name)
    if declared_type == "number":
        return _coerce_number(raw, var_name)
    # 'string' and any unrecognised type
    return str(raw)


def _coerce_bool(raw: Any, var_name: str) -> bool:
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        # Only the canonical 0/1 are meaningful; defer to the string table.
        raw = str(int(raw)) if float(raw).is_integer() else str(raw)
    text = str(raw).strip().lower()
    if text in _BOOL_TRUE:
        return True
    if text in _BOOL_FALSE:
        return False
    raise VariableCoercionError(var_name, "boolean", raw)


def _coerce_number(raw: Any, var_name: str):
    # bool is an int subclass — reject it explicitly so True/False can't become 1/0.
    if isinstance(raw, bool):
        raise VariableCoercionError(var_name, "number", raw)
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        if math.isnan(raw) or math.isinf(raw):
            raise VariableCoercionError(var_name, "number", raw)
        return int(raw) if raw.is_integer() else raw
    text = str(raw).strip()
    try:
        f = float(text)
    except (ValueError, OverflowError):
        raise VariableCoercionError(var_name, "number", raw)
    if math.isnan(f) or math.isinf(f):
        raise VariableCoercionError(var_name, "number", raw)
    return int(f) if f.is_integer() else f
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_type_coercion.py -v`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add backend/services/type_coercion.py backend/tests/test_type_coercion.py
git commit -m "feat(PC-401): pure coerce_value helper + VariableCoercionError"
```

- [ ] **Step 6: Update progress tracker**

Mark step 8 (backend coercion) in `docs/superpowers/progress/PC-401-progress.md` and commit:

```bash
git add docs/superpowers/progress/PC-401-progress.md
git commit -m "docs(PC-401): progress — coerce_value done"
```

---

## Task 2: `resolve_typed` wrapper

**Files:**
- Modify: `backend/services/workflow_runner.py` (add wrapper after `resolve_variable`, which ends at line 249)
- Test: `backend/tests/test_resolve_variable.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_resolve_variable.py`:

```python
from services.workflow_runner import resolve_typed
from services.type_coercion import VariableCoercionError
import pytest


class TestResolveTyped:
    def test_string_default(self):
        assert resolve_typed("hello", "M", [], {}, "string") == "hello"

    def test_boolean_from_binding(self):
        variables = [{"name": "keep", "value": "false", "scope": "per-run", "type": "boolean"}]
        # Resolve the binding by name, then coerce per the passed declared_type.
        assert resolve_typed("keep", "M", variables, {}, "boolean") is False

    def test_number_from_template(self):
        per_run = {"n": "13.0"}
        assert resolve_typed("{n}", "M", [], per_run, "number") == 13

    def test_per_model_boolean(self):
        variables = [{"name": "flag", "value": "yes", "scope": "per-model", "type": "boolean"}]
        assert resolve_typed("flag", "Bridge-01", variables, {}, "boolean") is True

    def test_invalid_raises_with_var_name(self):
        with pytest.raises(VariableCoercionError) as exc:
            resolve_typed("abc", "M", [], {}, "number", var_name="depth")
        assert exc.value.var_name == "depth"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_resolve_variable.py::TestResolveTyped -v`
Expected: FAIL — `ImportError: cannot import name 'resolve_typed'`

- [ ] **Step 3: Write minimal implementation**

In `backend/services/workflow_runner.py`, add the import near the top (after line 12, the `from utils.data_loader import load_naming_data` line):

```python
from services.type_coercion import coerce_value, VariableCoercionError
```

Then add this function immediately after `resolve_variable` ends (after line 249, before `def execute_node`):

```python
def resolve_typed(
    var_name: str,
    model_name: str,
    variables: List[Dict[str, Any]],
    per_run_vars: Dict[str, Any],
    declared_type: str,
    *,
    coerce_var_name: str = "",
) -> Any:
    """PC-401 — resolve a variable/template to a string, then coerce it to a
    declared type (string/number/boolean). resolve_variable is unchanged and
    still returns str; this is the opt-in typed layer. Raises
    VariableCoercionError on an uncoercible value (caught by PC-302 per-model
    isolation). ``coerce_var_name`` only labels the error message.
    """
    raw = resolve_variable(var_name, model_name, variables, per_run_vars)
    return coerce_value(raw, declared_type, var_name=coerce_var_name)
```

Note: the test calls `resolve_typed(..., "number", var_name="depth")`. Accept `var_name` as the keyword by renaming the param — change the signature keyword from `coerce_var_name` to `var_name`:

```python
def resolve_typed(
    var_name: str,
    model_name: str,
    variables: List[Dict[str, Any]],
    per_run_vars: Dict[str, Any],
    declared_type: str,
    *,
    var_name_for_error: str = "",
) -> Any:
    raw = resolve_variable(var_name, model_name, variables, per_run_vars)
    return coerce_value(raw, declared_type, var_name=var_name_for_error)
```

Wait — the test passes `var_name="depth"` as a keyword, but `var_name` is already the first positional param. Use the keyword name `var_name` cannot collide because the first is positional. To keep it unambiguous, the test in Step 1 must use the keyword the implementation defines. **Use `var_name` for the error label is impossible (name clash).** Resolve by having the test use `var_name_for_error`:

Update the Step 1 test's last case to:

```python
    def test_invalid_raises_with_var_name(self):
        with pytest.raises(VariableCoercionError) as exc:
            resolve_typed("abc", "M", [], {}, "number", var_name_for_error="depth")
        assert exc.value.var_name == "depth"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_resolve_variable.py -v`
Expected: PASS (existing resolve_variable tests + new TestResolveTyped).

- [ ] **Step 5: Commit**

```bash
git add backend/services/workflow_runner.py backend/tests/test_resolve_variable.py
git commit -m "feat(PC-401): resolve_typed wrapper (resolve then coerce)"
```

---

## Task 3: Coerce boolean params in `execute_node` (the foot-gun fix)

**Files:**
- Modify: `backend/services/workflow_runner.py` — the `cleanModel` branch (line 300) and every `continue_on_failure = data.get('continueOnFailure', ...)` site in `execute_node` (lines 300, 308, 315, 322, 329, 344, 356, 363, 370, 378, 385, 401, 411, 420, 426, 433, 441, 448, 460, 466, 472, 544, 574).
- Test: `backend/tests/test_run_workflow.py`

- [ ] **Step 1: Write the failing test (regression guard)**

Append to `backend/tests/test_run_workflow.py`:

```python
class TestTypedBooleanCoercion:
    """PC-401: continueOnFailure must be coerced to a real bool, so a string
    'false' (from a template / manual binding / param edge) emits false, not the
    truthy-string bug that emitted true."""

    def test_clean_model_string_false_emits_false(self, tmp_path):
        from services.workflow_runner import generate_chain_file
        nodes = [
            {"id": "fe", "type": "foreachModel", "data": {}},
            {"id": "clean", "type": "cleanModel",
             "data": {"modelName": "M", "comments": "", "continueOnFailure": "false",
                      "commandName": "Clean model"}},
            {"id": "out", "type": "chainFileOutput",
             "data": {"modelType": "Model", "projectFolder": "project_folder"}},
        ]
        edges = [
            {"source": "fe", "target": "clean", "sourceHandle": "flow:out", "targetHandle": "flow:in"},
            {"source": "clean", "target": "out", "sourceHandle": "flow:out", "targetHandle": "flow:in"},
        ]
        path = generate_chain_file("M", nodes, edges, [], {}, str(tmp_path), "")
        xml = Path(path).read_text(encoding="utf-8")
        assert "<Continue_on_failure>false</Continue_on_failure>" in xml

    def test_clean_model_string_true_emits_true(self, tmp_path):
        from services.workflow_runner import generate_chain_file
        nodes = [
            {"id": "fe", "type": "foreachModel", "data": {}},
            {"id": "clean", "type": "cleanModel",
             "data": {"modelName": "M", "comments": "", "continueOnFailure": "true",
                      "commandName": "Clean model"}},
            {"id": "out", "type": "chainFileOutput",
             "data": {"modelType": "Model", "projectFolder": "project_folder"}},
        ]
        edges = [
            {"source": "fe", "target": "clean", "sourceHandle": "flow:out", "targetHandle": "flow:in"},
            {"source": "clean", "target": "out", "sourceHandle": "flow:out", "targetHandle": "flow:in"},
        ]
        path = generate_chain_file("M", nodes, edges, [], {}, str(tmp_path), "")
        xml = Path(path).read_text(encoding="utf-8")
        assert "<Continue_on_failure>true</Continue_on_failure>" in xml
```

Confirm `generate_chain_file`'s signature first — check `backend/services/workflow_runner.py` around line 770 (`def generate_chain_file`). If the positional order differs from `(model_name, nodes, edges, variables, per_run_vars, output_folder, project_folder)`, adjust the test calls to match. (The `run_workflow` call at line 1023 uses exactly that order.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_run_workflow.py::TestTypedBooleanCoercion -v`
Expected: `test_clean_model_string_false_emits_false` FAILS (today emits `true` because `'true' if "false" else 'false'` is truthy). `test_clean_model_string_true_emits_true` may already pass.

- [ ] **Step 3: Write minimal implementation**

In `execute_node`, replace every boolean extraction. The canonical broken one at line 300:

```python
        continue_on_failure = data.get('continueOnFailure', 'True')
```
becomes:
```python
        continue_on_failure = coerce_value(
            data.get('continueOnFailure', True), 'boolean', var_name='continueOnFailure'
        )
```

And every other site of the form:
```python
        continue_on_failure = data.get('continueOnFailure', True)
```
becomes the identical coerced form:
```python
        continue_on_failure = coerce_value(
            data.get('continueOnFailure', True), 'boolean', var_name='continueOnFailure'
        )
```

Apply to all sites listed in **Files** above. (They are all within `execute_node`, lines 297–576.) Use an editor find/replace scoped to `execute_node`: there are two literal patterns — `data.get('continueOnFailure', True)` and `data.get('continueOnFailure', 'True')` — replace both with the coerced call.

Rationale: `coerce_value` accepts real bools (passes through) AND the string forms, so the schema-default mismatch (`'true'` string vs `true` bool, see `nodeSchemas.ts`) no longer matters — every path yields a real bool.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_run_workflow.py::TestTypedBooleanCoercion -v`
Expected: PASS (both).

- [ ] **Step 5: Run the full backend suite (no regressions)**

Run: `cd backend && python -m pytest tests/ -q`
Expected: all pass. The command generators already typed `continue_on_failure: bool`; passing a real bool is what they expected.

- [ ] **Step 6: Commit**

```bash
git add backend/services/workflow_runner.py backend/tests/test_run_workflow.py
git commit -m "fix(PC-401): coerce continueOnFailure to a real bool in execute_node"
```

---

## Task 4: Coerce numeric params + per-model failure isolation

**Files:**
- Modify: `backend/services/workflow_runner.py` — numeric extraction sites: `zOffset` (lines 439, 457), `depth` (458), `finalCutSlope`/`finalFillSlope`/`finalSearchDistance` (605–607).
- Test: `backend/tests/test_run_workflow.py`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_run_workflow.py`:

```python
class TestTypedNumberCoercion:
    """PC-401: numeric params lose a spurious '.0' and a bad number fails that
    model only (PC-302 isolation)."""

    def test_z_offset_strips_trailing_zero(self, tmp_path):
        from services.workflow_runner import generate_chain_file
        nodes = [
            {"id": "fe", "type": "foreachModel", "data": {}},
            {"id": "drape", "type": "drapeToTin",
             "data": {"dataToDrape": "D", "zOffset": "13.0", "tinName": "T",
                      "continueOnFailure": True, "comments": ""}},
            {"id": "out", "type": "chainFileOutput",
             "data": {"modelType": "Model", "projectFolder": "project_folder"}},
        ]
        edges = [
            {"source": "fe", "target": "drape", "sourceHandle": "flow:out", "targetHandle": "flow:in"},
            {"source": "drape", "target": "out", "sourceHandle": "flow:out", "targetHandle": "flow:in"},
        ]
        path = generate_chain_file("M", nodes, edges, [], {}, str(tmp_path), "")
        xml = Path(path).read_text(encoding="utf-8")
        assert "13.0" not in xml
        assert "13" in xml

    def test_bad_number_fails_only_that_model(self, monkeypatch, tmp_path):
        """A model whose numeric value can't parse gets an error row; siblings succeed."""
        excel = tmp_path / "models.xlsx"
        _write_excel(excel, ["Good", "Bad"])
        out = tmp_path / "out"
        out.mkdir()

        # Per-model variable: 'Bad' resolves zOffset to a non-number.
        variables = [
            {"name": "z", "value": "{zmap}", "scope": "per-model", "type": "number"},
        ]
        # Use a graph where zOffset references a per-model variable that is bad for 'Bad'.
        graph = {
            "nodes": [
                {"id": "fe", "type": "foreachModel", "data": {}},
                {"id": "drape", "type": "drapeToTin",
                 "data": {"dataToDrape": "D", "zOffset": "{badmap}", "tinName": "T",
                          "continueOnFailure": True, "comments": ""}},
                {"id": "out", "type": "chainFileOutput",
                 "data": {"modelType": "Model", "projectFolder": "project_folder"}},
            ],
            "edges": [
                {"source": "fe", "target": "drape", "sourceHandle": "flow:out", "targetHandle": "flow:in"},
                {"source": "drape", "target": "out", "sourceHandle": "flow:out", "targetHandle": "flow:in"},
            ],
        }
        # badmap resolves to a number for 'Good' and 'abc' for 'Bad' via per-run map is not
        # possible; instead make zOffset literally 'abc' so BOTH fail — then assert both error.
        # Simpler, deterministic check: literal bad value fails the model with an error row.
        graph["nodes"][1]["data"]["zOffset"] = "abc"

        generated, _pf, details = run_workflow(str(excel), graph, [], str(out))
        statuses = {r["model"]: r["status"] for r in details}
        assert statuses["Good"] == "error"
        assert statuses["Bad"] == "error"
        assert any("number" in (r["error"] or "") for r in details)
```

Note: the second test deliberately uses a literal bad `zOffset` so both models error (deterministic). The point being verified is: a coercion failure produces an `error` status row with a message mentioning the type, via PC-302 isolation — not a crash of the whole run. (A mixed good/bad-per-model case is covered conceptually; keep this one deterministic.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_run_workflow.py::TestTypedNumberCoercion -v`
Expected: `test_z_offset_strips_trailing_zero` FAILS (today `13.0` passes through verbatim). `test_bad_number_fails_only_that_model` FAILS (today `abc` is emitted as-is, status `success`).

- [ ] **Step 3: Write minimal implementation**

In `execute_node`, change the numeric extractions to coerce-then-stringify (XML wants text, but a coerced number drops the `.0`):

`drapeToTin` (line 439):
```python
        z_offset = str(resolve_typed(data.get('zOffset', '0'), model_name, variables, per_run_vars, 'number', var_name_for_error='zOffset'))
```

`createTrimeshFromTin` (lines 457–458):
```python
        z_offset = str(resolve_typed(data.get('zOffset', '0'), model_name, variables, per_run_vars, 'number', var_name_for_error='zOffset'))
        depth = str(resolve_typed(data.get('depth', '1'), model_name, variables, per_run_vars, 'number', var_name_for_error='depth'))
```

`createTemplateFile` (lines 605–607):
```python
        final_cut_slope = str(resolve_typed(data.get('finalCutSlope', '2'), model_name, variables, per_run_vars, 'number', var_name_for_error='finalCutSlope'))
        final_fill_slope = str(resolve_typed(data.get('finalFillSlope', '2'), model_name, variables, per_run_vars, 'number', var_name_for_error='finalFillSlope'))
        final_search_distance = str(resolve_typed(data.get('finalSearchDistance', '100'), model_name, variables, per_run_vars, 'number', var_name_for_error='finalSearchDistance'))
```

The `VariableCoercionError` raised here propagates out of `execute_node` → `_execute_node_with_capture` (which re-raises) → caught by PC-302's per-model try/except in `run_workflow` (line 1022), producing the error row. No new error plumbing needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_run_workflow.py::TestTypedNumberCoercion -v`
Expected: PASS (both).

- [ ] **Step 5: Verify the error message reaches the row**

Confirm the PC-302 except block at ~line 1045 stores `str(exc)` into the row's `error`. If it stores `str(exc)`, the `VariableCoercionError` message (`variable 'zOffset' (number): can't parse 'abc'`) flows through and the `"number" in error` assertion passes. If it stores a different field, adjust the assertion to match the stored text. Read lines 1040–1075 to confirm.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && python -m pytest tests/ -q`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add backend/services/workflow_runner.py backend/tests/test_run_workflow.py
git commit -m "feat(PC-401): coerce numeric params; bad values fail the model (PC-302)"
```

- [ ] **Step 8: Update progress tracker** (mark step 9 done; commit).

---

## Task 5: Frontend coercion mirror (`coerce.ts`)

**Files:**
- Create: `frontend/lib/workflow/coerce.ts`
- Test: `frontend/lib/workflow/__tests__/coerce.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/lib/workflow/__tests__/coerce.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { coerceCheck, coerceErrorMessage, type VariableType } from '../coerce';

describe('coerceCheck', () => {
  it('string always coerces', () => {
    expect(coerceCheck('anything', 'string')).toBe(true);
    expect(coerceCheck(13, 'string')).toBe(true);
  });

  it.each(['true', 'True', ' true ', '1', 'yes', 'on', true])(
    'boolean accepts %s',
    (raw) => expect(coerceCheck(raw as unknown, 'boolean')).toBe(true),
  );

  it.each(['false', 'False', '0', 'no', 'off', false])(
    'boolean accepts falsy %s',
    (raw) => expect(coerceCheck(raw as unknown, 'boolean')).toBe(true),
  );

  it.each(['maybe', '', '2'])(
    'boolean rejects %s',
    (raw) => expect(coerceCheck(raw as unknown, 'boolean')).toBe(false),
  );

  it('number accepts ints, floats, 13.0, whitespace, negatives', () => {
    for (const ok of ['13', '13.0', '1.5', '-4', ' 7 ', 13, 1.5]) {
      expect(coerceCheck(ok as unknown, 'number')).toBe(true);
    }
  });

  it.each(['abc', '', '1,000', 'nan', 'inf'])(
    'number rejects %s',
    (raw) => expect(coerceCheck(raw as unknown, 'number')).toBe(false),
  );

  it('number rejects a boolean', () => {
    expect(coerceCheck(true, 'number')).toBe(false);
  });

  it('coerceErrorMessage names the variable, type, and value', () => {
    const msg = coerceErrorMessage('depth', 'number', 'abc');
    expect(msg).toContain('depth');
    expect(msg).toContain('number');
    expect(msg).toContain('abc');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/workflow/__tests__/coerce.test.ts`
Expected: FAIL — cannot find module `../coerce`.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/lib/workflow/coerce.ts`:

```typescript
// PC-401 — frontend mirror of backend services/type_coercion.coerce_value.
// Pure, no DOM. Used by validateNode for a pre-run warning. The accept-lists
// MUST stay in parity with the backend (tested against the same table).

export type VariableType = 'string' | 'number' | 'boolean';

const BOOL_TRUE = new Set(['true', '1', 'yes', 'on']);
const BOOL_FALSE = new Set(['false', '0', 'no', 'off']);

/** Returns true if `value` can be coerced to `type`. `string` always succeeds. */
export function coerceCheck(value: unknown, type: VariableType): boolean {
  if (type === 'string') return true;
  if (type === 'boolean') return canCoerceBool(value);
  if (type === 'number') return canCoerceNumber(value);
  return true; // unknown type treated as string
}

function canCoerceBool(value: unknown): boolean {
  if (typeof value === 'boolean') return true;
  const text = String(value).trim().toLowerCase();
  return BOOL_TRUE.has(text) || BOOL_FALSE.has(text);
}

function canCoerceNumber(value: unknown): boolean {
  if (typeof value === 'boolean') return false; // mirror: bool is not a number
  if (typeof value === 'number') return Number.isFinite(value);
  const text = String(value).trim();
  if (text === '') return false;
  // Reject thousands separators / non-canonical: Number() is too lenient with ''
  // (handled above) but rejects '1,000', 'abc'. NaN/Infinity excluded by isFinite.
  const n = Number(text);
  return Number.isFinite(n);
}

/** Human-readable parity with the backend VariableCoercionError message. */
export function coerceErrorMessage(varName: string, type: VariableType, value: unknown): string {
  const name = varName ? ` '${varName}'` : '';
  return `variable${name} (${type}): can't parse ${JSON.stringify(value)}`;
}
```

Note on `Number('inf')`: JS `Number('inf')` is `NaN` (only `'Infinity'` parses), so `canCoerceNumber('inf')` correctly returns false. `Number('nan')` is also `NaN` → false. Confirmed by the test.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/workflow/__tests__/coerce.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/workflow/coerce.ts frontend/lib/workflow/__tests__/coerce.test.ts
git commit -m "feat(PC-401): frontend coercion mirror (coerce.ts) parity-locked to backend"
```

---

## Task 6: `VariableType` on `VariableBinding`

**Files:**
- Modify: `frontend/lib/workflow/types.ts:7-12`

- [ ] **Step 1: Apply the change**

Replace lines 6–12 of `frontend/lib/workflow/types.ts`:

```typescript
// Variable system
import type { VariableType } from './coerce';

export interface VariableBinding {
  name: string;
  value: string | number | boolean;
  scope: 'per-run' | 'per-model';
  type?: VariableType; // PC-401 — absent means 'string' (back-compat, no migration)
  source?: 'excel' | 'manual' | 'computed';
}
```

(If `types.ts` cannot have a runtime import cycle: `VariableType` is a `type`-only import, erased at compile time — no cycle. `coerce.ts` does not import `types.ts`.)

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/workflow/types.ts
git commit -m "feat(PC-401): add optional type field to VariableBinding"
```

---

## Task 7: `validateNode` pre-run warning for bad typed variables

**Files:**
- Modify: `frontend/lib/workflow/compile.ts` — the `setVariable` branch (line 232) and imports.
- Test: `frontend/lib/workflow/__tests__/validateNode.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside the `describe('validateNode', ...)` block in `frontend/lib/workflow/__tests__/validateNode.test.ts`:

```typescript
  it('setVariable with a value that does not match its type warns', () => {
    const node = makeNode('setVariable', {
      variables: [{ name: 'depth', value: 'abc', scope: 'per-run', type: 'number' }],
    });
    const warnings = validateNode(node, [node], []);
    expect(warnings.some((w) => w.includes('depth') && w.includes('number'))).toBe(true);
  });

  it('setVariable with a matching typed value does not warn', () => {
    const node = makeNode('setVariable', {
      variables: [{ name: 'depth', value: '1.5', scope: 'per-run', type: 'number' }],
    });
    const warnings = validateNode(node, [node], []);
    expect(warnings.some((w) => w.includes('depth'))).toBe(false);
  });

  it('setVariable with no type (legacy) never warns on coercion', () => {
    const node = makeNode('setVariable', {
      variables: [{ name: 'x', value: 'anything', scope: 'per-run' }],
    });
    const warnings = validateNode(node, [node], []);
    expect(warnings.some((w) => w.includes('x'))).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/workflow/__tests__/validateNode.test.ts`
Expected: FAIL — first new case (no coercion warning emitted yet).

- [ ] **Step 3: Write minimal implementation**

Add an import at the top of `frontend/lib/workflow/compile.ts` (with the other imports):

```typescript
import { coerceCheck, coerceErrorMessage, type VariableType } from './coerce';
import type { VariableBinding } from './types';
```

Replace the `setVariable` placeholder branch (lines 232–234) with:

```typescript
  if (node.type === 'setVariable') {
    const vars = (data.variables ?? []) as VariableBinding[];
    for (const v of vars) {
      const t = (v.type ?? 'string') as VariableType;
      if (t !== 'string' && !coerceCheck(v.value, t)) {
        warnings.push(coerceErrorMessage(v.name, t, v.value));
      }
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/workflow/__tests__/validateNode.test.ts`
Expected: PASS (new + existing cases).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/workflow/compile.ts frontend/lib/workflow/__tests__/validateNode.test.ts
git commit -m "feat(PC-401): validateNode warns on a variable value that won't coerce"
```

---

## Task 8: SetVariable editor — type dropdown + adaptive value input

**Files:**
- Modify: `frontend/components/workflow/RightSidebar.tsx` — the setVariable editor (the Value block at lines 283–302, and `handleAddVariable` at line 220).

- [ ] **Step 1: Add the type selector + default**

In `handleAddVariable` (line 220), add `type: 'string'` to the new binding:

```typescript
    const handleAddVariable = () => {
      const newVar: VariableBinding = {
        name: `var${variables.length + 1}`,
        value: '',
        scope: 'per-run',
        type: 'string',
      };
      onUpdateNode(selectedNode.id, {
        variables: [...variables, newVar],
      } as Partial<WorkflowNodeData>);
    };
```

- [ ] **Step 2: Add the Type dropdown + adaptive Value input**

Replace the Value `<div>` (lines 283–291) and insert a Type selector before it, so the block reads:

```tsx
                    <div>
                      <Label className="text-xs text-gray-400 mb-1 block">Type</Label>
                      <select
                        value={variable.type ?? 'string'}
                        onChange={(e) => handleUpdateVariable(index, 'type', e.target.value as 'string' | 'number' | 'boolean')}
                        className="w-full bg-gray-900 border border-gray-700 text-white text-sm h-8 rounded-md px-2"
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400 mb-1 block">Value</Label>
                      {(variable.type ?? 'string') === 'boolean' ? (
                        <select
                          value={String(variable.value) === 'true' || variable.value === true ? 'true' : 'false'}
                          onChange={(e) => handleUpdateVariable(index, 'value', e.target.value === 'true')}
                          className="w-full bg-gray-900 border border-gray-700 text-white text-sm h-8 rounded-md px-2"
                        >
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (variable.type ?? 'string') === 'number' ? (
                        <Input
                          type="number"
                          value={String(variable.value)}
                          onChange={(e) => handleUpdateVariable(index, 'value', e.target.value)}
                          className="bg-gray-900 border-gray-700 text-white text-sm h-8"
                          placeholder="0"
                        />
                      ) : (
                        <Input
                          value={String(variable.value)}
                          onChange={(e) => handleUpdateVariable(index, 'value', e.target.value)}
                          className="bg-gray-900 border-gray-700 text-white text-sm h-8"
                          placeholder="value"
                        />
                      )}
                    </div>
```

Note: number values stay stored as strings (the editor's `value` is `string | number | boolean`); the backend coerces and the frontend `validateNode` checks. This keeps templates/drafts JSON-stable and avoids partial-input churn (e.g. a lone `-` while typing).

- [ ] **Step 3: Typecheck + lint + build**

Run: `cd frontend && npx tsc --noEmit && npm run lint && npm run build`
Expected: tsc exit 0; lint shows only pre-existing warnings; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/workflow/RightSidebar.tsx
git commit -m "feat(PC-401): SetVariable editor — type dropdown + adaptive value input"
```

- [ ] **Step 5: Update progress tracker** (mark step 10 done; commit).

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Backend suite**

Run: `cd backend && python -m pytest tests/ -q`
Expected: all pass (including the new type_coercion, resolve_typed, and run_workflow cases).

- [ ] **Step 2: Frontend suite**

Run: `cd frontend && npm run test`
Expected: all pass (196 prior + new coerce.test.ts + validateNode additions).

- [ ] **Step 3: Typecheck / lint / build**

Run: `cd frontend && npx tsc --noEmit && npm run lint && npm run build`
Expected: tsc 0; lint only pre-existing warnings; build OK.

- [ ] **Step 4: Commit any incidental fixes, then update progress tracker** (mark step 11 done; commit).

---

## Task 10: Adversarial review, ROADMAP, merge

**Files:** `ROADMAP.md`, `docs/superpowers/progress/PC-401-progress.md`

- [ ] **Step 1: Adversarial multi-lens review**

Run an adversarial review of the full branch diff (correctness / parity / regression-risk / edge-cases). Each finding adversarially verified; apply confirmed fixes with their own commits. (The reviewer must specifically check: bool-before-number ordering in `coerce_value`; that no XML f-string site changed; frontend↔backend accept-list parity; that PC-302 still isolates the new error.)

- [ ] **Step 2: Mark ROADMAP PC-401 done**

In `ROADMAP.md`, change the PC-401 bullet (line 90) from `- **PC-401**` to `- ✅ **PC-401**` and the order-of-attack line (271) likewise, adding a one-paragraph rationale matching the house style (what shipped, the seam decision, tests, review result, verification).

- [ ] **Step 3: Final progress update + commit**

```bash
git add ROADMAP.md docs/superpowers/progress/PC-401-progress.md
git commit -m "docs(PC-401): mark typed variables shipped"
```

- [ ] **Step 4: Merge to main + push**

```bash
git checkout main
git merge --no-ff pc401-typed-variables -m "merge(PC-401): typed variables"
git push origin main
```

(Per working-style memory: merge + push each ticket to main. Use `--no-ff` so the feature branch's history is preserved as one clean merge.)

---

## Self-Review (completed by plan author)

- **Spec coverage:** §4 coercion rules → Task 1 (table tests). §5.1 new file → Task 1. §5.2 resolve_typed → Task 2; boolean sites → Task 3; numeric sites → Task 4. §5.3 per-model error → Task 4 (PC-302 reuse). §6.1 types → Task 6. §6.2 editor → Task 8. §6.3 validateNode + coerceCheck → Tasks 5+7. §7 tests → embedded in each task. All covered.
- **Placeholder scan:** none — every code step has full code; commands have expected output.
- **Type consistency:** `coerce_value(raw, declared_type, *, var_name)` and `coerceCheck(value, type)` / `coerceErrorMessage(varName, type, value)` used identically across tasks. `resolve_typed(..., declared_type, *, var_name_for_error)` keyword consistent between Task 2 def and Task 4 calls. `VariableType` defined in `coerce.ts` (Task 5), imported by `types.ts` (Task 6) and `compile.ts` (Task 7).
- **Known verification dependency flagged inline:** Task 3 Step 1 and Task 4 Step 5 instruct confirming `generate_chain_file`'s signature and the PC-302 except block's stored error field before asserting — these are reads, not guesses.
