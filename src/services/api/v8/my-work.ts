import { v8Get, v8Post } from './client';

export type V8MyWorkRoofStatus = 'mixed_truth' | 'partially_coherent' | 'coherent';
export type V8MyWorkRoofMaturity =
  | 'backed_by_real_service'
  | 'partial_stitched'
  | 'placeholder_non_canonical';

export interface V8MyWorkRoofSummary {
  generatedAt: string;
  overallStatus: V8MyWorkRoofStatus;
  surfaceMode: string;
  contracts: {
    homeV2Endpoint: boolean;
    radarEndpoint: boolean;
    homeViewUsesAggregatedContract: boolean;
    outputsBridgeVisible: boolean;
  };
  homeBlocks: Array<{
    blockName: string;
    maturityLevel: V8MyWorkRoofMaturity;
    serviceRef: string | null;
    lastAuditedAt: string;
    source: 'persisted' | 'derived';
    rationale: string;
  }>;
  counts: Record<V8MyWorkRoofMaturity, number>;
  inboxMaterialization: {
    avgLatencyMs: number;
    latencyBandDistribution: {
      near_realtime: number;
      operational: number;
      degraded: number;
    };
    status: 'observed' | 'not_proven_yet';
  };
  calendar: Array<{
    phaseName: string;
    status: string;
    blockedBy: string | null;
    source: 'persisted' | 'derived';
    rationale: string;
  }>;
}

export interface V8CanonicalInboxStats {
  total: number;
  byPriority: Record<string, number>;
  bySection: Record<string, number>;
  byStatus: Record<string, number>;
  bySlaStatus: Record<string, number>;
}

export interface V8CanonicalInboxItem {
  id: string;
  userId: string;
  organizationId: string;
  itemType: 'task' | 'decision' | 'approval' | 'signal' | 'mention' | 'escalation';
  sourceEntityType: string;
  sourceEntityId: string;
  title: string;
  description?: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  section: string;
  status: 'pending' | 'triaged' | 'delegated' | 'resolved' | 'snoozed';
  slaDeadline?: string;
  slaStatus: 'on_track' | 'at_risk' | 'breached' | 'resolved';
  delegatedTo?: string;
  delegatedAt?: string;
  delegatedBy?: string;
  delegationNotes?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
}

export interface V8CanonicalInboxMaterializeResult {
  success: boolean;
  upserted?: number;
}

export interface V8CanonicalInboxTableParams {
  section?: string;
  status?: 'pending' | 'resolved' | 'snoozed';
  priority?: string;
  slaStatus?: string;
  limit?: number;
  offset?: number;
}

export const V8MyWorkApi = {
  getRoofSummary: () => v8Get<V8MyWorkRoofSummary>('/my-work/roof/summary'),
  getCanonicalInboxTable: (params?: V8CanonicalInboxTableParams) =>
    v8Get<{ items: V8CanonicalInboxItem[] }>(
      '/my-work/inbox/canonical',
      params
        ? Object.fromEntries(
            Object.entries(params).map(([key, value]) => [key, String(value)])
          )
        : undefined
    ),
  getCanonicalInboxStats: () => v8Get<V8CanonicalInboxStats>('/my-work/inbox/canonical/stats'),
  materializeCanonicalInbox: () =>
    v8Post<V8CanonicalInboxMaterializeResult>('/my-work/inbox/canonical/materialize'),
};
