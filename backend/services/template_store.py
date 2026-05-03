"""
PC-202 — Workflow template storage.

A template is a saved workflow graph (nodes + edges + viewport) that users can
re-load on the canvas. They used to live in browser localStorage, so they were
per-machine and per-browser. They now live in Postgres (Supabase), shared
across every user of the deployment.

Two implementations sit behind the `TemplateStore` Protocol:

* `SupabaseTemplateStore` — production. Talks to `pynode_templates` via the
  supabase-py client using the service role key.
* `InMemoryTemplateStore` — tests + offline dev. Same shape, no network.

Pick one with `build_template_store()` based on env: presence of
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` selects Supabase, otherwise
in-memory with a one-time warning.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Dict, List, Optional, Protocol

logger = logging.getLogger(__name__)

TABLE_NAME = "pynode_templates"

# Columns we round-trip through the DB. Anything not in this set is dropped on
# write — keeps callers from accidentally persisting transient junk.
PERSISTED_FIELDS = frozenset({"name", "nodes", "edges", "viewport"})

DEFAULT_VIEWPORT: Dict[str, float] = {"x": 0, "y": 0, "zoom": 1}


class TemplateStore(Protocol):
    def list_all(self) -> List[Dict[str, Any]]: ...
    def get(self, template_id: str) -> Optional[Dict[str, Any]]: ...
    def create(self, data: Dict[str, Any]) -> Dict[str, Any]: ...
    def update(self, template_id: str, patch: Dict[str, Any]) -> Optional[Dict[str, Any]]: ...
    def delete(self, template_id: str) -> bool: ...


def _filter_persisted(data: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in data.items() if k in PERSISTED_FIELDS}


def _serialize(row: Dict[str, Any]) -> Dict[str, Any]:
    """Coerce datetimes to ISO strings so the row is JSON-safe."""
    out = dict(row)
    for key in ("created_at", "updated_at"):
        value = out.get(key)
        if isinstance(value, datetime):
            out[key] = value.isoformat()
    return out


class InMemoryTemplateStore:
    """Process-local dict-of-dicts. Used in tests and as a dev fallback."""

    def __init__(self) -> None:
        self._rows: Dict[str, Dict[str, Any]] = {}
        self._lock = RLock()

    def list_all(self) -> List[Dict[str, Any]]:
        with self._lock:
            rows = [_serialize(r) for r in self._rows.values()]
        rows.sort(key=lambda r: r.get("updated_at") or "", reverse=True)
        return rows

    def get(self, template_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            row = self._rows.get(template_id)
            return _serialize(row) if row is not None else None

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        row = _filter_persisted(data)
        row.setdefault("viewport", dict(DEFAULT_VIEWPORT))
        row["id"] = str(uuid.uuid4())
        row["created_at"] = now
        row["updated_at"] = now
        with self._lock:
            self._rows[row["id"]] = row
        return _serialize(row)

    def update(self, template_id: str, patch: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        payload = _filter_persisted(patch)
        with self._lock:
            row = self._rows.get(template_id)
            if row is None:
                return None
            if payload:
                row.update(payload)
                row["updated_at"] = datetime.now(timezone.utc)
            return _serialize(row)

    def delete(self, template_id: str) -> bool:
        with self._lock:
            return self._rows.pop(template_id, None) is not None


class SupabaseTemplateStore:
    """Postgres-backed via the Supabase service role key."""

    def __init__(self, client: Any) -> None:
        self._client = client

    def list_all(self) -> List[Dict[str, Any]]:
        resp = (
            self._client.table(TABLE_NAME)
            .select("*")
            .order("updated_at", desc=True)
            .execute()
        )
        return list(getattr(resp, "data", None) or [])

    def get(self, template_id: str) -> Optional[Dict[str, Any]]:
        resp = (
            self._client.table(TABLE_NAME)
            .select("*")
            .eq("id", template_id)
            .limit(1)
            .execute()
        )
        rows = getattr(resp, "data", None) or []
        return rows[0] if rows else None

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        row = _filter_persisted(data)
        row.setdefault("viewport", dict(DEFAULT_VIEWPORT))
        # Let Postgres assign the id (gen_random_uuid default) and timestamps.
        resp = self._client.table(TABLE_NAME).insert(row).execute()
        rows = getattr(resp, "data", None) or []
        if not rows:
            raise RuntimeError("Supabase insert returned no row")
        return rows[0]

    def update(self, template_id: str, patch: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        payload = _filter_persisted(patch)
        if not payload:
            # Nothing to write — return current row so callers can echo it back.
            return self.get(template_id)
        resp = (
            self._client.table(TABLE_NAME)
            .update(payload)
            .eq("id", template_id)
            .execute()
        )
        rows = getattr(resp, "data", None) or []
        return rows[0] if rows else None

    def delete(self, template_id: str) -> bool:
        # PostgREST DELETEs return an empty body by default, so we can't trust
        # the response to tell us whether the row existed. Check first.
        if self.get(template_id) is None:
            return False
        self._client.table(TABLE_NAME).delete().eq("id", template_id).execute()
        return True


def build_template_store() -> TemplateStore:
    """Pick a store based on env. Falls back to in-memory with a warning."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.warning(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — using in-memory "
            "template store. Templates will be lost on restart."
        )
        return InMemoryTemplateStore()

    try:
        from supabase import create_client
    except ImportError:
        logger.warning(
            "supabase package not installed — falling back to in-memory template "
            "store. Run: pip install -r requirements.txt"
        )
        return InMemoryTemplateStore()

    client = create_client(url, key)
    logger.info("Template store: Supabase (%s)", TABLE_NAME)
    return SupabaseTemplateStore(client)
