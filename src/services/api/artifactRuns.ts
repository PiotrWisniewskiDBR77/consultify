import { fetchWithRetry, getHeaders, handleResponse } from './baseClient';

export type ArtifactPlanOutputType = 'report' | 'presentation' | 'sheet';
export const ArtifactFamilyValues = ['document', 'presentation', 'sheet', 'template'] as const;
export type ArtifactFamily = (typeof ArtifactFamilyValues)[number];
export const ArtifactOriginRuntimeValues = [
  'report',
  'presentation',
  'sheet',
  'native_artifact',
  'report_template',
  'presentation_template',
  'sheet_template',
  'document_template',
  'work_canvas',
] as const;
export type ArtifactOriginRuntime = (typeof ArtifactOriginRuntimeValues)[number];
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

export interface ArtifactRunOperationContract {
  contractId: string;
  version: 'v1';
  kind: 'teresa_handoff' | 'governed_execution' | 'artifact_runtime' | 'tool_invocation';
  stage:
    | 'draft'
    | 'proposal_ready'
    | 'pending_review'
    | 'approved'
    | 'executing'
    | 'completed'
    | 'rejected'
    | 'failed';
  links: {
    organizationId: string;
    userId: string | null;
    conversationId: string | null;
    sessionId: string | null;
    contextSnapshotId: string | null;
    executionRunId: string | null;
    teresaProposalId: string | null;
    governedProposalId: string | null;
    chatProposalId: string | null;
    artifactRunId: string | null;
    artifactId: string | null;
    toolInvocationId: string | null;
    targetModule: string | null;
    targetRef: {
      artifactId: string;
      artifactType: string;
      artifactModule: string;
      relationship: 'target' | 'source' | 'reference';
    } | null;
  };
  preview: {
    title: string;
    summary: string;
    intent: string;
    previewLines: string[];
    riskLabel: string | null;
  };
  createdAt: string;
  updatedAt: string;
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
  persistedRunStatus: ArtifactRunStatus;
  effectiveRunStatus: ArtifactRunStatus;
  /** Backward-compatible alias of effectiveRunStatus. */
  runStatus: ArtifactRunStatus;
  proposalId: string | null;
  retryOfRunId: string | null;
  failureReason: string | null;
  preflight: ArtifactRunPreflight | null;
  failurePackage: ArtifactRunFailurePackage | null;
  materializationOrigin: {
    originRuntime: ArtifactOriginRuntime;
    originRecordId: string;
  } | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  operationContract?: ArtifactRunOperationContract;
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

/**
 * Compatibility-only normalization for payloads produced before explicit status fields.
 * The client never derives lifecycle state from Execution Spine; backend values are canonical.
 */
export function normalizeArtifactRunStatusFields(
  payload:
    | ArtifactRunRecord
    | (Omit<ArtifactRunRecord, 'persistedRunStatus' | 'effectiveRunStatus'> & {
        persistedRunStatus?: ArtifactRunStatus;
        effectiveRunStatus?: ArtifactRunStatus;
      })
): ArtifactRunRecord {
  const effectiveRunStatus = payload.effectiveRunStatus ?? payload.runStatus;
  const persistedRunStatus = payload.persistedRunStatus ?? payload.runStatus;
  return {
    ...payload,
    persistedRunStatus,
    effectiveRunStatus,
    runStatus: effectiveRunStatus,
  } as ArtifactRunRecord;
}

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
    return {
      ...json.data,
      run: normalizeArtifactRunStatusFields(json.data.run),
    };
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
    return normalizeArtifactRunStatusFields(json.data);
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
    return json.data.map(normalizeArtifactRunStatusFields);
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
    return normalizeArtifactRunStatusFields(json.data);
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
    return normalizeArtifactRunStatusFields(json.data);
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
    return normalizeArtifactRunStatusFields(json.data);
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
    return normalizeArtifactRunStatusFields(json.data);
  },
};
