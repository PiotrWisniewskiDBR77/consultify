import {
  WorkCanvasActionResult,
  WorkCanvasConversionProposal,
  WorkCanvasDraft,
  WorkCanvasTarget,
} from '@/components/AIChat/WorkCanvas/types';

import { API_URL, fetchWithRetry, getHeaders, handleResponse } from './baseClient';

const BASE_PATH = `${API_URL}/work-canvas`;

type Envelope<T> =
  | T
  | { data?: T; auditEventId?: string | null; readBack?: Record<string, unknown> | null };

function unwrap<T>(payload: Envelope<T>): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data?: T }).data as T;
  }
  return payload as T;
}

function meta(
  payload: unknown
): Pick<WorkCanvasActionResult<unknown>, 'auditEventId' | 'readBack'> {
  if (!payload || typeof payload !== 'object') return {};
  const value = payload as {
    auditEventId?: string | null;
    readBack?: Record<string, unknown> | null;
  };
  return {
    auditEventId: value.auditEventId,
    readBack: value.readBack,
  };
}

async function request<T>(path: string, init?: RequestInit, error = 'Work Canvas request failed') {
  const res = await fetchWithRetry(`${BASE_PATH}${path}`, {
    ...init,
    headers: { ...getHeaders(), ...((init?.headers as Record<string, string>) || {}) },
  });
  return handleResponse<T>(res, error);
}

export const WorkCanvasApi = {
  async listDrafts(params: {
    conversationId?: string | null;
    projectId?: string | null;
    limit?: number;
  }): Promise<WorkCanvasDraft[]> {
    const query = new URLSearchParams();
    if (params.conversationId) query.set('conversationId', params.conversationId);
    if (params.projectId) query.set('projectId', params.projectId);
    if (params.limit) query.set('limit', String(params.limit));
    const payload = await request<Envelope<WorkCanvasDraft[]>>(
      `/drafts${query.toString() ? `?${query}` : ''}`,
      undefined,
      'Failed to list Work Canvas drafts'
    );
    return unwrap(payload) || [];
  },

  async getDraft(draftId: string): Promise<{
    draft: WorkCanvasDraft;
    proposals: WorkCanvasConversionProposal[];
  }> {
    const payload = await request<
      Envelope<{ draft: WorkCanvasDraft; proposals: WorkCanvasConversionProposal[] }>
    >(`/drafts/${encodeURIComponent(draftId)}`, undefined, 'Failed to load Work Canvas draft');
    return unwrap(payload);
  },

  async createDraft(
    input: Partial<WorkCanvasDraft>
  ): Promise<WorkCanvasActionResult<WorkCanvasDraft>> {
    const payload = await request<Envelope<WorkCanvasDraft>>(
      '/drafts',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      'Failed to create Work Canvas draft'
    );
    return { data: unwrap(payload), ...meta(payload) };
  },

  async updateDraft(
    draftId: string,
    input: Partial<WorkCanvasDraft>
  ): Promise<WorkCanvasActionResult<WorkCanvasDraft>> {
    const payload = await request<Envelope<WorkCanvasDraft>>(
      `/drafts/${encodeURIComponent(draftId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
      'Failed to update Work Canvas draft'
    );
    return { data: unwrap(payload), ...meta(payload) };
  },

  async saveAsArtifact(
    draftId: string,
    input: { artifactId?: string | null; artifactRunId?: string | null }
  ): Promise<WorkCanvasActionResult<WorkCanvasDraft>> {
    const payload = await request<Envelope<WorkCanvasDraft>>(
      `/drafts/${encodeURIComponent(draftId)}/save-as-artifact`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      'Failed to save Work Canvas artifact'
    );
    return { data: unwrap(payload), ...meta(payload) };
  },

  async createProposal(
    draftId: string,
    target: WorkCanvasTarget,
    payload: Record<string, unknown>,
    idempotencyKey?: string | null
  ): Promise<WorkCanvasActionResult<WorkCanvasConversionProposal>> {
    const response = await request<Envelope<WorkCanvasConversionProposal>>(
      `/drafts/${encodeURIComponent(draftId)}/proposals`,
      {
        method: 'POST',
        body: JSON.stringify({
          target,
          payload,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        }),
      },
      'Failed to create Work Canvas proposal'
    );
    return { data: unwrap(response), ...meta(response) };
  },

  async approveProposal(
    proposalId: string
  ): Promise<WorkCanvasActionResult<WorkCanvasConversionProposal>> {
    const payload = await request<Envelope<WorkCanvasConversionProposal>>(
      `/proposals/${encodeURIComponent(proposalId)}/approve`,
      { method: 'POST', body: '{}' },
      'Failed to approve Work Canvas proposal'
    );
    return { data: unwrap(payload), ...meta(payload) };
  },

  async rejectProposal(
    proposalId: string,
    reason?: string
  ): Promise<WorkCanvasActionResult<WorkCanvasConversionProposal>> {
    const payload = await request<Envelope<WorkCanvasConversionProposal>>(
      `/proposals/${encodeURIComponent(proposalId)}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      },
      'Failed to reject Work Canvas proposal'
    );
    return { data: unwrap(payload), ...meta(payload) };
  },
};
