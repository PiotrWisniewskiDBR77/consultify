import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  CreateRetrievalRequestParams,
  LogRetrievalTraceParams,
  RetrievalRequest,
  ScopeResolutionSummary,
} from '../../../types/governedRetrieval.js';
import {
  ACLCheckResultSchema,
  BudgetHintSchema,
  CreateRetrievalRequestParamsSchema,
  DeniedEntrySchema,
  LogRetrievalTraceParamsSchema,
  PipelineStageTraceSchema,
  RetrievalResultSchema,
  ScopeResolutionSummarySchema,
} from '../../../types/governedRetrieval.js';

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
  createRetrievalRequest,
  getTracesByConversation,
  getTracesByRequest,
  logRetrievalTrace,
} from '../governedRetrievalService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const ORG_B_ID = '00000000-0000-4000-8000-000000000099';
const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000010';
const CONV_ID = '00000000-0000-4000-8000-000000000020';
const REQUEST_ID = '00000000-0000-4000-8000-000000000030';

function makeRequestParams(
  overrides?: Partial<CreateRetrievalRequestParams>
): CreateRetrievalRequestParams {
  return {
    organizationId: ORG_ID,
    contextSnapshotId: SNAPSHOT_ID,
    consumerClass: 'chat',
    query: 'How do I configure SSO?',
    searchPreset: 'workspace_broad',
    budgetHint: null,
    workingMemoryContextRef: null,
    ...overrides,
  };
}

function makeTraceParams(overrides?: Partial<LogRetrievalTraceParams>): LogRetrievalTraceParams {
  return {
    requestId: REQUEST_ID,
    organizationId: ORG_ID,
    snapshotId: SNAPSHOT_ID,
    conversationId: CONV_ID,
    consumerClass: 'chat',
    presetUsed: 'workspace_broad',
    scopeResolutionSummary: {
      tenantId: ORG_ID,
      projectId: null,
      scopeTypes: ['organization', 'system'],
      sensitivityCeiling: 'confidential',
      privacyMode: false,
    },
    pipelineStages: [
      {
        stage: 'tenant_filter',
        candidatesBefore: 100,
        candidatesAfter: 80,
        deniedCount: 20,
        durationMs: 5,
      },
      {
        stage: 'acl_filter',
        candidatesBefore: 80,
        candidatesAfter: 60,
        deniedCount: 20,
        durationMs: 12,
      },
    ],
    candidatesConsidered: 100,
    resultsReturned: 5,
    results: [],
    deniedEntries: [
      {
        sourceRef: 'src-blocked-1',
        connectorId: null,
        denialReason: 'TENANT_BOUNDARY',
        denialDetail: 'Source belongs to a different org',
        freshnessStateAtDenial: null,
        sensitivityLabel: null,
      },
    ],
    freshnessWarnings: ['connector-xyz: stale by 45 min'],
    totalLatencyMs: 120,
    ...overrides,
  };
}

function makeFakeTraceRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    trace_id: '00000000-0000-4000-8000-bbbbbbbbbbbb',
    request_id: REQUEST_ID,
    organization_id: ORG_ID,
    snapshot_id: SNAPSHOT_ID,
    conversation_id: CONV_ID,
    consumer_class: 'chat',
    preset_used: 'workspace_broad',
    scope_resolution_summary: JSON.stringify({
      tenantId: ORG_ID,
      projectId: null,
      scopeTypes: ['organization', 'system'],
      sensitivityCeiling: 'confidential',
      privacyMode: false,
    }),
    pipeline_stages: JSON.stringify([]),
    candidates_considered: 50,
    results_returned: 3,
    results: JSON.stringify([]),
    denied_entries: JSON.stringify([]),
    freshness_warnings: JSON.stringify([]),
    total_latency_ms: 95,
    created_at: '2026-03-23T10:00:00.000Z',
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
// createRetrievalRequest
// ------------------------------------------

describe('createRetrievalRequest', () => {
  it('creates a request with all required fields and persists it', async () => {
    const result = await createRetrievalRequest(makeRequestParams());

    expect(result.requestId).toBeDefined();
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.contextSnapshotId).toBe(SNAPSHOT_ID);
    expect(result.consumerClass).toBe('chat');
    expect(result.query).toBe('How do I configure SSO?');
    expect(result.searchPreset).toBe('workspace_broad');
    expect(result.status).toBe('pending');
    expect(result.budgetHint).toBeNull();
    expect(result.workingMemoryContextRef).toBeNull();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_retrieval_requests');
  });

  it('accepts a budget hint (Decision W2-7)', async () => {
    const result = await createRetrievalRequest(
      makeRequestParams({
        budgetHint: { maxLatencyMs: 500, maxResults: 10 },
      })
    );

    expect(result.budgetHint).toEqual({ maxLatencyMs: 500, maxResults: 10 });
  });

  it('accepts working_memory_context_ref (Decision W2-4)', async () => {
    const result = await createRetrievalRequest(
      makeRequestParams({
        workingMemoryContextRef: 'wm:session:abc123',
      })
    );

    expect(result.workingMemoryContextRef).toBe('wm:session:abc123');
  });

  it('accepts all four canonical search presets', async () => {
    for (const preset of [
      'workspace_broad',
      'project_focused',
      'artifact_deep',
      'cross_org_federated',
    ] as const) {
      const result = await createRetrievalRequest(makeRequestParams({ searchPreset: preset }));
      expect(result.searchPreset).toBe(preset);
    }
  });

  it('rejects interactive consumer without contextSnapshotId (Decision 2)', async () => {
    await expect(
      createRetrievalRequest(makeRequestParams({ consumerClass: 'chat', contextSnapshotId: null }))
    ).rejects.toThrow(ZodError);

    await expect(
      createRetrievalRequest(
        makeRequestParams({ consumerClass: 'execution', contextSnapshotId: null })
      )
    ).rejects.toThrow(ZodError);

    await expect(
      createRetrievalRequest(
        makeRequestParams({ consumerClass: 'worker', contextSnapshotId: null })
      )
    ).rejects.toThrow(ZodError);
  });

  it('allows background consumer with only a RetrievalScopeToken', async () => {
    const result = await createRetrievalRequest(
      makeRequestParams({
        consumerClass: 'background',
        contextSnapshotId: null,
        retrievalScopeToken: {
          organizationId: ORG_ID,
          effectiveScopeRef: 'org:' + ORG_ID,
          consumerClass: 'background',
          privacyMode: false,
          sourceContextRefs: [],
        },
      })
    );

    expect(result.consumerClass).toBe('background');
    expect(result.contextSnapshotId).toBeNull();
    expect(result.retrievalScopeToken).not.toBeNull();
  });

  it('rejects background consumer with neither snapshot nor scope token', async () => {
    await expect(
      createRetrievalRequest(
        makeRequestParams({
          consumerClass: 'background',
          contextSnapshotId: null,
          retrievalScopeToken: null,
        })
      )
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid search preset via Zod', async () => {
    await expect(
      createRetrievalRequest(makeRequestParams({ searchPreset: 'invalid_preset' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty query', async () => {
    await expect(createRetrievalRequest(makeRequestParams({ query: '' }))).rejects.toThrow(
      ZodError
    );
  });
});

// ------------------------------------------
// checkACL
// ------------------------------------------

describe('checkACL', () => {
  it('returns a 3-layer ACL check result structure', async () => {
    const request: RetrievalRequest = {
      requestId: REQUEST_ID,
      organizationId: ORG_ID,
      contextSnapshotId: SNAPSHOT_ID,
      retrievalScopeToken: null,
      consumerClass: 'chat',
      query: 'test',
      searchPreset: 'workspace_broad',
      budgetHint: null,
      workingMemoryContextRef: null,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const result = await checkACL(request);

    expect(result.overallVerdict).toBe('allowed');
    expect(result.layers).toHaveLength(3);
    expect(result.checkedAt).toBeDefined();

    const layerNames = result.layers.map((l) => l.layer);
    expect(layerNames).toContain('tenant_boundary');
    expect(layerNames).toContain('source_acl');
    expect(layerNames).toContain('scope_sensitivity');

    for (const layer of result.layers) {
      expect(layer.verdict).toBe('allowed');
      expect(layer.denialReason).toBeNull();
    }
  });

  it('ACL result validates against Zod schema', async () => {
    const request: RetrievalRequest = {
      requestId: REQUEST_ID,
      organizationId: ORG_ID,
      contextSnapshotId: SNAPSHOT_ID,
      retrievalScopeToken: null,
      consumerClass: 'execution',
      query: 'test',
      searchPreset: 'project_focused',
      budgetHint: null,
      workingMemoryContextRef: null,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const result = await checkACL(request);
    expect(() => ACLCheckResultSchema.parse(result)).not.toThrow();
  });
});

// ------------------------------------------
// logRetrievalTrace
// ------------------------------------------

describe('logRetrievalTrace', () => {
  it('creates and persists a trace with all fields', async () => {
    const trace = await logRetrievalTrace(makeTraceParams());

    expect(trace.traceId).toBeDefined();
    expect(trace.requestId).toBe(REQUEST_ID);
    expect(trace.organizationId).toBe(ORG_ID);
    expect(trace.snapshotId).toBe(SNAPSHOT_ID);
    expect(trace.conversationId).toBe(CONV_ID);
    expect(trace.consumerClass).toBe('chat');
    expect(trace.presetUsed).toBe('workspace_broad');
    expect(trace.candidatesConsidered).toBe(100);
    expect(trace.resultsReturned).toBe(5);
    expect(trace.pipelineStages).toHaveLength(2);
    expect(trace.deniedEntries).toHaveLength(1);
    expect(trace.deniedEntries[0].denialReason).toBe('TENANT_BOUNDARY');
    expect(trace.freshnessWarnings).toHaveLength(1);
    expect(trace.totalLatencyMs).toBe(120);

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_retrieval_traces');
  });

  it('records scope resolution summary correctly', async () => {
    const trace = await logRetrievalTrace(makeTraceParams());

    expect(trace.scopeResolutionSummary.tenantId).toBe(ORG_ID);
    expect(trace.scopeResolutionSummary.scopeTypes).toContain('organization');
    expect(trace.scopeResolutionSummary.sensitivityCeiling).toBe('confidential');
    expect(trace.scopeResolutionSummary.privacyMode).toBe(false);
  });

  it('rejects trace with invalid denial reason', async () => {
    await expect(
      logRetrievalTrace(
        makeTraceParams({
          deniedEntries: [
            {
              sourceRef: 'src-1',
              connectorId: null,
              denialReason: 'INVALID_REASON' as any,
              denialDetail: null,
              freshnessStateAtDenial: null,
              sensitivityLabel: null,
            },
          ],
        })
      )
    ).rejects.toThrow(ZodError);
  });

  it('rejects trace with invalid pipeline stage', async () => {
    await expect(
      logRetrievalTrace(
        makeTraceParams({
          pipelineStages: [
            {
              stage: 'nonexistent_stage' as any,
              candidatesBefore: 10,
              candidatesAfter: 5,
              deniedCount: 5,
              durationMs: 1,
            },
          ],
        })
      )
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// getTracesByRequest
// ------------------------------------------

describe('getTracesByRequest', () => {
  it('returns traces for a request with org isolation', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeTraceRow()]);

    const results = await getTracesByRequest(REQUEST_ID, ORG_ID);

    expect(results).toHaveLength(1);
    expect(results[0].requestId).toBe(REQUEST_ID);
    expect(results[0].organizationId).toBe(ORG_ID);

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('organization_id');
  });

  it('returns empty array when no traces exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getTracesByRequest('nonexistent', ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation — different org returns nothing', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getTracesByRequest(REQUEST_ID, ORG_B_ID);
    expect(results).toEqual([]);

    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[1]).toBe(ORG_B_ID);
  });
});

// ------------------------------------------
// getTracesByConversation
// ------------------------------------------

describe('getTracesByConversation', () => {
  it('returns traces for a conversation with org isolation', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeTraceRow({ created_at: '2026-03-23T10:00:00.000Z' }),
      makeFakeTraceRow({ trace_id: 'trace-2', created_at: '2026-03-23T11:00:00.000Z' }),
    ]);

    const results = await getTracesByConversation(CONV_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].conversationId).toBe(CONV_ID);

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('conversation_id');
    expect(sql).toContain('organization_id');
  });

  it('returns empty array when no traces exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getTracesByConversation(CONV_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// Zod schema validation (standalone)
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates BudgetHint', () => {
    expect(() => BudgetHintSchema.parse({ maxLatencyMs: 500 })).not.toThrow();
    expect(() => BudgetHintSchema.parse({ maxResults: 20, maxTokenBudget: 4000 })).not.toThrow();
    expect(() => BudgetHintSchema.parse({})).not.toThrow();
    expect(() => BudgetHintSchema.parse({ maxLatencyMs: -1 })).toThrow(ZodError);
  });

  it('validates DeniedEntry with all 9 denial reasons', () => {
    const reasons = [
      'TENANT_BOUNDARY',
      'ACL_DENIED',
      'SCOPE_MISMATCH',
      'SENSITIVITY_BLOCKED',
      'CONNECTOR_DISCONNECTED',
      'CONNECTOR_ARCHIVED',
      'FRESHNESS_EXCLUDED',
      'PRIVACY_MODE',
      'POLICY_BLOCKED',
    ] as const;

    for (const reason of reasons) {
      expect(() =>
        DeniedEntrySchema.parse({
          sourceRef: 'src-1',
          connectorId: null,
          denialReason: reason,
          denialDetail: null,
          freshnessStateAtDenial: null,
          sensitivityLabel: null,
        })
      ).not.toThrow();
    }
  });

  it('validates PipelineStageTrace for all 7 stages', () => {
    const stages = [
      'tenant_filter',
      'scope_type_filter',
      'acl_filter',
      'sensitivity_filter',
      'freshness_filter',
      'privacy_mode_filter',
      'connector_health_filter',
    ] as const;

    for (const stage of stages) {
      expect(() =>
        PipelineStageTraceSchema.parse({
          stage,
          candidatesBefore: 100,
          candidatesAfter: 80,
          deniedCount: 20,
          durationMs: 5,
        })
      ).not.toThrow();
    }
  });

  it('validates ScopeResolutionSummary', () => {
    const valid: ScopeResolutionSummary = {
      tenantId: ORG_ID,
      projectId: null,
      scopeTypes: ['organization', 'system'],
      sensitivityCeiling: 'confidential',
      privacyMode: false,
    };
    expect(() => ScopeResolutionSummarySchema.parse(valid)).not.toThrow();
  });

  it('validates RetrievalResult', () => {
    expect(() =>
      RetrievalResultSchema.parse({
        sourceRef: 'doc-123',
        connectorId: 'conn-abc',
        scopeType: 'organization',
        relevanceScore: 0.87,
        trustClass: 'verified',
        sensitivityLabel: 'internal',
        freshnessState: 'fresh',
        aclCheckResult: {
          overallVerdict: 'allowed',
          layers: [
            { layer: 'tenant_boundary', verdict: 'allowed', denialReason: null, detail: null },
            { layer: 'source_acl', verdict: 'allowed', denialReason: null, detail: null },
            { layer: 'scope_sensitivity', verdict: 'allowed', denialReason: null, detail: null },
          ],
          checkedAt: '2026-03-23T10:00:00.000Z',
          aclStalenessMs: null,
        },
        rankPosition: 0,
        citationBindingRef: null,
      })
    ).not.toThrow();
  });

  it('rejects RetrievalResult with relevanceScore > 1', () => {
    expect(() =>
      RetrievalResultSchema.parse({
        sourceRef: 'doc-123',
        connectorId: null,
        scopeType: 'organization',
        relevanceScore: 1.5,
        trustClass: 'verified',
        sensitivityLabel: 'internal',
        freshnessState: 'fresh',
        aclCheckResult: {
          overallVerdict: 'allowed',
          layers: [],
          checkedAt: '2026-03-23T10:00:00.000Z',
          aclStalenessMs: null,
        },
        rankPosition: 0,
        citationBindingRef: null,
      })
    ).toThrow(ZodError);
  });

  it('validates CreateRetrievalRequestParams — rejects invalid consumerClass', () => {
    expect(() =>
      CreateRetrievalRequestParamsSchema.parse({
        ...makeRequestParams(),
        consumerClass: 'invalid_class',
      })
    ).toThrow(ZodError);
  });

  it('validates LogRetrievalTraceParams', () => {
    expect(() => LogRetrievalTraceParamsSchema.parse(makeTraceParams())).not.toThrow();
  });
});
