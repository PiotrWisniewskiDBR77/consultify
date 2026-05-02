import { fetchWithRetry, getHeaders, handleResponse } from './baseClient';

export interface Conclusion {
  id: string;
  organizationId: string;
  projectId?: string | null;
  title: string;
  statement: string;
  sourceModule: string;
  sourceArtifactRefs: Array<{ type: string; id: string; title?: string | null; url?: string | null }>;
  confidenceLevel: 'high' | 'medium' | 'low' | 'insufficient' | 'contradicted' | string;
  limits: string;
  evidenceRefs: Array<{ type: string; ref: string; excerpt?: string | null }>;
  recommendedNextAction?: string | null;
  status:
    | 'candidate'
    | 'needs_evidence'
    | 'needs_review'
    | 'ready_for_readout'
    | 'published'
    | 'converted'
    | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactConversion {
  id: string;
  sourceConclusionId?: string | null;
  targetArtifactType: string;
  targetArtifactId?: string | null;
  conversionStatus: 'draft' | 'proposed' | 'approved' | 'converted' | 'rejected' | 'failed' | 'cancelled';
  conversionIntent: string;
  errorMessage?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(`/api${path}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<T>(res, `GET ${path}`);
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetchWithRetry(`/api${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(res, `POST ${path}`);
}

export const ConclusionsApi = {
  list: (params?: { status?: string; sourceModule?: string; projectId?: string }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.sourceModule) search.set('sourceModule', params.sourceModule);
    if (params?.projectId) search.set('projectId', params.projectId);
    const qs = search.toString();
    return apiGet<{ conclusions: Conclusion[] }>(`/conclusions${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) =>
    apiGet<{ conclusion: Conclusion; conversions: ArtifactConversion[] }>(
      `/conclusions/${encodeURIComponent(id)}`
    ),

  proposeInitiativeConversion: (conclusionId: string) =>
    apiPost<{ conversion: ArtifactConversion; warning?: string | null }>(
      '/artifact-conversions/propose',
      {
        conclusionId,
        targetArtifactType: 'initiative',
      }
    ),

  executeConversion: (conversionId: string) =>
    apiPost<{ conversion: ArtifactConversion; initiative: { id: string } }>(
      `/artifact-conversions/${encodeURIComponent(conversionId)}/convert`,
      {}
    ),
};
