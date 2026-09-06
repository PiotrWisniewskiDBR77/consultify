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

/** Verdict / rationale / evidence shape mirrored from the server ConclusionService. */
export interface ConclusionArtifactRef {
  type: string;
  id: string;
  title?: string | null;
  url?: string | null;
}

export interface ConclusionEvidenceRef {
  type: string;
  ref: string;
  excerpt?: string | null;
}

export type ConclusionStatus =
  | 'candidate'
  | 'needs_evidence'
  | 'needs_review'
  | 'ready_for_readout'
  | 'published'
  | 'converted'
  | 'rejected';

export interface Conclusion {
  id: string;
  organizationId: string;
  projectId?: string | null;
  /** Verdict headline (CARD_CONTENT_FORMULA title). */
  title: string;
  /** Rationale — the answer-first statement. */
  statement: string;
  /** Origin: 'tool' | 'assessment' | 'assessment_siri' | 'assessment_adma' | 'interview' | 'tools'. */
  sourceModule: string;
  sourceArtifactRefs: ConclusionArtifactRef[];
  sourcePackId?: string | null;
  confidenceLevel: string;
  limits: string;
  evidenceRefs: ConclusionEvidenceRef[];
  recommendedNextAction?: string | null;
  status: ConclusionStatus;
  ownerId?: string | null;
  reviewerId?: string | null;
  sponsorId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConclusionSourcePack {
  id: string;
  organizationId: string;
  projectId?: string | null;
  sourceModule: string;
  sourceArtifactRefs: ConclusionArtifactRef[];
  evidenceRefs: ConclusionEvidenceRef[];
  contextSummary: string;
  limitations: string[];
  capturedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConclusionDetail {
  conclusion: Conclusion;
  sourcePack: ConclusionSourcePack | null;
  conversions: ArtifactConversion[];
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(`/api${path}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<T>(res, `GET ${path}`);
}

async function apiPost<T>(path: string): Promise<T> {
  const res = await fetchWithRetry(`/api${path}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse<T>(res, `POST ${path}`);
}

export const ConclusionsApi = {
  /**
   * 1.1-Z3 #1 (DECYZJA CTO): odczyt nie może pisać — `GET /conclusions` już
   * nie synchronizuje źródeł (interview/assessment/tools) po cichu. Wołaj
   * `sync()` jawnie przed `list()` (raz na wejście na ekran, plus przycisk
   * „Odśwież"); brak uprawnienia (403) NIE ma blokować listy — pomiń błąd i
   * pokaż to, co już jest w bazie.
   */
  sync: () => apiPost<{ synced: Record<string, number> }>('/conclusions/sync'),

  /**
   * Org-wide list of governed conclusions. Pure read — no side effects; call
   * `sync()` first if the caller wants a fresh sync from interview/assessment/
   * tool sources.
   */
  list: (params?: { status?: string; sourceModule?: string; projectId?: string }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.sourceModule) search.set('sourceModule', params.sourceModule);
    if (params?.projectId) search.set('projectId', params.projectId);
    const qs = search.toString();
    return apiGet<{ conclusions: Conclusion[] }>(`/conclusions${qs ? `?${qs}` : ''}`);
  },

  /** Single conclusion + its source pack + downstream conversions (readout view). */
  get: (id: string) => apiGet<ConclusionDetail>(`/conclusions/${encodeURIComponent(id)}`),

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
