# PyChain - 12d Model Chain Generator

A modern, node-based workflow application for generating 12d Model chain files using a visual drag-and-drop interface.

## Overview

This application provides a playful, gamified node-based workspace for building 12d Model chain generation workflows:

- **Visual node-based workflow builder** - Drag and connect nodes to build chain generation pipelines
- **Excel-driven model processing** - Upload Excel files with model names and process them per-model
- **Command node library** - Use pre-built nodes for imports, views, model operations, TIN processing, and more
- **Variable system** - Set and reference variables dynamically (e.g., `modified_variable`, `actual_file_path`)
- **Automatic chain scaffolding** - Every chain automatically includes required opening/closing XML structure
- **Template system** - Save, load, export, and import workflow templates
- **Real-time processing status** - Watch your workflow execute and download results as ZIP

## Project Structure

```
12dPynode/
├── backend/                    # FastAPI backend server
│   ├── main.py                 # API endpoints (legacy + workflow)
│   ├── services/               # Core processing logic
│   │   ├── pychain_service.py  # Legacy batch processing
│   │   └── workflow_runner.py  # Node workflow execution engine
│   ├── utils/                  # Utility modules
│   ├── commands/               # Command generators (XML builders)
│   │   ├── metadata/          # Header, meta data, chain wrapper
│   │   ├── views/              # View operations
│   │   ├── models/             # Model operations
│   │   ├── importers/          # IFC/DWG/DGN importers
│   │   ├── tin/                # TIN/triangulation operations
│   │   └── ...
│   └── requirements.txt
└── frontend/                   # Next.js frontend
    ├── app/                    # Next.js app directory
    │   ├── page.tsx            # Main workspace page
    │   └── globals.css         # Styling with animations
    ├── components/
    │   ├── ui/                 # shadcn-style UI components
    │   └── workflow/           # Workflow components
    │       ├── TopBar.tsx      # Top action bar
    │       ├── LeftSidebar.tsx # File tray + node palette
    │       ├── RightSidebar.tsx # Properties panel
    │       ├── WorkspaceCanvas.tsx # React Flow canvas
    │       └── nodes/          # Custom node components
    └── lib/
        ├── api.ts              # Legacy API client
        └── workflow/           # Workflow system
            ├── types.ts        # Type definitions
            ├── compile.ts      # Graph compilation
            ├── run.ts          # Workflow API client
            └── templates.ts   # Template persistence
```

## Prerequisites

- **Python 3.8+**
- **Node.js 18+** (tested with Node 18+)
- **npm** or **yarn**
- **FastAPI** and Python dependencies (installed via requirements.txt)
- **React Flow** and frontend dependencies (installed via npm)

## Quick Start

### 1. Backend Setup

Open a terminal and navigate to the project root:

```bash
cd "G:\WebDev\Python Scripts\12dPynode\backend"
```

Create and activate a virtual environment:

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**Linux/Mac:**
```bash
python3 -m venv venv
source venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Start the backend server:

```bash
python main.py
```

The backend API will be available at `http://localhost:8001`
- API docs: `http://localhost:8001/docs`
- Health check: `http://localhost:8001/`

### 2. Frontend Setup

Open a **new terminal** (keep the backend running) and navigate to the frontend directory:

```bash
cd "G:\WebDev\Python Scripts\12dPynode\frontend"
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

### 3. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

You should see the node-based workflow workspace with:
- **Top bar**: Run Chain, Save/Load/Export/Import template buttons
- **Left sidebar**: File tray for Excel/model files + node palette
- **Central canvas**: Drag-and-drop node workspace
- **Right sidebar**: Properties panel (shows when a node is selected)

## Usage Guide

### Building a Workflow

1. **Upload Excel File** (Left Sidebar)
   - Drag and drop or click to upload an Excel file (`.xlsx`)
   - The file should contain a column with model names (one per row)
   - The app will automatically parse model names from the first column

2. **Add Nodes** (Left Sidebar → Node Palette)
   - Click any node type to add it to the canvas
   - Essential nodes:
     - **Excel Models**: Connects to your uploaded Excel file
     - **Foreach Model**: Iterates over each model name
     - **Set Variable**: Define variables (e.g., `project_folder`, `actual_file_path`)
     - **Command Nodes**: Import, Clean Model, Create View, etc.
     - **Chain Output**: Final node that generates the `.chain` file

3. **Connect Nodes**
   - Drag from output handles (right side) to input handles (left side)
   - Build your workflow: Excel → Foreach → Commands → Chain Output

4. **Configure Variables**
   - Select a **Set Variable** node to define values
   - Variables can be:
     - **Per-run**: Set once for all models (e.g., `project_folder`)
     - **Per-model**: Computed for each model (e.g., `modified_variable = model_name.replace('-', ' ')`)

5. **Run the Workflow**
   - Click **"Run Chain"** in the top bar
   - The workflow executes once per model name from Excel
   - Each model generates a separate `.chain` file

6. **Download Results**
   - When processing completes, download the ZIP file
   - Contains all generated `.chain` files

### Saving and Loading Templates

- **Save Template**: Click "Save Template" → Enter a name → Template saved to browser localStorage
- **Load Template**: Click "Load Template" → Select from list
- **Export**: Download template as JSON file
- **Import**: Upload a previously exported template JSON

### Node Types

**Input Nodes:**
- `excelModels` - Excel file with model names
- `foreachModel` - Iterates over model names

**Command Nodes:**
- `import` - Import IFC/DWG/DGN files
- `cleanModel` - Clean model command
- `createView` - Create a view
- `addModelToView` - Add model to view
- `removeModelFromView` - Remove model from view
- `deleteModelsFromView` - Delete models from view
- `createSharedModel` - Create shared model
- `triangulateManualOption` - TIN triangulation
- `tinFunction` - TIN function execution

**Output Nodes:**
- `chainFileOutput` - Generates the final `.chain` file

**Utility Nodes:**
- `setVariable` - Set variable values

## API Endpoints

### Workflow API (New)
- `POST /api/workflow/run` - Execute a workflow graph
- `GET /api/workflow/status/{session_id}` - Get workflow processing status
- `GET /api/workflow/download/{session_id}` - Download workflow results as ZIP

### Legacy API (Still Available)
- `POST /api/upload` - Upload Excel and DWG/DGN/IFC files
- `POST /api/process` - Start processing with model type mappings
- `GET /api/status/{session_id}` - Get processing status
- `GET /api/download/{session_id}` - Download results as ZIP

## Excel File Format

### Minimal Format (Workflow System)

For the node-based workflow, the Excel file needs at minimum:
- **First column**: Model names (one per row)
  - Example: `NWP-714-C-NWA-M2D-00-COY-CFN-DE60`
  - Each row becomes a model that the workflow processes

### Extended Format (Legacy System)

The legacy batch processing system expects:
- **filename**: The base filename (without extension)
- **discipline**: The discipline code
- **prefix**: The prefix for the model
- **description**: Description of the model
- **object_dimension**: Dimensional information
- **file_ext**: File extension information
- **project_folder_path**: The project folder path embedded in chain files
- **file_mapping_path**: Folder path where DWG/IFC files are located

## Environment Variables

### Backend

- `CORS_ORIGINS` - Comma-separated list of allowed CORS origins (default: `http://localhost:3000,http://localhost:5173`)

### Frontend

- `NODE_ENV` - Set to `production` for production builds

## Development

The backend uses FastAPI with automatic API documentation available at `http://localhost:8001/docs` when running.

## Key Features

### Automatic Chain Scaffolding

Every generated chain file automatically includes:
- **Opening**: XML header + meta data + chain wrapper + chain settings
- **Commands**: Your workflow nodes execute here
- **Closing**: Chain closing tags

This ensures all chains have the required structure, even if your workflow graph is minimal.

### Variable System

Variables can be referenced in node properties:
- `model_name` - Current model name from Excel
- `modified_variable` - Model name with hyphens replaced by spaces
- `project_folder` - Project folder path (set via Set Variable node)
- `actual_file_path` - File path for imports (set via Set Variable node)
- Custom variables - Define your own via Set Variable nodes

### Execution Model

- **Per-model execution**: The workflow runs once for each model name in Excel
- **Variable resolution**: Variables are resolved per-model at execution time
- **Command chaining**: Nodes execute in order based on graph connections

## Troubleshooting

### Backend won't start
- Ensure Python 3.8+ is installed
- Check that all dependencies are installed: `pip install -r requirements.txt`
- Verify port 8001 is not in use

### Frontend won't start
- Ensure Node.js 18+ is installed
- Delete `node_modules` and `package-lock.json`, then run `npm install` again
- Check that port 3000 is not in use

### Workflow execution fails
- Ensure Excel file has at least one model name in the first column
- Verify that Excel Models node is connected to Foreach Model node
- Check that at least one Chain Output node exists
- Review backend logs for detailed error messages

### Templates not saving/loading
- Templates are stored in browser localStorage
- Clear browser data will delete templates
- Use Export/Import to backup templates

## Notes

- Temporary files are stored in `backend/uploads` and `backend/output`
- Old files are cleaned up on server startup
- Generated `.chain` files are excluded from version control
- Templates are stored in browser localStorage (temporary - DB integration planned)
