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

export interface ConclusionReadout {
  id: string;
  organizationId: string;
  projectId?: string | null;
  title: string;
  sourceConclusionIds: string[];
  summary: string;
  sections: {
    researchSummary: string;
    strongestConclusions: string[];
    risks: string[];
    opportunities: string[];
    contradictions: string[];
    coverageGaps: string[];
    decisionsNeeded: string[];
    proposedConversions: string[];
  };
  visibilityScope: 'private' | 'project' | 'organization' | 'review_shared';
  outputArtifactRefs: Array<{ type: string; id: string; title?: string; url?: string }>;
  createdBy: string;
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

  listReadouts: () => apiGet<{ readouts: ConclusionReadout[] }>('/conclusions/readouts'),

  listConversions: (params?: {
    sourceConclusionId?: string;
    targetArtifactType?: string;
    targetArtifactId?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.sourceConclusionId) search.set('sourceConclusionId', params.sourceConclusionId);
    if (params?.targetArtifactType) search.set('targetArtifactType', params.targetArtifactType);
    if (params?.targetArtifactId) search.set('targetArtifactId', params.targetArtifactId);
    const qs = search.toString();
    return apiGet<{ conversions: ArtifactConversion[] }>(
      `/artifact-conversions${qs ? `?${qs}` : ''}`
    );
  },

  createReadout: (payload: {
    title?: string;
    conclusionIds: string[];
    visibilityScope?: 'private' | 'project' | 'organization' | 'review_shared';
  }) => apiPost<{ readout: ConclusionReadout }>('/conclusions/readouts', payload),

  generateReadoutReport: (readoutId: string) =>
    apiPost<{ reportId: string; readout: ConclusionReadout }>(
      `/conclusions/readouts/${encodeURIComponent(readoutId)}/generate-report`,
      {}
    ),

  getReadoutChatContext: (readoutId: string) =>
    apiPost<{ context: Record<string, unknown> }>(
      `/conclusions/readouts/${encodeURIComponent(readoutId)}/chat-context`,
      {}
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
