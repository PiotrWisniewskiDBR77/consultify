import type {
  WorkCanvasActionResult,
  WorkCanvasConversionProposal,
  WorkCanvasDraft,
  WorkCanvasKind,
  WorkCanvasSource,
  WorkCanvasTarget,
} from '@/components/AIChat/WorkCanvas/types';

import { fetchWithRetry, getHeaders, handleResponse } from './baseClient';

const WORK_CANVAS_BASE = '/api/work-canvas';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  auditEventId?: string | null;
  readBack?: Record<string, unknown> | null;
};

export interface WorkCanvasDraftInput {
  conversationId: string;
  kind: WorkCanvasKind;
  title: string;
  content: WorkCanvasDraft['content'];
  sources?: WorkCanvasSource[];
  provenance?: WorkCanvasDraft['provenance'];
  clientId?: string | null;
  projectId?: string | null;
  ownerId?: string | null;
  researchSessionId?: string | null;
  artifactRunId?: string | null;
  artifactId?: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const res = await fetchWithRetry(`${WORK_CANVAS_BASE}${path}`, {
    ...init,
    headers: {
      ...getHeaders(),
      ...((init?.headers as Record<string, string>) || {}),
    },
  });
  return handleResponse<ApiEnvelope<T>>(res, `WorkCanvas ${init?.method || 'GET'} ${path}`);
}

export const WorkCanvasApi = {
  async listDrafts(params?: {
    conversationId?: string | null;
    projectId?: string | null;
    limit?: number;
  }): Promise<WorkCanvasDraft[]> {
    const search = new URLSearchParams();
    if (params?.conversationId) search.set('conversationId', params.conversationId);
    if (params?.projectId) search.set('projectId', params.projectId);
    if (params?.limit) search.set('limit', String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : '';
    const json = await request<WorkCanvasDraft[]>(`/drafts${suffix}`);
    return json.data;
  },

  async createDraft(input: WorkCanvasDraftInput): Promise<WorkCanvasActionResult<WorkCanvasDraft>> {
    const json = await request<WorkCanvasDraft>('/drafts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return { data: json.data, auditEventId: json.auditEventId, readBack: json.readBack };
  },

  async updateDraft(
    draftId: string,
    patch: Partial<WorkCanvasDraftInput>
  ): Promise<WorkCanvasActionResult<WorkCanvasDraft>> {
    const json = await request<WorkCanvasDraft>(`/drafts/${encodeURIComponent(draftId)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    return { data: json.data, auditEventId: json.auditEventId, readBack: json.readBack };
  },

  async getDraft(draftId: string): Promise<{
    draft: WorkCanvasDraft;
    proposals: WorkCanvasConversionProposal[];
  }> {
    const json = await request<{
      draft: WorkCanvasDraft;
      proposals: WorkCanvasConversionProposal[];
    }>(`/drafts/${encodeURIComponent(draftId)}`);
    return json.data;
  },

  async saveAsArtifact(
    draftId: string,
    body?: { artifactId?: string | null; artifactRunId?: string | null }
  ): Promise<WorkCanvasActionResult<WorkCanvasDraft>> {
    const json = await request<WorkCanvasDraft>(
      `/drafts/${encodeURIComponent(draftId)}/save-as-artifact`,
      {
        method: 'POST',
        body: JSON.stringify(body || {}),
      }
    );
    return { data: json.data, auditEventId: json.auditEventId, readBack: json.readBack };
  },

  async createProposal(
    draftId: string,
    target: WorkCanvasTarget,
    payload?: Record<string, unknown>
  ): Promise<WorkCanvasActionResult<WorkCanvasConversionProposal>> {
    const json = await request<WorkCanvasConversionProposal>(
      `/drafts/${encodeURIComponent(draftId)}/proposals`,
      {
        method: 'POST',
        body: JSON.stringify({ target, payload }),
      }
    );
    return { data: json.data, auditEventId: json.auditEventId, readBack: json.readBack };
  },

  async approveProposal(
    proposalId: string
  ): Promise<WorkCanvasActionResult<WorkCanvasConversionProposal>> {
    const json = await request<WorkCanvasConversionProposal>(
      `/proposals/${encodeURIComponent(proposalId)}/approve`,
      { method: 'POST' }
    );
    return { data: json.data, auditEventId: json.auditEventId, readBack: json.readBack };
  },

  async rejectProposal(
    proposalId: string,
    reason?: string
  ): Promise<WorkCanvasActionResult<WorkCanvasConversionProposal>> {
    const json = await request<WorkCanvasConversionProposal>(
      `/proposals/${encodeURIComponent(proposalId)}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
    return { data: json.data, auditEventId: json.auditEventId, readBack: json.readBack };
  },
};
