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

export interface WorkflowStatusResponse {
  status: 'processing' | 'completed' | 'error';
  results?: {
    files: string[];
    file_details?: Array<{
      model?: string;
      filename: string | null;
      project_folder: string;
      output_path: string | null;
      status?: 'success' | 'error';
      error?: string | null;
    }>;
    zip_path: string;
    summary: {
      total_files: number;
      succeeded_count?: number;
      failed_count?: number;
      project_folder: string;
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
  formData.append('excel_file', compiled.excelFile);

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

