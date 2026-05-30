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


def test_manual_model_names_no_excel(monkeypatch, output_dir):
    """PC-1001: with no Excel file, model names come from workflow_graph.modelNames."""
    def fake_generate(model_name, *args, **kwargs):
        path = str(output_dir / f"{model_name}.chain")
        Path(path).write_text("<xml/>", encoding="utf-8")
        return path

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    graph = {**_minimal_graph(), "modelNames": ["A", "B", "C"]}
    generated, _project, details = run_workflow(None, graph, [], str(output_dir))

    assert len(generated) == 3
    assert [r["model"] for r in details] == ["A", "B", "C"]
    assert all(r["status"] == "success" for r in details)


def test_manual_model_names_whitespace_and_blanks(monkeypatch, output_dir):
    """PC-1001: manual names are trimmed; blank/'nan' entries are dropped."""
    def fake_generate(model_name, *args, **kwargs):
        path = str(output_dir / f"{model_name}.chain")
        Path(path).write_text("<xml/>", encoding="utf-8")
        return path

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    graph = {**_minimal_graph(), "modelNames": ["  A ", "", "   ", "B", "nan"]}
    generated, _project, details = run_workflow(None, graph, [], str(output_dir))

    assert [r["model"] for r in details] == ["A", "B"]


def test_manual_model_names_empty_list(monkeypatch, output_dir):
    """PC-1001: an empty manual list yields no generated files and no rows."""
    def boom(*a, **k):
        raise AssertionError("generate_chain_file should not be called for an empty list")

    monkeypatch.setattr(workflow_runner, "generate_chain_file", boom)

    graph = {**_minimal_graph(), "modelNames": []}
    generated, _project, details = run_workflow(None, graph, [], str(output_dir))

    assert generated == []
    assert details == []


def test_manual_model_names_respect_selected_subset(monkeypatch, output_dir):
    """PC-1001: selectedModelNames still narrows a manual list (powers PC-1004 test-run)."""
    def fake_generate(model_name, *args, **kwargs):
        path = str(output_dir / f"{model_name}.chain")
        Path(path).write_text("<xml/>", encoding="utf-8")
        return path

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    graph = {**_minimal_graph(), "modelNames": ["A", "B", "C"], "selectedModelNames": ["B"]}
    generated, _project, details = run_workflow(None, graph, [], str(output_dir))

    assert [r["model"] for r in details] == ["B"]


def test_normalize_model_key_collapses_numeric_strings():
    """PC-704: numeric names normalize to one form so the frontend's '13' matches
    pandas' '13.0'; non-numeric names (and nan/inf) are left untouched."""
    from services.workflow_runner import _normalize_model_key

    assert _normalize_model_key("13.0") == _normalize_model_key("13") == "13"
    assert _normalize_model_key("  13.0  ") == "13"  # trimmed
    assert _normalize_model_key(13.0) == "13"        # non-str input
    assert _normalize_model_key("12.5") == "12.5"    # genuine decimal preserved
    assert _normalize_model_key("NWP-01") == "NWP-01"  # non-numeric untouched
    assert _normalize_model_key("nan") == "nan"        # guarded (int() would raise)
    assert _normalize_model_key("inf") == "inf"


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


def test_selected_subset_matches_numeric_excel_column(monkeypatch, tmp_path, output_dir):
    """PC-704: a numeric Excel column stringifies as '13.0' under pandas, while the
    frontend (SheetJS) sends the subset as '13'. Normalization keeps them matching;
    without it the run would silently produce zero files."""
    excel = tmp_path / "numeric.xlsx"
    # A header-less float column -> pandas reads it as float64 -> '12.5','13.0','14.0'.
    pd.DataFrame({0: [12.5, 13.0, 14]}).to_excel(
        excel, index=False, header=False, engine="openpyxl"
    )

    def fake_generate(model_name, *args, **kwargs):
        path = str(output_dir / f"{model_name}.chain")
        Path(path).write_text("<xml/>", encoding="utf-8")
        return path

    monkeypatch.setattr(workflow_runner, "generate_chain_file", fake_generate)

    graph = {**_minimal_graph(), "selectedModelNames": ["13", "14"]}
    generated, _project, details = run_workflow(str(excel), graph, [], str(output_dir))

    assert [r["model"] for r in details] == ["13.0", "14.0"]
    assert all(r["status"] == "success" for r in details)


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

    def test_bad_number_fails_only_that_model(self, tmp_path):
        """A coercion failure produces an error row (PC-302), not a crash of the run."""
        excel = tmp_path / "models.xlsx"
        _write_excel(excel, ["Good", "Bad"])
        out = tmp_path / "out"
        out.mkdir()
        graph = {
            "nodes": [
                {"id": "fe", "type": "foreachModel", "data": {}},
                {"id": "drape", "type": "drapeToTin",
                 "data": {"dataToDrape": "D", "zOffset": "abc", "tinName": "T",
                          "continueOnFailure": True, "comments": ""}},
                {"id": "out", "type": "chainFileOutput",
                 "data": {"modelType": "Model", "projectFolder": "project_folder"}},
            ],
            "edges": [
                {"source": "fe", "target": "drape", "sourceHandle": "flow:out", "targetHandle": "flow:in"},
                {"source": "drape", "target": "out", "sourceHandle": "flow:out", "targetHandle": "flow:in"},
            ],
        }
        generated, _pf, details = run_workflow(str(excel), graph, [], str(out))
        statuses = {r["model"]: r["status"] for r in details}
        assert statuses["Good"] == "error"
        assert statuses["Bad"] == "error"
        assert any("number" in (r["error"] or "") for r in details)
