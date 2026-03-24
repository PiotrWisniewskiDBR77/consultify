import { describe, expect, it, vi, beforeEach } from 'vitest';

import type {
  RetrievalRequest,
  SensitivityLabel,
} from '../../../types/governedRetrieval.js';
import type { ScopeType } from '../../../types/contextSnapshot.js';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  checkACL,
  checkFreshness,
  runPipeline,
  buildScopeResolution,
  getTracesBySnapshot,
  getRequestsByOrg,
} from '../governedRetrievalService.js';
import type { SourceACLContext, CandidateSource } from '../governedRetrievalService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-a000-000000000001';
const ORG_B_ID = '00000000-0000-4000-a000-000000000099';
const SNAPSHOT_ID = '00000000-0000-4000-a000-000000000010';
const REQUEST_ID = '00000000-0000-4000-a000-000000000030';

function makeRequest(overrides?: Partial<RetrievalRequest>): RetrievalRequest {
  return {
    requestId: REQUEST_ID,
    organizationId: ORG_ID,
    contextSnapshotId: SNAPSHOT_ID,
    retrievalScopeToken: null,
    consumerClass: 'chat',
    query: 'test query',
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
    connectorId: 'conn-001',
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
    sourceRef: 'src-test',
    tenantId: ORG_ID,
    sensitivityLabel: 'internal',
    aclCheckedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ------------------------------------------
// checkACL — real enforcement
// ------------------------------------------

describe('checkACL', () => {
  it('denies with TENANT_BOUNDARY when source tenant differs from request org', async () => {
    const request = makeRequest();
    const source = makeSourceACL({ tenantId: ORG_B_ID });

    const result = await checkACL(request, source);

    expect(result.overallVerdict).toBe('denied');
    const tenantLayer = result.layers.find((l) => l.layer === 'tenant_boundary');
    expect(tenantLayer?.verdict).toBe('denied');
    expect(tenantLayer?.denialReason).toBe('TENANT_BOUNDARY');
  });

  it('denies with SENSITIVITY_BLOCKED when source sensitivity exceeds preset ceiling', async () => {
    const request = makeRequest({ searchPreset: 'cross_org_federated' });
    const source = makeSourceACL({ sensitivityLabel: 'internal' });

    const result = await checkACL(request, source);

    expect(result.overallVerdict).toBe('denied');
    const sensitivityLayer = result.layers.find((l) => l.layer === 'scope_sensitivity');
    expect(sensitivityLayer?.verdict).toBe('denied');
    expect(sensitivityLayer?.denialReason).toBe('SENSITIVITY_BLOCKED');
  });

  it('denies with PRIVACY_MODE when privacy mode blocks confidential source', async () => {
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

  it('returns degraded verdict when ACL data is staler than window', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const request = makeRequest({ searchPreset: 'artifact_deep' });
    const source = makeSourceACL({
      sensitivityLabel: 'confidential',
      aclCheckedAt: twoHoursAgo,
    });

    const result = await checkACL(request, source);

    expect(result.overallVerdict).toBe('degraded');
    const aclLayer = result.layers.find((l) => l.layer === 'source_acl');
    expect(aclLayer?.verdict).toBe('degraded');
    expect(result.aclStalenessMs).toBeGreaterThan(3_600_000);
  });

  it('returns allowed when all layers pass', async () => {
    const request = makeRequest({ searchPreset: 'artifact_deep' });
    const source = makeSourceACL({
      sensitivityLabel: 'confidential',
      aclCheckedAt: new Date().toISOString(),
    });

    const result = await checkACL(request, source);

    expect(result.overallVerdict).toBe('allowed');
    expect(result.layers).toHaveLength(3);
    for (const layer of result.layers) {
      expect(layer.verdict).toBe('allowed');
      expect(layer.denialReason).toBeNull();
    }
  });

  it('returns allowed with no source context (backward compat)', async () => {
    const request = makeRequest();
    const result = await checkACL(request);

    expect(result.overallVerdict).toBe('allowed');
    expect(result.layers).toHaveLength(3);
  });
});

// ------------------------------------------
// checkFreshness
// ------------------------------------------

describe('checkFreshness', () => {
  it('returns disconnected when freshnessAt is null', () => {
    expect(checkFreshness('src-1', 'conn-1', null)).toBe('disconnected');
  });

  it('returns archived when age > 7 days', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(checkFreshness('src-1', 'conn-1', eightDaysAgo)).toBe('archived');
  });

  it('returns stale when age > 24 hours but <= 7 days', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(checkFreshness('src-1', 'conn-1', twoDaysAgo)).toBe('stale');
  });

  it('returns drifted when age > 1 hour and connectorId is not null', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(checkFreshness('src-1', 'conn-1', twoHoursAgo)).toBe('drifted');
  });

  it('returns fresh when age > 1 hour but connectorId is null', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(checkFreshness('src-1', null, twoHoursAgo)).toBe('fresh');
  });

  it('returns fresh when age <= 1 hour', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(checkFreshness('src-1', 'conn-1', thirtyMinAgo)).toBe('fresh');
  });
});

// ------------------------------------------
// runPipeline
// ------------------------------------------

describe('runPipeline', () => {
  it('filters candidates through all 7 stages', async () => {
    const request = makeRequest({ searchPreset: 'workspace_broad' });
    const sources: CandidateSource[] = [
      makeSource({ sourceRef: 'src-ok', scopeType: 'organization', sensitivityLabel: 'internal' }),
      makeSource({ sourceRef: 'src-ok-2', scopeType: 'system', sensitivityLabel: 'public' }),
    ];

    const output = await runPipeline(request, sources);

    expect(output.stages).toHaveLength(7);
    expect(output.results).toHaveLength(2);
    expect(output.denied).toHaveLength(0);

    const stageNames = output.stages.map((s) => s.stage);
    expect(stageNames).toEqual([
      'tenant_filter',
      'scope_type_filter',
      'acl_filter',
      'sensitivity_filter',
      'freshness_filter',
      'privacy_mode_filter',
      'connector_health_filter',
    ]);
  });

  it('records denied entries with correct reasons for tenant boundary', async () => {
    const request = makeRequest();
    const sources: CandidateSource[] = [
      makeSource({ sourceRef: 'src-foreign', tenantId: ORG_B_ID, scopeType: 'organization' }),
      makeSource({ sourceRef: 'src-ok', scopeType: 'organization' }),
    ];

    const output = await runPipeline(request, sources);

    expect(output.results).toHaveLength(1);
    expect(output.results[0].sourceRef).toBe('src-ok');
    expect(output.denied).toHaveLength(1);
    expect(output.denied[0].sourceRef).toBe('src-foreign');
    expect(output.denied[0].denialReason).toBe('TENANT_BOUNDARY');
  });

  it('records denied entries for sensitivity blocked', async () => {
    const request = makeRequest({ searchPreset: 'cross_org_federated' });
    const sources: CandidateSource[] = [
      makeSource({
        sourceRef: 'src-secret',
        sensitivityLabel: 'confidential',
        scopeType: 'external',
      }),
      makeSource({
        sourceRef: 'src-pub',
        sensitivityLabel: 'public',
        scopeType: 'external',
      }),
    ];

    const output = await runPipeline(request, sources);

    expect(output.results).toHaveLength(1);
    expect(output.results[0].sourceRef).toBe('src-pub');
    const sensitivityDenied = output.denied.find((d) => d.denialReason === 'SENSITIVITY_BLOCKED');
    expect(sensitivityDenied).toBeDefined();
    expect(sensitivityDenied?.sourceRef).toBe('src-secret');
  });

  it('records denied entries for archived freshness', async () => {
    const request = makeRequest({ searchPreset: 'workspace_broad' });
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const sources: CandidateSource[] = [
      makeSource({ sourceRef: 'src-old', freshnessAt: tenDaysAgo, scopeType: 'organization' }),
      makeSource({ sourceRef: 'src-fresh', scopeType: 'organization' }),
    ];

    const output = await runPipeline(request, sources);

    expect(output.results).toHaveLength(1);
    expect(output.results[0].sourceRef).toBe('src-fresh');
    const freshnessDenied = output.denied.find((d) => d.denialReason === 'FRESHNESS_EXCLUDED');
    expect(freshnessDenied).toBeDefined();
    expect(freshnessDenied?.freshnessStateAtDenial).toBe('archived');
  });

  it('records denied entries for privacy mode blocking confidential', async () => {
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

  it('records denied entries for disconnected connectors', async () => {
    const request = makeRequest({ searchPreset: 'workspace_broad' });
    const sources: CandidateSource[] = [
      makeSource({ sourceRef: 'src-disc', freshnessAt: null, scopeType: 'organization' }),
      makeSource({ sourceRef: 'src-ok', scopeType: 'organization' }),
    ];

    const output = await runPipeline(request, sources);

    expect(output.results).toHaveLength(1);
    expect(output.results[0].sourceRef).toBe('src-ok');
    const connDenied = output.denied.find((d) => d.denialReason === 'CONNECTOR_DISCONNECTED');
    expect(connDenied).toBeDefined();
    expect(connDenied?.sourceRef).toBe('src-disc');
  });

  it('pipeline stage traces record correct before/after counts', async () => {
    const request = makeRequest({ searchPreset: 'workspace_broad' });
    const sources: CandidateSource[] = [
      makeSource({ sourceRef: 'src-1', tenantId: ORG_B_ID, scopeType: 'organization' }),
      makeSource({ sourceRef: 'src-2', scopeType: 'organization' }),
      makeSource({ sourceRef: 'src-3', scopeType: 'organization' }),
    ];

    const output = await runPipeline(request, sources);

    const tenantStage = output.stages.find((s) => s.stage === 'tenant_filter')!;
    expect(tenantStage.candidatesBefore).toBe(3);
    expect(tenantStage.candidatesAfter).toBe(2);
    expect(tenantStage.deniedCount).toBe(1);
  });
});

// ------------------------------------------
// buildScopeResolution
// ------------------------------------------

describe('buildScopeResolution', () => {
  it('builds correct summary for workspace_broad preset', () => {
    const request = makeRequest({ searchPreset: 'workspace_broad' });
    const summary = buildScopeResolution(request);

    expect(summary.tenantId).toBe(ORG_ID);
    expect(summary.projectId).toBeNull();
    expect(summary.scopeTypes).toContain('organization');
    expect(summary.scopeTypes).toContain('system');
    expect(summary.scopeTypes).toContain('external');
    expect(summary.sensitivityCeiling).toBe('internal');
    expect(summary.privacyMode).toBe(false);
  });

  it('builds correct summary for artifact_deep preset', () => {
    const request = makeRequest({ searchPreset: 'artifact_deep' });
    const summary = buildScopeResolution(request);

    expect(summary.sensitivityCeiling).toBe('confidential');
    expect(summary.scopeTypes).toContain('session');
    expect(summary.scopeTypes).toContain('user_private');
  });

  it('builds correct summary for cross_org_federated preset', () => {
    const request = makeRequest({ searchPreset: 'cross_org_federated' });
    const summary = buildScopeResolution(request);

    expect(summary.sensitivityCeiling).toBe('public');
    expect(summary.scopeTypes).toEqual(['external']);
  });

  it('reflects privacy mode from retrieval scope token', () => {
    const request = makeRequest({
      retrievalScopeToken: {
        organizationId: ORG_ID,
        effectiveScopeRef: 'org:' + ORG_ID,
        consumerClass: 'chat',
        privacyMode: true,
        sourceContextRefs: [],
      },
    });
    const summary = buildScopeResolution(request);
    expect(summary.privacyMode).toBe(true);
  });
});

// ------------------------------------------
// getTracesBySnapshot
// ------------------------------------------

describe('getTracesBySnapshot', () => {
  it('returns traces for a snapshot with org isolation', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        trace_id: '00000000-0000-4000-a000-aaaaaaaaaaaa',
        request_id: REQUEST_ID,
        organization_id: ORG_ID,
        snapshot_id: SNAPSHOT_ID,
        conversation_id: null,
        consumer_class: 'chat',
        preset_used: 'workspace_broad',
        scope_resolution_summary: JSON.stringify({
          tenantId: ORG_ID,
          projectId: null,
          scopeTypes: ['organization'],
          sensitivityCeiling: 'internal',
          privacyMode: false,
        }),
        pipeline_stages: JSON.stringify([]),
        candidates_considered: 20,
        results_returned: 5,
        results: JSON.stringify([]),
        denied_entries: JSON.stringify([]),
        freshness_warnings: JSON.stringify([]),
        total_latency_ms: 50,
        created_at: '2026-03-23T10:00:00.000Z',
      },
    ]);

    const results = await getTracesBySnapshot(SNAPSHOT_ID, ORG_ID);

    expect(results).toHaveLength(1);
    expect(results[0].snapshotId).toBe(SNAPSHOT_ID);
    expect(results[0].organizationId).toBe(ORG_ID);

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('snapshot_id');
    expect(sql).toContain('organization_id');
  });

  it('returns empty array when no traces exist for snapshot', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getTracesBySnapshot('00000000-0000-4000-a000-ffffffffffff', ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// getRequestsByOrg
// ------------------------------------------

describe('getRequestsByOrg', () => {
  it('returns requests ordered by date desc', async () => {
    mockDbAll.mockResolvedValueOnce([
      {
        request_id: '00000000-0000-4000-a000-000000000031',
        organization_id: ORG_ID,
        context_snapshot_id: SNAPSHOT_ID,
        retrieval_scope_token: null,
        consumer_class: 'chat',
        query: 'newest',
        search_preset: 'workspace_broad',
        budget_hint: null,
        working_memory_context_ref: null,
        status: 'completed',
        created_at: '2026-03-23T12:00:00.000Z',
      },
      {
        request_id: '00000000-0000-4000-a000-000000000032',
        organization_id: ORG_ID,
        context_snapshot_id: SNAPSHOT_ID,
        retrieval_scope_token: null,
        consumer_class: 'chat',
        query: 'older',
        search_preset: 'workspace_broad',
        budget_hint: null,
        working_memory_context_ref: null,
        status: 'completed',
        created_at: '2026-03-23T10:00:00.000Z',
      },
    ]);

    const results = await getRequestsByOrg(ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].query).toBe('newest');
    expect(results[1].query).toBe('older');

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('ORDER BY created_at DESC');
    expect(sql).toContain('LIMIT');
  });

  it('respects custom limit parameter', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getRequestsByOrg(ORG_ID, 10);

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params[1]).toBe(10);
  });

  it('returns empty array when no requests exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getRequestsByOrg(ORG_B_ID);
    expect(results).toEqual([]);
  });
});
