"""
PyChain API
FastAPI backend for processing DWG/DGN/IFC files and generating 12d Model chain files
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
from contextlib import asynccontextmanager
import os
import uuid
import asyncio
from pathlib import Path
import logging
import zipfile
from commands.importers import normalize_file_path
from services.workflow_runner import run_workflow
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup
    logger.info("Starting PyChain API")
    
    # Clean up old files (optional)
    for directory in [UPLOAD_DIR, OUTPUT_DIR]:
        for file_path in directory.glob("*"):
            if file_path.is_file():
                try:
                    file_path.unlink()
                except Exception:
                    pass
    
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

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for session management
# In-memory storage for session management
workflow_sessions = {}




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
        
        # Initialize session
        processing_sessions[session_id] = {
            "status": "uploaded",
            "excel_file": str(excel_path),
            "dwg_ifc_files": dwg_ifc_paths,
            "results": None,
            "error": None
        }
        
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
        workflow_sessions[session_id] = {
            "status": "processing",
            "excel_file": str(excel_path),
            "workflow_graph": workflow_json,
            "variables": variables_json,
            "results": None,
            "error": None,
        }
        
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
        if session_id not in workflow_sessions:
            return
        
        session = workflow_sessions[session_id]
        
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
        session["status"] = "completed"
        session["results"] = {
            "files": [os.path.basename(f) for f in generated_files],
            "file_details": file_details,
            "zip_path": str(zip_path),
            "summary": {
                "total_files": len(generated_files),
                "project_folder": project_folder or "",
            },
        }
        logger.info(f"Workflow processing completed for session {session_id}")
        
    except Exception as e:
        if session_id in workflow_sessions:
            workflow_sessions[session_id]["status"] = "error"
            workflow_sessions[session_id]["error"] = str(e)
        logger.error(f"Error in workflow background processing: {e}", exc_info=True)


@app.get("/api/workflow/status/{session_id}")
async def get_workflow_status(session_id: str):
    """
    Get workflow processing status
    """
    if session_id not in workflow_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = workflow_sessions[session_id]
    
    result = {
        "status": session["status"],
    }
    
    if session["status"] == "completed":
        result["results"] = session["results"]
    elif session["status"] == "error":
        result["error"] = session.get("error", "Unknown error")
    
    return result


@app.get("/api/workflow/download/{session_id}")
async def download_workflow_results(session_id: str):
    """
    Download workflow results
    """
    if session_id not in workflow_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = workflow_sessions[session_id]
    
    if session["status"] != "completed":
        raise HTTPException(status_code=400, detail="Processing not completed")
    
    zip_path = session["results"]["zip_path"]
    
    if not Path(zip_path).exists():
        raise HTTPException(status_code=404, detail="Download file not found")
    
    return FileResponse(
        zip_path,
        headers={"Content-Disposition": f"attachment; filename=workflow_chain_files_{session_id}.zip"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

