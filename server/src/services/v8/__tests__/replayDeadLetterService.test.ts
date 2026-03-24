import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ZodError } from 'zod';

import type {
  CreateDeadLetterRecordParams,
  SetRetryPolicyParams,
  RequestReplayParams,
  RecordProviderHealthParams,
  RecordSchemaDriftParams,
} from '../../../types/replayDeadLetterReliability.js';
import {
  ErrorClassValues,
  ReplayEligibilityValues,
  ResolutionStateValues,
  BackoffFamilyValues,
  ReplayTypeValues,
  ReplayStatusValues,
  HealthStatusValues,
  DriftTypeValues,
  DeadLetterRecordSchema,
  RetryPolicySchema,
  ReplayRequestSchema,
  ProviderHealthModelSchema,
  SchemaDriftEventSchema,
  CreateDeadLetterRecordParamsSchema,
  SetRetryPolicyParamsSchema,
  RequestReplayParamsSchema,
  RecordProviderHealthParamsSchema,
  RecordSchemaDriftParamsSchema,
  DEAD_LETTER_RETENTION_DAYS,
} from '../../../types/replayDeadLetterReliability.js';

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
  createDeadLetterRecord,
  getDeadLetterQueue,
  updateDeadLetterResolution,
  setRetryPolicy,
  getRetryPolicy,
  requestReplay,
  getReplayRequests,
  recordProviderHealth,
  getProviderHealth,
  recordSchemaDrift,
  getRetentionCutoffDate,
  getExpiredResolvedRecords,
} from '../replayDeadLetterService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const ORG_ID_2 = '00000000-0000-4000-8000-000000000099';
const CONNECTOR_ID = 'jira-connector-1';
const DL_ID = '00000000-0000-4000-8000-dddddddddd01';
const USER_ID = 'operator-1';

function makeDeadLetterParams(overrides?: Partial<CreateDeadLetterRecordParams>): CreateDeadLetterRecordParams {
  return {
    originalJobRef: 'job-ref-001',
    originalPayloadRef: 'payload-ref-001',
    eventName: 'connector.sync.failed',
    connectorId: CONNECTOR_ID,
    organizationId: ORG_ID,
    providerKey: 'jira',
    objectType: 'Task',
    objectRef: 'TASK-123',
    reason: 'Provider returned 401 Unauthorized',
    errorClass: 'auth_failure',
    replayEligibility: 'requires_fix',
    retryCount: 3,
    lastAttemptAt: '2026-03-23T10:00:00.000Z',
    correlationId: 'corr-001',
    operatorNote: null,
    ...overrides,
  };
}

function makeRetryPolicyParams(overrides?: Partial<SetRetryPolicyParams>): SetRetryPolicyParams {
  return {
    connectorFamily: 'jira',
    organizationId: ORG_ID,
    maxAttemptClasses: {
      auth_failure: 1,
      provider_outage: 5,
      rate_limited: 8,
      target_not_found: 3,
    },
    backoffFamily: 'exponential',
    jitterEnabled: true,
    escalationHandoff: 'ops-team',
    ...overrides,
  };
}

function makeReplayParams(overrides?: Partial<RequestReplayParams>): RequestReplayParams {
  return {
    deadLetterId: DL_ID,
    organizationId: ORG_ID,
    replayType: 'single',
    requestedBy: USER_ID,
    safeguards: null,
    ...overrides,
  };
}

function makeHealthParams(overrides?: Partial<RecordProviderHealthParams>): RecordProviderHealthParams {
  return {
    providerKey: 'jira',
    organizationId: ORG_ID,
    authHealth: 'healthy',
    transportHealth: 'healthy',
    schemaHealth: 'healthy',
    syncFreshness: 'healthy',
    replayPressure: 'healthy',
    deadLetterPressure: 'healthy',
    overallHealth: 'healthy',
    ...overrides,
  };
}

function makeDriftParams(overrides?: Partial<RecordSchemaDriftParams>): RecordSchemaDriftParams {
  return {
    connectorId: CONNECTOR_ID,
    organizationId: ORG_ID,
    driftType: 'field_added',
    affectedFields: ['summary', 'priority'],
    ...overrides,
  };
}

function makeDeadLetterRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    dead_letter_id: DL_ID,
    original_job_ref: 'job-ref-001',
    original_payload_ref: 'payload-ref-001',
    event_name: 'connector.sync.failed',
    connector_id: CONNECTOR_ID,
    organization_id: ORG_ID,
    provider_key: 'jira',
    object_type: 'Task',
    object_ref: 'TASK-123',
    reason: 'Provider returned 401 Unauthorized',
    error_class: 'auth_failure',
    replay_eligibility: 'requires_fix',
    retry_count: 3,
    last_attempt_at: '2026-03-23T10:00:00.000Z',
    dead_lettered_at: '2026-03-23T10:05:00.000Z',
    correlation_id: 'corr-001',
    operator_note: null,
    resolution_state: 'pending_review',
    created_at: '2026-03-23T10:05:00.000Z',
    updated_at: '2026-03-23T10:05:00.000Z',
    ...overrides,
  };
}

function makeRetryPolicyRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    policy_id: '00000000-0000-4000-8000-eeeeeeeeee01',
    connector_family: 'jira',
    organization_id: ORG_ID,
    max_attempt_classes: JSON.stringify({ auth_failure: 1, provider_outage: 5 }),
    backoff_family: 'exponential',
    jitter_enabled: 1,
    escalation_handoff: 'ops-team',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeReplayRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    replay_id: '00000000-0000-4000-8000-ffffff000001',
    dead_letter_id: DL_ID,
    organization_id: ORG_ID,
    replay_type: 'single',
    requested_by: USER_ID,
    status: 'pending',
    safeguards: null,
    created_at: '2026-03-23T11:00:00.000Z',
    updated_at: '2026-03-23T11:00:00.000Z',
    ...overrides,
  };
}

function makeHealthRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    health_id: '00000000-0000-4000-8000-aaaaaa000001',
    provider_key: 'jira',
    organization_id: ORG_ID,
    auth_health: 'healthy',
    transport_health: 'healthy',
    schema_health: 'healthy',
    sync_freshness: 'healthy',
    replay_pressure: 'healthy',
    dead_letter_pressure: 'healthy',
    overall_health: 'healthy',
    last_checked_at: '2026-03-23T10:00:00.000Z',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeDriftRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    event_id: '00000000-0000-4000-8000-bbbbbb000001',
    connector_id: CONNECTOR_ID,
    organization_id: ORG_ID,
    drift_type: 'field_added',
    affected_fields: JSON.stringify(['summary', 'priority']),
    detected_at: '2026-03-23T10:00:00.000Z',
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
// DEAD-LETTER CRUD
// ------------------------------------------

describe('createDeadLetterRecord', () => {
  it('creates a dead-letter record with pending_review state', async () => {
    const result = await createDeadLetterRecord(makeDeadLetterParams());

    expect(result.deadLetterId).toBeDefined();
    expect(result.errorClass).toBe('auth_failure');
    expect(result.replayEligibility).toBe('requires_fix');
    expect(result.resolutionState).toBe('pending_review');
    expect(result.retryCount).toBe(3);
    expect(result.organizationId).toBe(ORG_ID);
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('stores original payload ref for forensic inspection', async () => {
    const result = await createDeadLetterRecord(
      makeDeadLetterParams({ originalPayloadRef: 'blob-ref-xyz' }),
    );
    expect(result.originalPayloadRef).toBe('blob-ref-xyz');
  });

  it('allows null original payload ref', async () => {
    const result = await createDeadLetterRecord(
      makeDeadLetterParams({ originalPayloadRef: null }),
    );
    expect(result.originalPayloadRef).toBeNull();
  });

  it('preserves correlation chain', async () => {
    const result = await createDeadLetterRecord(
      makeDeadLetterParams({ correlationId: 'chain-abc-123' }),
    );
    expect(result.correlationId).toBe('chain-abc-123');
  });

  it('supports all 7 error classes', () => {
    for (const ec of ErrorClassValues) {
      expect(() =>
        CreateDeadLetterRecordParamsSchema.parse(makeDeadLetterParams({ errorClass: ec })),
      ).not.toThrow();
    }
  });

  it('supports all 3 replay eligibility values', () => {
    for (const re of ReplayEligibilityValues) {
      expect(() =>
        CreateDeadLetterRecordParamsSchema.parse(makeDeadLetterParams({ replayEligibility: re })),
      ).not.toThrow();
    }
  });

  it('rejects invalid error class via Zod', () => {
    expect(() =>
      CreateDeadLetterRecordParamsSchema.parse(
        makeDeadLetterParams({ errorClass: 'invalid_class' as any }),
      ),
    ).toThrow(ZodError);
  });

  it('rejects empty reason via Zod', () => {
    expect(() =>
      CreateDeadLetterRecordParamsSchema.parse(makeDeadLetterParams({ reason: '' })),
    ).toThrow(ZodError);
  });

  it('rejects negative retry count via Zod', () => {
    expect(() =>
      CreateDeadLetterRecordParamsSchema.parse(makeDeadLetterParams({ retryCount: -1 })),
    ).toThrow(ZodError);
  });
});

describe('getDeadLetterQueue', () => {
  it('returns dead-letter records for a connector', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeDeadLetterRow(),
      makeDeadLetterRow({
        dead_letter_id: 'dl-002',
        error_class: 'rate_limited',
        replay_eligibility: 'eligible',
      }),
    ]);

    const results = await getDeadLetterQueue(CONNECTOR_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].errorClass).toBe('auth_failure');
    expect(results[1].errorClass).toBe('rate_limited');
  });

  it('returns empty array when no dead-letter records exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getDeadLetterQueue(CONNECTOR_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('queries with connector and org filter', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getDeadLetterQueue(CONNECTOR_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('connector_id');
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(CONNECTOR_ID);
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });
});

// ------------------------------------------
// RESOLUTION STATE TRANSITIONS
// ------------------------------------------

describe('updateDeadLetterResolution', () => {
  it('transitions pending_review → replayed', async () => {
    mockDbGet.mockResolvedValueOnce(makeDeadLetterRow());

    const result = await updateDeadLetterResolution(DL_ID, 'replayed');

    expect(result.resolutionState).toBe('replayed');
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('transitions pending_review → dismissed', async () => {
    mockDbGet.mockResolvedValueOnce(makeDeadLetterRow());

    const result = await updateDeadLetterResolution(DL_ID, 'dismissed');
    expect(result.resolutionState).toBe('dismissed');
  });

  it('transitions pending_review → escalated', async () => {
    mockDbGet.mockResolvedValueOnce(makeDeadLetterRow());

    const result = await updateDeadLetterResolution(DL_ID, 'escalated', 'Needs L2 review');
    expect(result.resolutionState).toBe('escalated');
    expect(result.operatorNote).toBe('Needs L2 review');
  });

  it('transitions pending_review → remapped', async () => {
    mockDbGet.mockResolvedValueOnce(makeDeadLetterRow());

    const result = await updateDeadLetterResolution(DL_ID, 'remapped');
    expect(result.resolutionState).toBe('remapped');
  });

  it('transitions escalated → replayed', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeDeadLetterRow({ resolution_state: 'escalated' }),
    );

    const result = await updateDeadLetterResolution(DL_ID, 'replayed');
    expect(result.resolutionState).toBe('replayed');
  });

  it('transitions escalated → dismissed', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeDeadLetterRow({ resolution_state: 'escalated' }),
    );

    const result = await updateDeadLetterResolution(DL_ID, 'dismissed');
    expect(result.resolutionState).toBe('dismissed');
  });

  it('rejects replayed → pending_review (terminal state)', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeDeadLetterRow({ resolution_state: 'replayed' }),
    );

    await expect(
      updateDeadLetterResolution(DL_ID, 'pending_review'),
    ).rejects.toThrow('Invalid resolution transition');
  });

  it('rejects dismissed → replayed (terminal state)', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeDeadLetterRow({ resolution_state: 'dismissed' }),
    );

    await expect(
      updateDeadLetterResolution(DL_ID, 'replayed'),
    ).rejects.toThrow('Invalid resolution transition');
  });

  it('rejects remapped → escalated (terminal state)', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeDeadLetterRow({ resolution_state: 'remapped' }),
    );

    await expect(
      updateDeadLetterResolution(DL_ID, 'escalated'),
    ).rejects.toThrow('Invalid resolution transition');
  });

  it('throws when dead-letter record not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      updateDeadLetterResolution('nonexistent', 'replayed'),
    ).rejects.toThrow('not found');
  });

  it('preserves existing operator note when no new note provided', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeDeadLetterRow({ operator_note: 'existing note' }),
    );

    const result = await updateDeadLetterResolution(DL_ID, 'dismissed');
    expect(result.operatorNote).toBe('existing note');
  });
});

// ------------------------------------------
// RETRY POLICIES (Decision W5-5)
// ------------------------------------------

describe('setRetryPolicy', () => {
  it('creates a new retry policy', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await setRetryPolicy(makeRetryPolicyParams());

    expect(result.policyId).toBeDefined();
    expect(result.connectorFamily).toBe('jira');
    expect(result.backoffFamily).toBe('exponential');
    expect(result.jitterEnabled).toBe(true);
    expect(result.maxAttemptClasses).toHaveProperty('auth_failure');
    expect(result.maxAttemptClasses).toHaveProperty('provider_outage');
    expect(result.escalationHandoff).toBe('ops-team');
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('updates an existing retry policy', async () => {
    mockDbGet.mockResolvedValueOnce(makeRetryPolicyRow());

    const result = await setRetryPolicy(
      makeRetryPolicyParams({ backoffFamily: 'linear', jitterEnabled: false }),
    );

    expect(result.backoffFamily).toBe('linear');
    expect(result.jitterEnabled).toBe(false);
    expect(result.policyId).toBe('00000000-0000-4000-8000-eeeeeeeeee01');
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE');
  });

  it('supports all 3 backoff families', () => {
    for (const bf of BackoffFamilyValues) {
      expect(() =>
        SetRetryPolicyParamsSchema.parse(makeRetryPolicyParams({ backoffFamily: bf })),
      ).not.toThrow();
    }
  });

  it('validates max attempt classes have positive values', () => {
    expect(() =>
      SetRetryPolicyParamsSchema.parse(
        makeRetryPolicyParams({ maxAttemptClasses: { auth_failure: 0 } }),
      ),
    ).toThrow(ZodError);
  });

  it('rejects invalid backoff family via Zod', () => {
    expect(() =>
      SetRetryPolicyParamsSchema.parse(
        makeRetryPolicyParams({ backoffFamily: 'quadratic' as any }),
      ),
    ).toThrow(ZodError);
  });

  it('allows null escalation handoff', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await setRetryPolicy(
      makeRetryPolicyParams({ escalationHandoff: null }),
    );
    expect(result.escalationHandoff).toBeNull();
  });
});

describe('getRetryPolicy', () => {
  it('returns a retry policy with parsed JSON fields', async () => {
    mockDbGet.mockResolvedValueOnce(makeRetryPolicyRow());

    const result = await getRetryPolicy('jira', ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.connectorFamily).toBe('jira');
    expect(result!.maxAttemptClasses).toHaveProperty('auth_failure');
    expect(result!.jitterEnabled).toBe(true);
  });

  it('returns null when no policy exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getRetryPolicy('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });
});

// ------------------------------------------
// REPLAY REQUESTS (Decision W5-7)
// ------------------------------------------

describe('requestReplay', () => {
  it('creates a single replay request', async () => {
    mockDbGet.mockResolvedValueOnce(makeDeadLetterRow({ replay_eligibility: 'eligible' }));

    const result = await requestReplay(makeReplayParams());

    expect(result.replayId).toBeDefined();
    expect(result.replayType).toBe('single');
    expect(result.status).toBe('pending');
    expect(result.safeguards).toBeNull();
    expect(result.requestedBy).toBe(USER_ID);
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('creates a bulk replay with safeguards', async () => {
    mockDbGet.mockResolvedValueOnce(makeDeadLetterRow({ replay_eligibility: 'eligible' }));

    const safeguards = {
      scopeFilter: { errorClass: 'provider_outage' },
      previewCount: 50,
      rateLimit: 10,
      requireConfirmation: true,
    };

    const result = await requestReplay(
      makeReplayParams({ replayType: 'bulk', safeguards }),
    );

    expect(result.replayType).toBe('bulk');
    expect(result.safeguards).not.toBeNull();
    expect(result.safeguards!.previewCount).toBe(50);
    expect(result.safeguards!.rateLimit).toBe(10);
    expect(result.safeguards!.requireConfirmation).toBe(true);
  });

  it('rejects bulk replay without safeguards (Decision W5-7)', async () => {
    await expect(
      requestReplay(makeReplayParams({ replayType: 'bulk', safeguards: null })),
    ).rejects.toThrow('Bulk replay requires safeguards');
  });

  it('rejects replay for blocked dead-letter record', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeDeadLetterRow({ replay_eligibility: 'blocked' }),
    );

    await expect(
      requestReplay(makeReplayParams()),
    ).rejects.toThrow('not replay-eligible');
  });

  it('allows replay for requires_fix eligibility', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeDeadLetterRow({ replay_eligibility: 'requires_fix' }),
    );

    const result = await requestReplay(makeReplayParams());
    expect(result.status).toBe('pending');
  });

  it('throws when dead-letter record not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      requestReplay(makeReplayParams()),
    ).rejects.toThrow('not found');
  });

  it('supports both replay types', () => {
    for (const rt of ReplayTypeValues) {
      expect(() =>
        RequestReplayParamsSchema.parse(
          makeReplayParams({
            replayType: rt,
            safeguards: rt === 'bulk'
              ? { scopeFilter: {}, previewCount: 10, rateLimit: 5, requireConfirmation: true }
              : null,
          }),
        ),
      ).not.toThrow();
    }
  });
});

describe('getReplayRequests', () => {
  it('returns replay requests for a dead-letter record', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeReplayRow(),
      makeReplayRow({ replay_id: 'replay-002', status: 'completed' }),
    ]);

    const results = await getReplayRequests(DL_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('pending');
    expect(results[1].status).toBe('completed');
  });

  it('returns empty array when no replay requests exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getReplayRequests(DL_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// PROVIDER HEALTH (Decision W5-8)
// ------------------------------------------

describe('recordProviderHealth', () => {
  it('creates a new provider health record with all 5+ dimensions', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await recordProviderHealth(makeHealthParams());

    expect(result.healthId).toBeDefined();
    expect(result.authHealth).toBe('healthy');
    expect(result.transportHealth).toBe('healthy');
    expect(result.schemaHealth).toBe('healthy');
    expect(result.syncFreshness).toBe('healthy');
    expect(result.replayPressure).toBe('healthy');
    expect(result.deadLetterPressure).toBe('healthy');
    expect(result.overallHealth).toBe('healthy');
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('updates an existing provider health record', async () => {
    mockDbGet.mockResolvedValueOnce(makeHealthRow());

    const result = await recordProviderHealth(
      makeHealthParams({
        authHealth: 'unhealthy',
        transportHealth: 'degraded',
        overallHealth: 'unhealthy',
      }),
    );

    expect(result.authHealth).toBe('unhealthy');
    expect(result.transportHealth).toBe('degraded');
    expect(result.overallHealth).toBe('unhealthy');
    expect(result.healthId).toBe('00000000-0000-4000-8000-aaaaaa000001');
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE');
  });

  it('supports all 4 health status values for auth dimension', () => {
    for (const hs of HealthStatusValues) {
      expect(() =>
        RecordProviderHealthParamsSchema.parse(makeHealthParams({ authHealth: hs })),
      ).not.toThrow();
    }
  });

  it('supports all 4 health status values for transport dimension', () => {
    for (const hs of HealthStatusValues) {
      expect(() =>
        RecordProviderHealthParamsSchema.parse(makeHealthParams({ transportHealth: hs })),
      ).not.toThrow();
    }
  });

  it('supports all 4 health status values for schema dimension', () => {
    for (const hs of HealthStatusValues) {
      expect(() =>
        RecordProviderHealthParamsSchema.parse(makeHealthParams({ schemaHealth: hs })),
      ).not.toThrow();
    }
  });

  it('supports all 4 health status values for sync freshness dimension', () => {
    for (const hs of HealthStatusValues) {
      expect(() =>
        RecordProviderHealthParamsSchema.parse(makeHealthParams({ syncFreshness: hs })),
      ).not.toThrow();
    }
  });

  it('supports all 4 health status values for replay pressure dimension', () => {
    for (const hs of HealthStatusValues) {
      expect(() =>
        RecordProviderHealthParamsSchema.parse(makeHealthParams({ replayPressure: hs })),
      ).not.toThrow();
    }
  });

  it('rejects invalid health status via Zod', () => {
    expect(() =>
      RecordProviderHealthParamsSchema.parse(
        makeHealthParams({ overallHealth: 'critical' as any }),
      ),
    ).toThrow(ZodError);
  });
});

describe('getProviderHealth', () => {
  it('returns provider health with all dimensions', async () => {
    mockDbGet.mockResolvedValueOnce(makeHealthRow());

    const result = await getProviderHealth('jira', ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.providerKey).toBe('jira');
    expect(result!.authHealth).toBe('healthy');
    expect(result!.transportHealth).toBe('healthy');
    expect(result!.schemaHealth).toBe('healthy');
    expect(result!.syncFreshness).toBe('healthy');
    expect(result!.replayPressure).toBe('healthy');
    expect(result!.deadLetterPressure).toBe('healthy');
    expect(result!.overallHealth).toBe('healthy');
  });

  it('returns null when no health record exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getProviderHealth('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });
});

// ------------------------------------------
// SCHEMA DRIFT (Decision W5-4)
// ------------------------------------------

describe('recordSchemaDrift', () => {
  it('creates a schema drift event', async () => {
    const result = await recordSchemaDrift(makeDriftParams());

    expect(result.eventId).toBeDefined();
    expect(result.driftType).toBe('field_added');
    expect(result.affectedFields).toEqual(['summary', 'priority']);
    expect(result.connectorId).toBe(CONNECTOR_ID);
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('supports all 6 drift types', () => {
    for (const dt of DriftTypeValues) {
      expect(() =>
        RecordSchemaDriftParamsSchema.parse(makeDriftParams({ driftType: dt })),
      ).not.toThrow();
    }
  });

  it('requires at least one affected field', () => {
    expect(() =>
      RecordSchemaDriftParamsSchema.parse(makeDriftParams({ affectedFields: [] })),
    ).toThrow(ZodError);
  });

  it('rejects invalid drift type via Zod', () => {
    expect(() =>
      RecordSchemaDriftParamsSchema.parse(
        makeDriftParams({ driftType: 'invalid_drift' as any }),
      ),
    ).toThrow(ZodError);
  });

  it('records breaking_response_change drift type', async () => {
    const result = await recordSchemaDrift(
      makeDriftParams({
        driftType: 'breaking_response_change',
        affectedFields: ['response.status'],
      }),
    );
    expect(result.driftType).toBe('breaking_response_change');
  });
});

// ------------------------------------------
// 90-DAY RETENTION (Decision W5-6)
// ------------------------------------------

describe('retention policy (Decision W5-6)', () => {
  it('defines 90-day retention baseline', () => {
    expect(DEAD_LETTER_RETENTION_DAYS).toBe(90);
  });

  it('computes retention cutoff date correctly', () => {
    const cutoff = getRetentionCutoffDate();
    const cutoffDate = new Date(cutoff);
    const now = new Date();
    const diffDays = Math.round((now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(DEAD_LETTER_RETENTION_DAYS);
  });

  it('does not return pending_review records as expired', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getExpiredResolvedRecords(ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('NOT IN');
    expect(query).toContain('pending_review');
    expect(query).toContain('escalated');
  });

  it('returns resolved records past retention cutoff', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeDeadLetterRow({
        resolution_state: 'dismissed',
        dead_lettered_at: '2025-12-01T00:00:00.000Z',
      }),
    ]);

    const results = await getExpiredResolvedRecords(ORG_ID);
    expect(results).toHaveLength(1);
    expect(results[0].resolutionState).toBe('dismissed');
  });
});

// ------------------------------------------
// ORG ISOLATION
// ------------------------------------------

describe('org isolation', () => {
  it('dead-letter queue queries include organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getDeadLetterQueue(CONNECTOR_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('retry policy queries include organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getRetryPolicy('jira', ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbGet.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('replay request queries include organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getReplayRequests(DL_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('provider health queries include organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getProviderHealth('jira', ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbGet.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('replay request validates org matches dead-letter record', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      requestReplay(makeReplayParams({ organizationId: ORG_ID_2 })),
    ).rejects.toThrow('not found');
  });

  it('expired records query scoped to org', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getExpiredResolvedRecords(ORG_ID);

    expect(mockDbAll.mock.calls[0][1][0]).toBe(ORG_ID);
  });
});

// ------------------------------------------
// ZOD SCHEMA VALIDATION (output types)
// ------------------------------------------

describe('Zod schema validation (output types)', () => {
  it('validates DeadLetterRecord', () => {
    expect(() =>
      DeadLetterRecordSchema.parse({
        deadLetterId: DL_ID,
        originalJobRef: 'job-001',
        originalPayloadRef: null,
        eventName: 'connector.sync.failed',
        connectorId: CONNECTOR_ID,
        organizationId: ORG_ID,
        providerKey: 'jira',
        objectType: 'Task',
        objectRef: 'TASK-1',
        reason: 'Auth failed',
        errorClass: 'auth_failure',
        replayEligibility: 'requires_fix',
        retryCount: 3,
        lastAttemptAt: '2026-03-23T10:00:00.000Z',
        deadLetteredAt: '2026-03-23T10:05:00.000Z',
        correlationId: 'corr-001',
        operatorNote: null,
        resolutionState: 'pending_review',
        createdAt: '2026-03-23T10:05:00.000Z',
        updatedAt: '2026-03-23T10:05:00.000Z',
      }),
    ).not.toThrow();
  });

  it('validates RetryPolicy', () => {
    expect(() =>
      RetryPolicySchema.parse({
        policyId: '00000000-0000-4000-8000-eeeeeeeeee01',
        connectorFamily: 'jira',
        organizationId: ORG_ID,
        maxAttemptClasses: { auth_failure: 1, provider_outage: 5 },
        backoffFamily: 'exponential',
        jitterEnabled: true,
        escalationHandoff: 'ops-team',
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('validates ReplayRequest', () => {
    expect(() =>
      ReplayRequestSchema.parse({
        replayId: '00000000-0000-4000-8000-ffffff000001',
        deadLetterId: DL_ID,
        organizationId: ORG_ID,
        replayType: 'single',
        requestedBy: USER_ID,
        status: 'pending',
        safeguards: null,
        createdAt: '2026-03-23T11:00:00.000Z',
        updatedAt: '2026-03-23T11:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('validates ProviderHealthModel', () => {
    expect(() =>
      ProviderHealthModelSchema.parse({
        healthId: '00000000-0000-4000-8000-aaaaaa000001',
        providerKey: 'jira',
        organizationId: ORG_ID,
        authHealth: 'healthy',
        transportHealth: 'degraded',
        schemaHealth: 'healthy',
        syncFreshness: 'unknown',
        replayPressure: 'healthy',
        deadLetterPressure: 'unhealthy',
        overallHealth: 'degraded',
        lastCheckedAt: '2026-03-23T10:00:00.000Z',
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('validates SchemaDriftEvent', () => {
    expect(() =>
      SchemaDriftEventSchema.parse({
        eventId: '00000000-0000-4000-8000-bbbbbb000001',
        connectorId: CONNECTOR_ID,
        organizationId: ORG_ID,
        driftType: 'field_added',
        affectedFields: ['summary'],
        detectedAt: '2026-03-23T10:00:00.000Z',
        createdAt: '2026-03-23T10:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('validates all 7 error classes are defined', () => {
    expect(ErrorClassValues).toHaveLength(7);
  });

  it('validates all 3 replay eligibility values are defined', () => {
    expect(ReplayEligibilityValues).toHaveLength(3);
  });

  it('validates all 5 resolution states are defined', () => {
    expect(ResolutionStateValues).toHaveLength(5);
  });

  it('validates all 3 backoff families are defined', () => {
    expect(BackoffFamilyValues).toHaveLength(3);
  });

  it('validates all 2 replay types are defined', () => {
    expect(ReplayTypeValues).toHaveLength(2);
  });

  it('validates all 4 replay statuses are defined', () => {
    expect(ReplayStatusValues).toHaveLength(4);
  });

  it('validates all 4 health statuses are defined', () => {
    expect(HealthStatusValues).toHaveLength(4);
  });

  it('validates all 6 drift types are defined', () => {
    expect(DriftTypeValues).toHaveLength(6);
  });
});
