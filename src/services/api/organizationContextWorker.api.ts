import { API_URL, getHeaders, handleResponse } from './baseClient';

export interface OrganizationContextProcessingJob {
  id: string;
  documentId: string;
  status: string;
  attemptCount: number;
  errorCode?: string | null;
  lockedBy?: string | null;
  createdAt: string;
}

export interface OrganizationContextProcessingQueueSummary {
  adapter: string;
  configuredBackend?: string;
  queueBackendReady?: boolean;
  queueBackendReason?: string | null;
  externalQueueName?: string | null;
  queueCanEnqueue?: boolean;
  queueCanConsumeLocally?: boolean;
  queueAdapterReason?: string | null;
  brokerDeploymentReady?: boolean;
  brokerDeploymentMissing?: string[];
  schedulerEnabled?: boolean;
  pendingCount: number;
  blockedCount: number;
  claimedCount?: number;
  staleClaimedCount?: number;
  oldestClaimedAt?: string | null;
  deadLetterCount?: number;
  latestDeadLetterAt?: string | null;
  staleLockMs?: number;
  leaseDurationMs?: number;
  asyncCutoverReady?: boolean;
  asyncCutoverBlockers?: string[];
  uploadProcessingMode?: 'inline_worker_boundary_v1' | 'async_worker_enqueued_v1';
  guardedAsyncUploadReady?: boolean;
  guardedAsyncUploadBlockers?: string[];
  guardedAsyncUploadSwitchPlan?: {
    defaultMode: 'inline_worker_boundary_v1';
    cutoverMode: 'async_worker_enqueued_v1';
    requiredEnv: string[];
    rollbackEnv: string;
  };
  asyncUploadReadBack?: {
    processingDocumentCount: number;
    oldestProcessingDocumentAt: string | null;
    queuedJobCount: number;
    retryScheduledJobCount: number;
    attentionRequired: boolean;
  };
  externalWorkerDeploymentVerified?: boolean;
  externalWorkerDeploymentMissing?: string[];
  externalWorkerDeploymentVerification?: {
    mode: 'not_required' | 'manual_release_gate_v1';
    healthUrlConfigured: boolean;
    deploymentMarkerPresent: boolean;
  };
  externalWorkerHealthProbe?: {
    status: 'not_required' | 'not_configured' | 'not_checked' | 'healthy' | 'unhealthy';
    checkedAt: string | null;
    reason: string | null;
  };
  locatorUpgradePlan?: {
    baselineReady: string[];
    remaining: string[];
  };
  generatedAt?: string;
}

export interface OrganizationContextWorkerJobOutcome {
  jobId: string;
  documentId: string;
}

export interface OrganizationContextWorkerRunResult {
  processed?: number;
  retried?: number;
  deadLettered?: number;
  recoveredLocks?: number;
  claimSkipped?: number;
  pulledMessages?: number;
  ackedMessages?: number;
  backoffMessages?: number;
  queueActionReason?: string | null;
  runId?: string | null;
  auditEventId?: string | null;
  auditRecorded?: boolean;
  processedJobs?: OrganizationContextWorkerJobOutcome[];
  retriedJobs?: OrganizationContextWorkerJobOutcome[];
  deadLetteredJobs?: OrganizationContextWorkerJobOutcome[];
  claimSkippedJobs?: OrganizationContextWorkerJobOutcome[];
}

export interface OrganizationContextQueueOutcomeEvent {
  id: string;
  targetType: string;
  targetId: string;
  workflow: string;
  eventType: string;
  selectedDocumentIds: string[];
  degraded: boolean;
  degradedReasons: string[];
  metadata: {
    pulledMessages?: number;
    ackedMessages?: number;
    backoffMessages?: number;
    queueActionReason?: string | null;
    processed?: number;
    retried?: number;
    deadLettered?: number;
    claimSkipped?: number;
    [key: string]: unknown;
  };
  createdAt: string;
}

export interface OrganizationContextWorkerRunHistoryEvent {
  id: string;
  runId: string;
  auditEventId: string;
  processed: number;
  retried: number;
  deadLettered: number;
  recoveredLocks: number;
  claimSkipped: number;
  pulledMessages: number;
  ackedMessages: number;
  backoffMessages: number;
  queueActionReason: string | null;
  createdAt: string;
}

export interface OrganizationContextApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export type OrganizationContextWorkerRunHistoryFilter = 'all' | 'attention' | 'backoff';

function parseRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || raw.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function normalizeRunHistoryEvent(
  raw: Record<string, unknown>
): OrganizationContextWorkerRunHistoryEvent {
  const details = parseRecord(raw.details);
  const result = parseRecord(details.result);
  const runId = String(details.runId || raw.resource_id || raw.resourceId || raw.id || '');
  return {
    id: String(raw.id || runId),
    runId,
    auditEventId: String(raw.id || ''),
    processed: Number(result.processed || 0),
    retried: Number(result.retried || 0),
    deadLettered: Number(result.deadLettered || 0),
    recoveredLocks: Number(result.recoveredLocks || 0),
    claimSkipped: Number(result.claimSkipped || 0),
    pulledMessages: Number(result.pulledMessages || 0),
    ackedMessages: Number(result.ackedMessages || 0),
    backoffMessages: Number(result.backoffMessages || 0),
    queueActionReason: result.queueActionReason ? String(result.queueActionReason) : null,
    createdAt: String(raw.created_at || raw.createdAt || ''),
  };
}

export const OrganizationContextWorkerApi = {
  getProcessingJobs: async (
    filters: { documentId?: string; status?: string; limit?: number } = {}
  ): Promise<OrganizationContextApiResponse<OrganizationContextProcessingJob[]>> => {
    const params = new URLSearchParams();
    if (filters.documentId) params.set('documentId', String(filters.documentId));
    if (filters.status) params.set('status', String(filters.status));
    if (filters.limit !== undefined) params.set('limit', String(filters.limit));
    const res = await fetch(
      `${API_URL}/audit-logs/organization-context/processing-jobs?${params.toString()}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to fetch organization context processing jobs');
  },

  getProcessingQueueSummary: async (): Promise<
    OrganizationContextApiResponse<OrganizationContextProcessingQueueSummary>
  > => {
    const res = await fetch(`${API_URL}/audit-logs/organization-context/processing-jobs/summary`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch organization context processing summary');
  },

  getQueueOutcomeLineage: async (
    filters: { limit?: number; eventType?: string } = {}
  ): Promise<OrganizationContextApiResponse<OrganizationContextQueueOutcomeEvent[]>> => {
    const params = new URLSearchParams();
    params.set('targetType', 'organization_context_worker');
    params.set('workflow', 'organization_context_external_queue');
    if (filters.eventType) params.set('eventType', filters.eventType);
    if (filters.limit !== undefined) params.set('limit', String(filters.limit));
    const res = await fetch(
      `${API_URL}/audit-logs/organization-context/lineage?${params.toString()}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to fetch organization context queue outcome audit');
  },

  getWorkerRunHistory: async (
    filters: { limit?: number; outcome?: OrganizationContextWorkerRunHistoryFilter } = {}
  ): Promise<OrganizationContextApiResponse<OrganizationContextWorkerRunHistoryEvent[]>> => {
    const params = new URLSearchParams();
    params.set('action', 'organization_context.worker_run_requested');
    params.set('resource', 'organization_context_processing_jobs');
    params.set('limit', String(filters.limit ?? 5));
    const res = await fetch(`${API_URL}/audit-logs?${params.toString()}`, {
      headers: getHeaders(),
    });
    const payload = await handleResponse<{
      data?: Record<string, unknown>[];
      pagination?: Record<string, unknown>;
    }>(res, 'Failed to fetch organization context worker run history');
    const data = Array.isArray(payload?.data) ? payload.data.map(normalizeRunHistoryEvent) : [];
    const filteredData = data.filter((event) => {
      if (!filters.outcome || filters.outcome === 'all') return true;
      if (filters.outcome === 'attention') {
        return Boolean(event.queueActionReason) || Number(event.backoffMessages || 0) > 0;
      }
      return Number(event.backoffMessages || 0) > 0;
    });
    return {
      data: filteredData,
      meta: payload?.pagination ? { pagination: payload.pagination } : undefined,
    };
  },

  runWorkerOnce: async (
    payload: { limit?: number } = {}
  ): Promise<OrganizationContextApiResponse<OrganizationContextWorkerRunResult>> => {
    const res = await fetch(
      `${API_URL}/audit-logs/organization-context/processing-jobs/run-worker`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          confirmation: 'run_context_worker_once',
          limit: payload.limit ?? 5,
        }),
      }
    );
    return handleResponse(res, 'Failed to run organization context worker');
  },

  requeueProcessingJob: async (
    jobId: string
  ): Promise<OrganizationContextApiResponse<Record<string, unknown>>> => {
    const res = await fetch(
      `${API_URL}/audit-logs/organization-context/processing-jobs/${encodeURIComponent(
        jobId
      )}/requeue`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          confirmation: 'requeue_context_processing_job',
        }),
      }
    );
    return handleResponse(res, 'Failed to requeue organization context processing job');
  },

  recoverStaleLocks: async (
    payload: { staleLockMs?: number } = {}
  ): Promise<OrganizationContextApiResponse<{ recoveredLocks: number; staleLockMs?: number }>> => {
    const res = await fetch(
      `${API_URL}/audit-logs/organization-context/processing-jobs/recover-stale-locks`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          confirmation: 'recover_context_stale_locks',
          staleLockMs: payload.staleLockMs,
        }),
      }
    );
    return handleResponse(res, 'Failed to recover organization context stale locks');
  },
};
