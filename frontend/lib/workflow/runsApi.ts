import axios from 'axios';
import { getWorkflowDownloadUrl } from './run';

// PC-906 — run-history API client. Mirrors the axios pattern in run.ts /
// templatesApi.ts (each client owns its own instance; no shared singleton).
const API_URL =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'
    : 'http://localhost:8001';

const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 30000 });

export interface RunSummary {
  id: string;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
  created_at: string | null;
  updated_at: string | null;
  templateName: string | null;
  sourceName: string | null;
  modelCount: number | null;
  succeededCount: number | null;
  failedCount: number | null;
  error: string | null;
}

export async function listRuns(limit = 50): Promise<RunSummary[]> {
  try {
    const { data } = await api.get<RunSummary[]>('/workflow/runs', { params: { limit } });
    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
      throw new Error(typeof detail === 'string' ? detail : error.message);
    }
    throw error;
  }
}

/**
 * Re-download a run's ZIP. Fetches the file and triggers a browser download;
 * resolves to false (no download) when the ZIP has expired / is gone (the
 * backend 404s once the cleanup TTL sweeps it).
 */
export async function downloadRunZip(sessionId: string): Promise<boolean> {
  const res = await fetch(getWorkflowDownloadUrl(sessionId));
  if (!res.ok) return false;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `workflow_chain_files_${sessionId}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
  return true;
}
