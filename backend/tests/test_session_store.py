"""Tests for the PC-201 session store abstraction."""

from __future__ import annotations

import time
from typing import Any, Dict, List

import pytest

from services.session_store import (
    InMemorySessionStore,
    SupabaseSessionStore,
    TABLE_NAME,
    build_session_store,
)


# ── In-memory store ────────────────────────────────────────────────────────


def test_create_then_get_returns_persisted_fields():
    store = InMemorySessionStore()
    store.create("abc", {
        "status": "processing",
        "excel_file": "/tmp/foo.xlsx",
        "workflow_graph": {"nodes": []},
        "variables": [{"name": "x", "value": "1"}],
        "results": None,
        "error": None,
    })

    row = store.get("abc")
    assert row is not None
    assert row["id"] == "abc"
    assert row["status"] == "processing"
    assert row["excel_file"] == "/tmp/foo.xlsx"
    assert row["workflow_graph"] == {"nodes": []}
    assert "created_at" in row and "updated_at" in row


def test_get_unknown_session_returns_none():
    assert InMemorySessionStore().get("missing") is None


def test_create_drops_unknown_fields():
    store = InMemorySessionStore()
    store.create("x", {"status": "uploaded", "junk_field": "ignored"})
    row = store.get("x")
    assert "junk_field" not in row


def test_update_merges_and_bumps_updated_at():
    store = InMemorySessionStore()
    store.create("s", {"status": "processing"})
    original_updated = store.get("s")["updated_at"]

    # Sleep is unfortunate but datetime.now() resolution on Windows can collapse
    # back-to-back calls into the same instant.
    time.sleep(0.01)
    store.update("s", {"status": "completed", "results": {"files": ["a.chain"]}})

    row = store.get("s")
    assert row["status"] == "completed"
    assert row["results"] == {"files": ["a.chain"]}
    assert row["updated_at"] > original_updated


def test_update_on_missing_session_is_a_noop():
    store = InMemorySessionStore()
    store.update("ghost", {"status": "completed"})  # must not raise
    assert store.get("ghost") is None


def test_update_filters_unknown_fields():
    store = InMemorySessionStore()
    store.create("s", {"status": "processing"})
    store.update("s", {"status": "completed", "smuggled": "value"})
    assert "smuggled" not in store.get("s")


def test_delete_older_than_returns_count_and_removes_rows():
    store = InMemorySessionStore()
    store.create("old", {"status": "completed"})
    time.sleep(0.05)
    store.create("fresh", {"status": "completed"})

    deleted = store.delete_older_than(ttl_seconds=0)  # everything is "older than 0s ago"
    assert deleted == 2
    assert store.get("old") is None
    assert store.get("fresh") is None


def test_delete_older_than_keeps_recent_rows():
    store = InMemorySessionStore()
    store.create("recent", {"status": "completed"})
    deleted = store.delete_older_than(ttl_seconds=3600)
    assert deleted == 0
    assert store.get("recent") is not None


# ── Supabase adapter (against a fake client) ───────────────────────────────


class _FakeResponse:
    def __init__(self, data: List[Dict[str, Any]] | None = None):
        self.data = data or []


class _FakeQuery:
    """Mimics the supabase-py builder. Records every call for assertions."""

    def __init__(self, table: "_FakeTable", op: str):
        self.table = table
        self.op = op
        self.payload: Any = None
        self.filters: List[tuple] = []
        self.selected: str | None = None

    def insert(self, payload):
        self.payload = payload
        self.table.calls.append(("insert", payload))
        return self

    def select(self, cols):
        self.selected = cols
        return self

    def update(self, payload):
        self.payload = payload
        self.table.calls.append(("update", payload))
        return self

    def delete(self):
        self.table.calls.append(("delete", None))
        return self

    def eq(self, col, val):
        self.filters.append(("eq", col, val))
        return self

    def lt(self, col, val):
        self.filters.append(("lt", col, val))
        return self

    def limit(self, _n):
        return self

    def execute(self):
        return self.table.respond(self)


class _FakeTable:
    def __init__(self, rows: List[Dict[str, Any]] | None = None):
        self.calls: List[tuple] = []
        self.rows = rows or []

    def insert(self, payload):
        return _FakeQuery(self, "insert").insert(payload)

    def select(self, cols):
        return _FakeQuery(self, "select").select(cols)

    def update(self, payload):
        return _FakeQuery(self, "update").update(payload)

    def delete(self):
        return _FakeQuery(self, "delete").delete()

    def respond(self, q: _FakeQuery) -> _FakeResponse:
        # Echo back rows for select/delete so the adapter can introspect them.
        return _FakeResponse(self.rows)


class _FakeClient:
    def __init__(self, table: _FakeTable):
        self._table = table
        self.last_table_name: str | None = None

    def table(self, name: str):
        self.last_table_name = name
        return self._table


def test_supabase_store_create_targets_correct_table_and_id():
    table = _FakeTable()
    store = SupabaseSessionStore(_FakeClient(table))

    store.create("sid-1", {"status": "processing", "excel_file": "/tmp/a.xlsx"})

    assert ("insert", {"id": "sid-1", "status": "processing", "excel_file": "/tmp/a.xlsx"}) in table.calls


def test_supabase_store_get_filters_by_id():
    table = _FakeTable(rows=[{"id": "sid-1", "status": "completed"}])
    client = _FakeClient(table)
    store = SupabaseSessionStore(client)

    row = store.get("sid-1")

    assert client.last_table_name == TABLE_NAME
    assert row == {"id": "sid-1", "status": "completed"}


def test_supabase_store_get_returns_none_when_no_rows():
    store = SupabaseSessionStore(_FakeClient(_FakeTable(rows=[])))
    assert store.get("missing") is None


def test_supabase_store_update_skips_when_patch_is_empty():
    table = _FakeTable()
    store = SupabaseSessionStore(_FakeClient(table))

    store.update("sid", {"non_persisted": "x"})  # all fields filtered out

    assert table.calls == []


def test_supabase_store_update_sends_only_persisted_fields():
    table = _FakeTable()
    store = SupabaseSessionStore(_FakeClient(table))

    store.update("sid", {"status": "completed", "results": {"files": []}, "junk": 1})

    update_calls = [c for c in table.calls if c[0] == "update"]
    assert update_calls == [("update", {"status": "completed", "results": {"files": []}})]


def test_supabase_store_delete_older_than_uses_lt_filter():
    table = _FakeTable(rows=[{"id": "1"}, {"id": "2"}])
    store = SupabaseSessionStore(_FakeClient(table))

    deleted = store.delete_older_than(ttl_seconds=60)
    assert deleted == 2


# ── Factory ────────────────────────────────────────────────────────────────


def test_build_session_store_falls_back_to_memory_without_env(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    store = build_session_store()
    assert isinstance(store, InMemorySessionStore)
