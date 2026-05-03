"""
PC-201 — Workflow session storage.

A workflow session is a single run: uploaded files, the graph, the resolved
variables, and (eventually) the generated outputs. Sessions used to live in
a process-local dict, so a backend restart wiped every in-flight job. Now
they live in Postgres (Supabase), keyed by the same UUID we hand the client.

Two implementations sit behind the `SessionStore` Protocol:

* `SupabaseSessionStore` — production. Talks to `pynode_workflow_sessions`
  via the supabase-py client using the service role key.
* `InMemorySessionStore` — tests + offline dev. Same shape, no network.

Pick one with `build_session_store()` based on env: presence of
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` selects Supabase, otherwise
in-memory with a one-time warning.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from threading import RLock
from typing import Any, Dict, Optional, Protocol

logger = logging.getLogger(__name__)

TABLE_NAME = "pynode_workflow_sessions"

# Columns we round-trip through the DB. Anything not in this set is dropped on
# save — keeps callers from accidentally persisting transient junk.
PERSISTED_FIELDS = frozenset(
    {"status", "excel_file", "workflow_graph", "variables", "results", "error"}
)


class SessionStore(Protocol):
    def create(self, session_id: str, data: Dict[str, Any]) -> None: ...
    def get(self, session_id: str) -> Optional[Dict[str, Any]]: ...
    def update(self, session_id: str, patch: Dict[str, Any]) -> None: ...
    def delete_older_than(self, ttl_seconds: int) -> int: ...


def _filter_persisted(data: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in data.items() if k in PERSISTED_FIELDS}


class InMemorySessionStore:
    """Process-local dict-of-dicts. Used in tests and as a dev fallback."""

    def __init__(self) -> None:
        self._rows: Dict[str, Dict[str, Any]] = {}
        self._lock = RLock()

    def create(self, session_id: str, data: Dict[str, Any]) -> None:
        with self._lock:
            now = datetime.now(timezone.utc)
            row = _filter_persisted(data)
            row["id"] = session_id
            row["created_at"] = now
            row["updated_at"] = now
            self._rows[session_id] = row

    def get(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            row = self._rows.get(session_id)
            return dict(row) if row is not None else None

    def update(self, session_id: str, patch: Dict[str, Any]) -> None:
        with self._lock:
            row = self._rows.get(session_id)
            if row is None:
                return
            row.update(_filter_persisted(patch))
            row["updated_at"] = datetime.now(timezone.utc)

    def delete_older_than(self, ttl_seconds: int) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=ttl_seconds)
        with self._lock:
            stale = [sid for sid, row in self._rows.items() if row["created_at"] < cutoff]
            for sid in stale:
                del self._rows[sid]
            return len(stale)


class SupabaseSessionStore:
    """Postgres-backed via the Supabase service role key."""

    def __init__(self, client: Any) -> None:
        self._client = client

    def create(self, session_id: str, data: Dict[str, Any]) -> None:
        row = _filter_persisted(data)
        row["id"] = session_id
        self._client.table(TABLE_NAME).insert(row).execute()

    def get(self, session_id: str) -> Optional[Dict[str, Any]]:
        resp = (
            self._client.table(TABLE_NAME)
            .select("*")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        rows = getattr(resp, "data", None) or []
        return rows[0] if rows else None

    def update(self, session_id: str, patch: Dict[str, Any]) -> None:
        payload = _filter_persisted(patch)
        if not payload:
            return
        self._client.table(TABLE_NAME).update(payload).eq("id", session_id).execute()

    def delete_older_than(self, ttl_seconds: int) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=ttl_seconds)
        resp = (
            self._client.table(TABLE_NAME)
            .delete()
            .lt("created_at", cutoff.isoformat())
            .execute()
        )
        rows = getattr(resp, "data", None) or []
        return len(rows)


def build_session_store() -> SessionStore:
    """Pick a store based on env. Falls back to in-memory with a warning."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.warning(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — using in-memory "
            "session store. Sessions will be lost on restart. See "
            "backend/.env.example."
        )
        return InMemorySessionStore()

    try:
        from supabase import create_client
    except ImportError:
        logger.warning(
            "supabase package not installed — falling back to in-memory store. "
            "Run: pip install -r requirements.txt"
        )
        return InMemorySessionStore()

    client = create_client(url, key)
    logger.info("Session store: Supabase (%s)", TABLE_NAME)
    return SupabaseSessionStore(client)
