import { fetchWithRetry, getHeaders, handleResponse } from './baseClient';

export type ExecutionRunState =
  | 'drafting'
  | 'planning'
  | 'proposals_ready'
  | 'waiting_for_review'
  | 'approved_for_apply'
  | 'rejected'
  | 'applying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

export type ExecutionProposalStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'policy_allowed';

export interface ExecutionRunRecord {
  runId: string;
  organizationId: string;
  contextSnapshotId: string;
  initiatorUserId: string;
  state: ExecutionRunState;
  planVersion: number;
  goal: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  expiresAt: string | null;
  metadata?: Record<string, unknown>;
}

export interface ExecutionProposalRecord {
  proposalId: string;
  executionRunId: string;
  contextSnapshotRef: string;
  proposalType: string;
  summary: string;
  reason: string;
  riskClass: string;
  approvalClass: string;
  status: ExecutionProposalStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface ExecutionTransitionRecord {
  transitionId: string;
  runId: string;
  fromState: ExecutionRunState;
  toState: ExecutionRunState;
  triggeredBy: string;
  reason: string | null;
  transitionedAt: string;
}

const V8_EXECUTION_BASE = '/api/v8/execution';

export const V8ExecutionApi = {
  getRun: async (runId: string): Promise<ExecutionRunRecord> => {
    const res = await fetchWithRetry(`${V8_EXECUTION_BASE}/runs/${encodeURIComponent(runId)}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const json = await handleResponse<{ data: ExecutionRunRecord }>(
      res,
      'Failed to fetch governed execution run'
    );
    return json.data;
  },

  getRunProposals: async (runId: string): Promise<ExecutionProposalRecord[]> => {
    const res = await fetchWithRetry(
      `${V8_EXECUTION_BASE}/runs/${encodeURIComponent(runId)}/proposals`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );
    const json = await handleResponse<{ data: ExecutionProposalRecord[] }>(
      res,
      'Failed to fetch governed execution proposals'
    );
    return json.data;
  },

  getRunTransitions: async (runId: string): Promise<ExecutionTransitionRecord[]> => {
    const res = await fetchWithRetry(
      `${V8_EXECUTION_BASE}/runs/${encodeURIComponent(runId)}/transitions`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );
    const json = await handleResponse<{ data: ExecutionTransitionRecord[] }>(
      res,
      'Failed to fetch governed execution transitions'
    );
    return json.data;
  },

  submitReview: async (runId: string): Promise<ExecutionRunRecord> => {
    const res = await fetchWithRetry(
      `${V8_EXECUTION_BASE}/runs/${encodeURIComponent(runId)}/submit-review`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({}),
      }
    );
    const json = await handleResponse<{ data: ExecutionRunRecord }>(
      res,
      'Failed to submit governed execution review'
    );
    return json.data;
  },

  approveRun: async (runId: string, reason?: string): Promise<ExecutionRunRecord> => {
    const res = await fetchWithRetry(
      `${V8_EXECUTION_BASE}/runs/${encodeURIComponent(runId)}/approve`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(reason ? { reason } : {}),
      }
    );
    const json = await handleResponse<{ data: ExecutionRunRecord }>(
      res,
      'Failed to approve governed execution run'
    );
    return json.data;
  },

  rejectRun: async (runId: string, reason: string): Promise<ExecutionRunRecord> => {
    const res = await fetchWithRetry(
      `${V8_EXECUTION_BASE}/runs/${encodeURIComponent(runId)}/reject`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason }),
      }
    );
    const json = await handleResponse<{ data: ExecutionRunRecord }>(
      res,
      'Failed to reject governed execution run'
    );
    return json.data;
  },
};
