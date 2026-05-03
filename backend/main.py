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
from typing import Any, List, Dict
from contextlib import asynccontextmanager
import os
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

# Maximum age (in seconds) for files in uploads/ and output/ before they are
# cleaned up on startup.  Defaults to 1 hour; override via the environment
# variable CLEANUP_TTL_SECONDS.
CLEANUP_TTL_SECONDS = int(os.getenv("CLEANUP_TTL_SECONDS", "3600"))


# PC-201: persistent session storage. Survives backend restarts.
session_store = build_session_store()

# PC-202: persistent template storage. Replaces browser localStorage so
# templates can be shared across users / machines.
template_store = build_template_store()

# PC-203: per-template version history. Every save snapshots the graph here
# so users can browse history and revert.
template_version_store = build_template_version_store()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup
    logger.info("Starting PyChain API")

    # Clean up stale files older than CLEANUP_TTL_SECONDS.
    # This avoids destroying another session's in-flight data during restarts.
    now = _time.time()
    stale_count = 0
    for directory in [UPLOAD_DIR, OUTPUT_DIR]:
        for file_path in directory.glob("*"):
            if file_path.is_file():
                try:
                    age_seconds = now - file_path.stat().st_mtime
                    if age_seconds > CLEANUP_TTL_SECONDS:
                        file_path.unlink()
                        stale_count += 1
                except Exception as e:
                    logger.warning(f"Failed to clean up file {file_path}: {e}")
        # Also clean up empty session subdirectories in output/
        if directory == OUTPUT_DIR:
            for sub_path in directory.iterdir():
                if sub_path.is_dir():
                    try:
                        age_seconds = now - sub_path.stat().st_mtime
                        if age_seconds > CLEANUP_TTL_SECONDS:
                            import shutil
                            shutil.rmtree(sub_path, ignore_errors=True)
                            stale_count += 1
                    except Exception as e:
                        logger.warning(f"Failed to clean up directory {sub_path}: {e}")
    if stale_count:
        logger.info(f"Cleaned up {stale_count} stale file(s)/directory(ies) older than {CLEANUP_TTL_SECONDS}s")

    # Drop session rows whose files we just deleted (or that predate the TTL).
    try:
        purged = session_store.delete_older_than(CLEANUP_TTL_SECONDS)
        if purged:
            logger.info(f"Purged {purged} stale session row(s) older than {CLEANUP_TTL_SECONDS}s")
    except Exception as e:
        logger.warning(f"Failed to purge stale session rows: {e}")

    yield

    # Shutdown (if needed in the future)
    # logger.info("Shutting down PyChain API")


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
    excel_file: UploadFile = File(...),
    workflow_graph: UploadFile = File(...),
    variables: UploadFile = File(...),
    selected_column_index: str = Form("0"),
):
    """
    Run a workflow graph
    """
    try:
        if not excel_file.filename.endswith('.xlsx'):
            raise HTTPException(status_code=400, detail="Excel file must be .xlsx format")

        # Read and parse workflow graph and variables
        workflow_content = await workflow_graph.read()
        variables_content = await variables.read()
        workflow_json = json.loads(workflow_content.decode('utf-8'))
        variables_json = json.loads(variables_content.decode('utf-8'))
        column_index = int(selected_column_index)

        # Generate unique session ID
        session_id = str(uuid.uuid4())

        # Save uploaded Excel file
        excel_path = UPLOAD_DIR / f"{session_id}_{excel_file.filename}"
        content = await excel_file.read()
        excel_path.write_bytes(content)

        # Initialize session
        session_store.create(session_id, {
            "status": "processing",
            "excel_file": str(excel_path),
            "workflow_graph": workflow_json,
            "variables": variables_json,
            "results": None,
            "error": None,
        })

        # Kick off background job
        background_tasks.add_task(
            run_workflow_job,
            session_id,
            str(excel_path),
            workflow_json,
            variables_json,
            column_index,
        )

        return {
            "session_id": session_id,
            "status": "processing",
            "message": "Workflow started",
        }

    except Exception as e:
        logger.error(f"Error in workflow run: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def run_workflow_job(
    session_id: str,
    excel_file_path: str,
    workflow_graph: Dict,
    variables: List[Dict],
    selected_column_index: int = 0,
):
    """
    Background processing job for workflow execution
    """
    try:
        if session_store.get(session_id) is None:
            return

        # Create output directory for this session
        output_folder = OUTPUT_DIR / session_id
        output_folder.mkdir(exist_ok=True)

        # Run workflow
        generated_files, project_folder, file_details = run_workflow(
            excel_file_path,
            workflow_graph,
            variables,
            str(output_folder),
            selected_column_index=selected_column_index,
        )

        # Create ZIP file
        zip_path = OUTPUT_DIR / f"{session_id}_chain_files.zip"
        if generated_files:
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file_path in generated_files:
                    if os.path.exists(file_path):
                        zipf.write(file_path, os.path.basename(file_path))

        # Update session
        session_store.update(session_id, {
            "status": "completed",
            "results": {
                "files": [os.path.basename(f) for f in generated_files],
                "file_details": file_details,
                "zip_path": str(zip_path),
                "summary": {
                    "total_files": len(generated_files),
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

    return result


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
