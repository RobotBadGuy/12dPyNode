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


# PC-907 — progress writes ----------------------------------------------------

def test_progress_callback_writes_intermediate_results(monkeypatch, _isolate_dirs):
    """run_workflow_job wires a callback that updates the session's `results`
    field on every per-model tick. Stub run_workflow to drive the callback
    directly so we can observe each write."""
    _, output_dir = _isolate_dirs
    paths = _write_chain_files(output_dir, ["A.chain"])

    captured_states: List[Dict[str, Any]] = []
    session_id = _seed_session()

    # Snapshot the session's `results` field every time the callback fires.
    # Wrap session_store.update so we observe the actual stored shape.
    real_update = backend_main.session_store.update

    def spying_update(sid: str, patch: Dict[str, Any]) -> None:
        real_update(sid, patch)
        if sid == session_id and "results" in patch and patch.get("status") is None:
            row = backend_main.session_store.get(sid)
            captured_states.append(row["results"])

    monkeypatch.setattr(backend_main.session_store, "update", spying_update)

    queued_seed = [
        {"model": "A", "filename": None, "output_path": None,
         "project_folder": "/p", "status": "queued", "error": None},
        {"model": "B", "filename": None, "output_path": None,
         "project_folder": "/p", "status": "queued", "error": None},
    ]
    after_a = [
        _success_row("A", paths[0]),
        {"model": "B", "filename": None, "output_path": None,
         "project_folder": "/p", "status": "queued", "error": None},
    ]
    after_b = [_success_row("A", paths[0]), _failure_row("B", "RE: x")]

    def fake_run_workflow(*_a, progress_callback=None, **_k):
        # Drive the callback the same way the real run_workflow does.
        progress_callback(queued_seed)
        progress_callback(after_a)
        progress_callback(after_b)
        return ([paths[0]], "/p", after_b)

    monkeypatch.setattr(backend_main, "run_workflow", fake_run_workflow)

    backend_main.run_workflow_job(session_id, "/tmp/x.xlsx", {}, [])

    # 3 callback ticks + the final completion write. The final write carries
    # status='completed' so it is filtered out of captured_states.
    assert len(captured_states) == 3
    assert [r["status"] for r in captured_states[0]["file_details"]] == ["queued", "queued"]
    assert [r["status"] for r in captured_states[1]["file_details"]] == ["success", "queued"]
    assert [r["status"] for r in captured_states[2]["file_details"]] == ["success", "error"]


def test_status_endpoint_surfaces_progress_during_processing(monkeypatch, _isolate_dirs):
    """While status='processing', /api/workflow/status returns the in-flight
    `results` (with file_details) so the UI can render the live list."""
    session_id = _seed_session()
    backend_main.session_store.update(session_id, {
        "status": "processing",
        "results": {
            "file_details": [
                {"model": "A", "filename": None, "output_path": None,
                 "project_folder": "/p", "status": "success", "error": None},
                {"model": "B", "filename": None, "output_path": None,
                 "project_folder": "/p", "status": "queued", "error": None},
            ],
        },
    })

    import asyncio
    result = asyncio.run(backend_main.get_workflow_status(session_id))

    assert result["status"] == "processing"
    assert "results" in result
    assert [r["status"] for r in result["results"]["file_details"]] == ["success", "queued"]


def test_status_endpoint_omits_results_when_processing_with_no_progress_yet(
    monkeypatch, _isolate_dirs,
):
    """If the run hasn't reached the queued-seed callback yet, results is None
    and the endpoint must not include a `results` key."""
    session_id = _seed_session()  # seeds with results=None
    # Confirm: row exists with status='processing', results is None
    backend_main.session_store.update(session_id, {"status": "processing"})

    import asyncio
    result = asyncio.run(backend_main.get_workflow_status(session_id))

    assert result["status"] == "processing"
    assert "results" not in result


def test_run_workflow_job_no_excel_path(monkeypatch, _isolate_dirs):
    """PC-1001: run_workflow_job tolerates excel_file_path=None (manual source)."""
    _, output_dir = _isolate_dirs
    paths = _write_chain_files(output_dir, ["A.chain"])
    file_details = [_success_row("A", paths[0])]
    _patch_run_workflow(monkeypatch, ([paths[0]], "/proj", file_details))

    session_id = _seed_session()
    backend_main.run_workflow_job(session_id, None, {"modelNames": ["A"]}, [])

    session = backend_main.session_store.get(session_id)
    zip_path = session["results"]["zip_path"]
    with zipfile.ZipFile(zip_path) as zf:
        assert "A.chain" in set(zf.namelist())
