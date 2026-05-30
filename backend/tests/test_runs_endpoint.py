"""PC-906 — run-history list endpoint + slim-DTO mapping + store list_recent."""
import asyncio
from datetime import datetime, timezone

import main as backend_main
from services.session_store import InMemorySessionStore


def _row(sid, **over):
    row = {
        "id": sid,
        "status": "completed",
        "excel_file": None,
        "workflow_graph": {},
        "results": None,
        "error": None,
        "created_at": datetime(2020, 1, 1, tzinfo=timezone.utc),
        "updated_at": datetime(2020, 1, 1, tzinfo=timezone.utc),
    }
    row.update(over)
    return row


# ---- _run_summary (pure DTO mapping) -------------------------------------

def test_run_summary_completed_excel_run():
    row = _row(
        "sess1",
        excel_file="/abs/uploads/sess1_models.xlsx",
        workflow_graph={"nodes": [], "templateName": "Bridge"},
        results={"summary": {"total_files": 3, "succeeded_count": 2, "failed_count": 1}},
        updated_at=datetime(2020, 1, 1, 0, 0, 12, tzinfo=timezone.utc),
    )
    s = backend_main._run_summary(row)
    assert s["id"] == "sess1"
    assert s["status"] == "completed"
    assert s["templateName"] == "Bridge"
    assert s["sourceName"] == "models.xlsx"  # the "<id>_" prefix is stripped
    assert s["modelCount"] == 3
    assert s["succeededCount"] == 2
    assert s["failedCount"] == 1
    assert s["created_at"] == "2020-01-01T00:00:00+00:00"
    assert s["updated_at"] == "2020-01-01T00:00:12+00:00"
    # The heavy blobs must NOT leak into the list response.
    assert "workflow_graph" not in s
    assert "variables" not in s


def test_run_summary_manual_run_has_no_source_or_template():
    row = _row(
        "s2",
        excel_file=None,
        workflow_graph={"modelNames": ["A"]},
        results={"summary": {"total_files": 1, "succeeded_count": 1, "failed_count": 0}},
    )
    s = backend_main._run_summary(row)
    assert s["sourceName"] is None
    assert s["templateName"] is None
    assert s["modelCount"] == 1


def test_run_summary_error_run_surfaces_error_and_null_counts():
    row = _row("s3", status="error", results=None, error="Boom")
    s = backend_main._run_summary(row)
    assert s["status"] == "error"
    assert s["error"] == "Boom"
    assert s["modelCount"] is None
    assert s["succeededCount"] is None


def test_run_summary_passes_through_string_timestamps_and_odd_excel_name():
    # Supabase returns ISO strings; an excel path without the id prefix is kept verbatim.
    row = _row(
        "s4",
        status="processing",
        created_at="2021-05-01T10:00:00+00:00",
        excel_file="/abs/uploads/legacy.xlsx",
    )
    s = backend_main._run_summary(row)
    assert s["created_at"] == "2021-05-01T10:00:00+00:00"
    assert s["sourceName"] == "legacy.xlsx"


# ---- InMemorySessionStore.list_recent ------------------------------------

def test_list_recent_orders_newest_first_and_respects_limit():
    store = InMemorySessionStore()
    for i, sid in enumerate(["a", "b", "c", "d"]):
        store.create(sid, {"status": "completed"})
        store._rows[sid]["created_at"] = datetime(2020, 1, 1 + i, tzinfo=timezone.utc)
    recent = store.list_recent(50)
    assert [r["id"] for r in recent] == ["d", "c", "b", "a"]
    assert [r["id"] for r in store.list_recent(2)] == ["d", "c"]


def test_list_recent_empty_store():
    assert InMemorySessionStore().list_recent(50) == []


# ---- GET /api/workflow/runs endpoint -------------------------------------

def test_runs_endpoint_returns_slim_rows_newest_first(monkeypatch):
    store = InMemorySessionStore()
    store.create("old", {"status": "completed", "workflow_graph": {"templateName": "Old"},
                         "results": {"summary": {"total_files": 1, "succeeded_count": 1, "failed_count": 0}}})
    store.create("new", {"status": "error", "error": "x", "workflow_graph": {}})
    store._rows["old"]["created_at"] = datetime(2020, 1, 1, tzinfo=timezone.utc)
    store._rows["new"]["created_at"] = datetime(2020, 1, 2, tzinfo=timezone.utc)
    monkeypatch.setattr(backend_main, "session_store", store)

    rows = asyncio.run(backend_main.list_workflow_runs(limit=50))
    assert [r["id"] for r in rows] == ["new", "old"]
    assert rows[1]["templateName"] == "Old"
    assert rows[0]["status"] == "error"
    # Slim shape: no heavy blobs.
    assert all("workflow_graph" not in r and "variables" not in r for r in rows)


def test_runs_endpoint_caps_limit(monkeypatch):
    store = InMemorySessionStore()
    monkeypatch.setattr(backend_main, "session_store", store)
    captured = {}

    def fake_list_recent(limit):
        captured["limit"] = limit
        return []

    monkeypatch.setattr(store, "list_recent", fake_list_recent)
    asyncio.run(backend_main.list_workflow_runs(limit=99999))
    assert captured["limit"] == 200  # capped
    asyncio.run(backend_main.list_workflow_runs(limit=0))
    assert captured["limit"] == 1  # floored
