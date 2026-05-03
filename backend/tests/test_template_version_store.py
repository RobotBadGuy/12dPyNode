"""Tests for the PC-203 template version store."""

from __future__ import annotations

from typing import Any, Dict, List

import pytest

from services.template_version_store import (
    InMemoryTemplateVersionStore,
    SupabaseTemplateVersionStore,
    TABLE_NAME,
    build_template_version_store,
)


def _snapshot(name: str = "Pipeline A", message: str | None = None) -> Dict[str, Any]:
    return {
        "name": name,
        "nodes": [{"id": "n1", "type": "excelModels"}],
        "edges": [{"id": "e1", "source": "n1", "target": "n2"}],
        "viewport": {"x": 1, "y": 2, "zoom": 0.75},
        "message": message,
    }


# ── In-memory store ────────────────────────────────────────────────────────


def test_create_starts_at_version_one():
    store = InMemoryTemplateVersionStore()
    row = store.create("tid-1", _snapshot())

    assert row["version_number"] == 1
    assert row["template_id"] == "tid-1"
    assert row["name"] == "Pipeline A"
    assert row["created_at"]


def test_create_auto_increments_per_template():
    store = InMemoryTemplateVersionStore()
    v1 = store.create("tid-1", _snapshot("a"))
    v2 = store.create("tid-1", _snapshot("b"))
    v3 = store.create("tid-1", _snapshot("c"))

    assert [v1["version_number"], v2["version_number"], v3["version_number"]] == [1, 2, 3]


def test_create_increments_independently_per_template():
    store = InMemoryTemplateVersionStore()
    a1 = store.create("tid-A", _snapshot())
    b1 = store.create("tid-B", _snapshot())
    a2 = store.create("tid-A", _snapshot())

    assert a1["version_number"] == 1
    assert b1["version_number"] == 1
    assert a2["version_number"] == 2


def test_create_drops_unknown_fields():
    store = InMemoryTemplateVersionStore()
    row = store.create("tid-1", {**_snapshot(), "junk": "ignored"})
    assert "junk" not in row


def test_create_supplies_default_viewport_when_missing():
    store = InMemoryTemplateVersionStore()
    payload = _snapshot()
    payload.pop("viewport")
    row = store.create("tid-1", payload)
    assert row["viewport"] == {"x": 0, "y": 0, "zoom": 1}


def test_list_returns_metadata_only_newest_first():
    store = InMemoryTemplateVersionStore()
    store.create("tid-1", _snapshot("v1"))
    store.create("tid-1", _snapshot("v2", message="second save"))
    store.create("tid-1", _snapshot("v3"))

    rows = store.list_for_template("tid-1")

    assert [r["version_number"] for r in rows] == [3, 2, 1]
    # Metadata projection — heavy fields are stripped from the list response.
    assert "nodes" not in rows[0]
    assert "edges" not in rows[0]
    assert rows[1]["message"] == "second save"


def test_list_isolates_templates():
    store = InMemoryTemplateVersionStore()
    store.create("tid-A", _snapshot())
    store.create("tid-B", _snapshot())

    assert len(store.list_for_template("tid-A")) == 1
    assert len(store.list_for_template("tid-B")) == 1
    assert len(store.list_for_template("tid-C")) == 0


def test_get_returns_full_snapshot():
    store = InMemoryTemplateVersionStore()
    store.create("tid-1", _snapshot("v1"))
    store.create("tid-1", _snapshot("v2"))

    row = store.get("tid-1", 2)

    assert row is not None
    assert row["name"] == "v2"
    assert row["nodes"] == [{"id": "n1", "type": "excelModels"}]
    assert row["edges"] == [{"id": "e1", "source": "n1", "target": "n2"}]


def test_get_returns_none_for_unknown_version():
    store = InMemoryTemplateVersionStore()
    store.create("tid-1", _snapshot())
    assert store.get("tid-1", 99) is None
    assert store.get("ghost", 1) is None


# ── Supabase adapter (against a fake client) ───────────────────────────────


class _FakeResponse:
    def __init__(self, data: List[Dict[str, Any]] | None = None):
        self.data = data or []


class _FakeQuery:
    def __init__(self, table: "_FakeTable"):
        self.table = table

    def insert(self, payload):
        self.table.calls.append(("insert", payload))
        return self

    def select(self, cols):
        self.table.calls.append(("select", cols))
        return self

    def eq(self, col, val):
        self.table.calls.append(("eq", col, val))
        return self

    def order(self, col, desc=False):
        self.table.calls.append(("order", col, desc))
        return self

    def limit(self, _n):
        return self

    def execute(self):
        return self.table.respond()


class _FakeTable:
    def __init__(self, rows: List[Dict[str, Any]] | None = None):
        self.calls: List[tuple] = []
        self.rows = rows or []

    def insert(self, payload):
        return _FakeQuery(self).insert(payload)

    def select(self, cols):
        return _FakeQuery(self).select(cols)

    def respond(self) -> _FakeResponse:
        return _FakeResponse(self.rows)


class _FakeClient:
    def __init__(self, table: _FakeTable):
        self._table = table
        self.last_table_name: str | None = None

    def table(self, name: str):
        self.last_table_name = name
        return self._table


def test_supabase_create_inserts_with_computed_version_number():
    # First select returns the current max (5), so the insert should send 6.
    table = _FakeTable(rows=[{"version_number": 5}])
    store = SupabaseTemplateVersionStore(_FakeClient(table))

    store.create("tid-1", _snapshot())

    insert_calls = [c for c in table.calls if c[0] == "insert"]
    assert len(insert_calls) == 1
    payload = insert_calls[0][1]
    assert payload["template_id"] == "tid-1"
    assert payload["version_number"] == 6
    assert "id" not in payload  # let DB default fill it


def test_supabase_create_starts_at_one_when_no_prior_versions():
    # Empty rows means no prior versions for this template.
    table = _FakeTable(rows=[])
    store = SupabaseTemplateVersionStore(_FakeClient(table))

    # The fake responds the same to both queries (select max + insert), so
    # the insert response is also empty and we expect a RuntimeError.
    with pytest.raises(RuntimeError):
        store.create("tid-1", _snapshot())

    insert_calls = [c for c in table.calls if c[0] == "insert"]
    assert insert_calls[0][1]["version_number"] == 1


def test_supabase_create_retries_once_on_unique_violation():
    """Two writers can race on max+1; the loser retries once with fresh max."""

    class _RaceTable(_FakeTable):
        def __init__(self) -> None:
            super().__init__()
            self.attempts = 0
            # First select returns max=3 (so attempt picks v4, then collides).
            # Second select returns max=4 (someone else wrote v4 in between),
            # so the retry picks v5 and succeeds.
            self._select_returns = [
                [{"version_number": 3}],
                [{"version_number": 4}],
            ]
            self._select_idx = 0
            self._inserted_row = {"id": "vid", "version_number": 5}

        def respond(self) -> _FakeResponse:
            last = self.calls[-1] if self.calls else None
            if last and last[0] == "insert":
                self.attempts += 1
                if self.attempts == 1:
                    raise RuntimeError("duplicate key value violates unique constraint")
                return _FakeResponse([self._inserted_row])
            # Select branch — return scripted rows.
            rows = self._select_returns[self._select_idx]
            self._select_idx = min(self._select_idx + 1, len(self._select_returns) - 1)
            return _FakeResponse(rows)

    table = _RaceTable()
    store = SupabaseTemplateVersionStore(_FakeClient(table))

    row = store.create("tid-1", _snapshot())

    assert table.attempts == 2
    assert row["version_number"] == 5
    insert_calls = [c for c in table.calls if c[0] == "insert"]
    assert [c[1]["version_number"] for c in insert_calls] == [4, 5]


def test_supabase_create_propagates_when_retry_also_fails():
    """If both attempts collide, the caller learns about it."""

    class _AlwaysCollideTable(_FakeTable):
        def respond(self) -> _FakeResponse:
            last = self.calls[-1] if self.calls else None
            if last and last[0] == "insert":
                raise RuntimeError("duplicate key value violates unique constraint")
            return _FakeResponse([{"version_number": 1}])

    store = SupabaseTemplateVersionStore(_FakeClient(_AlwaysCollideTable()))

    with pytest.raises(RuntimeError, match="after retry"):
        store.create("tid-1", _snapshot())


def test_supabase_list_filters_and_orders():
    table = _FakeTable(rows=[{"version_number": 2}, {"version_number": 1}])
    client = _FakeClient(table)
    store = SupabaseTemplateVersionStore(client)

    rows = store.list_for_template("tid-1")

    assert client.last_table_name == TABLE_NAME
    assert ("eq", "template_id", "tid-1") in table.calls
    assert ("order", "version_number", True) in table.calls
    assert rows == [{"version_number": 2}, {"version_number": 1}]


def test_supabase_get_filters_by_template_and_version():
    table = _FakeTable(rows=[{"id": "vid", "version_number": 3}])
    store = SupabaseTemplateVersionStore(_FakeClient(table))

    row = store.get("tid-1", 3)

    assert row == {"id": "vid", "version_number": 3}
    assert ("eq", "template_id", "tid-1") in table.calls
    assert ("eq", "version_number", 3) in table.calls


def test_supabase_get_returns_none_when_missing():
    table = _FakeTable(rows=[])
    store = SupabaseTemplateVersionStore(_FakeClient(table))
    assert store.get("tid-1", 99) is None


# ── Factory ────────────────────────────────────────────────────────────────


def test_build_falls_back_to_memory_without_env(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    store = build_template_version_store()
    assert isinstance(store, InMemoryTemplateVersionStore)
