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
    """An Excel with only a header row yields zero models; loop runs zero times."""
    excel = tmp_path / "empty.xlsx"
    # 'filename' is in the common_headers list and gets filtered out, leaving
    # zero model names. Using just [""] would round-trip through openpyxl as a
    # 0x0 frame and trip the upstream Excel parser, which is out of scope here.
    _write_excel(excel, ["filename"])

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


# PC-907 — progress callback ---------------------------------------------------

def test_progress_callback_emits_queued_seed_and_per_model_updates(
    monkeypatch, excel_with_three_models, output_dir,
):
    """Callback fires once with all rows queued, then once per model attempt
    with that row promoted to success or error. Snapshot at each call."""
    def fake_generate(model_name, *args, **kwargs):
        if model_name == "B":
            raise RuntimeError("boom")
        path = str(output_dir / f"{model_name}.chain")
        Path(path).write_text("<xml/>", encoding="utf-8")
        return path

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    snapshots: List[List[Dict[str, Any]]] = []

    def capture(rows: List[Dict[str, Any]]) -> None:
        # Defensive copy: run_workflow mutates the same list in place between
        # callback invocations, so we must snapshot to assert on the per-call
        # state rather than the final state.
        snapshots.append([dict(r) for r in rows])

    run_workflow(
        str(excel_with_three_models), _minimal_graph(), [], str(output_dir),
        progress_callback=capture,
    )

    # 1 seed + 3 per-model = 4 calls
    assert len(snapshots) == 4

    # Seed: every row queued
    seed = snapshots[0]
    assert [r["model"] for r in seed] == ["A", "B", "C"]
    assert [r["status"] for r in seed] == ["queued", "queued", "queued"]

    # After A: A success, B+C still queued
    assert [r["status"] for r in snapshots[1]] == ["success", "queued", "queued"]

    # After B (which fails): A success, B error, C still queued
    assert [r["status"] for r in snapshots[2]] == ["success", "error", "queued"]
    assert snapshots[2][1]["error"] == "RuntimeError: boom"

    # After C: terminal state
    assert [r["status"] for r in snapshots[3]] == ["success", "error", "success"]


def test_progress_callback_exception_does_not_abort_run(
    monkeypatch, excel_with_three_models, output_dir, caplog,
):
    """A flaky callback must not derail the run; failures are logged at WARNING."""
    def fake_generate(model_name, *args, **kwargs):
        path = str(output_dir / f"{model_name}.chain")
        Path(path).write_text("<xml/>", encoding="utf-8")
        return path

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    def explode(_rows: List[Dict[str, Any]]) -> None:
        raise RuntimeError("db is down")

    with caplog.at_level(logging.WARNING, logger="services.workflow_runner"):
        generated, _project, details = run_workflow(
            str(excel_with_three_models), _minimal_graph(), [], str(output_dir),
            progress_callback=explode,
        )

    # Run still completed normally
    assert len(generated) == 3
    assert [r["status"] for r in details] == ["success", "success", "success"]
    # And every callback raise was logged
    assert any("db is down" in r.getMessage() for r in caplog.records)


def test_no_progress_callback_keeps_legacy_signature_working(
    monkeypatch, excel_with_three_models, output_dir,
):
    """Omitting progress_callback returns identical results to the pre-PC-907 path."""
    def fake_generate(model_name, *args, **kwargs):
        path = str(output_dir / f"{model_name}.chain")
        Path(path).write_text("<xml/>", encoding="utf-8")
        return path

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    generated, _project, details = run_workflow(
        str(excel_with_three_models), _minimal_graph(), [], str(output_dir),
    )

    assert len(generated) == 3
    # Final return never carries 'queued'
    assert all(r["status"] in ("success", "error") for r in details)
