"""PC-304 — whole-file chain preview endpoint."""
import asyncio

import pytest
from fastapi import HTTPException

import main as backend_main
from services.session_store import InMemorySessionStore


def _session_with_chain(store, output_path, model="NWP-01"):
    store.create("sess", {
        "status": "completed",
        "results": {"file_details": [
            {"model": model, "output_path": str(output_path), "status": "success"},
        ]},
    })


def test_preview_returns_chain_text(monkeypatch, tmp_path):
    out = tmp_path / "output"
    chain = out / "sess" / "NWP-01.chain"
    chain.parent.mkdir(parents=True)
    chain.write_text("<chain>hi</chain>", encoding="utf-8")

    store = InMemorySessionStore()
    _session_with_chain(store, chain)
    monkeypatch.setattr(backend_main, "session_store", store)
    monkeypatch.setattr(backend_main, "OUTPUT_DIR", out)

    resp = asyncio.run(backend_main.preview_chain_file("sess", "NWP-01"))
    assert resp.body.decode() == "<chain>hi</chain>"
    assert "text/plain" in resp.media_type


def test_preview_404_when_session_missing(monkeypatch):
    monkeypatch.setattr(backend_main, "session_store", InMemorySessionStore())
    with pytest.raises(HTTPException) as exc:
        asyncio.run(backend_main.preview_chain_file("nope", "M"))
    assert exc.value.status_code == 404


def test_preview_404_when_model_not_in_run(monkeypatch):
    store = InMemorySessionStore()
    store.create("s", {"status": "completed", "results": {"file_details": []}})
    monkeypatch.setattr(backend_main, "session_store", store)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(backend_main.preview_chain_file("s", "M"))
    assert exc.value.status_code == 404


def test_preview_404_when_file_missing(monkeypatch, tmp_path):
    out = tmp_path / "output"
    out.mkdir()
    missing = out / "M.chain"  # never created
    store = InMemorySessionStore()
    _session_with_chain(store, missing, model="M")
    monkeypatch.setattr(backend_main, "session_store", store)
    monkeypatch.setattr(backend_main, "OUTPUT_DIR", out)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(backend_main.preview_chain_file("sess", "M"))
    assert exc.value.status_code == 404


def test_preview_404_when_path_escapes_output_dir(monkeypatch, tmp_path):
    # A stored output_path outside OUTPUT_DIR must be rejected, not served.
    out = tmp_path / "output"
    out.mkdir()
    outside = tmp_path / "secret.chain"
    outside.write_text("secret", encoding="utf-8")
    store = InMemorySessionStore()
    _session_with_chain(store, outside, model="M")
    monkeypatch.setattr(backend_main, "session_store", store)
    monkeypatch.setattr(backend_main, "OUTPUT_DIR", out)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(backend_main.preview_chain_file("sess", "M"))
    assert exc.value.status_code == 404
