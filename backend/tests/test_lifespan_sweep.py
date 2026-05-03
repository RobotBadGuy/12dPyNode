"""Tests for the PC-204 periodic sweep function."""

from __future__ import annotations

import asyncio
import os
import time
from pathlib import Path
from typing import Any, Dict

import pytest

import main  # imported once at module scope; UPLOAD_DIR/OUTPUT_DIR are
            # monkeypatched per-test to point at tmp_path so we never touch
            # real disk locations.


def _touch(path: Path, age_seconds: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("x")
    mtime = time.time() - age_seconds
    os.utime(path, (mtime, mtime))


@pytest.fixture
def sandbox(monkeypatch, tmp_path):
    """Redirect main's upload/output dirs and TTL into a clean per-test sandbox."""
    upload = tmp_path / "uploads"
    output = tmp_path / "output"
    upload.mkdir()
    output.mkdir()
    monkeypatch.setattr(main, "UPLOAD_DIR", upload)
    monkeypatch.setattr(main, "OUTPUT_DIR", output)
    monkeypatch.setattr(main, "CLEANUP_TTL_SECONDS", 100)
    return upload, output


def test_sweep_deletes_files_older_than_ttl(sandbox):
    upload, _ = sandbox
    old = upload / "old.xlsx"
    fresh = upload / "fresh.xlsx"
    _touch(old, age_seconds=200)   # past TTL
    _touch(fresh, age_seconds=10)  # within TTL

    deleted = asyncio.run(main._sweep_stale_files_and_sessions())

    assert not old.exists()
    assert fresh.exists()
    assert deleted >= 1


def test_sweep_calls_session_store_delete_older_than(sandbox, monkeypatch):
    captured: Dict[str, Any] = {}

    class _StubStore:
        def delete_older_than(self, ttl_seconds: int) -> int:
            captured["ttl"] = ttl_seconds
            return 3

    monkeypatch.setattr(main, "session_store", _StubStore())

    deleted = asyncio.run(main._sweep_stale_files_and_sessions())

    assert captured["ttl"] == 100
    # 3 session rows + however many files (none, in this test) = 3.
    assert deleted == 3


def test_sweep_continues_when_session_store_raises(sandbox, monkeypatch):
    """A flaky session store must not stop the file half from running."""
    upload, _ = sandbox
    old = upload / "old.xlsx"
    _touch(old, age_seconds=200)

    class _BrokenStore:
        def delete_older_than(self, _ttl: int) -> int:
            raise RuntimeError("DB unavailable")

    monkeypatch.setattr(main, "session_store", _BrokenStore())

    deleted = asyncio.run(main._sweep_stale_files_and_sessions())

    assert not old.exists()  # file half still ran
    assert deleted >= 1
