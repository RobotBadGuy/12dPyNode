"""Tests for the PC-202 template store abstraction."""

from __future__ import annotations

import time
from typing import Any, Dict, List

import pytest

from services.template_store import (
    InMemoryTemplateStore,
    SupabaseTemplateStore,
    TABLE_NAME,
    build_template_store,
)


def _sample(name: str = "Pipeline A") -> Dict[str, Any]:
    return {
        "name": name,
        "nodes": [{"id": "n1", "type": "excelModels"}],
        "edges": [{"id": "e1", "source": "n1", "target": "n2"}],
        "viewport": {"x": 1, "y": 2, "zoom": 0.75},
    }


# ── In-memory store ────────────────────────────────────────────────────────


def test_create_returns_record_with_generated_id_and_timestamps():
    store = InMemoryTemplateStore()
    row = store.create(_sample())

    assert row["id"]
    assert row["name"] == "Pipeline A"
    assert row["nodes"] == [{"id": "n1", "type": "excelModels"}]
    assert row["edges"] == [{"id": "e1", "source": "n1", "target": "n2"}]
    assert row["viewport"] == {"x": 1, "y": 2, "zoom": 0.75}
    assert row["created_at"] and row["updated_at"]


def test_create_drops_unknown_fields():
    store = InMemoryTemplateStore()
    row = store.create({**_sample(), "junk": "ignored"})
    assert "junk" not in row


def test_create_supplies_default_viewport_when_missing():
    store = InMemoryTemplateStore()
    payload = _sample()
    payload.pop("viewport")
    row = store.create(payload)
    assert row["viewport"] == {"x": 0, "y": 0, "zoom": 1}


def test_get_returns_none_for_unknown_id():
    assert InMemoryTemplateStore().get("missing") is None


def test_get_returns_a_copy():
    store = InMemoryTemplateStore()
    created = store.create(_sample())
    fetched = store.get(created["id"])
    assert fetched is not None
    fetched["name"] = "mutated"
    assert store.get(created["id"])["name"] == "Pipeline A"


def test_list_all_sorts_by_updated_at_desc():
    store = InMemoryTemplateStore()
    first = store.create(_sample("first"))
    time.sleep(0.01)
    second = store.create(_sample("second"))
    rows = store.list_all()
    assert [r["id"] for r in rows] == [second["id"], first["id"]]


def test_update_merges_and_bumps_updated_at():
    store = InMemoryTemplateStore()
    created = store.create(_sample())
    original_updated = created["updated_at"]

    time.sleep(0.01)
    updated = store.update(created["id"], {"name": "renamed", "junk": "ignored"})

    assert updated is not None
    assert updated["name"] == "renamed"
    assert "junk" not in updated
    assert updated["updated_at"] > original_updated
    # Other fields are preserved.
    assert updated["nodes"] == created["nodes"]


def test_update_unknown_id_returns_none():
    assert InMemoryTemplateStore().update("ghost", {"name": "x"}) is None


def test_update_with_no_persisted_fields_is_noop_but_returns_row():
    store = InMemoryTemplateStore()
    created = store.create(_sample())
    original_updated = created["updated_at"]
    time.sleep(0.01)

    row = store.update(created["id"], {"junk_only": "x"})

    assert row is not None
    assert row["id"] == created["id"]
    assert row["updated_at"] == original_updated  # nothing changed


def test_delete_returns_true_when_row_existed():
    store = InMemoryTemplateStore()
    created = store.create(_sample())
    assert store.delete(created["id"]) is True
    assert store.get(created["id"]) is None


def test_delete_unknown_id_returns_false():
    assert InMemoryTemplateStore().delete("missing") is False


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
        self.ordered: tuple | None = None

    def insert(self, payload):
        self.payload = payload
        self.table.calls.append(("insert", payload))
        return self

    def select(self, cols):
        self.table.calls.append(("select", cols))
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
        self.table.calls.append(("eq", col, val))
        return self

    def order(self, col, desc=False):
        self.ordered = (col, desc)
        self.table.calls.append(("order", col, desc))
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

    def respond(self, _q: _FakeQuery) -> _FakeResponse:
        return _FakeResponse(self.rows)


class _FakeClient:
    def __init__(self, table: _FakeTable):
        self._table = table
        self.last_table_name: str | None = None

    def table(self, name: str):
        self.last_table_name = name
        return self._table


def test_supabase_store_create_inserts_payload_without_id():
    table = _FakeTable(rows=[{"id": "generated", **_sample()}])
    store = SupabaseTemplateStore(_FakeClient(table))

    store.create(_sample())

    insert_calls = [c for c in table.calls if c[0] == "insert"]
    assert len(insert_calls) == 1
    payload = insert_calls[0][1]
    # We rely on the DB default (gen_random_uuid()) — no id should be sent.
    assert "id" not in payload
    assert payload["name"] == "Pipeline A"


def test_supabase_store_create_raises_when_no_row_returned():
    table = _FakeTable(rows=[])
    store = SupabaseTemplateStore(_FakeClient(table))
    with pytest.raises(RuntimeError):
        store.create(_sample())


def test_supabase_store_list_all_orders_by_updated_at_desc():
    table = _FakeTable(rows=[{"id": "a"}, {"id": "b"}])
    client = _FakeClient(table)
    store = SupabaseTemplateStore(client)

    rows = store.list_all()

    assert client.last_table_name == TABLE_NAME
    assert ("order", "updated_at", True) in table.calls
    assert rows == [{"id": "a"}, {"id": "b"}]


def test_supabase_store_get_filters_by_id():
    table = _FakeTable(rows=[{"id": "tid-1", "name": "x"}])
    store = SupabaseTemplateStore(_FakeClient(table))

    row = store.get("tid-1")

    assert row == {"id": "tid-1", "name": "x"}
    assert ("eq", "id", "tid-1") in table.calls


def test_supabase_store_update_skips_when_patch_is_empty_but_returns_current():
    table = _FakeTable(rows=[{"id": "tid", "name": "current"}])
    store = SupabaseTemplateStore(_FakeClient(table))

    row = store.update("tid", {"non_persisted": "x"})

    update_calls = [c for c in table.calls if c[0] == "update"]
    assert update_calls == []
    assert row == {"id": "tid", "name": "current"}


def test_supabase_store_update_sends_only_persisted_fields():
    table = _FakeTable(rows=[{"id": "tid", "name": "renamed"}])
    store = SupabaseTemplateStore(_FakeClient(table))

    store.update("tid", {"name": "renamed", "junk": 1})

    update_calls = [c for c in table.calls if c[0] == "update"]
    assert update_calls == [("update", {"name": "renamed"})]


def test_supabase_store_update_returns_none_when_row_missing():
    table = _FakeTable(rows=[])
    store = SupabaseTemplateStore(_FakeClient(table))
    assert store.update("missing", {"name": "x"}) is None


def test_supabase_store_delete_returns_true_when_row_exists():
    # The fake responds with the same `rows` for both the existence check
    # (select) and the delete; non-empty rows means "exists".
    table = _FakeTable(rows=[{"id": "tid"}])
    store = SupabaseTemplateStore(_FakeClient(table))

    assert store.delete("tid") is True
    assert ("delete", None) in table.calls


def test_supabase_store_delete_returns_false_when_row_missing():
    # Empty rows from the existence check short-circuits the delete.
    table = _FakeTable(rows=[])
    store = SupabaseTemplateStore(_FakeClient(table))

    assert store.delete("missing") is False
    assert ("delete", None) not in table.calls


# ── Factory ────────────────────────────────────────────────────────────────


def test_build_template_store_falls_back_to_memory_without_env(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    store = build_template_store()
    assert isinstance(store, InMemoryTemplateStore)
