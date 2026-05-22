"""Tests for PC-303 per-node event capture and the node-XML endpoint."""
from __future__ import annotations

import asyncio
import uuid
from pathlib import Path
from typing import Any, Dict, List

import pytest
from fastapi import HTTPException

from services import workflow_runner
from services.workflow_runner import build_command_chain, generate_chain_file
import main as backend_main


def _node(node_id: str, node_type: str = "createView", label: str | None = None) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    if label is not None:
        data["label"] = label
    return {"id": node_id, "type": node_type, "data": data}


def _flow_edge(source: str, target: str) -> Dict[str, Any]:
    return {
        "source": source,
        "target": target,
        "sourceHandle": "flow:out",
        "targetHandle": "flow:in",
    }


# ----------------------------------------------------------------------------
# build_command_chain — per-node event + xml capture (no foreach fallback path)
# ----------------------------------------------------------------------------

def test_build_command_chain_records_one_event_per_executed_node(monkeypatch):
    """A linear A→B graph (no foreach) executes both nodes, with one success
    event per node and the emitted XML slice captured for each."""
    nodes = [_node("a", label="First"), _node("b", label="Second")]
    edges = [_flow_edge("a", "b")]

    # Append distinct lines so we can verify per-node XML slicing by node id.
    def patched_execute_node(node, model_name, variables, per_run_vars, xml_content, output_folder):
        node_id = node["id"]
        xml_content.append(f"<{node_id}>line1")
        xml_content.append(f"<{node_id}>line2")

    monkeypatch.setattr(workflow_runner, "execute_node", patched_execute_node)

    events: List[Dict[str, Any]] = []
    xml_by_node: Dict[str, List[str]] = {}

    out = build_command_chain(
        nodes, edges, "ModelX", [], {}, "Model", "/tmp",
        node_events_out=events,
        node_xml_out=xml_by_node,
    )

    # Two success events, one per node, in execution order.
    assert [e["node_id"] for e in events] == ["a", "b"]
    assert all(e["status"] == "success" for e in events)
    assert all(e["error"] is None for e in events)
    assert all(e["model"] == "ModelX" for e in events)
    assert events[0]["node_label"] == "First"
    assert events[1]["node_label"] == "Second"

    # Per-node XML slices captured.
    assert xml_by_node["a"] == ["<a>line1", "<a>line2"]
    assert xml_by_node["b"] == ["<b>line1", "<b>line2"]
    # The full output is the concatenation.
    assert out == ["<a>line1", "<a>line2", "<b>line1", "<b>line2"]


def test_build_command_chain_records_error_event_and_reraises(monkeypatch):
    """When a node raises, an error event is appended for THAT node before
    the exception propagates so PC-302 can still isolate the failure."""
    nodes = [_node("a"), _node("b"), _node("c")]
    edges = [_flow_edge("a", "b"), _flow_edge("b", "c")]

    def patched_execute_node(node, model_name, variables, per_run_vars, xml_content, output_folder):
        if node["id"] == "b":
            raise ValueError("boom")
        xml_content.append(f"<{node['id']}>ok")

    monkeypatch.setattr(workflow_runner, "execute_node", patched_execute_node)

    events: List[Dict[str, Any]] = []
    xml_by_node: Dict[str, List[str]] = {}

    with pytest.raises(ValueError, match="boom"):
        build_command_chain(
            nodes, edges, "M", [], {}, "Model", "/tmp",
            node_events_out=events,
            node_xml_out=xml_by_node,
        )

    # 'a' succeeded, 'b' errored, 'c' was never reached.
    assert [e["node_id"] for e in events] == ["a", "b"]
    assert events[0]["status"] == "success"
    assert events[1]["status"] == "error"
    assert events[1]["error"] == "ValueError: boom"

    # XML for 'a' was captured (it ran to completion); 'b' did not record
    # any XML (it raised before its slice was committed).
    assert xml_by_node == {"a": ["<a>ok"]}


def test_build_command_chain_omits_event_when_callbacks_are_none(monkeypatch):
    """Passing no node_events_out / node_xml_out keeps the legacy code path —
    no AttributeError, no extra work, just the XML returned."""
    nodes = [_node("a")]
    edges: List[Dict[str, Any]] = []

    def patched_execute_node(node, model_name, variables, per_run_vars, xml_content, output_folder):
        xml_content.append("hello")

    monkeypatch.setattr(workflow_runner, "execute_node", patched_execute_node)

    out = build_command_chain(nodes, edges, "M", [], {}, "Model", "/tmp")
    assert out == ["hello"]


def test_build_command_chain_skips_control_flow_node_types(monkeypatch):
    """Control-flow node types (foreachModel, chainFileOutput, excelModels,
    setVariable) are skipped during execution — they shape the graph but
    don't generate commands. They MUST NOT appear in node_events_out either."""
    nodes = [
        _node("excel", node_type="excelModels"),
        _node("fe", node_type="foreachModel"),
        _node("real", node_type="createView"),
        _node("out", node_type="chainFileOutput"),
    ]
    edges = [
        _flow_edge("excel", "fe"),
        _flow_edge("fe", "real"),
        _flow_edge("real", "out"),
    ]

    def patched_execute_node(node, *args, **kwargs):
        # Should only ever be called for the createView node.
        assert node["type"] == "createView"
        args[3].append("real-line")  # xml_content is positional arg index 3 here

    monkeypatch.setattr(workflow_runner, "execute_node", patched_execute_node)

    events: List[Dict[str, Any]] = []
    build_command_chain(
        nodes, edges, "M", [], {}, "Model", "/tmp",
        node_events_out=events,
    )

    assert [e["node_id"] for e in events] == ["real"]
    assert [e["node_type"] for e in events] == ["createView"]


# ----------------------------------------------------------------------------
# generate_chain_file — events + xml plumb through end-to-end
# ----------------------------------------------------------------------------

def test_generate_chain_file_attaches_node_events_and_xml(monkeypatch, tmp_path):
    """Per-node events and XML round-trip from generate_chain_file callers."""
    out_folder = tmp_path / "out"
    out_folder.mkdir()
    nodes = [
        _node("fe", node_type="foreachModel"),
        _node("real", node_type="createView", label="A View"),
        _node("out", node_type="chainFileOutput"),
    ]
    edges = [_flow_edge("fe", "real"), _flow_edge("real", "out")]

    def patched_execute_node(node, model_name, variables, per_run_vars, xml_content, output_folder):
        xml_content.append("<view>")

    monkeypatch.setattr(workflow_runner, "execute_node", patched_execute_node)

    events: List[Dict[str, Any]] = []
    xml_by_node: Dict[str, List[str]] = {}
    chain_path = generate_chain_file(
        "ModelOne", nodes, edges, [], {}, str(out_folder), "/proj",
        node_events_out=events,
        node_xml_out=xml_by_node,
    )

    assert chain_path is not None
    assert Path(chain_path).is_file()
    assert [e["node_id"] for e in events] == ["real"]
    assert events[0]["model"] == "ModelOne"
    assert xml_by_node == {"real": ["<view>"]}


# ----------------------------------------------------------------------------
# /api/workflow/node-xml endpoint
# ----------------------------------------------------------------------------

@pytest.fixture
def _node_xml_session(monkeypatch, tmp_path):
    """Wire OUTPUT_DIR to a temp dir and seed a session with some node XML."""
    output_dir = tmp_path / "output"
    output_dir.mkdir()
    monkeypatch.setattr(backend_main, "OUTPUT_DIR", output_dir)

    session_id = str(uuid.uuid4())
    backend_main.session_store.create(session_id, {
        "status": "completed",
        "excel_file": "/tmp/x.xlsx",
        "workflow_graph": {},
        "variables": [],
        "results": None,
        "error": None,
    })

    # Mirror the real on-disk layout: <output_dir>/<session_id>/_node_xml/<safe_model>/<safe_node_id>.xml
    base = output_dir / session_id / "_node_xml" / "Bridge-01" / "createView_1"
    base.parent.mkdir(parents=True, exist_ok=True)
    (base.parent / "createView_1.xml").write_text("<view>line1\nline2</view>", encoding="utf-8")

    yield session_id

    # Cleanup the session row to keep parallel-test runs against real Supabase clean.
    try:
        backend_main.session_store.delete_older_than(0)
    except Exception:
        pass


def test_node_xml_endpoint_returns_captured_text(_node_xml_session):
    from fastapi.responses import Response  # noqa: F401  — typing only
    session_id = _node_xml_session
    result = asyncio.run(backend_main.get_node_xml(session_id, "Bridge-01", "createView_1"))
    assert result.media_type.startswith("text/plain")
    assert result.body.decode("utf-8") == "<view>line1\nline2</view>"


def test_node_xml_endpoint_404_for_unknown_session(monkeypatch, tmp_path):
    monkeypatch.setattr(backend_main, "OUTPUT_DIR", tmp_path)
    # Use a valid UUID that isn't in the store; Supabase rejects non-UUID
    # primary keys before our None-check fires, so the test must hand a
    # well-formed id that simply doesn't exist.
    bogus = str(uuid.uuid4())
    with pytest.raises(HTTPException) as excinfo:
        asyncio.run(backend_main.get_node_xml(bogus, "M", "n"))
    assert excinfo.value.status_code == 404
    assert "Session not found" in excinfo.value.detail


def test_node_xml_endpoint_404_for_unknown_node(_node_xml_session):
    session_id = _node_xml_session
    with pytest.raises(HTTPException) as excinfo:
        asyncio.run(backend_main.get_node_xml(session_id, "Bridge-01", "no-such-node"))
    assert excinfo.value.status_code == 404
    assert "Node XML not found" in excinfo.value.detail


def test_safe_path_segment_resists_traversal():
    """Sanitizer must not let '..' or path separators leak into the on-disk layout."""
    # Slashes / dots / backslashes all collapse to underscore. "../etc/passwd"
    # has 3 disallowed chars (.. /) before "etc", then 1 (/) before "passwd".
    assert backend_main._safe_path_segment("../etc/passwd") == "___etc_passwd"
    assert backend_main._safe_path_segment("a\\b") == "a_b"
    assert backend_main._safe_path_segment("a/b") == "a_b"
    # Empty / fully-stripped values fall back to a single underscore.
    assert backend_main._safe_path_segment("") == "_"
    # Hyphens and underscores survive.
    assert backend_main._safe_path_segment("Bridge-01_v2") == "Bridge-01_v2"


# ----------------------------------------------------------------------------
# run_workflow_job wires the node_xml_callback to disk
# ----------------------------------------------------------------------------

def test_run_workflow_job_persists_node_xml_to_disk(monkeypatch, tmp_path):
    """Stub run_workflow to drive the node_xml_callback; assert files land
    on disk at the layout the endpoint reads from."""
    upload_dir = tmp_path / "uploads"
    output_dir = tmp_path / "output"
    upload_dir.mkdir()
    output_dir.mkdir()
    monkeypatch.setattr(backend_main, "UPLOAD_DIR", upload_dir)
    monkeypatch.setattr(backend_main, "OUTPUT_DIR", output_dir)

    captured_kwargs: Dict[str, Any] = {}

    def fake_run_workflow(*_args, node_xml_callback=None, **_kwargs):
        captured_kwargs["cb"] = node_xml_callback
        # Drive the callback the way the real run_workflow would.
        node_xml_callback("Bridge-01", {"createView_1": ["<v>", "</v>"]})
        node_xml_callback("Bridge-02", {"createView_1": ["<v2>"]})
        return ([], "/proj", [
            {"model": "Bridge-01", "filename": None, "output_path": None,
             "project_folder": "/proj", "status": "success", "error": None,
             "node_events": []},
            {"model": "Bridge-02", "filename": None, "output_path": None,
             "project_folder": "/proj", "status": "success", "error": None,
             "node_events": []},
        ])

    monkeypatch.setattr(backend_main, "run_workflow", fake_run_workflow)

    import uuid as _uuid
    session_id = str(_uuid.uuid4())
    backend_main.session_store.create(session_id, {
        "status": "processing", "excel_file": "/tmp/x.xlsx",
        "workflow_graph": {}, "variables": [], "results": None, "error": None,
    })

    backend_main.run_workflow_job(session_id, "/tmp/x.xlsx", {}, [])

    base = output_dir / session_id / "_node_xml"
    assert (base / "Bridge-01" / "createView_1.xml").read_text(encoding="utf-8") == "<v>\n</v>"
    assert (base / "Bridge-02" / "createView_1.xml").read_text(encoding="utf-8") == "<v2>"


# ----------------------------------------------------------------------------
# PC-903 — disabled nodes are skipped during emission
# ----------------------------------------------------------------------------

def test_disabled_node_is_skipped(monkeypatch):
    """A disabled middle node emits nothing and records no event, while the
    flow still routes through it to the downstream node."""
    nodes = [_node("a"), _node("b"), _node("c")]
    nodes[1]["data"]["disabled"] = True  # disable 'b'
    edges = [_flow_edge("a", "b"), _flow_edge("b", "c")]

    def patched_execute_node(node, model_name, variables, per_run_vars, xml_content, output_folder):
        xml_content.append(f"<{node['id']}>line")

    monkeypatch.setattr(workflow_runner, "execute_node", patched_execute_node)

    events: List[Dict[str, Any]] = []
    xml_by_node: Dict[str, List[str]] = {}
    out = build_command_chain(
        nodes, edges, "M", [], {}, "Model", "/tmp",
        node_events_out=events,
        node_xml_out=xml_by_node,
    )

    assert [e["node_id"] for e in events] == ["a", "c"]   # 'b' skipped
    assert "b" not in xml_by_node
    assert out == ["<a>line", "<c>line"]


def test_non_disabled_node_still_runs(monkeypatch):
    """Regression: the same graph without the disabled flag runs all three."""
    nodes = [_node("a"), _node("b"), _node("c")]
    edges = [_flow_edge("a", "b"), _flow_edge("b", "c")]

    def patched_execute_node(node, model_name, variables, per_run_vars, xml_content, output_folder):
        xml_content.append(f"<{node['id']}>line")

    monkeypatch.setattr(workflow_runner, "execute_node", patched_execute_node)

    events: List[Dict[str, Any]] = []
    out = build_command_chain(
        nodes, edges, "M", [], {}, "Model", "/tmp",
        node_events_out=events,
    )
    assert [e["node_id"] for e in events] == ["a", "b", "c"]
    assert out == ["<a>line", "<b>line", "<c>line"]
