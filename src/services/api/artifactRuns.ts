import { fetchWithRetry, getHeaders, handleResponse } from './baseClient';

export type ArtifactPlanOutputType = 'report' | 'presentation' | 'sheet';
export type ArtifactFamily = 'document' | 'presentation' | 'sheet';
export type ArtifactVisibilityScope =
  | 'private'
  | 'project'
  | 'organization'
  | 'review_shared'
  | 'demo';
export type ArtifactRunStatus =
  | 'planned'
  | 'proposal_created'
  | 'awaiting_review'
  | 'approved_for_apply'
  | 'applying'
  | 'rejected'
  | 'retry_requested'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ArtifactRunPreflightState = 'passed' | 'pending' | 'attention_required';

export interface ArtifactRunPreflight {
  state: ArtifactRunPreflightState;
  computedAt: string;
  checks: Array<{
    id:
      | 'execution_run_resolvable'
      | 'plan_supported'
      | 'materialization_inputs'
      | 'materialization_target';
    status: 'passed' | 'pending' | 'failed';
    message: string;
  }>;
}

export interface ArtifactRunFailurePackage {
  stage: 'preflight' | 'materialize' | 'retry';
  message: string;
  occurredAt: string;
  ghostArtifactsCleanedUp?: boolean;
  cleanupNotes?: string | null;
}

export interface ArtifactRunPlan {
  artifactFamily: ArtifactFamily;
  outputType: ArtifactPlanOutputType;
  titleHint: string;
  governancePath: 'execution_spine';
  visibilityScope: ArtifactVisibilityScope;
}

export interface ArtifactRunRecord {
  runId: string;
  artifactId: string | null;
  organizationId: string;
  executionRunId: string;
  contextSnapshotId: string;
  triggerType: 'chat' | 'module_action' | 'template' | 'refresh';
  sourceContextType: string | null;
  sourceContextId: string | null;
  requestedByUserId: string;
  plan: ArtifactRunPlan;
  runStatus: ArtifactRunStatus;
  proposalId: string | null;
  retryOfRunId: string | null;
  failureReason: string | null;
  preflight: ArtifactRunPreflight | null;
  failurePackage: ArtifactRunFailurePackage | null;
  materializationOrigin: {
    originRuntime:
      | 'report'
      | 'presentation'
      | 'sheet'
      | 'native_artifact'
      | 'report_template'
      | 'presentation_template';
    originRecordId: string;
  } | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactRunPlanningEnvelope {
  artifactRunId: string;
  executionRunId: string;
  artifactPlan: ArtifactRunPlan;
  run: ArtifactRunRecord;
}

export interface CreateArtifactRunFromChatParams {
  conversationId: string;
  contextSnapshotId: string;
  goal: string;
  requestedArtifactFamily?: ArtifactFamily;
  requestedOutputType?: ArtifactPlanOutputType;
}

export interface MaterializeArtifactRunParams {
  title?: string;
  description?: string;
  sourceType?: string;
  sourceId?: string;
  sourceName?: string;
  templateId?: string;
  config?: Record<string, unknown>;
}

const ARTIFACT_RUNS_BASE = '/api/artifact-runs';

export const ArtifactRunsApi = {
  createFromChat: async (
    params: CreateArtifactRunFromChatParams
  ): Promise<ArtifactRunPlanningEnvelope> => {
    const res = await fetchWithRetry(`${ARTIFACT_RUNS_BASE}/from-chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params),
      // Planning involves LLM + org-context snapshot; can exceed 20s default.
      timeoutMs: 120000,
    });
    const json = await handleResponse<{ data: ArtifactRunPlanningEnvelope }>(
      res,
      'Failed to create artifact run from chat'
    );
    return json.data;
  },

  getRun: async (runId: string): Promise<ArtifactRunRecord> => {
    const res = await fetchWithRetry(`${ARTIFACT_RUNS_BASE}/${encodeURIComponent(runId)}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const json = await handleResponse<{ data: ArtifactRunRecord }>(
      res,
      'Failed to fetch artifact run'
    );
    return json.data;
  },

  getHistory: async (runId: string): Promise<ArtifactRunRecord[]> => {
    const res = await fetchWithRetry(`${ARTIFACT_RUNS_BASE}/${encodeURIComponent(runId)}/history`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const json = await handleResponse<{ data: ArtifactRunRecord[] }>(
      res,
      'Failed to fetch artifact run history'
    );
    return json.data;
  },

  acceptPlan: async (runId: string): Promise<ArtifactRunRecord> => {
    const res = await fetchWithRetry(
      `${ARTIFACT_RUNS_BASE}/${encodeURIComponent(runId)}/accept-plan`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({}),
      }
    );
    const json = await handleResponse<{ data: ArtifactRunRecord }>(
      res,
      'Failed to accept artifact run plan'
    );
    return json.data;
  },

  materialize: async (
    runId: string,
    params: MaterializeArtifactRunParams
  ): Promise<ArtifactRunRecord> => {
    const res = await fetchWithRetry(
      `${ARTIFACT_RUNS_BASE}/${encodeURIComponent(runId)}/materialize`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(params),
        // Deck/report assembly + persist legitimately exceeds the 20s default.
        timeoutMs: 120000,
      }
    );
    const json = await handleResponse<{ data: ArtifactRunRecord }>(
      res,
      'Failed to materialize artifact run'
    );
    return json.data;
  },

  retry: async (runId: string): Promise<ArtifactRunRecord> => {
    const res = await fetchWithRetry(`${ARTIFACT_RUNS_BASE}/${encodeURIComponent(runId)}/retry`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({}),
    });
    const json = await handleResponse<{ data: ArtifactRunRecord }>(
      res,
      'Failed to retry artifact run'
    );
    return json.data;
  },

  preflight: async (runId: string): Promise<ArtifactRunRecord> => {
    const res = await fetchWithRetry(
      `${ARTIFACT_RUNS_BASE}/${encodeURIComponent(runId)}/preflight`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({}),
        // Preflight runs LLM generation per stage; can exceed 20s default.
        timeoutMs: 120000,
      }
    );
    const json = await handleResponse<{ data: ArtifactRunRecord }>(
      res,
      'Failed to preflight artifact run'
    );
    return json.data;
  },
};
