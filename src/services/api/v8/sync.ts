import { v8Get } from './client';

export interface V8SyncCredentialHealthSummary {
  total: number;
  healthy: number;
  failing: number;
  escalated: number;
}

export interface V8SyncAuthEscalation {
  escalationId: string;
  organizationId: string;
  connectorId: string;
  reason: string | null;
  escalatedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface V8SyncConflictRecord {
  conflictId: string;
  objectSyncStateId: string;
  organizationId: string;
  conflictClass: string;
  severity: string;
  resolutionPath: string | null;
  resolutionStrategy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

export const V8SyncApi = {
  getAuthHealth: () => v8Get<{ summary: V8SyncCredentialHealthSummary }>('/sync/auth/health'),
  getAuthEscalations: () =>
    v8Get<{ escalations: V8SyncAuthEscalation[]; count: number }>('/sync/auth/escalations'),
  getConflicts: (limit = 10) =>
    v8Get<{ conflicts: V8SyncConflictRecord[]; count: number }>('/sync/conflicts', {
      limit: String(limit),
    }),
};
