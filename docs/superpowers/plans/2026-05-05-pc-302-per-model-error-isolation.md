# PC-302 — Per-Model Error Isolation and Partial Results — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap each model in `run_workflow`'s loop with try/except, collect per-model status, and produce a partial-result ZIP plus a `_summary.txt` so a single bad model no longer aborts the whole batch. Surface partial state minimally in the success modal.

**Architecture:** Three layers, in dependency order:
1. `services/workflow_runner.py::run_workflow` — per-model try/except, expanded `file_details` rows.
2. `main.py::run_workflow_job` — adds `_summary.txt` to the ZIP, stores `succeeded_count`/`failed_count` on the session, drops the swallowing of per-model failures (outer try/except still catches pre-loop / IO failures).
3. Frontend — optional new fields on `WorkflowStatusResponse`, a warning state in `SuccessCelebration`, and updated wiring in `app/page.tsx` for the single-Excel and multi-Excel paths.

**Tech Stack:** Python 3.11/3.12, pytest (with `caplog`, `monkeypatch`, `tmp_path`), `zipfile` (stdlib), Next.js/React, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-05-pc-302-per-model-error-isolation-design.md`

**Pre-flight verification (already confirmed by spec author, but re-run if uncertain):**
- `backend/services/workflow_runner.py::run_workflow` lives at lines 767–872. The model loop is lines 853–870.
- `backend/main.py::run_workflow_job` lives at lines 309–361. The ZIP step is lines 336–342; the session update is lines 344–356.
- Existing `file_details` row keys are `filename`, `output_path`, `project_folder` (workflow_runner.py:866-870).
- `session_store.update(session_id, patch)` merges `patch` into the existing session dict (services/session_store.py).
- Backend test command (preferred): `python -m pytest backend/tests/ -v` from repo root, **or** `python -m pytest tests/ -v` from `backend/`.
- Frontend test command: `npm run test` from `frontend/`.
- Vitest tests live under `frontend/lib/workflow/__tests__/*.test.ts` (see `edgeRules.test.ts` for style).
- The success modal component is `frontend/components/workflow/SuccessCelebration.tsx`. It currently accepts `{ isOpen, onClose, fileCount }`. The single-Excel path renders it from `app/page.tsx:1224`.

---

## Task 1: Per-model try/except in `run_workflow`

**Files:**
- Modify: `backend/services/workflow_runner.py` (model loop at lines 853–870)
- Create: `backend/tests/test_run_workflow.py`

This task isolates per-model failures inside `run_workflow`. New failure rows have `status="error"`, `error="<ExceptionType>: <message>"`, `filename=None`, `output_path=None`. Successes get the same shape with `status="success"`, `error=None`. Row order matches model-name iteration order.

- [ ] **Step 1: Create the new test file with all tests**

Create `backend/tests/test_run_workflow.py`:

```python
"""Tests for run_workflow per-model error isolation (PC-302)."""
import logging
import os
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd
import pytest

from services import workflow_runner
from services.workflow_runner import run_workflow


def _write_excel(path: Path, model_names: List[str]) -> None:
    """Write a one-column .xlsx with the given model names (no header row)."""
    df = pd.DataFrame({0: model_names})
    df.to_excel(path, index=False, header=False, engine="openpyxl")


def _minimal_graph() -> Dict[str, Any]:
    """A graph with foreachModel + chainFileOutput so run_workflow's path-resolution works."""
    return {
        "nodes": [
            {"id": "fe", "type": "foreachModel", "data": {}},
            {"id": "out", "type": "chainFileOutput",
             "data": {"modelType": "Model", "projectFolder": "project_folder"}},
        ],
        "edges": [
            {"source": "fe", "target": "out",
             "sourceHandle": "flow:out", "targetHandle": "flow:in"},
        ],
    }


@pytest.fixture
def excel_with_three_models(tmp_path: Path) -> Path:
    excel = tmp_path / "models.xlsx"
    _write_excel(excel, ["A", "B", "C"])
    return excel


@pytest.fixture
def output_dir(tmp_path: Path) -> Path:
    out = tmp_path / "out"
    out.mkdir()
    return out


def test_all_models_succeed(monkeypatch, excel_with_three_models, output_dir):
    """All three models succeed; file_details has three success rows in order."""
    def fake_generate(model_name, *args, **kwargs):
        path = str(output_dir / f"{model_name}.chain")
        Path(path).write_text("<xml/>", encoding="utf-8")
        return path

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    generated, _project, details = run_workflow(
        str(excel_with_three_models), _minimal_graph(), [], str(output_dir),
    )

    assert len(generated) == 3
    assert [r["model"] for r in details] == ["A", "B", "C"]
    assert all(r["status"] == "success" for r in details)
    assert all(r["error"] is None for r in details)
    assert [r["filename"] for r in details] == ["A.chain", "B.chain", "C.chain"]


def test_one_model_fails_others_succeed(monkeypatch, excel_with_three_models, output_dir):
    """Model B raises FileNotFoundError; A and C still succeed; one failure row."""
    def fake_generate(model_name, *args, **kwargs):
        if model_name == "B":
            raise FileNotFoundError("missing.dwg")
        path = str(output_dir / f"{model_name}.chain")
        Path(path).write_text("<xml/>", encoding="utf-8")
        return path

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    generated, _project, details = run_workflow(
        str(excel_with_three_models), _minimal_graph(), [], str(output_dir),
    )

    assert len(generated) == 2  # only A and C
    assert [r["model"] for r in details] == ["A", "B", "C"]
    assert details[0]["status"] == "success"
    assert details[1]["status"] == "error"
    assert details[1]["filename"] is None
    assert details[1]["output_path"] is None
    assert details[1]["error"] == "FileNotFoundError: missing.dwg"
    assert details[2]["status"] == "success"


def test_all_models_fail(monkeypatch, excel_with_three_models, output_dir):
    """Every model raises; generated_files is empty; three failure rows in order."""
    def fake_generate(model_name, *args, **kwargs):
        raise RuntimeError(f"boom-{model_name}")

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    generated, _project, details = run_workflow(
        str(excel_with_three_models), _minimal_graph(), [], str(output_dir),
    )

    assert generated == []
    assert [r["model"] for r in details] == ["A", "B", "C"]
    assert all(r["status"] == "error" for r in details)
    assert details[0]["error"] == "RuntimeError: boom-A"
    assert details[1]["error"] == "RuntimeError: boom-B"
    assert details[2]["error"] == "RuntimeError: boom-C"


def test_failure_logged_with_traceback(monkeypatch, excel_with_three_models, output_dir, caplog):
    """A per-model failure logs at ERROR with exc_info populated."""
    def fake_generate(model_name, *args, **kwargs):
        if model_name == "B":
            raise ValueError("bad input")
        return str(output_dir / f"{model_name}.chain")

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    with caplog.at_level(logging.ERROR, logger="services.workflow_runner"):
        run_workflow(
            str(excel_with_three_models), _minimal_graph(), [], str(output_dir),
        )

    error_records = [r for r in caplog.records if r.levelno == logging.ERROR]
    assert any("B" in r.getMessage() and "bad input" in r.getMessage() for r in error_records)
    failure_record = next(r for r in error_records if "B" in r.getMessage())
    assert failure_record.exc_info is not None


def test_pre_loop_excel_error_still_raises(tmp_path, output_dir):
    """A non-existent Excel file path raises out of run_workflow (status=error path)."""
    missing = tmp_path / "does_not_exist.xlsx"
    with pytest.raises(Exception):
        run_workflow(str(missing), _minimal_graph(), [], str(output_dir))


def test_no_models_after_filtering_returns_empty(monkeypatch, tmp_path, output_dir):
    """An Excel with only an empty cell yields zero models; loop runs zero times."""
    excel = tmp_path / "empty.xlsx"
    _write_excel(excel, [""])

    def fake_generate(*args, **kwargs):  # pragma: no cover - should never be called
        raise AssertionError("generate_chain_file should not be called for empty input")

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    generated, _project, details = run_workflow(
        str(excel), _minimal_graph(), [], str(output_dir),
    )

    assert generated == []
    assert details == []


def test_file_details_shape(monkeypatch, excel_with_three_models, output_dir):
    """Every row (success and failure) has the six required keys."""
    def fake_generate(model_name, *args, **kwargs):
        if model_name == "B":
            raise RuntimeError("x")
        return str(output_dir / f"{model_name}.chain")

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    _gen, _project, details = run_workflow(
        str(excel_with_three_models), _minimal_graph(), [], str(output_dir),
    )

    required = {"model", "filename", "output_path", "project_folder", "status", "error"}
    for row in details:
        assert required.issubset(row.keys()), f"missing keys in {row}"


def test_row_order_matches_model_order(monkeypatch, excel_with_three_models, output_dir):
    """file_details order matches model-name iteration order, mixed success/failure."""
    def fake_generate(model_name, *args, **kwargs):
        if model_name in {"A", "C"}:
            raise RuntimeError("x")
        return str(output_dir / f"{model_name}.chain")

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    _gen, _project, details = run_workflow(
        str(excel_with_three_models), _minimal_graph(), [], str(output_dir),
    )

    assert [r["model"] for r in details] == ["A", "B", "C"]
    assert [r["status"] for r in details] == ["error", "success", "error"]
```

- [ ] **Step 2: Run the new tests and verify they fail**

From `backend/`:

```bash
python -m pytest tests/test_run_workflow.py -v
```

Expected: most tests fail with `KeyError: 'model'` or `assert ... == 'success'` failures — current code returns rows with only `filename`/`output_path`/`project_folder` and no `status`/`error`/`model`. The "all_models_fail" test fails because today the first failure raises out of the function.

`test_pre_loop_excel_error_still_raises` may already pass (the read fails today). `test_no_models_after_filtering_returns_empty` may already pass (empty list → empty loop). That's fine — those exist to lock in current behavior.

- [ ] **Step 3: Implement the per-model try/except in `run_workflow`**

In `backend/services/workflow_runner.py`, replace the model loop (lines ~853–870):

```python
    generated_files: List[str] = []
    file_details: List[Dict[str, str]] = []

    # Generate chain file for each model. PC-302: isolate per-model failures so a
    # single bad model does not abort the whole batch.
    for model_name in model_names:
        try:
            chain_file = generate_chain_file(
                model_name,
                nodes,
                edges,
                variables,
                per_run_vars,
                output_folder,
                project_folder,
            )
            if chain_file:
                generated_files.append(chain_file)
                file_details.append({
                    'model': model_name,
                    'filename': os.path.basename(chain_file),
                    'output_path': chain_file,
                    'project_folder': project_folder,
                    'status': 'success',
                    'error': None,
                })
        except Exception as e:
            logger.error(
                "Chain file generation failed for model %r: %s",
                model_name, e, exc_info=True,
            )
            file_details.append({
                'model': model_name,
                'filename': None,
                'output_path': None,
                'project_folder': project_folder,
                'status': 'error',
                'error': f"{type(e).__name__}: {e}",
            })

    return generated_files, project_folder, file_details
```

Note: `logger` already exists at module scope (line 66, added by PC-301). Re-use it.

Also update the function's return-type annotation and docstring. Find at line 773:

```python
) -> Tuple[List[str], Optional[str], List[Dict[str, str]]]:
```

The signature stays the same (`List[Dict[str, str]]` is loose enough — `None` values for `filename`/`output_path` and `error` will pass through fine since the type hint is informational, not enforced). Update the docstring `Returns:` paragraph to reflect the new row shape:

```python
    Returns:
        Tuple of (successfully generated file paths, project folder, per-model
        status rows). Each row in file_details has keys: model, filename,
        output_path, project_folder, status ('success' | 'error'), error
        (None on success, "<ExceptionType>: <message>" on failure).
```

- [ ] **Step 4: Run the new tests and verify they pass**

```bash
python -m pytest tests/test_run_workflow.py -v
```

Expected: all 8 tests pass.

- [ ] **Step 5: Run the full backend test suite to verify nothing regresses**

```bash
python -m pytest tests/ -v
```

Expected: all green. Existing `test_generate_chain_file.py`, `test_build_command_chain.py`, etc. unchanged.

- [ ] **Step 6: Commit**

```bash
git add backend/services/workflow_runner.py backend/tests/test_run_workflow.py
git commit -m "feat(PC-302): isolate per-model failures in run_workflow

Wrap generate_chain_file in per-model try/except. Failure rows carry
status='error' and a '<ExceptionType>: <message>' string; successes carry
status='success' and error=None. Row order matches model-name order.

Adds backend/tests/test_run_workflow.py covering success, single failure,
all-fail, logging, pre-loop error propagation, empty input, row shape,
and ordering."
```

---

## Task 2: `_summary.txt` and partial-result ZIP in `run_workflow_job`

**Files:**
- Modify: `backend/main.py` (job at lines 309–361, plus a new `_build_summary_text` helper)
- Create: `backend/tests/test_run_workflow_job.py`

`run_workflow_job` now reads `file_details` from `run_workflow`, computes counts, builds `_summary.txt`, and writes everything (chain files + summary) into the ZIP. The session result gains `summary.succeeded_count` and `summary.failed_count`. The outer `try/except Exception` stays — it still catches pre-loop / IO failures and produces `status: "error"`.

- [ ] **Step 1: Create the new test file**

Create `backend/tests/test_run_workflow_job.py`:

```python
"""Tests for run_workflow_job summary/zip/session shape (PC-302)."""
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Tuple

import pytest

import main as backend_main


@pytest.fixture(autouse=True)
def _isolate_dirs(monkeypatch, tmp_path):
    """Redirect UPLOAD_DIR and OUTPUT_DIR so the test does not touch real folders."""
    upload_dir = tmp_path / "uploads"
    output_dir = tmp_path / "output"
    upload_dir.mkdir()
    output_dir.mkdir()
    monkeypatch.setattr(backend_main, "UPLOAD_DIR", upload_dir)
    monkeypatch.setattr(backend_main, "OUTPUT_DIR", output_dir)
    return upload_dir, output_dir


def _write_chain_files(output_dir: Path, names: List[str]) -> List[str]:
    """Materialize fake .chain files on disk and return their absolute paths."""
    paths = []
    for name in names:
        p = output_dir / name
        p.write_text("<xml/>", encoding="utf-8")
        paths.append(str(p))
    return paths


def _success_row(model: str, path: str) -> Dict[str, Any]:
    return {
        "model": model,
        "filename": Path(path).name,
        "output_path": path,
        "project_folder": "/proj",
        "status": "success",
        "error": None,
    }


def _failure_row(model: str, error: str) -> Dict[str, Any]:
    return {
        "model": model,
        "filename": None,
        "output_path": None,
        "project_folder": "/proj",
        "status": "error",
        "error": error,
    }


def _patch_run_workflow(
    monkeypatch,
    return_value: Tuple[List[str], str, List[Dict[str, Any]]],
):
    """Stub services.workflow_runner.run_workflow as imported by main.py."""
    monkeypatch.setattr(backend_main, "run_workflow", lambda *a, **k: return_value)


def _seed_session(session_id: str = "s1") -> str:
    """Initialize a session row the way run_workflow_endpoint would."""
    backend_main.session_store.create(session_id, {
        "status": "processing",
        "excel_file": "/tmp/x.xlsx",
        "workflow_graph": {},
        "variables": [],
        "results": None,
        "error": None,
    })
    return session_id


def test_zip_contains_summary_txt_with_failures(monkeypatch, _isolate_dirs):
    _, output_dir = _isolate_dirs
    paths = _write_chain_files(output_dir, ["A.chain", "C.chain"])
    file_details = [
        _success_row("A", paths[0]),
        _failure_row("B", "FileNotFoundError: missing.dwg"),
        _success_row("C", paths[1]),
    ]
    _patch_run_workflow(monkeypatch, ([paths[0], paths[1]], "/proj", file_details))

    session_id = _seed_session()
    backend_main.run_workflow_job(session_id, "/tmp/x.xlsx", {}, [])

    session = backend_main.session_store.get(session_id)
    zip_path = session["results"]["zip_path"]
    with zipfile.ZipFile(zip_path) as zf:
        names = set(zf.namelist())
        summary = zf.read("_summary.txt").decode("utf-8")

    assert names == {"A.chain", "C.chain", "_summary.txt"}
    assert "B" in summary
    assert "FileNotFoundError: missing.dwg" in summary
    assert "SUCCEEDED" in summary
    assert "FAILED" in summary


def test_zip_contains_only_summary_when_all_fail(monkeypatch, _isolate_dirs):
    file_details = [
        _failure_row("A", "RuntimeError: x"),
        _failure_row("B", "RuntimeError: y"),
        _failure_row("C", "RuntimeError: z"),
    ]
    _patch_run_workflow(monkeypatch, ([], "/proj", file_details))

    session_id = _seed_session()
    backend_main.run_workflow_job(session_id, "/tmp/x.xlsx", {}, [])

    session = backend_main.session_store.get(session_id)
    zip_path = session["results"]["zip_path"]
    with zipfile.ZipFile(zip_path) as zf:
        assert zf.namelist() == ["_summary.txt"]


def test_summary_counts_in_session(monkeypatch, _isolate_dirs):
    _, output_dir = _isolate_dirs
    paths = _write_chain_files(output_dir, ["A.chain", "C.chain"])
    file_details = [
        _success_row("A", paths[0]),
        _failure_row("B", "X: y"),
        _success_row("C", paths[1]),
    ]
    _patch_run_workflow(monkeypatch, ([paths[0], paths[1]], "/proj", file_details))

    session_id = _seed_session()
    backend_main.run_workflow_job(session_id, "/tmp/x.xlsx", {}, [])

    session = backend_main.session_store.get(session_id)
    summary = session["results"]["summary"]

    assert summary["succeeded_count"] == 2
    assert summary["failed_count"] == 1
    assert summary["total_files"] == 2
    assert session["results"]["file_details"] == file_details


def test_pre_loop_error_status_is_error(monkeypatch, _isolate_dirs):
    def boom(*_a, **_k):
        raise ValueError("bad excel")
    monkeypatch.setattr(backend_main, "run_workflow", boom)

    session_id = _seed_session()
    backend_main.run_workflow_job(session_id, "/tmp/x.xlsx", {}, [])

    session = backend_main.session_store.get(session_id)
    assert session["status"] == "error"
    assert "bad excel" in (session.get("error") or "")


def test_summary_text_format(monkeypatch, _isolate_dirs):
    """Golden-ish format check on _build_summary_text output."""
    _, output_dir = _isolate_dirs
    paths = _write_chain_files(output_dir, ["A.chain"])
    file_details = [
        _success_row("A", paths[0]),
        _failure_row("B", "FileNotFoundError: missing.dwg"),
    ]

    text = backend_main._build_summary_text(
        session_id="abc-123",
        file_details=file_details,
        succeeded_count=1,
        failed_count=1,
    )

    assert "PyChain workflow run summary" in text
    assert "Session:   abc-123" in text
    assert "Models:    2 total" in text
    assert "1 succeeded" in text
    assert "1 failed" in text
    assert "SUCCEEDED" in text
    assert "  A.chain" in text
    assert "FAILED" in text
    assert "  B" in text
    assert "    FileNotFoundError: missing.dwg" in text


def test_summary_omits_succeeded_section_when_all_fail(monkeypatch, _isolate_dirs):
    file_details = [_failure_row("A", "RuntimeError: x")]
    text = backend_main._build_summary_text(
        session_id="s",
        file_details=file_details,
        succeeded_count=0,
        failed_count=1,
    )
    assert "SUCCEEDED" not in text
    assert "FAILED" in text


def test_summary_omits_failed_section_when_all_succeed(monkeypatch, _isolate_dirs):
    _, output_dir = _isolate_dirs
    paths = _write_chain_files(output_dir, ["A.chain"])
    file_details = [_success_row("A", paths[0])]
    text = backend_main._build_summary_text(
        session_id="s",
        file_details=file_details,
        succeeded_count=1,
        failed_count=0,
    )
    assert "SUCCEEDED" in text
    assert "FAILED" not in text
```

- [ ] **Step 2: Run the new tests and verify they fail**

```bash
python -m pytest tests/test_run_workflow_job.py -v
```

Expected: failures pointing at missing `_build_summary_text`, missing `succeeded_count`/`failed_count` in session, and `_summary.txt` not in ZIP.

- [ ] **Step 3: Add `_build_summary_text` and update `run_workflow_job`**

In `backend/main.py`, just above `def run_workflow_job(...)` (around line 309), add the helper:

```python
from datetime import datetime as _datetime


def _build_summary_text(
    session_id: str,
    file_details: List[Dict[str, Any]],
    succeeded_count: int,
    failed_count: int,
) -> str:
    """Build the human-readable per-run summary written into the ZIP as _summary.txt."""
    timestamp = _datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    total = len(file_details)
    lines: List[str] = [
        "PyChain workflow run summary",
        "============================",
        f"Generated: {timestamp}",
        f"Session:   {session_id}",
        f"Models:    {total} total · {succeeded_count} succeeded · {failed_count} failed",
        "",
    ]

    successes = [r for r in file_details if r.get("status") == "success"]
    failures = [r for r in file_details if r.get("status") == "error"]

    if successes:
        lines.append("SUCCEEDED")
        for r in successes:
            lines.append(f"  {r.get('filename')}")
        lines.append("")

    if failures:
        lines.append("FAILED")
        for r in failures:
            lines.append(f"  {r.get('model')}")
            lines.append(f"    {r.get('error')}")
        lines.append("")

    return "\n".join(lines)
```

Then replace the body of `run_workflow_job` (lines 309–361). The new body:

```python
def run_workflow_job(
    session_id: str,
    excel_file_path: str,
    workflow_graph: Dict,
    variables: List[Dict],
    selected_column_index: int = 0,
):
    """
    Background processing job for workflow execution.

    PC-302: per-model failures are isolated inside run_workflow and surfaced via
    file_details rows. The outer try/except below still catches pre-loop / IO
    failures (Excel parse error, ZIP write error, etc.) and turns them into
    status='error'.
    """
    try:
        if session_store.get(session_id) is None:
            return

        # Create output directory for this session
        output_folder = OUTPUT_DIR / session_id
        output_folder.mkdir(exist_ok=True)

        # Run workflow
        generated_files, project_folder, file_details = run_workflow(
            excel_file_path,
            workflow_graph,
            variables,
            str(output_folder),
            selected_column_index=selected_column_index,
        )

        succeeded_count = sum(1 for r in file_details if r.get("status") == "success")
        failed_count = sum(1 for r in file_details if r.get("status") == "error")

        summary_text = _build_summary_text(
            session_id, file_details, succeeded_count, failed_count,
        )

        # Build the ZIP. _summary.txt is always included so users have provenance
        # even when every model failed.
        zip_path = OUTPUT_DIR / f"{session_id}_chain_files.zip"
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in generated_files:
                if os.path.exists(file_path):
                    zipf.write(file_path, os.path.basename(file_path))
            zipf.writestr("_summary.txt", summary_text)

        # Update session
        session_store.update(session_id, {
            "status": "completed",
            "results": {
                "files": [os.path.basename(f) for f in generated_files],
                "file_details": file_details,
                "zip_path": str(zip_path),
                "summary": {
                    "total_files": len(generated_files),
                    "succeeded_count": succeeded_count,
                    "failed_count": failed_count,
                    "project_folder": project_folder or "",
                },
            },
        })
        logger.info(f"Workflow processing completed for session {session_id}")

    except Exception as e:
        session_store.update(session_id, {"status": "error", "error": str(e)})
        logger.error(f"Error in workflow background processing: {e}", exc_info=True)
```

- [ ] **Step 4: Run the new tests and verify they pass**

```bash
python -m pytest tests/test_run_workflow_job.py -v
```

Expected: all 7 tests pass.

- [ ] **Step 5: Run the full backend test suite**

```bash
python -m pytest tests/ -v
```

Expected: all green. Including Task 1's tests and the existing suites.

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/tests/test_run_workflow_job.py
git commit -m "feat(PC-302): write _summary.txt and per-model counts in run_workflow_job

Adds _build_summary_text helper and updates run_workflow_job to:
- Compute succeeded_count and failed_count from file_details.
- Always include _summary.txt in the ZIP (provenance even when all fail).
- Store the new counts and full file_details on the session result.

The outer try/except still catches pre-loop / IO failures and turns them
into status='error'. Per-model failures now produce status='completed'
with failed_count > 0.

Adds backend/tests/test_run_workflow_job.py covering ZIP contents,
session counts, pre-loop error path, and summary text format."
```

---

## Task 3: Frontend types — accept the new optional fields

**Files:**
- Modify: `frontend/lib/workflow/run.ts` (lines 29–45)
- Create: `frontend/lib/workflow/__tests__/run.test.ts`

This task widens `WorkflowStatusResponse` so old and new payloads both type-check. No runtime behavior changes yet — that's Task 4.

- [ ] **Step 1: Create the type-shape vitest**

Create `frontend/lib/workflow/__tests__/run.test.ts`:

```typescript
import { describe, it, expectTypeOf } from 'vitest';
import type { WorkflowStatusResponse } from '../run';

describe('WorkflowStatusResponse type', () => {
  it('accepts the legacy shape (no PC-302 fields)', () => {
    const legacy: WorkflowStatusResponse = {
      status: 'completed',
      results: {
        files: ['A.chain'],
        file_details: [
          {
            filename: 'A.chain',
            project_folder: '/proj',
            output_path: '/abs/A.chain',
          },
        ],
        zip_path: '/abs/zip',
        summary: { total_files: 1, project_folder: '/proj' },
      },
    };
    expectTypeOf(legacy).toEqualTypeOf<WorkflowStatusResponse>();
  });

  it('accepts the PC-302 shape with model/status/error and counts', () => {
    const next: WorkflowStatusResponse = {
      status: 'completed',
      results: {
        files: ['A.chain'],
        file_details: [
          {
            model: 'A',
            filename: 'A.chain',
            project_folder: '/proj',
            output_path: '/abs/A.chain',
            status: 'success',
            error: null,
          },
          {
            model: 'B',
            filename: null,
            project_folder: '/proj',
            output_path: null,
            status: 'error',
            error: 'FileNotFoundError: missing.dwg',
          },
        ],
        zip_path: '/abs/zip',
        summary: {
          total_files: 1,
          succeeded_count: 1,
          failed_count: 1,
          project_folder: '/proj',
        },
      },
    };
    expectTypeOf(next).toEqualTypeOf<WorkflowStatusResponse>();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

From `frontend/`:

```bash
npm run test -- run.test.ts
```

Expected: TypeScript error — `filename: null` is not assignable to `string`, and `model`/`status`/`error`/`succeeded_count`/`failed_count` are not in the type.

- [ ] **Step 3: Update the type**

Replace the `WorkflowStatusResponse` interface in `frontend/lib/workflow/run.ts` (lines 29–45):

```typescript
export interface WorkflowStatusResponse {
  status: 'processing' | 'completed' | 'error';
  results?: {
    files: string[];
    file_details?: Array<{
      model?: string;
      filename: string | null;
      project_folder: string;
      output_path?: string | null;
      status?: 'success' | 'error';
      error?: string | null;
    }>;
    zip_path: string;
    summary: {
      total_files: number;
      succeeded_count?: number;
      failed_count?: number;
      project_folder: string;
    };
  };
  error?: string;
}
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
npm run test -- run.test.ts
```

Expected: pass.

- [ ] **Step 5: Run typecheck and full vitest to verify no regressions**

```bash
npm run lint
npm run test
```

Expected: green. Any consumer reading `filename` may surface a "string | null is not assignable to string" error — if so, that's exposing a real call site that needs the null-guard introduced in Task 4. If you see a typecheck error in `app/page.tsx` or anywhere else, **stop and resolve it as part of Task 4 before moving on** rather than weakening this type.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/workflow/run.ts frontend/lib/workflow/__tests__/run.test.ts
git commit -m "feat(PC-302): widen WorkflowStatusResponse for per-model fields

Adds optional model/status/error per row, and succeeded_count/failed_count
on summary. filename and output_path become nullable for failure rows.
Pure type change; runtime wiring lands in the next commit."
```

---

## Task 4: SuccessCelebration — warning state and failed-models list

**Files:**
- Modify: `frontend/components/workflow/SuccessCelebration.tsx`

`SuccessCelebration` currently renders a single celebratory state. Extend it with two additional states (warning, failure) driven by new props. Keep the prop surface backwards-compatible: existing callers passing only `{ isOpen, onClose, fileCount }` continue to render the existing emerald success view.

- [ ] **Step 1: Replace the component with the extended version**

Overwrite `frontend/components/workflow/SuccessCelebration.tsx`:

```typescript
'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Download, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface FailedModel {
  model: string;
  error: string;
}

interface SuccessCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  fileCount?: number;
  /** PC-302: total models attempted across the run (or batch). */
  totalModels?: number;
  /** PC-302: models that failed; if non-empty, the modal shifts to a warning/error state. */
  failedModels?: FailedModel[];
}

export function SuccessCelebration({
  isOpen,
  onClose,
  fileCount,
  totalModels,
  failedModels,
}: SuccessCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [failuresExpanded, setFailuresExpanded] = useState(false);

  const failed = failedModels ?? [];
  const succeeded = fileCount ?? 0;
  const total = totalModels ?? succeeded + failed.length;

  const allFailed = failed.length > 0 && succeeded === 0;
  const partial = failed.length > 0 && succeeded > 0;
  const fullSuccess = failed.length === 0;

  useEffect(() => {
    if (isOpen && fullSuccess) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
    setShowConfetti(false);
  }, [isOpen, fullSuccess]);

  useEffect(() => {
    if (!isOpen) setFailuresExpanded(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const tone = allFailed ? 'error' : partial ? 'warning' : 'success';
  const borderClass =
    tone === 'success' ? 'border-emerald-500/50'
      : tone === 'warning' ? 'border-amber-500/50'
        : 'border-rose-500/50';
  const iconBgClass =
    tone === 'success' ? 'from-emerald-500 to-green-600'
      : tone === 'warning' ? 'from-amber-500 to-orange-600'
        : 'from-rose-500 to-red-600';
  const ringPulseClass =
    tone === 'success' ? 'bg-emerald-500/20'
      : tone === 'warning' ? 'bg-amber-500/20'
        : 'bg-rose-500/20';
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : XCircle;

  const title =
    tone === 'success' ? '🎉 Success! 🎉'
      : tone === 'warning' ? 'Workflow completed with errors'
        : 'Workflow failed';

  const message =
    tone === 'success' ? 'Your workflow has completed successfully!'
      : tone === 'warning' ? `${succeeded} of ${total} models succeeded.`
        : `All ${total} models failed. The ZIP contains _summary.txt for diagnosis.`;

  return (
    <>
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-confetti-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                backgroundColor: [
                  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b',
                  '#ef4444', '#ec4899', '#06b6d4',
                ][Math.floor(Math.random() * 7)],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
        <div
          className={`bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border-2 ${borderClass} p-8 max-w-md w-full animate-in fade-in zoom-in duration-300`}
        >
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className={`absolute inset-0 ${ringPulseClass} rounded-full animate-ping`} />
              <div className={`relative bg-gradient-to-br ${iconBgClass} rounded-full p-4`}>
                <Icon className="w-16 h-16 text-white" />
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-center text-white mb-2">{title}</h2>

          <p className="text-center text-gray-300 mb-4">{message}</p>

          {fileCount !== undefined && fileCount > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4">
              <p className="text-center text-emerald-400 font-semibold">
                <Sparkles className="w-4 h-4 inline mr-2" />
                {fileCount} chain file{fileCount !== 1 ? 's' : ''} generated
              </p>
            </div>
          )}

          {failed.length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 mb-6">
              <button
                type="button"
                onClick={() => setFailuresExpanded((v) => !v)}
                className="w-full text-left text-sm text-rose-300 font-semibold flex items-center justify-between"
              >
                <span>
                  {failed.length} model{failed.length !== 1 ? 's' : ''} failed
                </span>
                <span aria-hidden>{failuresExpanded ? '▾' : '▸'}</span>
              </button>
              {failuresExpanded && (
                <ul className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {failed.map((f) => (
                    <li key={f.model} className="text-xs text-gray-200">
                      <div className="font-semibold text-white">{f.model}</div>
                      <div className="font-mono text-rose-300 break-all">{f.error}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {fullSuccess && (
            <div className="flex justify-center mb-6">
              <div className="animate-bounce">
                <Download className="w-8 h-8 text-emerald-400" />
              </div>
            </div>
          )}

          <Button
            onClick={onClose}
            className={
              tone === 'success'
                ? 'w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold py-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-emerald-500/50'
                : tone === 'warning'
                  ? 'w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold py-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-amber-500/50'
                  : 'w-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-semibold py-2 rounded-lg transition-all duration-200 shadow-lg hover:shadow-rose-500/50'
            }
          >
            {tone === 'success' ? 'Awesome!' : 'Close'}
          </Button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run lint
```

Expected: clean. The only call site (`app/page.tsx:1224`) still passes a subset of props, which type-checks because `totalModels` and `failedModels` are optional. Wiring those props is Task 5.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/workflow/SuccessCelebration.tsx
git commit -m "feat(PC-302): add warning/error states to SuccessCelebration

Extends the modal with optional totalModels and failedModels props.
- 0 failures -> emerald success (existing behavior, prop-shape compatible).
- mixed -> amber warning, expandable failed-models list.
- 0 successes -> rose failure, same list.
Wiring from app/page.tsx lands in the next commit."
```

---

## Task 5: Wire failed-models data through `app/page.tsx`

**Files:**
- Modify: `frontend/app/page.tsx` (single-Excel path ~lines 770–789, multi-Excel path ~lines 790–842, modal render ~lines 1224–1228)

This task plumbs `succeeded_count`, `failed_count`, and the failure rows from the status response through to `SuccessCelebration`. Both the single-Excel and multi-Excel paths must be updated.

- [ ] **Step 1: Update `runSingleWorkflow` to return per-model status**

Find `runSingleWorkflow` (around line 724). Today it returns `{ sessionId, zipBlob, folderName }`. Extend the return type and propagate the status payload from `getWorkflowStatus` so the caller can read counts and failures.

Replace the return-type and the `completed` branch inside the polling loop. Locate (around lines 744–758):

```typescript
        if (status.status === 'completed') {
          // Download the ZIP file
          const downloadUrl = getWorkflowDownloadUrl(sessionId);
          const zipResponse = await fetch(downloadUrl);
          const zipBlob = await zipResponse.blob();

          // Generate folder name from Excel filename
          const excelNode = nodes.find((n) => n.id === excelNodeId);
          const excelFile = (excelNode?.data as any)?.file as File | undefined;
          const folderName = excelFile
            ? excelFile.name.replace(/\.xlsx?$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_')
            : `workflow_${sessionId.substring(0, 8)}`;

          return { sessionId, zipBlob, folderName };
        } else if (status.status === 'error') {
```

Replace with:

```typescript
        if (status.status === 'completed') {
          // Download the ZIP file
          const downloadUrl = getWorkflowDownloadUrl(sessionId);
          const zipResponse = await fetch(downloadUrl);
          const zipBlob = await zipResponse.blob();

          // Generate folder name from Excel filename
          const excelNode = nodes.find((n) => n.id === excelNodeId);
          const excelFile = (excelNode?.data as any)?.file as File | undefined;
          const folderName = excelFile
            ? excelFile.name.replace(/\.xlsx?$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_')
            : `workflow_${sessionId.substring(0, 8)}`;

          // PC-302: surface partial-success state from the response.
          const succeededCount = status.results?.summary?.succeeded_count;
          const failedCount = status.results?.summary?.failed_count ?? 0;
          const failedModels = (status.results?.file_details ?? [])
            .filter((r) => r.status === 'error')
            .map((r) => ({
              model: r.model ?? '(unknown model)',
              error: r.error ?? '(no error message)',
            }));

          return {
            sessionId,
            zipBlob,
            folderName,
            succeededCount,
            failedCount,
            failedModels,
          };
        } else if (status.status === 'error') {
```

The function's inferred return type now includes the three new fields. If you want to be explicit, add at the top of `runSingleWorkflow`:

```typescript
const runSingleWorkflow = async (excelNodeId: string): Promise<{
  sessionId: string;
  zipBlob: Blob;
  folderName: string;
  succeededCount?: number;
  failedCount: number;
  failedModels: Array<{ model: string; error: string }>;
}> => {
```

- [ ] **Step 2: Update the single-Excel branch to pass per-model state to the modal**

Find the single-Excel branch (around lines 770–789). Today:

```typescript
      if (selectedExcelIds.length === 1) {
        // Single workflow - use existing behavior
        const { sessionId, zipBlob, folderName } = await runSingleWorkflow(selectedExcelIds[0]);
        setSessionId(sessionId);

        // Get file count (approximate from ZIP)
        const zip = await JSZip.loadAsync(zipBlob);
        const fileCount = Object.keys(zip.files).filter((name) => !name.endsWith('/')).length;
        setSuccessFileCount(fileCount);
        setShowSuccess(true);
```

Replace with:

```typescript
      if (selectedExcelIds.length === 1) {
        // Single workflow - use existing behavior
        const result = await runSingleWorkflow(selectedExcelIds[0]);
        const { sessionId, zipBlob, succeededCount, failedCount, failedModels } = result;
        setSessionId(sessionId);

        // PC-302: prefer the structured succeeded_count from the backend; fall back
        // to counting non-_summary entries in the ZIP for legacy sessions.
        let chainFileCount = succeededCount;
        if (chainFileCount === undefined) {
          const zip = await JSZip.loadAsync(zipBlob);
          chainFileCount = Object.keys(zip.files).filter(
            (name) => !name.endsWith('/') && name !== '_summary.txt',
          ).length;
        }
        setSuccessFileCount(chainFileCount);
        setSuccessTotalModels((chainFileCount ?? 0) + failedCount);
        setSuccessFailedModels(failedModels);
        setShowSuccess(true);
```

Note: this introduces two new state setters (`setSuccessTotalModels`, `setSuccessFailedModels`) — declare them next to the existing modal state (around line 63):

```typescript
  const [showSuccess, setShowSuccess] = useState(false);
  const [successFileCount, setSuccessFileCount] = useState<number | undefined>(undefined);
  const [successTotalModels, setSuccessTotalModels] = useState<number | undefined>(undefined);
  const [successFailedModels, setSuccessFailedModels] = useState<Array<{ model: string; error: string }>>([]);
```

- [ ] **Step 3: Update the multi-Excel branch to accumulate counts and surface combined warning**

Find the multi-Excel branch (around lines 790–842). Today the inner loop calls `runSingleWorkflow` and counts ZIP files, with a `setSuccessFileCount(totalFileCount); setShowSuccess(true);` at the end. Replace the loop body and the final modal call:

```typescript
      } else {
        // Multiple workflows - run sequentially and combine
        const results: Array<{
          sessionId: string;
          zipBlob: Blob;
          folderName: string;
          succeededCount?: number;
          failedCount: number;
          failedModels: Array<{ model: string; error: string }>;
        }> = [];
        let totalSucceeded = 0;
        let totalFailed = 0;
        const combinedFailedModels: Array<{ model: string; error: string }> = [];

        for (const excelNodeId of selectedExcelIds) {
          try {
            const result = await runSingleWorkflow(excelNodeId);
            results.push(result);

            // Prefer structured counts; fall back to ZIP inspection (excluding _summary.txt).
            let succeededInRun = result.succeededCount;
            if (succeededInRun === undefined) {
              const zip = await JSZip.loadAsync(result.zipBlob);
              succeededInRun = Object.keys(zip.files).filter(
                (name) => !name.endsWith('/') && name !== '_summary.txt',
              ).length;
            }
            totalSucceeded += succeededInRun;
            totalFailed += result.failedCount;
            // Prefix the model name with the Excel folder so the combined list is unambiguous.
            for (const f of result.failedModels) {
              combinedFailedModels.push({
                model: `${result.folderName}/${f.model}`,
                error: f.error,
              });
            }
          } catch (err) {
            setErrorModal({
              isOpen: true,
              title: 'Workflow Failed',
              message: `Error running workflow for ${excelNodeId}: ${err instanceof Error ? err.message : 'Unknown error'}`,
              isExcelError: false,
            });
            setIsRunning(false);
            return;
          }
        }

        // Combine all ZIPs into one (excluding the per-run _summary.txt files; we
        // could merge them, but keeping them per-folder is simpler and preserves
        // the existing folderName/relativePath layout below).
        const combinedZip = new JSZip();
        for (const result of results) {
          const zip = await JSZip.loadAsync(result.zipBlob);
          const filePromises: Promise<void>[] = [];
          zip.forEach((relativePath: string, file: JSZip.JSZipObject) => {
            if (!file.dir) {
              filePromises.push(
                file.async('blob').then((fileData) => {
                  combinedZip.file(`${result.folderName}/${relativePath}`, fileData);
                })
              );
            }
          });
          await Promise.all(filePromises);
        }

        const combinedBlob = await combinedZip.generateAsync({ type: 'blob' });
        setSuccessFileCount(totalSucceeded);
        setSuccessTotalModels(totalSucceeded + totalFailed);
        setSuccessFailedModels(combinedFailedModels);
        setShowSuccess(true);
```

(The download trigger below — `URL.createObjectURL(combinedBlob)` — stays unchanged.)

- [ ] **Step 4: Pass the new props to `<SuccessCelebration>`**

Find the modal render (around lines 1224–1228):

```typescript
            <SuccessCelebration
              isOpen={showSuccess}
              onClose={() => setShowSuccess(false)}
              fileCount={successFileCount}
            />
```

Replace with:

```typescript
            <SuccessCelebration
              isOpen={showSuccess}
              onClose={() => setShowSuccess(false)}
              fileCount={successFileCount}
              totalModels={successTotalModels}
              failedModels={successFailedModels}
            />
```

- [ ] **Step 5: Reset the new state on close**

The existing `onClose={() => setShowSuccess(false)}` doesn't clear the failure state. That's harmless functionally (the modal won't render unless `isOpen`), but to keep state clean, change the close handler to also reset:

```typescript
              onClose={() => {
                setShowSuccess(false);
                setSuccessFailedModels([]);
                setSuccessTotalModels(undefined);
              }}
```

- [ ] **Step 6: Lint, typecheck, and run all frontend tests**

```bash
npm run lint
npm run test
npm run build
```

Expected: green.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat(PC-302): surface per-model failures in success modal

Both the single-Excel and multi-Excel paths now read succeeded_count,
failed_count, and failed file_details rows from the status response and
forward them to SuccessCelebration. Multi-Excel prefixes failed model
names with the per-Excel folder name to keep the combined list
unambiguous. Falls back to ZIP inspection (excluding _summary.txt) when
the backend response doesn't carry structured counts (legacy sessions)."
```

---

## Task 6: End-to-end manual verification + roadmap update

**Files:**
- Modify: `ROADMAP.md` (PC-302 entry)

- [ ] **Step 1: Start backend and frontend in two terminals**

Terminal 1, from `backend/`:

```bash
python main.py
```

Terminal 2, from `frontend/`:

```bash
npm run dev
```

- [ ] **Step 2: Build a workflow that fails one model out of three**

In the browser at `http://localhost:3000`:
1. Drop an `excelModels` node, a `foreachModel` node, an `import` node (file type DWG), a `cleanModel` node, and a `chainFileOutput` node. Wire flow edges in that order.
2. On the `import` node, set `filePath` to a per-model variable expression like `D:/missing/{model_name}.dwg`. Make a per-model variable so models A and C resolve to existing paths and B resolves to a missing one — the simplest way is to point the importer at a path that **always** errors (any `import` raises during `generate_chain_file` → triggers PC-302), but force only some models to fail. If you don't have real DWG files handy, just patch one model's variable to a clearly bad path and let the others stay at a placeholder that also fails — what matters for verification is that *some* models fail and *some* succeed, even if "succeed" just means "no exception raised by the importer." For a faster test, replace the `import` node with `addLabel` or `addComment` (both pass for all models) and use the dev tools to break one — see Step 3 alternative.

**Faster alternative:** if assembling a real failing workflow is fiddly, run the integration test by calling `run_workflow_job` from a Python REPL with a stubbed `generate_chain_file`. That's already covered by `test_run_workflow_job.py` — the manual step here is specifically to validate the **UI** path.

- [ ] **Step 3: Confirm the success modal shows the partial-success state**

When the run finishes:
- The modal headline reads `Workflow completed with errors`.
- A box reports `<X> of <Y> models succeeded`.
- A `<N> models failed` toggle expands to show each failed model name and error string.
- The download triggers automatically; the ZIP contains the chain files for successful models plus `_summary.txt`.
- `_summary.txt` content matches the format from Task 2 (SUCCEEDED list, FAILED list with indented error strings).

- [ ] **Step 4: Confirm the all-fail state**

Force all three models to fail (e.g., point the importer's path at `Z:/definitely-missing/{model_name}.dwg`).
- The modal headline reads `Workflow failed`.
- The body reads `All <N> models failed. The ZIP contains _summary.txt for diagnosis.`
- The expandable failed-models list shows all three.
- The download still triggers; the ZIP contains only `_summary.txt`.

- [ ] **Step 5: Confirm the all-succeed state is unchanged**

Run a workflow you know works end-to-end (the dev's standard demo flow). Expected: emerald celebration, confetti animation, "X chain files generated" badge, no failed-models section. Visual parity with pre-PC-302.

- [ ] **Step 6: Confirm the server log captures tracebacks**

In Terminal 1 (backend), grep the output for the failed model name. Expected: an `ERROR`-level log line with model name + error message, followed by a stack trace (`exc_info=True` from Task 1).

- [ ] **Step 7: Update `ROADMAP.md`**

Find the PC-302 entry (line 58 in `ROADMAP.md` at the time of writing). Mark it done in the same style as PC-301 (line 55) and PC-305:

```markdown
- ✅ **PC-302** `[P1]` — Per-model error isolation and partial results.
  *Rationale:* `run_workflow` now wraps each model in try/except, returning per-model status rows (`{model, status, error}`) on `file_details`. `run_workflow_job` writes a `_summary.txt` summary file into every ZIP and stores `succeeded_count` / `failed_count` on the session. The success modal surfaces partial-success ("X of Y models succeeded") and total-failure states, with an expandable failed-models list. Tested in `backend/tests/test_run_workflow.py` and `backend/tests/test_run_workflow_job.py`.
```

- [ ] **Step 8: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: mark PC-302 done in ROADMAP"
```

---

## Self-review (run by plan author after writing)

**Spec coverage:**
- §Approach 1 (run_workflow per-model try/except) → Task 1 ✓
- §Approach 2 (run_workflow_job summary + counts) → Task 2 ✓
- §Approach 3 (frontend types + modal) → Tasks 3, 4, 5 ✓
- §`_summary.txt` format → Task 2 (impl) + test_summary_text_format ✓
- §Data shapes (file_details, summary) → Tasks 1, 2 ✓
- §Frontend types → Task 3 ✓
- §SuccessCelebration warning state → Task 4 ✓
- §Multi-Excel path → Task 5 ✓
- §Edge cases (all fail, no models, ZIP fails) → covered by tests in Tasks 1, 2 ✓
- §Backwards compatibility → Task 3 (legacy type test) + Task 5 (ZIP fallback for legacy sessions) ✓
- §Manual verification → Task 6 ✓

**Placeholder scan:** No "TBD", "TODO", or "implement later" in any task body. All test code is complete; all production code is complete; commands are exact. ✓

**Type/name consistency:**
- `succeeded_count` / `failed_count` (snake_case backend, snake_case in JSON) → Tasks 1, 2 ✓
- `succeededCount` / `failedCount` (camelCase in TS local variables) → Tasks 3, 5 ✓
- `failedModels: { model, error }[]` shape consistent across SuccessCelebration prop, runSingleWorkflow return, page.tsx state ✓
- `_build_summary_text` referenced in test (`backend_main._build_summary_text`) and defined in main.py (Task 2 Step 3) ✓
- `FailedModel` type exported from SuccessCelebration; not imported in page.tsx (page.tsx uses an inline shape) — both shapes are structurally identical, so no name drift, but if the engineer prefers one canonical type they can `import { FailedModel } from '@/components/workflow/SuccessCelebration'` in page.tsx. Optional — no blocker.

---

## Out of scope for this plan
- Per-node error isolation (PC-303).
- Streaming progress / SSE (PC-303).
- Canvas-level error highlighting (PC-303).
- Retry of failed models (future).
- Persistent failure history beyond session TTL (future).
