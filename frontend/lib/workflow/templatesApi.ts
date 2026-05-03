import axios from 'axios';
import {
  WorkflowTemplate,
  WorkflowTemplateVersion,
  WorkflowTemplateVersionSnapshot,
  WorkflowNode,
  WorkflowEdge,
} from './types';

const API_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001')
    : 'http://localhost:8001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
});

export interface TemplatePayload {
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: { x: number; y: number; zoom: number };
  // PC-203: optional commit message stored on the resulting version row.
  message?: string;
}

interface ServerTemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  name: string;
  message: string | null;
  author: string | null;
  created_at: string;
}

interface ServerTemplateVersionSnapshot extends ServerTemplateVersion {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: { x: number; y: number; zoom: number };
}

function versionFromServer(row: ServerTemplateVersion): WorkflowTemplateVersion {
  return {
    id: row.id,
    templateId: row.template_id,
    versionNumber: row.version_number,
    name: row.name,
    message: row.message,
    author: row.author,
    createdAt: row.created_at,
  };
}

function versionSnapshotFromServer(
  row: ServerTemplateVersionSnapshot,
): WorkflowTemplateVersionSnapshot {
  return {
    ...versionFromServer(row),
    nodes: row.nodes,
    edges: row.edges,
    viewport: row.viewport ?? { x: 0, y: 0, zoom: 1 },
  };
}

interface ServerTemplate {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: { x: number; y: number; zoom: number };
  created_at: string;
  updated_at: string;
}

function fromServer(row: ServerTemplate): WorkflowTemplate {
  return {
    id: row.id,
    name: row.name,
    nodes: row.nodes,
    edges: row.edges,
    viewport: row.viewport ?? { x: 0, y: 0, zoom: 1 },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function unwrap(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown })?.detail;
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

export async function fetchTemplates(): Promise<WorkflowTemplate[]> {
  try {
    const { data } = await api.get<ServerTemplate[]>('/templates');
    return data.map(fromServer);
  } catch (error) {
    return unwrap(error);
  }
}

export async function createTemplate(payload: TemplatePayload): Promise<WorkflowTemplate> {
  try {
    const { data } = await api.post<ServerTemplate>('/templates', payload);
    return fromServer(data);
  } catch (error) {
    return unwrap(error);
  }
}

export async function updateTemplate(
  id: string,
  payload: TemplatePayload,
): Promise<WorkflowTemplate> {
  try {
    const { data } = await api.put<ServerTemplate>(`/templates/${id}`, payload);
    return fromServer(data);
  } catch (error) {
    return unwrap(error);
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  try {
    await api.delete(`/templates/${id}`);
  } catch (error) {
    return unwrap(error);
  }
}

export async function fetchTemplateVersions(
  templateId: string,
): Promise<WorkflowTemplateVersion[]> {
  try {
    const { data } = await api.get<ServerTemplateVersion[]>(
      `/templates/${templateId}/versions`,
    );
    return data.map(versionFromServer);
  } catch (error) {
    return unwrap(error);
  }
}

export async function fetchTemplateVersion(
  templateId: string,
  versionNumber: number,
): Promise<WorkflowTemplateVersionSnapshot> {
  try {
    const { data } = await api.get<ServerTemplateVersionSnapshot>(
      `/templates/${templateId}/versions/${versionNumber}`,
    );
    return versionSnapshotFromServer(data);
  } catch (error) {
    return unwrap(error);
  }
}
