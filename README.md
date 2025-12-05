# PyChain - 12d Model Chain Generator

A modern web application for generating 12d Model chain files from DWG/DGN/IFC files using Excel naming conventions.

## Overview

This application provides a clean, modern interface for processing CAD files and generating 12d Model chain files:

- **Drag-and-drop file uploads**
- **Per-file model type selection** (Model/TIN)
- **Real-time processing status**
- **ZIP download** of generated chain files

## Project Structure

```
PyChainApp/
├── backend/          # FastAPI backend server
│   ├── main.py      # API endpoints
│   ├── services/    # Core processing logic
│   ├── utils/       # Utility modules
│   ├── commands/     # Command generators
│   └── requirements.txt
└── frontend/        # Next.js frontend
    ├── app/         # Next.js app directory
    ├── components/   # UI components
    └── lib/         # API client and utilities
```

## Prerequisites

- Python 3.8+
- Node.js 18+
- npm or yarn

## Backend Setup

1. Navigate to the backend directory:

```bash
cd backend
```

2. Create a virtual environment (recommended):

```bash
python -m venv venv
On Windows: venv\Scripts\activate
source venv/bin/activate  
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Run the backend server:

```bash
python main.py
```

The backend will run on `http://localhost:8001`

## Frontend Setup

1. Navigate to the frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Usage

1. Start both the backend and frontend servers
2. Open `http://localhost:3000` in your browser
3. Upload your `model_naming.xlsx` file
4. Upload one or more DWG/DGN/IFC files
5. Review and adjust model types (Model/TIN) for each file
6. Click "Generate Chain Files"
7. Wait for processing to complete
8. Download the ZIP file containing all generated chain files

## API Endpoints

- `POST /api/upload` - Upload Excel and DWG/DGN/IFC files
- `POST /api/process` - Start processing with model type mappings
- `GET /api/status/{session_id}` - Get processing status
- `GET /api/download/{session_id}` - Download results as ZIP

## Excel File Format

The `model_naming.xlsx` file should contain the following columns:
- **filename**: The base filename (without extension)
- **discipline**: The discipline code
- **prefix**: The prefix for the model
- **description**: Description of the model
- **object_dimension**: Dimensional information
- **file_ext**: File extension information
- **project_folder_path**: The project folder path that will be embedded in the chain files
- **file_mapping_path**: The folder path where the DWG/IFC files are located (filename will be added automatically)

## Environment Variables

### Backend

- `CORS_ORIGINS` - Comma-separated list of allowed CORS origins (default: `http://localhost:3000,http://localhost:5173`)

### Frontend

- `NODE_ENV` - Set to `production` for production builds

## Development

The backend uses FastAPI with automatic API documentation available at `http://localhost:8001/docs` when running.

## Notes

- Temporary files are stored in `backend/uploads` and `backend/output`
- Old files are cleaned up on server startup
- Generated `.chain` files are excluded from version control
