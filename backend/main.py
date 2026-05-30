"""
PyChain API
FastAPI backend for processing DWG/DGN/IFC files and generating 12d Model chain files
"""

# Load .env before importing anything that reads SUPABASE_* (services/session_store).
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form, Body, Response
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, List, Dict, Optional
from contextlib import asynccontextmanager
from datetime import datetime
import os
import re
import uuid
from pathlib import Path
import logging
import zipfile
from commands.importers import normalize_file_path
from services.workflow_runner import run_workflow
from services.session_store import build_session_store
from services.template_store import build_template_store
from services.template_version_store import build_template_version_store
from utils.data_loader import load_naming_data
import json

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create necessary directories
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("output")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)


import time as _time
import asyncio

# Maximum age (in seconds) for files in uploads/ and output/ and session rows
# before they are cleaned up. PC-906 bumped the default from 1 hour to 7 days so
# the run-history view keeps both the record AND the re-downloadable ZIP for a
# useful window; override via CLEANUP_TTL_SECONDS.
CLEANUP_TTL_SECONDS = int(os.getenv("CLEANUP_TTL_SECONDS", "604800"))

# How often the periodic sweep runs (seconds). Defaults to a quarter of the
# TTL, clamped to [60s, 1h] — frequent enough to keep the working set bounded
# without thrashing the disk, and (PC-906) capped so the bumped 7-day TTL
# doesn't stretch the sweep to ~42h. Override via CLEANUP_INTERVAL_SECONDS.
CLEANUP_INTERVAL_SECONDS = int(
    os.getenv("CLEANUP_INTERVAL_SECONDS", str(min(3600, max(60, CLEANUP_TTL_SECONDS // 4))))
)


# PC-201: persistent session storage. Survives backend restarts.
session_store = build_session_store()

# PC-202: persistent template storage. Replaces browser localStorage so
# templates can be shared across users / machines.
template_store = build_template_store()

# PC-203: per-template version history. Every save snapshots the graph here
# so users can browse history and revert.
template_version_store = build_template_version_store()


async def _sweep_stale_files_and_sessions(now: float | None = None) -> int:
    """Delete files/dirs in UPLOAD_DIR + OUTPUT_DIR older than CLEANUP_TTL_SECONDS,
    plus session rows older than the same TTL. Returns the total number of items
    removed. Each half is independently try/except'd so a flaky DB doesn't block
    the disk sweep and vice versa.

    `now` is injectable for tests; production callers leave it None.
    """
    current = now if now is not None else _time.time()
    removed = 0

    for directory in (UPLOAD_DIR, OUTPUT_DIR):
        for entry in directory.glob("*"):
            try:
                age = current - entry.stat().st_mtime
                if age <= CLEANUP_TTL_SECONDS:
                    continue
                if entry.is_file():
                    entry.unlink()
                    removed += 1
                elif entry.is_dir() and directory == OUTPUT_DIR:
                    import shutil
                    shutil.rmtree(entry, ignore_errors=True)
                    removed += 1
            except Exception as exc:
                logger.warning("Failed to clean up %s: %s", entry, exc)

    try:
        purged = session_store.delete_older_than(CLEANUP_TTL_SECONDS)
        if purged:
            logger.info("Purged %d stale session row(s)", purged)
        removed += purged
    except Exception as exc:
        logger.warning("Failed to purge stale session rows: %s", exc)

    if removed:
        logger.info("Sweep removed %d stale item(s)", removed)
    return removed


async def _periodic_sweep() -> None:
    """Background loop that runs the sweep every CLEANUP_INTERVAL_SECONDS.

    Cancelled by lifespan teardown; CancelledError exits the loop cleanly.
    """
    try:
        while True:
            await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
            try:
                await _sweep_stale_files_and_sessions()
            except Exception:
                logger.exception("Periodic sweep raised — continuing")
    except asyncio.CancelledError:
        logger.info("Periodic sweep stopped")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    logger.info("Starting PyChain API")

    # One sweep on boot, then keep sweeping every CLEANUP_INTERVAL_SECONDS so
    # long-running deployments don't accumulate orphaned files and rows.
    await _sweep_stale_files_and_sessions()
    sweep_task = asyncio.create_task(_periodic_sweep())

    try:
        yield
    finally:
        sweep_task.cancel()
        try:
            await sweep_task
        except asyncio.CancelledError:
            pass
        logger.info("PyChain API shutdown complete")


app = FastAPI(
    title="PyChain API",
    description="API for generating 12d Model chain files from DWG/DGN/IFC files",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS origins from environment variables
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
cors_origins = [origin.strip() for origin in cors_origins if origin.strip()]

# Add CORS middleware. Methods/headers are explicit so the API surface is
# documented in code; tighten further with PC-801 when auth lands.
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)




@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "PyChain API is running"}


@app.post("/api/upload")
async def upload_files(
    background_tasks: BackgroundTasks,
    excel_file: UploadFile = File(...),
    dwg_ifc_files: List[UploadFile] = File(...)
):
    """
    Upload and validate files
    """
    try:
        # Validate inputs
        if not excel_file:
            raise HTTPException(status_code=400, detail="No Excel file uploaded")

        if not excel_file.filename.endswith('.xlsx'):
            raise HTTPException(status_code=400, detail="Excel file must be .xlsx format")

        if not dwg_ifc_files:
            raise HTTPException(status_code=400, detail="No DWG/DGN/IFC files uploaded")

        # Validate file types
        valid_extensions = {'.dwg', '.dgn', '.ifc'}
        for file in dwg_ifc_files:
            file_ext = os.path.splitext(file.filename)[1].lower()
            if file_ext not in valid_extensions:
                raise HTTPException(
                    status_code=400,
                    detail=f"File {file.filename} is not a valid DWG, DGN, or IFC file"
                )

        # Generate unique session ID
        session_id = str(uuid.uuid4())

        # Save uploaded files
        excel_path = UPLOAD_DIR / f"{session_id}_{excel_file.filename}"
        content = await excel_file.read()
        excel_path.write_bytes(content)

        dwg_ifc_paths = []
        for file in dwg_ifc_files:
            file_path = UPLOAD_DIR / f"{session_id}_{file.filename}"
            content = await file.read()
            file_path.write_bytes(content)
            dwg_ifc_paths.append(str(file_path))

        # Initialize session. dwg_ifc_files is currently informational only —
        # the run endpoint reads files straight off the multipart upload.
        session_store.create(session_id, {
            "status": "uploaded",
            "excel_file": str(excel_path),
            "results": None,
            "error": None,
        })

        logger.info(f"Files uploaded successfully for session {session_id}")

        return {
            "session_id": session_id,
            "status": "uploaded",
            "excel_file": excel_file.filename,
            "dwg_ifc_count": len(dwg_ifc_files),
            "message": "Files uploaded successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in upload: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))






@app.post("/api/workflow/run")
async def run_workflow_endpoint(
    background_tasks: BackgroundTasks,
    workflow_graph: UploadFile = File(...),
    variables: UploadFile = File(...),
    excel_file: Optional[UploadFile] = File(None),
    selected_column_index: str = Form("0"),
):
    """
    Run a workflow graph.

    PC-1001: excel_file is optional. When omitted, model names are taken from
    workflow_graph.modelNames (the manual Model List source) instead of an
    Excel column.
    """
    try:
        # Read and parse workflow graph and variables
        workflow_content = await workflow_graph.read()
        variables_content = await variables.read()
        workflow_json = json.loads(workflow_content.decode('utf-8'))
        variables_json = json.loads(variables_content.decode('utf-8'))
        column_index = int(selected_column_index)

        # Generate unique session ID
        session_id = str(uuid.uuid4())

        # Save the uploaded Excel file when present; otherwise require a manual list.
        excel_path = None
        if excel_file is not None and excel_file.filename:
            if not excel_file.filename.endswith('.xlsx'):
                raise HTTPException(status_code=400, detail="Excel file must be .xlsx format")
            excel_path = UPLOAD_DIR / f"{session_id}_{excel_file.filename}"
            content = await excel_file.read()
            excel_path.write_bytes(content)
        elif not (workflow_json.get('modelNames') or []):
            raise HTTPException(
                status_code=400,
                detail="No model source: upload an Excel file or provide a non-empty model list.",
            )

        # Initialize session
        session_store.create(session_id, {
            "status": "processing",
            "excel_file": str(excel_path) if excel_path else None,
            "workflow_graph": workflow_json,
            "variables": variables_json,
            "results": None,
            "error": None,
        })

        # Kick off background job
        background_tasks.add_task(
            run_workflow_job,
            session_id,
            str(excel_path) if excel_path else None,
            workflow_json,
            variables_json,
            column_index,
        )

        return {
            "session_id": session_id,
            "status": "processing",
            "message": "Workflow started",
        }

    except HTTPException:
        # Pre-existing bug: the broad `except Exception` below would otherwise
        # re-wrap our 400s as 500s. Let HTTPExceptions through unchanged.
        raise
    except Exception as e:
        logger.error(f"Error in workflow run: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _safe_path_segment(value: str) -> str:
    """PC-303 — sanitize a model name or node id for use as a filesystem path
    segment. Replaces anything outside [A-Za-z0-9_-] with '_'. Used by both the
    write side (run_workflow_job._on_node_xml) and the read side (the
    /api/workflow/node-xml endpoint) so they always agree on the layout."""
    safe = re.sub(r"[^A-Za-z0-9_-]", "_", value)
    return safe or "_"


def _build_summary_text(
    session_id: str,
    file_details: List[Dict[str, Any]],
    succeeded_count: int,
    failed_count: int,
) -> str:
    """Build the human-readable per-run summary written into the ZIP as _summary.txt."""
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    total = len(file_details)
    lines: List[str] = [
        "PyChain workflow run summary",
        "============================",
        f"Generated: {timestamp}",
        f"Session:   {session_id}",
        f"Models:    {total} total · {succeeded_count} succeeded · {failed_count} failed",
        "",
    ]

    successes = [r for r in file_details if r.get("status") == "success"]
    failures = [r for r in file_details if r.get("status") == "error"]

    if successes:
        lines.append("SUCCEEDED")
        for r in successes:
            lines.append(f"  {r.get('filename')}")
        lines.append("")

    if failures:
        lines.append("FAILED")
        for r in failures:
            lines.append(f"  {r.get('model')}")
            lines.append(f"    {r.get('error')}")
        lines.append("")

    return "\n".join(lines)


def run_workflow_job(
    session_id: str,
    excel_file_path: Optional[str],
    workflow_graph: Dict,
    variables: List[Dict],
    selected_column_index: int = 0,
):
    """
    Background processing job for workflow execution.

    PC-302: per-model failures are isolated inside run_workflow and surfaced via
    file_details rows. The outer try/except below still catches pre-loop / IO
    failures (Excel parse error, ZIP write error, etc.) and turns them into
    status='error'.

    PC-907: a progress_callback is passed into run_workflow so each per-model
    row update is mirrored onto the session's `results` field while the run is
    still in progress. Polling clients see the list grow (queued → success /
    error) instead of waiting for one final write. The /api/workflow/status
    endpoint surfaces these intermediate `results` while status='processing'.
    """
    try:
        if session_store.get(session_id) is None:
            return

        # Create output directory for this session
        output_folder = OUTPUT_DIR / session_id
        output_folder.mkdir(exist_ok=True)

        def _on_progress(file_details_so_far: List[Dict[str, Any]]) -> None:
            # PC-907: the running shape carries only `file_details`; counts are
            # derived on the client via row.status. The final write below
            # replaces this with the richer completion shape (zip_path,
            # succeeded/failed counts, project_folder).
            session_store.update(session_id, {
                "results": {
                    "file_details": list(file_details_so_far),
                },
            })

        # PC-303: persist per-node emitted XML to disk so the run-details UI
        # can fetch a single node's slice on demand without bloating every
        # /api/workflow/status poll. Layout: OUTPUT_DIR/<session>/_node_xml/
        # <safe_model>/<safe_node_id>.xml. Sanitization must match the read
        # side in /api/workflow/node-xml.
        node_xml_root = output_folder / "_node_xml"

        def _on_node_xml(model_name: str, node_xml: Dict[str, List[str]]) -> None:
            model_dir = node_xml_root / _safe_path_segment(model_name)
            model_dir.mkdir(parents=True, exist_ok=True)
            for node_id, lines in node_xml.items():
                target = model_dir / f"{_safe_path_segment(node_id)}.xml"
                target.write_text("\n".join(lines), encoding="utf-8")

        # Run workflow
        generated_files, project_folder, file_details = run_workflow(
            excel_file_path,
            workflow_graph,
            variables,
            str(output_folder),
            selected_column_index=selected_column_index,
            progress_callback=_on_progress,
            node_xml_callback=_on_node_xml,
        )

        succeeded_count = sum(1 for r in file_details if r.get("status") == "success")
        failed_count = sum(1 for r in file_details if r.get("status") == "error")

        summary_text = _build_summary_text(
            session_id, file_details, succeeded_count, failed_count,
        )

        # Build the ZIP. _summary.txt is always included so users have provenance
        # even when every model failed.
        zip_path = OUTPUT_DIR / f"{session_id}_chain_files.zip"
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in generated_files:
                if os.path.exists(file_path):
                    zipf.write(file_path, os.path.basename(file_path))
            zipf.writestr("_summary.txt", summary_text)

        # Update session
        session_store.update(session_id, {
            "status": "completed",
            "results": {
                "files": [os.path.basename(f) for f in generated_files],
                "file_details": file_details,
                "zip_path": str(zip_path),
                "summary": {
                    "total_files": len(generated_files),
                    "succeeded_count": succeeded_count,
                    "failed_count": failed_count,
                    "project_folder": project_folder or "",
                },
            },
        })
        logger.info(f"Workflow processing completed for session {session_id}")

    except Exception as e:
        session_store.update(session_id, {"status": "error", "error": str(e)})
        logger.error(f"Error in workflow background processing: {e}", exc_info=True)


@app.get("/api/workflow/status/{session_id}")
async def get_workflow_status(session_id: str):
    """
    Get workflow processing status
    """
    session = session_store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    result = {
        "status": session["status"],
    }

    if session["status"] == "completed":
        result["results"] = session.get("results")
    elif session["status"] == "error":
        result["error"] = session.get("error") or "Unknown error"
    elif session["status"] == "processing":
        # PC-907: surface the live per-model progress that run_workflow_job
        # writes via the progress callback. May be None if the run hasn't
        # parsed the Excel yet (the queued seed has not been emitted).
        progress = session.get("results")
        if progress is not None:
            result["results"] = progress

    return result


def _iso(value: Any) -> Optional[str]:
    """Normalize a timestamp to an ISO string (Supabase returns strings already;
    the in-memory store holds datetimes)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _run_summary(row: Dict[str, Any]) -> Dict[str, Any]:
    """PC-906 — slim run-history row from a full session, dropping the heavy
    workflow_graph / variables blobs the list view doesn't need."""
    graph = row.get("workflow_graph") if isinstance(row.get("workflow_graph"), dict) else {}
    results = row.get("results") if isinstance(row.get("results"), dict) else {}
    summary = results.get("summary") if isinstance(results.get("summary"), dict) else {}

    # excel_file is stored as "<session_id>_<original>.xlsx" under uploads/;
    # strip the id prefix so the user sees the name they uploaded.
    excel = row.get("excel_file")
    source_name = None
    if excel:
        base = os.path.basename(excel)
        prefix = f"{row.get('id')}_"
        source_name = base[len(prefix):] if base.startswith(prefix) else base

    return {
        "id": row.get("id"),
        "status": row.get("status"),
        "created_at": _iso(row.get("created_at")),
        "updated_at": _iso(row.get("updated_at")),
        "templateName": graph.get("templateName"),
        "sourceName": source_name,
        "modelCount": summary.get("total_files"),
        "succeededCount": summary.get("succeeded_count"),
        "failedCount": summary.get("failed_count"),
        "error": row.get("error"),
    }


@app.get("/api/workflow/runs")
async def list_workflow_runs(limit: int = 50):
    """PC-906 — recent run history, newest first. Slim rows for the Runs view;
    re-download still goes through /api/workflow/download/{id} (works while the
    ZIP survives the cleanup TTL)."""
    capped = max(1, min(limit, 200))
    rows = session_store.list_recent(capped)
    return [_run_summary(r) for r in rows]


@app.get("/api/workflow/node-xml/{session_id}/{model_name}/{node_id}")
async def get_node_xml(session_id: str, model_name: str, node_id: str):
    """PC-303 — return the XML lines emitted by a single node for one model.
    Layout was written by run_workflow_job._on_node_xml; sanitization for the
    path segments must match _safe_path_segment.

    Returns text/plain. 404 if the session, model, or node has no captured XML.
    """
    if session_store.get(session_id) is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # Defense in depth: session_id is normally a server-generated UUID and
    # session_store.get() has already validated it exists, but sanitize the
    # path segment too so a hypothetical future code path that produces a
    # weirder id can never escape OUTPUT_DIR.
    file_path = (
        OUTPUT_DIR
        / _safe_path_segment(session_id)
        / "_node_xml"
        / _safe_path_segment(model_name)
        / f"{_safe_path_segment(node_id)}.xml"
    )
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Node XML not found for this run")

    text = file_path.read_text(encoding="utf-8")
    return Response(content=text, media_type="text/plain; charset=utf-8")


@app.get("/api/workflow/download/{session_id}")
async def download_workflow_results(session_id: str):
    """
    Download workflow results
    """
    session = session_store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if session["status"] != "completed":
        raise HTTPException(status_code=400, detail="Processing not completed")

    results = session.get("results") or {}
    zip_path = results.get("zip_path")
    if not zip_path or not Path(zip_path).exists():
        raise HTTPException(status_code=404, detail="Download file not found")

    return FileResponse(
        zip_path,
        headers={"Content-Disposition": f"attachment; filename=workflow_chain_files_{session_id}.zip"}
    )


@app.get("/api/workflow/preview/{session_id}/{model_name}")
async def preview_chain_file(session_id: str, model_name: str):
    """PC-304 — return the full generated .chain text for one model so users can
    verify output without opening 12d Model. 404 if the session, model, or file
    is gone (e.g. cleaned up after the TTL)."""
    session = session_store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    results = session.get("results") or {}
    file_details = results.get("file_details") or []
    row = next((d for d in file_details if d.get("model") == model_name), None)
    if row is None or not row.get("output_path"):
        raise HTTPException(status_code=404, detail="No generated chain for this model")

    # The output_path is server-generated under OUTPUT_DIR; defend against any
    # stored path escaping it before reading from disk.
    output_path = Path(row["output_path"]).resolve()
    try:
        output_path.relative_to(Path(OUTPUT_DIR).resolve())
    except ValueError:
        raise HTTPException(status_code=404, detail="Chain file not found")
    if not output_path.is_file():
        raise HTTPException(status_code=404, detail="Chain file not found (it may have expired)")

    text = output_path.read_text(encoding="utf-8")
    return Response(content=text, media_type="text/plain; charset=utf-8")


# ── Templates (PC-202) ─────────────────────────────────────────────────────


def _validate_template_payload(payload: Any) -> Dict[str, Any]:
    """Coerce a JSON body into a template dict; raise 400 on shape errors.

    Returns a dict that includes the optional `message` (used when writing a
    version row) — the template store itself filters this out before persisting.
    """
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Template body must be a JSON object")
    name = payload.get("name")
    if not isinstance(name, str) or not name.strip():
        raise HTTPException(status_code=400, detail="`name` is required")
    if not isinstance(payload.get("nodes"), list):
        raise HTTPException(status_code=400, detail="`nodes` must be a list")
    if not isinstance(payload.get("edges"), list):
        raise HTTPException(status_code=400, detail="`edges` must be a list")
    viewport = payload.get("viewport") or {"x": 0, "y": 0, "zoom": 1}
    if not isinstance(viewport, dict):
        raise HTTPException(status_code=400, detail="`viewport` must be an object")
    message = payload.get("message")
    if message is not None and not isinstance(message, str):
        raise HTTPException(status_code=400, detail="`message` must be a string")
    return {
        "name": name.strip(),
        "nodes": payload["nodes"],
        "edges": payload["edges"],
        "viewport": viewport,
        "message": message.strip() if isinstance(message, str) and message.strip() else None,
    }


def _snapshot_version(template_id: str, data: Dict[str, Any]) -> None:
    """Append a version row for the given template snapshot.

    Failures are logged but never propagated — a flaky version write should
    not break the user's save. The unique (template_id, version_number)
    constraint protects against split-brain races.
    """
    try:
        template_version_store.create(
            template_id,
            {
                "name": data["name"],
                "nodes": data["nodes"],
                "edges": data["edges"],
                "viewport": data["viewport"],
                "message": data.get("message"),
            },
        )
    except Exception:
        logger.exception("Failed to snapshot template %s version", template_id)


@app.get("/api/templates")
async def list_templates():
    """Return every saved template, newest first."""
    return template_store.list_all()


@app.post("/api/templates", status_code=201)
async def create_template(payload: Any = Body(...)):
    """Create a new template. Duplicate names are allowed."""
    data = _validate_template_payload(payload)
    created = template_store.create(data)
    _snapshot_version(created["id"], data)
    return created


@app.put("/api/templates/{template_id}")
async def update_template(template_id: str, payload: Any = Body(...)):
    """Overwrite an existing template. 404 if it doesn't exist."""
    data = _validate_template_payload(payload)
    updated = template_store.update(template_id, data)
    if updated is None:
        raise HTTPException(status_code=404, detail="Template not found")
    _snapshot_version(template_id, data)
    return updated


@app.delete("/api/templates/{template_id}", status_code=204)
async def delete_template(template_id: str):
    """Delete a template. 404 if it doesn't exist."""
    if not template_store.delete(template_id):
        raise HTTPException(status_code=404, detail="Template not found")
    return Response(status_code=204)


@app.get("/api/templates/{template_id}/versions")
async def list_template_versions(template_id: str):
    """Return version metadata for a template, newest first.

    Excludes nodes/edges to keep the list response small — fetch one specific
    version via /versions/{n} when the user wants to restore.
    """
    if template_store.get(template_id) is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template_version_store.list_for_template(template_id)


@app.get("/api/templates/{template_id}/versions/{version_number}")
async def get_template_version(template_id: str, version_number: int):
    """Return the full snapshot for a single version (nodes + edges + viewport)."""
    row = template_version_store.get(template_id, version_number)
    if row is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return row


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
