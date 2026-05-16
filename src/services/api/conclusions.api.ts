import { fetchWithRetry, getHeaders, handleResponse } from './baseClient';

export interface ArtifactConversion {
  id: string;
  sourceConclusionId?: string | null;
  sourceArtifactType?: string;
  sourceArtifactId?: string;
  sourceArtifactTitle?: string;
  targetArtifactType: string;
  targetArtifactId?: string | null;
  conversionStatus:
    | 'draft'
    | 'proposed'
    | 'approved'
    | 'converted'
    | 'rejected'
    | 'failed'
    | 'cancelled';
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

export const ConclusionsApi = {
  listConversions: (params?: {
    sourceConclusionId?: string;
    sourceArtifactType?: string;
    sourceArtifactId?: string;
    targetArtifactType?: string;
    targetArtifactId?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.sourceConclusionId) search.set('sourceConclusionId', params.sourceConclusionId);
    if (params?.sourceArtifactType) search.set('sourceArtifactType', params.sourceArtifactType);
    if (params?.sourceArtifactId) search.set('sourceArtifactId', params.sourceArtifactId);
    if (params?.targetArtifactType) search.set('targetArtifactType', params.targetArtifactType);
    if (params?.targetArtifactId) search.set('targetArtifactId', params.targetArtifactId);
    const qs = search.toString();
    return apiGet<{ conversions: ArtifactConversion[] }>(
      `/artifact-conversions${qs ? `?${qs}` : ''}`
    );
  },
};
