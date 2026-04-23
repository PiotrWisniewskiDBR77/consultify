import { fetchWithRetry, handleDataResponse } from '../baseClient';

export type OutcomeKpiDomain = 'revenue' | 'retention' | 'cost' | 'time';
export type OutcomeSignalKind =
  | 'time_saved'
  | 'decision_shipped'
  | 'revenue'
  | 'margin'
  | 'risk_avoided'
  | 'quality';
export type OutcomeConfidence = 'low' | 'medium' | 'high';
export type OutcomeAcceptanceStatus = 'draft' | 'accepted' | 'rejected' | 'needs_revision';

export type OutcomeMetric = {
  id: string;
  label: string;
  domain: OutcomeKpiDomain;
  unit: string;
  baselineValue: number;
  targetValue: number;
  observedValue?: number;
};

export type OutcomeEvidenceRefs = {
  analysisId: string;
  artifactId?: string;
  researchMissionId?: string;
  reasoningRunId?: string;
  correlationId?: string;
};

export type OutcomeAcceptancePreviewRequest = {
  analysisSummary: string;
  businessGoal: string;
  metrics: OutcomeMetric[];
  evidence: OutcomeEvidenceRefs;
  now?: string;
};

export type OutcomeAcceptancePreviewResponse = {
  previewId: string;
  now: string;
  metrics: Array<
    OutcomeMetric & {
      projectedDelta: number;
      deltaToTarget: number;
      previewState: 'ready' | 'needs_review' | 'at_risk';
      suggestedSignalKind: OutcomeSignalKind;
    }
  >;
  suggestedSignals: Array<{
    kind: OutcomeSignalKind;
    confidence: OutcomeConfidence;
    magnitude: { value: number; unit: string };
    rationale: string;
  }>;
  acceptanceContract: {
    contractId: string;
    previewId: string;
    status: OutcomeAcceptanceStatus;
    requiredActions: string[];
    linkedMetricIds: string[];
  };
  businessLinkSummary: {
    headline: string;
    linkedMetricIds: string[];
    confidence: OutcomeConfidence;
  };
};

export type OutcomeSignalIngestRequest = {
  source: 'kpi_accept' | 'analysis_link' | 'user_confirmation' | 'artifact_ship' | 'research_mission';
  kind: OutcomeSignalKind;
  magnitude: { value: number; unit: string };
  confidence?: OutcomeConfidence;
  evidence: OutcomeEvidenceRefs & { acceptanceContractId?: string };
  note?: string;
  now?: string;
};

export type OutcomeSignalIngestResponse = {
  signalId: string;
  now: string;
  status: 'captured';
};

export type OutcomeAcceptanceResolveRequest = {
  contractId: string;
  decision: 'accepted' | 'rejected' | 'needs_revision';
  acceptedMetricIds?: string[];
  note?: string;
  now?: string;
};

export type OutcomeAcceptanceResolveResponse = {
  contractId: string;
  previewId: string;
  status: OutcomeAcceptanceStatus;
  outcomeRecordId: string | null;
  acceptedMetricIds: string[];
  now: string;
};

export type OutcomeBusinessLinkRequest = {
  analysisSummary: string;
  businessGoal: string;
  hypothesis: string;
  metrics: OutcomeMetric[];
  evidence: OutcomeEvidenceRefs;
  now?: string;
};

export type OutcomeBusinessLinkResponse = {
  linkId: string;
  now: string;
  strongestSignalKind: OutcomeSignalKind;
  linkedMetricIds: string[];
  summary: string;
  evidenceCoverage: {
    hasArtifact: boolean;
    hasResearchMission: boolean;
    hasReasoningRun: boolean;
  };
};

export const OutcomeRuntimeApi = {
  previewAcceptance: async (body: OutcomeAcceptancePreviewRequest): Promise<OutcomeAcceptancePreviewResponse> => {
    const res = await fetchWithRetry('/api/v10/outcome-runtime/acceptance/preview', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<OutcomeAcceptancePreviewResponse>(res, 'Failed to preview KPI acceptance');
  },

  ingestSignal: async (body: OutcomeSignalIngestRequest): Promise<OutcomeSignalIngestResponse> => {
    const res = await fetchWithRetry('/api/v10/outcome-runtime/signals/ingest', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<OutcomeSignalIngestResponse>(res, 'Failed to ingest outcome signal');
  },

  resolveAcceptance: async (body: OutcomeAcceptanceResolveRequest): Promise<OutcomeAcceptanceResolveResponse> => {
    const res = await fetchWithRetry('/api/v10/outcome-runtime/acceptance/resolve', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<OutcomeAcceptanceResolveResponse>(
      res,
      'Failed to resolve outcome acceptance contract'
    );
  },

  linkAnalysisToBusinessOutcome: async (body: OutcomeBusinessLinkRequest): Promise<OutcomeBusinessLinkResponse> => {
    const res = await fetchWithRetry('/api/v10/outcome-runtime/analysis/business-link', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return handleDataResponse<OutcomeBusinessLinkResponse>(res, 'Failed to link analysis to business effect');
  },
};
