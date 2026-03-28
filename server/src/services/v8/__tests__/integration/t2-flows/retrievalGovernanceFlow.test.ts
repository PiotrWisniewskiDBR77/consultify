import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScopeType } from '../../../../../types/contextSnapshot.js';
import type { RetrievalRequest, SensitivityLabel } from '../../../../../types/governedRetrieval.js';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import type { CandidateSource, SourceACLContext } from '../../../governedRetrievalService.js';
import {
  checkACL,
  checkFreshness,
  getTracesBySnapshot,
  logRetrievalTrace,
  runPipeline,
} from '../../../governedRetrievalService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '10000000-0000-4000-a000-000000000001';
const ORG_B_ID = '10000000-0000-4000-a000-000000000099';
const SNAPSHOT_ID = '10000000-0000-4000-a000-000000000010';
const REQUEST_ID = '10000000-0000-4000-a000-000000000030';

function makeRequest(overrides?: Partial<RetrievalRequest>): RetrievalRequest {
  return {
    requestId: REQUEST_ID,
    organizationId: ORG_ID,
    contextSnapshotId: SNAPSHOT_ID,
    retrievalScopeToken: null,
    consumerClass: 'chat',
    query: 'integration test query',
    searchPreset: 'workspace_broad',
    budgetHint: null,
    workingMemoryContextRef: null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSource(overrides?: Partial<CandidateSource>): CandidateSource {
  return {
    sourceRef: 'src-' + Math.random().toString(36).slice(2, 8),
    connectorId: 'conn-int-001',
    scopeType: 'organization' as ScopeType,
    sensitivityLabel: 'internal' as SensitivityLabel,
    freshnessAt: new Date().toISOString(),
    tenantId: ORG_ID,
    aclCheckedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSourceACL(overrides?: Partial<SourceACLContext>): SourceACLContext {
  return {
    sourceRef: 'src-acl-test',
    tenantId: ORG_ID,
    sensitivityLabel: 'internal',
    aclCheckedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ==========================================
// INTEGRATION FLOW TESTS
// ==========================================

describe('Wave 3/4 — Retrieval Governance Integration Proof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('F01: ACL enforcement blocks cross-tenant access', () => {
    it('denies retrieval when source belongs to a different tenant', async () => {
      const request = makeRequest();
      const foreignSource = makeSourceACL({ tenantId: ORG_B_ID });

      const result = await checkACL(request, foreignSource);

      expect(result.overallVerdict).toBe('denied');

      const tenantLayer = result.layers.find((l) => l.layer === 'tenant_boundary');
      expect(tenantLayer).toBeDefined();
      expect(tenantLayer?.verdict).toBe('denied');
      expect(tenantLayer?.denialReason).toBe('TENANT_BOUNDARY');
      expect(tenantLayer?.detail).toContain(ORG_B_ID);
      expect(tenantLayer?.detail).toContain(ORG_ID);
    });

    it('allows retrieval when source belongs to the same tenant', async () => {
      const request = makeRequest();
      const sameOrgSource = makeSourceACL({ tenantId: ORG_ID });

      const result = await checkACL(request, sameOrgSource);

      expect(result.overallVerdict).not.toBe('denied');
      const tenantLayer = result.layers.find((l) => l.layer === 'tenant_boundary');
      expect(tenantLayer?.verdict).toBe('allowed');
    });
  });

  describe('F02: Freshness runtime detects stale sources', () => {
    it('returns fresh for recently synced source', () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      expect(checkFreshness('src-f02-a', 'conn-001', thirtyMinAgo)).toBe('fresh');
    });

    it('returns drifted for source >1h old with connector', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(checkFreshness('src-f02-b', 'conn-001', twoHoursAgo)).toBe('drifted');
    });

    it('returns stale for source >24h old', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(checkFreshness('src-f02-c', 'conn-001', twoDaysAgo)).toBe('stale');
    });

    it('returns archived for source >7 days old', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      expect(checkFreshness('src-f02-d', 'conn-001', tenDaysAgo)).toBe('archived');
    });

    it('returns disconnected for null freshnessAt', () => {
      expect(checkFreshness('src-f02-e', 'conn-001', null)).toBe('disconnected');
    });
  });

  describe('F03: Pipeline filters candidates through all stages', () => {
    it('passes valid sources and denies foreign-tenant + archived sources', async () => {
      const request = makeRequest({ searchPreset: 'workspace_broad' });
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

      const sources: CandidateSource[] = [
        makeSource({ sourceRef: 'src-valid-1', scopeType: 'organization' }),
        makeSource({ sourceRef: 'src-valid-2', scopeType: 'system' }),
        makeSource({ sourceRef: 'src-foreign', tenantId: ORG_B_ID, scopeType: 'organization' }),
        makeSource({
          sourceRef: 'src-archived',
          freshnessAt: tenDaysAgo,
          scopeType: 'organization',
        }),
      ];

      const output = await runPipeline(request, sources);

      expect(output.stages).toHaveLength(7);
      expect(output.results).toHaveLength(2);
      expect(output.results.map((r) => r.sourceRef).sort()).toEqual(['src-valid-1', 'src-valid-2']);

      expect(output.denied.length).toBeGreaterThanOrEqual(2);

      const tenantDenied = output.denied.find((d) => d.sourceRef === 'src-foreign');
      expect(tenantDenied).toBeDefined();
      expect(tenantDenied?.denialReason).toBe('TENANT_BOUNDARY');

      const freshnessDenied = output.denied.find((d) => d.sourceRef === 'src-archived');
      expect(freshnessDenied).toBeDefined();
      expect(freshnessDenied?.denialReason).toBe('FRESHNESS_EXCLUDED');
      expect(freshnessDenied?.freshnessStateAtDenial).toBe('archived');
    });

    it('records correct before/after counts per stage', async () => {
      const request = makeRequest({ searchPreset: 'workspace_broad' });
      const sources: CandidateSource[] = [
        makeSource({ sourceRef: 'src-ok', scopeType: 'organization' }),
        makeSource({ sourceRef: 'src-bad', tenantId: ORG_B_ID, scopeType: 'organization' }),
      ];

      const output = await runPipeline(request, sources);

      const tenantStage = output.stages.find((s) => s.stage === 'tenant_filter')!;
      expect(tenantStage.candidatesBefore).toBe(2);
      expect(tenantStage.candidatesAfter).toBe(1);
      expect(tenantStage.deniedCount).toBe(1);
    });
  });

  describe('F04: Sensitivity ceiling enforced per preset', () => {
    it('cross_org_federated blocks confidential sources', async () => {
      const request = makeRequest({ searchPreset: 'cross_org_federated' });
      const source = makeSourceACL({ sensitivityLabel: 'confidential' });

      const result = await checkACL(request, source);

      expect(result.overallVerdict).toBe('denied');
      const sensitivityLayer = result.layers.find((l) => l.layer === 'scope_sensitivity');
      expect(sensitivityLayer?.verdict).toBe('denied');
      expect(sensitivityLayer?.denialReason).toBe('SENSITIVITY_BLOCKED');
    });

    it('cross_org_federated blocks internal sources', async () => {
      const request = makeRequest({ searchPreset: 'cross_org_federated' });
      const source = makeSourceACL({ sensitivityLabel: 'internal' });

      const result = await checkACL(request, source);

      expect(result.overallVerdict).toBe('denied');
      const sensitivityLayer = result.layers.find((l) => l.layer === 'scope_sensitivity');
      expect(sensitivityLayer?.denialReason).toBe('SENSITIVITY_BLOCKED');
    });

    it('cross_org_federated allows public sources', async () => {
      const request = makeRequest({ searchPreset: 'cross_org_federated' });
      const source = makeSourceACL({ sensitivityLabel: 'public' });

      const result = await checkACL(request, source);

      expect(result.overallVerdict).not.toBe('denied');
    });

    it('artifact_deep allows confidential sources', async () => {
      const request = makeRequest({ searchPreset: 'artifact_deep' });
      const source = makeSourceACL({
        sensitivityLabel: 'confidential',
        aclCheckedAt: new Date().toISOString(),
      });

      const result = await checkACL(request, source);

      expect(result.overallVerdict).toBe('allowed');
    });
  });

  describe('F05: Privacy mode blocks confidential', () => {
    it('denies confidential source when privacy mode is enabled', async () => {
      const request = makeRequest({
        searchPreset: 'artifact_deep',
        retrievalScopeToken: {
          organizationId: ORG_ID,
          effectiveScopeRef: 'org:' + ORG_ID,
          consumerClass: 'chat',
          privacyMode: true,
          sourceContextRefs: [],
        },
      });
      const source = makeSourceACL({ sensitivityLabel: 'confidential' });

      const result = await checkACL(request, source);

      expect(result.overallVerdict).toBe('denied');
      const sensitivityLayer = result.layers.find((l) => l.layer === 'scope_sensitivity');
      expect(sensitivityLayer?.denialReason).toBe('PRIVACY_MODE');
    });

    it('allows internal source when privacy mode is enabled', async () => {
      const request = makeRequest({
        searchPreset: 'artifact_deep',
        retrievalScopeToken: {
          organizationId: ORG_ID,
          effectiveScopeRef: 'org:' + ORG_ID,
          consumerClass: 'chat',
          privacyMode: true,
          sourceContextRefs: [],
        },
      });
      const source = makeSourceACL({
        sensitivityLabel: 'internal',
        aclCheckedAt: new Date().toISOString(),
      });

      const result = await checkACL(request, source);

      expect(result.overallVerdict).toBe('allowed');
    });

    it('pipeline denies confidential in privacy mode and keeps internal', async () => {
      const request = makeRequest({
        searchPreset: 'artifact_deep',
        retrievalScopeToken: {
          organizationId: ORG_ID,
          effectiveScopeRef: 'org:' + ORG_ID,
          consumerClass: 'chat',
          privacyMode: true,
          sourceContextRefs: [],
        },
      });

      const sources: CandidateSource[] = [
        makeSource({
          sourceRef: 'src-conf',
          sensitivityLabel: 'confidential',
          scopeType: 'organization',
        }),
        makeSource({
          sourceRef: 'src-int',
          sensitivityLabel: 'internal',
          scopeType: 'organization',
        }),
      ];

      const output = await runPipeline(request, sources);

      expect(output.results).toHaveLength(1);
      expect(output.results[0].sourceRef).toBe('src-int');

      const privacyDenied = output.denied.find((d) => d.denialReason === 'PRIVACY_MODE');
      expect(privacyDenied).toBeDefined();
      expect(privacyDenied?.sourceRef).toBe('src-conf');
    });
  });

  describe('F06: Scope traceability via snapshot', () => {
    it('logs a trace and queries it back by snapshot ID', async () => {
      const request = makeRequest();
      const traceParams = {
        requestId: request.requestId,
        organizationId: ORG_ID,
        snapshotId: SNAPSHOT_ID,
        consumerClass: 'chat' as const,
        presetUsed: 'workspace_broad' as const,
        scopeResolutionSummary: {
          tenantId: ORG_ID,
          projectId: null,
          scopeTypes: ['organization' as ScopeType],
          sensitivityCeiling: 'internal' as SensitivityLabel,
          privacyMode: false,
        },
        pipelineStages: [
          {
            stage: 'tenant_filter' as const,
            candidatesBefore: 5,
            candidatesAfter: 4,
            deniedCount: 1,
            durationMs: 2,
          },
        ],
        candidatesConsidered: 5,
        resultsReturned: 4,
        results: [],
        deniedEntries: [],
        freshnessWarnings: [],
        totalLatencyMs: 35,
      };

      const trace = await logRetrievalTrace(traceParams);

      expect(trace.traceId).toBeDefined();
      expect(trace.requestId).toBe(REQUEST_ID);
      expect(trace.snapshotId).toBe(SNAPSHOT_ID);
      expect(trace.organizationId).toBe(ORG_ID);

      expect(mockDbRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO v8_retrieval_traces'),
        expect.any(Array)
      );

      mockDbAll.mockResolvedValueOnce([
        {
          trace_id: trace.traceId,
          request_id: REQUEST_ID,
          organization_id: ORG_ID,
          snapshot_id: SNAPSHOT_ID,
          conversation_id: null,
          consumer_class: 'chat',
          preset_used: 'workspace_broad',
          scope_resolution_summary: JSON.stringify(traceParams.scopeResolutionSummary),
          pipeline_stages: JSON.stringify(traceParams.pipelineStages),
          candidates_considered: 5,
          results_returned: 4,
          results: '[]',
          denied_entries: '[]',
          freshness_warnings: '[]',
          total_latency_ms: 35,
          created_at: trace.createdAt,
        },
      ]);

      const traces = await getTracesBySnapshot(SNAPSHOT_ID, ORG_ID);

      expect(traces).toHaveLength(1);
      expect(traces[0].snapshotId).toBe(SNAPSHOT_ID);
      expect(traces[0].organizationId).toBe(ORG_ID);
      expect(traces[0].requestId).toBe(REQUEST_ID);

      const querySql = mockDbAll.mock.calls[0][0] as string;
      expect(querySql).toContain('snapshot_id');
      expect(querySql).toContain('organization_id');
    });
  });
});
