import axios from 'axios';
import { CompiledWorkflow, WorkflowNode, WorkflowEdge } from './types';

const API_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001')
    : 'http://localhost:8001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 300000, // 5 minutes
});

export interface WorkflowRunRequest {
  excel_file: File;
  workflow_graph: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  variables: any[];
}

export interface WorkflowRunResponse {
  session_id: string;
  status: string;
  message: string;
}

// PC-907: rows are 'queued' from the moment the backend has parsed the model
// list (the seed write) until each model is attempted, at which point they
// flip to 'success' or 'error'. The final completion snapshot only contains
// 'success' / 'error'.
export type FileDetailStatus = 'queued' | 'success' | 'error';

// PC-303: per-node event emitted by build_command_chain. One event per
// (model, node_id) pair — every executed (non-control-flow) node gets an
// event. Successful nodes have error: null; failed nodes carry the
// "<ExceptionType>: <message>" string.
export interface NodeEvent {
  model: string;
  node_id: string;
  node_type: string;
  node_label?: string | null;
  status: 'success' | 'error';
  error?: string | null;
}

export interface FileDetail {
  model?: string;
  filename: string | null;
  project_folder: string;
  output_path: string | null;
  status?: FileDetailStatus;
  error?: string | null;
  // PC-303: present on rows whose model has been attempted (status is
  // 'success' or 'error'). Absent on 'queued' rows.
  node_events?: NodeEvent[];
}

export interface WorkflowStatusResponse {
  status: 'processing' | 'completed' | 'error';
  // PC-907: `results` may be present while status='processing' once the
  // backend has parsed the Excel and seeded queued rows. Fields like
  // `files`, `zip_path` and `summary.succeeded_count` are only populated by
  // the final completion write — hence everything is optional below.
  results?: {
    files?: string[];
    file_details?: FileDetail[];
    zip_path?: string;
    summary?: {
      total_files?: number;
      succeeded_count?: number;
      failed_count?: number;
      project_folder?: string;
    };
  };
  error?: string;
}

export async function runWorkflow(
  compiled: CompiledWorkflow
): Promise<WorkflowRunResponse> {
  // Defensive: if excelFile isn't a real File, FormData will stringify it to "[object Object]"
  // and FastAPI will return 422 "Expected UploadFile".
  if (typeof File !== 'undefined' && !(compiled.excelFile instanceof File)) {
    throw new Error('Excel file missing/invalid. Please re-upload the .xlsx file before running.');
  }

  const formData = new FormData();
  formData.append('excel_file', compiled.excelFile as File);

  // Send JSON parts as actual Files so FastAPI can reliably parse them as UploadFile
  const workflowFile = new File([JSON.stringify(compiled.graph)], 'workflow_graph.json', {
    type: 'application/json',
  });
  const variablesFile = new File([JSON.stringify(compiled.variables)], 'variables.json', {
    type: 'application/json',
  });

  formData.append('workflow_graph', workflowFile);
  formData.append('variables', variablesFile);
  formData.append('selected_column_index', String(compiled.selectedColumnIndex ?? 0));

  try {
    const response = await api.post<WorkflowRunResponse>(
      '/workflow/run',
      formData,
      {
        // IMPORTANT: don't set Content-Type manually; Axios will add the required boundary
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = (error.response?.data as any)?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? JSON.stringify(detail)
            : error.message;
      throw new Error(message);
    }
    throw error;
  }
}

export async function getWorkflowStatus(
  sessionId: string
): Promise<WorkflowStatusResponse> {
  try {
    const response = await api.get<WorkflowStatusResponse>(
      `/workflow/status/${sessionId}`
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.detail || error.message);
    }
    throw error;
  }
}

export function getWorkflowDownloadUrl(sessionId: string): string {
  return `${API_URL}/api/workflow/download/${sessionId}`;
}

// PC-303: fetch the XML lines a single node emitted for one model. The
// backend captures these to disk during run_workflow_job; the layout is
// keyed by sanitized model name + node id. Returns plain text. Throws on
// 404 (no captured XML for this node, or unknown session).
export async function getNodeXml(
  sessionId: string,
  modelName: string,
  nodeId: string,
): Promise<string> {
  const url = `${API_URL}/api/workflow/node-xml/${encodeURIComponent(sessionId)}/${encodeURIComponent(modelName)}/${encodeURIComponent(nodeId)}`;
  try {
    const response = await api.get<string>(url, {
      // Force the response body to be returned as a raw string. Axios will
      // otherwise try to JSON.parse a "<xml>..." body, throwing on the first
      // non-JSON character.
      responseType: 'text',
      transformResponse: (body) => body,
      // The path is absolute — bypass the api instance's baseURL.
      baseURL: '',
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data || error.message);
    }
    throw error;
  }
}

