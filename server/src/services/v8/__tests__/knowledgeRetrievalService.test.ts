import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  CreateWorkingMemoryEntryParams,
  MemoryType,
  OrchestrateRetrievalParams,
  RequestMemoryPromotionParams,
} from '../../../types/knowledgeRetrievalIntegration.js';
import {
  CreateWorkingMemoryEntryParamsSchema,
  MemoryFreshnessCheckSchema,
  MemoryPromotionRequestSchema,
  OrchestrateRetrievalParamsSchema,
  RequestMemoryPromotionParamsSchema,
  WorkingMemoryEntrySchema,
  WorkingMemoryOrchestrationResultSchema,
} from '../../../types/knowledgeRetrievalIntegration.js';

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
  checkMemoryFreshness,
  createWorkingMemoryEntry,
  getWorkingMemory,
  orchestrateRetrieval,
  requestMemoryPromotion,
  resolveMemoryPromotion,
} from '../knowledgeRetrievalService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const ORG_B_ID = '00000000-0000-4000-8000-000000000099';
const CONV_ID = '00000000-0000-4000-8000-000000000020';
const SNAPSHOT_ID = '00000000-0000-4000-8000-000000000010';
const ENTRY_ID = '00000000-0000-4000-8000-000000000040';
const PROMO_ID = '00000000-0000-4000-8000-000000000050';

function makeEntryParams(
  overrides?: Partial<CreateWorkingMemoryEntryParams>
): CreateWorkingMemoryEntryParams {
  return {
    conversationId: CONV_ID,
    organizationId: ORG_ID,
    memoryType: 'session',
    content: 'User asked about SSO configuration',
    sourceRef: null,
    expiresAt: null,
    ...overrides,
  };
}

function makePromotionParams(
  overrides?: Partial<RequestMemoryPromotionParams>
): RequestMemoryPromotionParams {
  return {
    organizationId: ORG_ID,
    sourceEntryId: ENTRY_ID,
    targetMemoryType: 'user_private_durable',
    provenanceRef: 'prov:run:abc123',
    requestedBy: 'user:admin',
    ...overrides,
  };
}

function makeOrchestrateParams(
  overrides?: Partial<OrchestrateRetrievalParams>
): OrchestrateRetrievalParams {
  return {
    organizationId: ORG_ID,
    conversationId: CONV_ID,
    contextSnapshotId: SNAPSHOT_ID,
    consumerClass: 'chat',
    query: 'How do I configure SSO?',
    searchPreset: 'workspace_broad',
    budgetHint: null,
    workingMemoryContextRef: null,
    ...overrides,
  };
}

function makeFakeMemoryRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    entry_id: ENTRY_ID,
    conversation_id: CONV_ID,
    organization_id: ORG_ID,
    memory_type: 'session',
    content: 'User asked about SSO configuration',
    source_ref: null,
    created_at: new Date().toISOString(),
    expires_at: null,
    ...overrides,
  };
}

function makeFakePromotionRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    request_id: PROMO_ID,
    organization_id: ORG_ID,
    source_entry_id: ENTRY_ID,
    target_memory_type: 'user_private_durable',
    promotion_status: 'pending',
    provenance_ref: 'prov:run:abc123',
    requested_by: 'user:admin',
    resolved_by: null,
    resolved_at: null,
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
// createWorkingMemoryEntry
// ------------------------------------------

describe('createWorkingMemoryEntry', () => {
  it('creates an entry with all required fields and persists it', async () => {
    const result = await createWorkingMemoryEntry(makeEntryParams());

    expect(result.entryId).toBeDefined();
    expect(result.conversationId).toBe(CONV_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.memoryType).toBe('session');
    expect(result.content).toBe('User asked about SSO configuration');
    expect(result.sourceRef).toBeNull();
    expect(result.expiresAt).toBeNull();
    expect(result.createdAt).toBeDefined();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_working_memory_entries');
  });

  it('accepts all four memory types', async () => {
    const types: MemoryType[] = [
      'ephemeral',
      'session',
      'user_private_durable',
      'organization_durable',
    ];
    for (const memoryType of types) {
      vi.clearAllMocks();
      const result = await createWorkingMemoryEntry(makeEntryParams({ memoryType }));
      expect(result.memoryType).toBe(memoryType);
    }
  });

  it('stores sourceRef when provided', async () => {
    const result = await createWorkingMemoryEntry(
      makeEntryParams({ sourceRef: 'retrieval:trace:xyz' })
    );
    expect(result.sourceRef).toBe('retrieval:trace:xyz');
  });

  it('stores expiresAt for ephemeral entries', async () => {
    const expires = new Date(Date.now() + 3600_000).toISOString();
    const result = await createWorkingMemoryEntry(
      makeEntryParams({ memoryType: 'ephemeral', expiresAt: expires })
    );
    expect(result.expiresAt).toBe(expires);
  });

  it('rejects empty content', async () => {
    await expect(createWorkingMemoryEntry(makeEntryParams({ content: '' }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects invalid memory type', async () => {
    await expect(
      createWorkingMemoryEntry(makeEntryParams({ memoryType: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid organizationId', async () => {
    await expect(
      createWorkingMemoryEntry(makeEntryParams({ organizationId: 'not-a-uuid' }))
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// getWorkingMemory
// ------------------------------------------

describe('getWorkingMemory', () => {
  it('returns active entries for a conversation with org isolation', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeMemoryRow()]);

    const results = await getWorkingMemory(CONV_ID, ORG_ID);

    expect(results).toHaveLength(1);
    expect(results[0].conversationId).toBe(CONV_ID);
    expect(results[0].organizationId).toBe(ORG_ID);

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('conversation_id');
    expect(sql).toContain('organization_id');
    expect(sql).toContain('expires_at');
  });

  it('returns empty array when no entries exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getWorkingMemory(CONV_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation — different org returns nothing', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getWorkingMemory(CONV_ID, ORG_B_ID);
    expect(results).toEqual([]);

    const params = mockDbAll.mock.calls[0][1] as string[];
    expect(params[1]).toBe(ORG_B_ID);
  });
});

// ------------------------------------------
// orchestrateRetrieval
// ------------------------------------------

describe('orchestrateRetrieval', () => {
  it('combines governed retrieval + working memory into a unified result', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeMemoryRow()]);

    const result = await orchestrateRetrieval(makeOrchestrateParams());

    expect(result.requestId).toBeDefined();
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.workingMemoryResults).toHaveLength(1);
    expect(result.mergedTrustClass).toBeDefined();
    expect(result.budgetUsed).toBeDefined();

    expect(mockDbRun).toHaveBeenCalled();
    const insertCalls = mockDbRun.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' &&
        (call[0] as string).includes('INSERT INTO v8_retrieval_requests')
    );
    expect(insertCalls.length).toBe(1);
  });

  it('passes budget hint to governed retrieval (Decision W2-7)', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const result = await orchestrateRetrieval(
      makeOrchestrateParams({
        budgetHint: { maxResults: 5, maxTokenBudget: 2000 },
      })
    );

    expect(result.budgetUsed).toEqual({ maxResults: 5, maxTokenBudget: 2000 });
  });

  it('generates working_memory_context_ref when entries exist (Decision W2-4)', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeMemoryRow(), makeFakeMemoryRow()]);

    await orchestrateRetrieval(makeOrchestrateParams());

    const retrievalInsert = mockDbRun.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        (call[0] as string).includes('INSERT INTO v8_retrieval_requests')
    );
    expect(retrievalInsert).toBeDefined();
    const insertParams = retrievalInsert![1] as (string | null)[];
    const wmContextRefIndex = 8;
    expect(insertParams[wmContextRefIndex]).toContain('wm:');
  });

  it('rejects invalid consumer class', async () => {
    await expect(
      orchestrateRetrieval(makeOrchestrateParams({ consumerClass: 'worker' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty query', async () => {
    await expect(orchestrateRetrieval(makeOrchestrateParams({ query: '' }))).rejects.toThrow(
      ZodError
    );
  });
});

// ------------------------------------------
// requestMemoryPromotion (Decision W2-6)
// ------------------------------------------

describe('requestMemoryPromotion', () => {
  it('creates a governed promotion request with pending status', async () => {
    const result = await requestMemoryPromotion(makePromotionParams());

    expect(result.requestId).toBeDefined();
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.sourceEntryId).toBe(ENTRY_ID);
    expect(result.targetMemoryType).toBe('user_private_durable');
    expect(result.promotionStatus).toBe('pending');
    expect(result.provenanceRef).toBe('prov:run:abc123');
    expect(result.requestedBy).toBe('user:admin');
    expect(result.resolvedBy).toBeNull();
    expect(result.resolvedAt).toBeNull();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_memory_promotion_requests');
  });

  it('requires provenance ref — not silent promotion (Decision W2-6)', async () => {
    await expect(
      requestMemoryPromotion(makePromotionParams({ provenanceRef: '' }))
    ).rejects.toThrow(ZodError);
  });

  it('requires requestedBy', async () => {
    await expect(requestMemoryPromotion(makePromotionParams({ requestedBy: '' }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects invalid target memory type', async () => {
    await expect(
      requestMemoryPromotion(makePromotionParams({ targetMemoryType: 'archived' as any }))
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// resolveMemoryPromotion
// ------------------------------------------

describe('resolveMemoryPromotion', () => {
  it('approves a pending promotion request', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakePromotionRow());

    const result = await resolveMemoryPromotion(PROMO_ID, 'approved', 'admin:reviewer');

    expect(result.promotionStatus).toBe('approved');
    expect(result.resolvedBy).toBe('admin:reviewer');
    expect(result.resolvedAt).toBeDefined();

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE v8_memory_promotion_requests');
  });

  it('rejects a pending promotion request', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakePromotionRow());

    const result = await resolveMemoryPromotion(PROMO_ID, 'rejected', 'admin:reviewer');

    expect(result.promotionStatus).toBe('rejected');
    expect(result.resolvedBy).toBe('admin:reviewer');
  });

  it('throws when request not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(resolveMemoryPromotion('nonexistent', 'approved', 'admin')).rejects.toThrow(
      'not found'
    );
  });

  it('throws when request already resolved', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakePromotionRow({ promotion_status: 'approved' }));

    await expect(resolveMemoryPromotion(PROMO_ID, 'rejected', 'admin')).rejects.toThrow(
      'already resolved'
    );
  });
});

// ------------------------------------------
// checkMemoryFreshness (Decision W2-5)
// ------------------------------------------

describe('checkMemoryFreshness', () => {
  it('returns inherently_fresh for ephemeral memory', async () => {
    const result = await checkMemoryFreshness('ephemeral', ORG_ID);

    expect(result.memoryType).toBe('ephemeral');
    expect(result.freshnessPolicy).toBe('inherently_fresh');
    expect(result.isStale).toBe(false);
    expect(result.lastCheckedAt).toBeDefined();
    expect(result.organizationId).toBe(ORG_ID);
  });

  it('returns inherently_fresh for session memory', async () => {
    const result = await checkMemoryFreshness('session', ORG_ID);

    expect(result.freshnessPolicy).toBe('inherently_fresh');
    expect(result.isStale).toBe(false);
  });

  it('returns check_on_read for user_private_durable memory', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeMemoryRow({
        memory_type: 'user_private_durable',
        created_at: new Date().toISOString(),
      })
    );

    const result = await checkMemoryFreshness('user_private_durable', ORG_ID);

    expect(result.freshnessPolicy).toBe('check_on_read');
    expect(result.isStale).toBe(false);
  });

  it('marks user_private_durable as stale when old', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    mockDbGet.mockResolvedValueOnce(
      makeFakeMemoryRow({
        memory_type: 'user_private_durable',
        created_at: twoHoursAgo,
      })
    );

    const result = await checkMemoryFreshness('user_private_durable', ORG_ID);

    expect(result.isStale).toBe(true);
  });

  it('returns periodic_reindex for organization_durable memory', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeMemoryRow({
        memory_type: 'organization_durable',
        created_at: new Date().toISOString(),
      })
    );

    const result = await checkMemoryFreshness('organization_durable', ORG_ID);

    expect(result.freshnessPolicy).toBe('periodic_reindex');
    expect(result.isStale).toBe(false);
  });

  it('marks organization_durable as stale when old', async () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    mockDbGet.mockResolvedValueOnce(
      makeFakeMemoryRow({
        memory_type: 'organization_durable',
        created_at: fiveHoursAgo,
      })
    );

    const result = await checkMemoryFreshness('organization_durable', ORG_ID);

    expect(result.isStale).toBe(true);
  });

  it('uses different freshness policies for internal vs connector-backed (Decision W2-5)', async () => {
    const ephResult = await checkMemoryFreshness('ephemeral', ORG_ID);
    expect(ephResult.freshnessPolicy).toBe('inherently_fresh');

    mockDbGet.mockResolvedValueOnce(makeFakeMemoryRow({ created_at: new Date().toISOString() }));
    const durableResult = await checkMemoryFreshness('organization_durable', ORG_ID);
    expect(durableResult.freshnessPolicy).toBe('periodic_reindex');

    expect(ephResult.freshnessPolicy).not.toBe(durableResult.freshnessPolicy);
  });
});

// ------------------------------------------
// Zod schema validation (standalone)
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates WorkingMemoryEntry', () => {
    expect(() =>
      WorkingMemoryEntrySchema.parse({
        entryId: ENTRY_ID,
        conversationId: CONV_ID,
        organizationId: ORG_ID,
        memoryType: 'session',
        content: 'test content',
        sourceRef: null,
        createdAt: '2026-03-23T10:00:00.000Z',
        expiresAt: null,
      })
    ).not.toThrow();
  });

  it('validates all four memory types', () => {
    for (const memoryType of [
      'ephemeral',
      'session',
      'user_private_durable',
      'organization_durable',
    ] as const) {
      expect(() =>
        CreateWorkingMemoryEntryParamsSchema.parse({
          ...makeEntryParams(),
          memoryType,
        })
      ).not.toThrow();
    }
  });

  it('validates MemoryPromotionRequest', () => {
    expect(() =>
      MemoryPromotionRequestSchema.parse({
        requestId: PROMO_ID,
        organizationId: ORG_ID,
        sourceEntryId: ENTRY_ID,
        targetMemoryType: 'user_private_durable',
        promotionStatus: 'pending',
        provenanceRef: 'prov:run:abc',
        requestedBy: 'user:admin',
        resolvedBy: null,
        resolvedAt: null,
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates all three promotion statuses', () => {
    for (const status of ['pending', 'approved', 'rejected'] as const) {
      expect(() =>
        MemoryPromotionRequestSchema.parse({
          requestId: PROMO_ID,
          organizationId: ORG_ID,
          sourceEntryId: ENTRY_ID,
          targetMemoryType: 'organization_durable',
          promotionStatus: status,
          provenanceRef: 'prov:ref',
          requestedBy: 'user:admin',
          resolvedBy: status !== 'pending' ? 'admin' : null,
          resolvedAt: status !== 'pending' ? '2026-03-23T11:00:00.000Z' : null,
          createdAt: '2026-03-23T10:00:00.000Z',
        })
      ).not.toThrow();
    }
  });

  it('validates MemoryFreshnessCheck', () => {
    expect(() =>
      MemoryFreshnessCheckSchema.parse({
        memoryType: 'session',
        organizationId: ORG_ID,
        freshnessPolicy: 'inherently_fresh',
        lastCheckedAt: '2026-03-23T10:00:00.000Z',
        isStale: false,
      })
    ).not.toThrow();
  });

  it('validates all three freshness policies', () => {
    for (const policy of ['inherently_fresh', 'check_on_read', 'periodic_reindex'] as const) {
      expect(() =>
        MemoryFreshnessCheckSchema.parse({
          memoryType: 'session',
          organizationId: ORG_ID,
          freshnessPolicy: policy,
          lastCheckedAt: '2026-03-23T10:00:00.000Z',
          isStale: false,
        })
      ).not.toThrow();
    }
  });

  it('validates OrchestrateRetrievalParams', () => {
    expect(() => OrchestrateRetrievalParamsSchema.parse(makeOrchestrateParams())).not.toThrow();
  });

  it('rejects OrchestrateRetrievalParams with invalid consumer class', () => {
    expect(() =>
      OrchestrateRetrievalParamsSchema.parse({
        ...makeOrchestrateParams(),
        consumerClass: 'background',
      })
    ).toThrow(ZodError);
  });

  it('rejects RequestMemoryPromotionParams with empty provenanceRef', () => {
    expect(() =>
      RequestMemoryPromotionParamsSchema.parse({
        ...makePromotionParams(),
        provenanceRef: '',
      })
    ).toThrow(ZodError);
  });
});
