import { v8Get } from './client';

export interface V8RetrievalTrace {
  traceId: string;
  requestId: string;
  organizationId: string;
  snapshotId: string | null;
  conversationId: string | null;
  consumerClass: string;
  presetUsed: string;
  scopeResolutionSummary: {
    tenantId: string;
    projectId: string | null;
    scopeTypes: string[];
    sensitivityCeiling: string;
    privacyMode: boolean;
  };
  pipelineStages: Array<{
    stage: string;
    candidatesBefore: number;
    candidatesAfter: number;
    deniedCount: number;
    durationMs: number;
  }>;
  candidatesConsidered: number;
  resultsReturned: number;
  results: Array<{ sourceRef: string; rankPosition: number }>;
  deniedEntries: Array<{ sourceRef: string; denialReason: string }>;
  freshnessWarnings: string[];
  totalLatencyMs: number;
  createdAt: string;
}

export const V8RetrievalApi = {
  getConversationTraces: (conversationId: string) =>
    v8Get<V8RetrievalTrace[]>(`/retrieval/conversations/${encodeURIComponent(conversationId)}/traces`),
};
