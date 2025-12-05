"""
PyChain API
FastAPI backend for processing DWG/DGN/IFC files and generating 12d Model chain files
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
import uuid
import asyncio
from pathlib import Path
import logging
import zipfile
from services.pychain_service import process_files_batch, normalize_file_path
from utils.data_loader import load_naming_data

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PyChain API",
    description="API for generating 12d Model chain files from DWG/DGN/IFC files",
    version="1.0.0"
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

# Create necessary directories
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("output")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# In-memory storage for session management
processing_sessions = {}


class ModelTypeMapping(BaseModel):
    """Model type mapping for files"""
    filename: str
    model_type: str  # "Model" or "TIN"


class ProcessRequest(BaseModel):
    """Request model for processing files"""
    model_types: List[ModelTypeMapping]


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


@app.post("/api/process")
async def process_files(
    session_id: str,
    request: ProcessRequest,
    background_tasks: BackgroundTasks
):
    """
    Queue processing in the background and return immediately
    """
    try:
        if session_id not in processing_sessions:
            raise HTTPException(status_code=404, detail="Session not found")
        
        session = processing_sessions[session_id]
        
        if session["status"] not in ("uploaded", "error"):
            raise HTTPException(status_code=400, detail="Files not ready for processing")
        
        # Update status and reset results
        session["status"] = "processing"
        session["results"] = None
        session["error"] = None

        # Build model type mapping
        model_type_map = {}
        for mapping in request.model_types:
            filename = mapping.filename
            model_type_map[filename] = mapping.model_type
            # Also map without extension
            stem = os.path.splitext(filename)[0]
            model_type_map[stem] = mapping.model_type

        # Kick off background job
        if background_tasks is None:
            raise HTTPException(status_code=500, detail="Background tasks not available")
        background_tasks.add_task(
            run_processing_job, 
            session_id, 
            model_type_map
        )

        return {"status": "processing", "message": "Processing started"}

    except HTTPException:
        raise
    except Exception as e:
        if session_id in processing_sessions:
            processing_sessions[session_id]["status"] = "error"
            processing_sessions[session_id]["error"] = str(e)
        logger.error(f"Error queuing processing: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def run_processing_job(session_id: str, model_type_map: Dict[str, str]):
    """
    Background processing job for chain file generation
    """
    try:
        if session_id not in processing_sessions:
            return
        session = processing_sessions[session_id]

        excel_file_path = session["excel_file"]
        dwg_ifc_files = session["dwg_ifc_files"]
        
        # Create output directory for this session
        output_folder = OUTPUT_DIR / session_id
        output_folder.mkdir(exist_ok=True)
        
        # Load naming data to construct actual file paths
        naming_data = load_naming_data(excel_file_path)
        if naming_data is None:
            raise ValueError("Error loading naming data from Excel file")
        
        # Build file paths list: (temp_path, actual_path)
        # Uploaded files are saved with a session prefix: "<session_id>_<original_name>"
        # We need to strip that prefix to match Excel 'filename' values and to build actual paths.
        file_paths = []
        for file_path in dwg_ifc_files:
            temp_filename = os.path.basename(file_path)
            # Remove the session prefix (everything before the first underscore)
            if "_" in temp_filename:
                original_filename = temp_filename.split("_", 1)[1]
            else:
                original_filename = temp_filename

            filename_stem = os.path.splitext(original_filename)[0]
            
            # Find matching row in Excel based on the original filename stem
            if filename_stem in naming_data['filename'].values:
                row = naming_data[naming_data['filename'] == filename_stem].iloc[0]
                file_folder_path = normalize_file_path(row.get('file_mapping_path', ''))
                
                if file_folder_path:
                    file_extension = os.path.splitext(original_filename)[1]
                    actual_file_path = os.path.join(file_folder_path, filename_stem + file_extension)
                    actual_file_path = normalize_file_path(actual_file_path)
                    file_paths.append((file_path, actual_file_path))

        if not file_paths:
            # No files matched the naming data; mark session as error
            session["status"] = "error"
            session["error"] = (
                "No uploaded files matched entries in the Excel 'filename' column "
                "or 'file_mapping_path' was missing."
            )
            logger.error(f"No matching files found in naming data for session {session_id}")
            return
        
        # Process files
        generated_files, project_folder, file_details = process_files_batch(
            excel_file_path,
            file_paths,
            model_type_map,
            str(output_folder)
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
                "project_folder": project_folder or ""
            }
        }
        logger.info(f"Processing completed for session {session_id}")

    except Exception as e:
        if session_id in processing_sessions:
            processing_sessions[session_id]["status"] = "error"
            processing_sessions[session_id]["error"] = str(e)
        logger.error(f"Error in background processing: {e}", exc_info=True)


@app.get("/api/status/{session_id}")
async def get_status(session_id: str):
    """
    Get processing status for a session
    """
    if session_id not in processing_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return processing_sessions[session_id]


@app.get("/api/download/{session_id}")
async def download_results(session_id: str):
    """
    Download processed results
    """
    if session_id not in processing_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = processing_sessions[session_id]
    
    if session["status"] != "completed":
        raise HTTPException(status_code=400, detail="Processing not completed")
    
    zip_path = session["results"]["zip_path"]
    
    if not Path(zip_path).exists():
        raise HTTPException(status_code=404, detail="Download file not found")
    
    return FileResponse(
        zip_path,
        headers={"Content-Disposition": f"attachment; filename=chain_files_{session_id}.zip"}
    )


@app.on_event("startup")
async def startup_event():
    """Cleanup old files on startup"""
    logger.info("Starting PyChain API")
    
    # Clean up old files (optional)
    for directory in [UPLOAD_DIR, OUTPUT_DIR]:
        for file_path in directory.glob("*"):
            if file_path.is_file():
                try:
                    file_path.unlink()
                except Exception:
                    pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

