"""
PC-203 — Workflow template version history.

Each save against a template (POST /api/templates or PUT /api/templates/{id})
appends a row here. The store is append-only: versions are never updated or
deleted in place. Cascade delete from `pynode_templates` cleans them up.

Two implementations sit behind the `TemplateVersionStore` Protocol, mirroring
the template store's pattern:

* `SupabaseTemplateVersionStore` — production, talks to
  `pynode_template_versions` via supabase-py.
* `InMemoryTemplateVersionStore` — tests + offline dev.

Pick one with `build_template_version_store()`.
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Dict, List, Optional, Protocol

logger = logging.getLogger(__name__)

TABLE_NAME = "pynode_template_versions"

# Fields the caller can write. `version_number` is computed by the store, not
# accepted from outside, so concurrent callers can't collide on the same N.
SNAPSHOT_FIELDS = frozenset({"name", "nodes", "edges", "viewport", "message", "author"})

# Metadata-only projection — the list endpoint returns these columns so the
# client doesn't pull megabytes of nodes/edges just to render a history list.
METADATA_FIELDS = ("id", "template_id", "version_number", "name", "message", "author", "created_at")

DEFAULT_VIEWPORT: Dict[str, float] = {"x": 0, "y": 0, "zoom": 1}


class TemplateVersionStore(Protocol):
    def list_for_template(self, template_id: str) -> List[Dict[str, Any]]: ...
    def get(self, template_id: str, version_number: int) -> Optional[Dict[str, Any]]: ...
    def create(self, template_id: str, snapshot: Dict[str, Any]) -> Dict[str, Any]: ...


def _filter_snapshot(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in snapshot.items() if k in SNAPSHOT_FIELDS}


def _serialize(row: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(row)
    value = out.get("created_at")
    if isinstance(value, datetime):
        out["created_at"] = value.isoformat()
    return out


def _strip_to_metadata(row: Dict[str, Any]) -> Dict[str, Any]:
    return {k: row.get(k) for k in METADATA_FIELDS}


class InMemoryTemplateVersionStore:
    """Process-local list per template_id. Used in tests and as a dev fallback."""

    def __init__(self) -> None:
        self._rows: List[Dict[str, Any]] = []
        self._lock = RLock()

    def list_for_template(self, template_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            rows = [_serialize(r) for r in self._rows if r["template_id"] == template_id]
        rows.sort(key=lambda r: r["version_number"], reverse=True)
        return [_strip_to_metadata(r) for r in rows]

    def get(self, template_id: str, version_number: int) -> Optional[Dict[str, Any]]:
        with self._lock:
            for row in self._rows:
                if row["template_id"] == template_id and row["version_number"] == version_number:
                    return _serialize(row)
        return None

    def create(self, template_id: str, snapshot: Dict[str, Any]) -> Dict[str, Any]:
        payload = _filter_snapshot(snapshot)
        payload.setdefault("viewport", dict(DEFAULT_VIEWPORT))
        with self._lock:
            existing = [r["version_number"] for r in self._rows if r["template_id"] == template_id]
            next_version = (max(existing) + 1) if existing else 1
            row = {
                "id": str(uuid.uuid4()),
                "template_id": template_id,
                "version_number": next_version,
                "created_at": datetime.now(timezone.utc),
                **payload,
            }
            self._rows.append(row)
        return _serialize(row)


class SupabaseTemplateVersionStore:
    """Postgres-backed via the Supabase service role key."""

    def __init__(self, client: Any) -> None:
        self._client = client

    def list_for_template(self, template_id: str) -> List[Dict[str, Any]]:
        resp = (
            self._client.table(TABLE_NAME)
            .select(",".join(METADATA_FIELDS))
            .eq("template_id", template_id)
            .order("version_number", desc=True)
            .execute()
        )
        return list(getattr(resp, "data", None) or [])

    def get(self, template_id: str, version_number: int) -> Optional[Dict[str, Any]]:
        resp = (
            self._client.table(TABLE_NAME)
            .select("*")
            .eq("template_id", template_id)
            .eq("version_number", version_number)
            .limit(1)
            .execute()
        )
        rows = getattr(resp, "data", None) or []
        return rows[0] if rows else None

    def create(self, template_id: str, snapshot: Dict[str, Any]) -> Dict[str, Any]:
        payload = _filter_snapshot(snapshot)
        payload.setdefault("viewport", dict(DEFAULT_VIEWPORT))
        # Compute next version_number client-side. Concurrent writers protected
        # by the unique (template_id, version_number) index — on collision the
        # losing writer re-reads the new max and retries once.
        last_error: Exception | None = None
        for _attempt in range(2):
            resp = (
                self._client.table(TABLE_NAME)
                .select("version_number")
                .eq("template_id", template_id)
                .order("version_number", desc=True)
                .limit(1)
                .execute()
            )
            rows = getattr(resp, "data", None) or []
            next_version = (rows[0]["version_number"] + 1) if rows else 1
            row = {"template_id": template_id, "version_number": next_version, **payload}
            try:
                resp = self._client.table(TABLE_NAME).insert(row).execute()
            except Exception as exc:  # supabase-py raises on integrity errors
                last_error = exc
                continue
            inserted = getattr(resp, "data", None) or []
            if not inserted:
                raise RuntimeError("Supabase insert returned no row")
            return inserted[0]
        # Both attempts collided — propagate so the route can decide.
        raise RuntimeError(
            f"Failed to insert version row for template {template_id} after retry"
        ) from last_error


def build_template_version_store() -> TemplateVersionStore:
    """Pick a store based on env. Falls back to in-memory with a warning."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.warning(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — using in-memory "
            "template version store. Versions will be lost on restart."
        )
        return InMemoryTemplateVersionStore()

    try:
        from supabase import create_client
    except ImportError:
        logger.warning(
            "supabase package not installed — falling back to in-memory template "
            "version store."
        )
        return InMemoryTemplateVersionStore()

    client = create_client(url, key)
    logger.info("Template version store: Supabase (%s)", TABLE_NAME)
    return SupabaseTemplateVersionStore(client)
