"""Tests for run_workflow_job summary/zip/session shape (PC-302)."""
import zipfile
import uuid
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


def _seed_session(session_id: str | None = None) -> str:
    """Initialize a session row the way run_workflow_endpoint would.

    Generates a fresh UUID per call so tests don't collide on the session
    primary key when run against a real Supabase backend.
    """
    if session_id is None:
        session_id = str(uuid.uuid4())
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
