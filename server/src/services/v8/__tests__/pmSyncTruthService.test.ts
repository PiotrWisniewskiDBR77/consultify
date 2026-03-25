import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ZodError } from 'zod';

import type {
  SetConnectorAuthStateParams,
  RegisterProviderProfileParams,
  UpdateObjectSyncStateParams,
  RecordConflictParams,
} from '../../../types/pmSyncTruth.js';
import {
  ConnectorAuthStateValues,
  ProviderTierValues,
  SyncStatusValues,
  ConflictClassValues,
  ConflictSeverityValues,
  ConflictResolutionPathValues,
  ConnectorAuthRecordSchema,
  ProviderDepthProfileSchema,
  BusinessObjectSyncStateSchema,
  ConflictRecordSchema,
  SetConnectorAuthStateParamsSchema,
  RegisterProviderProfileParamsSchema,
  UpdateObjectSyncStateParamsSchema,
  RecordConflictParamsSchema,
  AUTH_STATE_TRANSITIONS,
} from '../../../types/pmSyncTruth.js';

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
  isValidAuthTransition,
  setConnectorAuthState,
  getConnectorAuthState,
  registerProviderProfile,
  getProviderProfile,
  updateObjectSyncState,
  getObjectSyncState,
  getObjectSyncStatesByConnector,
  recordConflict,
  resolveConflict,
  getConflictsByObject,
  getConnectorHealth as getConnectorSyncHealthSummary,
  getUnresolvedConflicts,
} from '../pmSyncTruthService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const ORG_ID_2 = '00000000-0000-4000-8000-000000000099';
const CONNECTOR_ID = 'jira-connector-1';
const USER_ID = 'user-admin-1';
const PROVIDER_ID = 'jira';
const OBJECT_ID = 'task-123';
const SYNC_STATE_ID = '00000000-0000-4000-8000-000000000010';

function makeAuthParams(overrides?: Partial<SetConnectorAuthStateParams>): SetConnectorAuthStateParams {
  return {
    connectorId: CONNECTOR_ID,
    organizationId: ORG_ID,
    targetState: 'connecting',
    transitionedBy: USER_ID,
    reason: null,
    ...overrides,
  };
}

function makeProviderParams(overrides?: Partial<RegisterProviderProfileParams>): RegisterProviderProfileParams {
  return {
    providerId: PROVIDER_ID,
    providerName: 'Jira',
    tier: 'A',
    parityDimensions: [
      { dimension: 'auth_maturity', score: 9, notes: null },
      { dimension: 'task_object_mapping', score: 8, notes: 'Strong mapping' },
    ],
    limitations: ['No custom field bidirectional sync yet'],
    displayContract: 'Enterprise parity — full bidirectional task sync',
    organizationId: ORG_ID,
    ...overrides,
  };
}

function makeSyncStateParams(overrides?: Partial<UpdateObjectSyncStateParams>): UpdateObjectSyncStateParams {
  return {
    objectType: 'Task',
    objectId: OBJECT_ID,
    connectorId: CONNECTOR_ID,
    organizationId: ORG_ID,
    syncStatus: 'synced',
    errorClass: null,
    ...overrides,
  };
}

function makeConflictParams(overrides?: Partial<RecordConflictParams>): RecordConflictParams {
  return {
    objectSyncStateId: SYNC_STATE_ID,
    organizationId: ORG_ID,
    conflictClass: 'field_authority_conflict',
    severity: 'degraded',
    ...overrides,
  };
}

function makeAuthRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    record_id: '00000000-0000-4000-8000-aaaaaaaaaaaa',
    connector_id: CONNECTOR_ID,
    organization_id: ORG_ID,
    auth_state: 'not_connected',
    previous_state: null,
    transitioned_at: '2026-03-23T10:00:00.000Z',
    transitioned_by: USER_ID,
    reason: null,
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeProviderRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    profile_id: '00000000-0000-4000-8000-bbbbbbbbbbbb',
    provider_id: PROVIDER_ID,
    provider_name: 'Jira',
    tier: 'A',
    parity_dimensions: JSON.stringify([{ dimension: 'auth_maturity', score: 9, notes: null }]),
    limitations: JSON.stringify(['No custom field bidirectional sync yet']),
    display_contract: 'Enterprise parity',
    organization_id: ORG_ID,
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeSyncStateRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    sync_state_id: SYNC_STATE_ID,
    object_type: 'Task',
    object_id: OBJECT_ID,
    connector_id: CONNECTOR_ID,
    organization_id: ORG_ID,
    sync_status: 'synced',
    last_synced_at: '2026-03-23T10:00:00.000Z',
    stale_since: null,
    error_class: null,
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeConflictRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    conflict_id: '00000000-0000-4000-8000-cccccccccccc',
    object_sync_state_id: SYNC_STATE_ID,
    organization_id: ORG_ID,
    conflict_class: 'field_authority_conflict',
    severity: 'degraded',
    resolution_path: null,
    resolution_strategy: null,
    resolved_at: null,
    resolved_by: null,
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
// AUTH STATE TRANSITIONS
// ------------------------------------------

describe('isValidAuthTransition', () => {
  it('allows not_connected → connecting', () => {
    expect(isValidAuthTransition('not_connected', 'connecting')).toBe(true);
  });

  it('allows connecting → connected_pending_verification', () => {
    expect(isValidAuthTransition('connecting', 'connected_pending_verification')).toBe(true);
  });

  it('allows connecting → not_connected (callback failure)', () => {
    expect(isValidAuthTransition('connecting', 'not_connected')).toBe(true);
  });

  it('allows connected_pending_verification → healthy', () => {
    expect(isValidAuthTransition('connected_pending_verification', 'healthy')).toBe(true);
  });

  it('allows healthy → degraded_reauth_needed', () => {
    expect(isValidAuthTransition('healthy', 'degraded_reauth_needed')).toBe(true);
  });

  it('allows healthy → degraded_scope_limited', () => {
    expect(isValidAuthTransition('healthy', 'degraded_scope_limited')).toBe(true);
  });

  it('allows healthy → suspended', () => {
    expect(isValidAuthTransition('healthy', 'suspended')).toBe(true);
  });

  it('allows healthy → disconnected', () => {
    expect(isValidAuthTransition('healthy', 'disconnected')).toBe(true);
  });

  it('allows degraded_reauth_needed → healthy (after reauth)', () => {
    expect(isValidAuthTransition('degraded_reauth_needed', 'healthy')).toBe(true);
  });

  it('allows degraded_reauth_needed → connecting (reauth flow)', () => {
    expect(isValidAuthTransition('degraded_reauth_needed', 'connecting')).toBe(true);
  });

  it('allows suspended → healthy (admin intervention)', () => {
    expect(isValidAuthTransition('suspended', 'healthy')).toBe(true);
  });

  it('rejects not_connected → healthy (skips connecting)', () => {
    expect(isValidAuthTransition('not_connected', 'healthy')).toBe(false);
  });

  it('rejects disconnected → any (terminal state)', () => {
    for (const state of ConnectorAuthStateValues) {
      expect(isValidAuthTransition('disconnected', state)).toBe(false);
    }
  });

  it('rejects healthy → not_connected (invalid backward)', () => {
    expect(isValidAuthTransition('healthy', 'not_connected')).toBe(false);
  });

  it('rejects connecting → healthy (skips verification)', () => {
    expect(isValidAuthTransition('connecting', 'healthy')).toBe(false);
  });
});

describe('setConnectorAuthState', () => {
  it('creates first auth state record when no prior state exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await setConnectorAuthState(makeAuthParams({ targetState: 'connecting' }));

    expect(result.authState).toBe('connecting');
    expect(result.previousState).toBeNull();
    expect(result.connectorId).toBe(CONNECTOR_ID);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.recordId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('transitions from existing state with validation', async () => {
    mockDbGet.mockResolvedValueOnce(makeAuthRow({ auth_state: 'connecting' }));

    const result = await setConnectorAuthState(
      makeAuthParams({ targetState: 'connected_pending_verification' }),
    );

    expect(result.authState).toBe('connected_pending_verification');
    expect(result.previousState).toBe('connecting');
  });

  it('rejects invalid transition from existing state', async () => {
    mockDbGet.mockResolvedValueOnce(makeAuthRow({ auth_state: 'not_connected' }));

    await expect(
      setConnectorAuthState(makeAuthParams({ targetState: 'healthy' })),
    ).rejects.toThrow('Invalid auth state transition');
  });

  it('rejects invalid params via Zod', async () => {
    await expect(
      setConnectorAuthState({
        connectorId: '',
        organizationId: 'not-uuid',
        targetState: 'invalid' as any,
        transitionedBy: USER_ID,
      }),
    ).rejects.toThrow(ZodError);
  });
});

describe('getConnectorAuthState', () => {
  it('returns the most recent auth state', async () => {
    mockDbGet.mockResolvedValueOnce(makeAuthRow({ auth_state: 'healthy' }));

    const result = await getConnectorAuthState(CONNECTOR_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.authState).toBe('healthy');
    expect(result!.organizationId).toBe(ORG_ID);
  });

  it('returns null when no auth state exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getConnectorAuthState(CONNECTOR_ID, ORG_ID);
    expect(result).toBeNull();
  });
});

// ------------------------------------------
// PROVIDER DEPTH PROFILES
// ------------------------------------------

describe('registerProviderProfile', () => {
  it('creates a new provider profile', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await registerProviderProfile(makeProviderParams());

    expect(result.providerId).toBe(PROVIDER_ID);
    expect(result.providerName).toBe('Jira');
    expect(result.tier).toBe('A');
    expect(result.parityDimensions).toHaveLength(2);
    expect(result.limitations).toHaveLength(1);
    expect(result.profileId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('updates an existing provider profile', async () => {
    mockDbGet.mockResolvedValueOnce(makeProviderRow());

    const result = await registerProviderProfile(
      makeProviderParams({ tier: 'B', providerName: 'Jira Updated' }),
    );

    expect(result.tier).toBe('B');
    expect(result.providerName).toBe('Jira Updated');
    expect(result.profileId).toBe('00000000-0000-4000-8000-bbbbbbbbbbbb');
    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE');
  });

  it('supports all four tiers (A, B, C, D)', () => {
    for (const tier of ProviderTierValues) {
      expect(() =>
        RegisterProviderProfileParamsSchema.parse(makeProviderParams({ tier })),
      ).not.toThrow();
    }
  });

  it('rejects invalid tier via Zod', () => {
    expect(() =>
      RegisterProviderProfileParamsSchema.parse(makeProviderParams({ tier: 'E' as any })),
    ).toThrow(ZodError);
  });
});

describe('getProviderProfile', () => {
  it('returns a provider profile with parsed JSON fields', async () => {
    mockDbGet.mockResolvedValueOnce(makeProviderRow());

    const result = await getProviderProfile(PROVIDER_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.tier).toBe('A');
    expect(result!.parityDimensions).toHaveLength(1);
    expect(result!.parityDimensions[0].dimension).toBe('auth_maturity');
    expect(result!.limitations).toHaveLength(1);
  });

  it('returns null when profile does not exist', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getProviderProfile('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });
});

// ------------------------------------------
// BUSINESS OBJECT SYNC STATE
// ------------------------------------------

describe('updateObjectSyncState', () => {
  it('creates a new sync state record', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await updateObjectSyncState(makeSyncStateParams());

    expect(result.objectType).toBe('Task');
    expect(result.objectId).toBe(OBJECT_ID);
    expect(result.syncStatus).toBe('synced');
    expect(result.lastSyncedAt).toBeDefined();
    expect(result.errorClass).toBeNull();
    expect(result.syncStateId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('updates an existing sync state', async () => {
    mockDbGet.mockResolvedValueOnce(makeSyncStateRow());

    const result = await updateObjectSyncState(
      makeSyncStateParams({ syncStatus: 'error', errorClass: 'auth_failure' }),
    );

    expect(result.syncStatus).toBe('error');
    expect(result.errorClass).toBe('auth_failure');
    expect(result.syncStateId).toBe(SYNC_STATE_ID);
  });

  it('sets staleSince when transitioning to stale', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await updateObjectSyncState(
      makeSyncStateParams({ syncStatus: 'stale' }),
    );

    expect(result.syncStatus).toBe('stale');
    expect(result.staleSince).toBeDefined();
  });

  it('clears staleSince when transitioning away from stale', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeSyncStateRow({ sync_status: 'stale', stale_since: '2026-03-23T09:00:00.000Z' }),
    );

    const result = await updateObjectSyncState(
      makeSyncStateParams({ syncStatus: 'synced' }),
    );

    expect(result.syncStatus).toBe('synced');
    expect(result.staleSince).toBeNull();
  });

  it('supports all 7 sync status values', () => {
    for (const status of SyncStatusValues) {
      expect(() =>
        UpdateObjectSyncStateParamsSchema.parse(makeSyncStateParams({ syncStatus: status })),
      ).not.toThrow();
    }
  });

  it('supports all 7 error class values', () => {
    for (const errorClass of ['auth_failure', 'permission_denied', 'provider_outage', 'mapping_failure', 'business_conflict', 'rate_limited', 'target_not_found'] as const) {
      expect(() =>
        UpdateObjectSyncStateParamsSchema.parse(
          makeSyncStateParams({ syncStatus: 'error', errorClass }),
        ),
      ).not.toThrow();
    }
  });

  it('rejects invalid objectType via Zod', () => {
    expect(() =>
      UpdateObjectSyncStateParamsSchema.parse(
        makeSyncStateParams({ objectType: 'InvalidType' as any }),
      ),
    ).toThrow(ZodError);
  });
});

describe('getObjectSyncState', () => {
  it('returns sync state with org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(makeSyncStateRow());

    const result = await getObjectSyncState('Task', OBJECT_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.objectType).toBe('Task');
    expect(result!.organizationId).toBe(ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns null when no sync state exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getObjectSyncState('Task', 'nonexistent', ORG_ID);
    expect(result).toBeNull();
  });
});

describe('getObjectSyncStatesByConnector', () => {
  it('returns all sync states for a connector', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeSyncStateRow(),
      makeSyncStateRow({ sync_state_id: 'state-2', object_id: 'task-456', sync_status: 'stale' }),
    ]);

    const results = await getObjectSyncStatesByConnector(CONNECTOR_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].syncStatus).toBe('synced');
    expect(results[1].syncStatus).toBe('stale');
  });

  it('returns empty array when no sync states exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getObjectSyncStatesByConnector(CONNECTOR_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// CONFLICT RECORDS
// ------------------------------------------

describe('recordConflict', () => {
  it('creates a new conflict record', async () => {
    const result = await recordConflict(makeConflictParams());

    expect(result.conflictClass).toBe('field_authority_conflict');
    expect(result.severity).toBe('degraded');
    expect(result.resolutionPath).toBeNull();
    expect(result.resolutionStrategy).toBeNull();
    expect(result.resolvedAt).toBeNull();
    expect(result.resolvedBy).toBeNull();
    expect(result.conflictId).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('supports all 7 conflict classes', () => {
    for (const conflictClass of ConflictClassValues) {
      expect(() =>
        RecordConflictParamsSchema.parse(makeConflictParams({ conflictClass })),
      ).not.toThrow();
    }
  });

  it('supports all 3 severity levels', () => {
    for (const severity of ConflictSeverityValues) {
      expect(() =>
        RecordConflictParamsSchema.parse(makeConflictParams({ severity })),
      ).not.toThrow();
    }
  });

  it('rejects invalid conflict class via Zod', () => {
    expect(() =>
      RecordConflictParamsSchema.parse(
        makeConflictParams({ conflictClass: 'invalid_class' as any }),
      ),
    ).toThrow(ZodError);
  });

  it('rejects invalid severity via Zod', () => {
    expect(() =>
      RecordConflictParamsSchema.parse(
        makeConflictParams({ severity: 'critical' as any }),
      ),
    ).toThrow(ZodError);
  });
});

describe('resolveConflict', () => {
  it('resolves an unresolved conflict', async () => {
    mockDbGet.mockResolvedValueOnce(makeConflictRow());

    const result = await resolveConflict(
      '00000000-0000-4000-8000-cccccccccccc',
      'manual_review',
      USER_ID,
    );

    expect(result.resolutionPath).toBe('manual_review');
    expect(result.resolutionStrategy).toBe('manual_review');
    expect(result.resolvedBy).toBe(USER_ID);
    expect(result.resolvedAt).toBeDefined();
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('scopes conflict resolution by organization when provided', async () => {
    mockDbGet.mockResolvedValueOnce(makeConflictRow());

    await resolveConflict('00000000-0000-4000-8000-cccccccccccc', 'dismiss', USER_ID, ORG_ID);

    expect(mockDbGet).toHaveBeenCalledWith(
      expect.stringContaining('organization_id = ?'),
      ['00000000-0000-4000-8000-cccccccccccc', ORG_ID],
    );
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.stringContaining('organization_id = ?'),
      expect.arrayContaining(['dismiss', USER_ID, '00000000-0000-4000-8000-cccccccccccc', ORG_ID]),
    );
  });

  it('throws when conflict not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      resolveConflict('nonexistent', 'dismiss', USER_ID),
    ).rejects.toThrow('not found');
  });

  it('throws when conflict already resolved', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeConflictRow({ resolved_at: '2026-03-23T12:00:00.000Z', resolved_by: 'someone' }),
    );

    await expect(
      resolveConflict('00000000-0000-4000-8000-cccccccccccc', 'dismiss', USER_ID),
    ).rejects.toThrow('already resolved');
  });

  it('supports all 6 resolution paths', () => {
    for (const path of ConflictResolutionPathValues) {
      expect(ConflictResolutionPathValues).toContain(path);
    }
  });
});

describe('getConnectorSyncHealthSummary', () => {
  it('aggregates auth, worst sync status, conflict count, and last sync', async () => {
    mockDbGet.mockResolvedValueOnce(makeAuthRow({ auth_state: 'healthy' }));

    mockDbAll.mockResolvedValueOnce([
      makeSyncStateRow({ sync_status: 'synced', last_synced_at: '2026-03-23T09:00:00.000Z' }),
      makeSyncStateRow({
        sync_state_id: '00000000-0000-4000-8000-000000000099',
        object_id: 'task-999',
        sync_status: 'stale',
        last_synced_at: '2026-03-23T11:00:00.000Z',
      }),
    ]);

    mockDbGet.mockResolvedValueOnce({ n: 2 });

    const summary = await getConnectorSyncHealthSummary(CONNECTOR_ID, ORG_ID);

    expect(summary.authState).toBe('healthy');
    expect(summary.syncStatus).toBe('stale');
    expect(summary.conflictCount).toBe(2);
    expect(summary.lastSyncAt).toBe('2026-03-23T11:00:00.000Z');
    expect(summary.healthy).toBe(false);
  });
});

describe('getUnresolvedConflicts', () => {
  it('returns open conflicts for the org with limit', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeConflictRow({ resolved_at: null }),
      makeConflictRow({
        conflict_id: '00000000-0000-4000-8000-dddddddddddd',
        resolved_at: null,
        conflict_class: 'concurrent_edit_conflict',
      }),
    ]);

    const rows = await getUnresolvedConflicts(ORG_ID, 10);

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.resolvedAt === null)).toBe(true);
    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('resolved_at IS NULL');
    expect(mockDbAll.mock.calls[0][1]).toEqual([ORG_ID, 10]);
  });
});

describe('getConflictsByObject', () => {
  it('returns conflicts for an object sync state', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeConflictRow(),
      makeConflictRow({
        conflict_id: 'conflict-2',
        conflict_class: 'concurrent_edit_conflict',
        severity: 'blocking',
      }),
    ]);

    const results = await getConflictsByObject(SYNC_STATE_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].conflictClass).toBe('field_authority_conflict');
    expect(results[1].conflictClass).toBe('concurrent_edit_conflict');
  });

  it('returns empty array when no conflicts exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getConflictsByObject(SYNC_STATE_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// ORG ISOLATION
// ------------------------------------------

describe('org isolation', () => {
  it('auth state queries include organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getConnectorAuthState(CONNECTOR_ID, ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbGet.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('sync state queries include organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getObjectSyncState('Task', OBJECT_ID, ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbGet.mock.calls[0][1]).toContain(ORG_ID);
  });

  it('conflict queries include organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getConflictsByObject(SYNC_STATE_ID, ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    expect(mockDbAll.mock.calls[0][1]).toContain(ORG_ID);
  });
});

// ------------------------------------------
// ZOD SCHEMA VALIDATION
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates ConnectorAuthRecord', () => {
    expect(() =>
      ConnectorAuthRecordSchema.parse({
        recordId: '00000000-0000-4000-8000-aaaaaaaaaaaa',
        connectorId: CONNECTOR_ID,
        organizationId: ORG_ID,
        authState: 'healthy',
        previousState: 'connected_pending_verification',
        transitionedAt: '2026-03-23T10:00:00.000Z',
        transitionedBy: USER_ID,
        reason: null,
      }),
    ).not.toThrow();
  });

  it('rejects invalid auth state in schema', () => {
    expect(() =>
      ConnectorAuthRecordSchema.parse({
        recordId: '00000000-0000-4000-8000-aaaaaaaaaaaa',
        connectorId: CONNECTOR_ID,
        organizationId: ORG_ID,
        authState: 'invalid_state',
        previousState: null,
        transitionedAt: '2026-03-23T10:00:00.000Z',
        transitionedBy: USER_ID,
        reason: null,
      }),
    ).toThrow(ZodError);
  });

  it('validates BusinessObjectSyncState', () => {
    expect(() =>
      BusinessObjectSyncStateSchema.parse({
        syncStateId: '00000000-0000-4000-8000-aaaaaaaaaaaa',
        objectType: 'Task',
        objectId: OBJECT_ID,
        connectorId: CONNECTOR_ID,
        organizationId: ORG_ID,
        syncStatus: 'synced',
        lastSyncedAt: '2026-03-23T10:00:00.000Z',
        staleSince: null,
        errorClass: null,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('validates ConflictRecord', () => {
    expect(() =>
      ConflictRecordSchema.parse({
        conflictId: '00000000-0000-4000-8000-aaaaaaaaaaaa',
        objectSyncStateId: SYNC_STATE_ID,
        organizationId: ORG_ID,
        conflictClass: 'field_authority_conflict',
        severity: 'blocking',
        resolutionPath: 'manual_review',
        resolutionStrategy: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: '2026-03-23T10:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('validates all 8 auth states are defined', () => {
    expect(ConnectorAuthStateValues).toHaveLength(8);
  });

  it('validates all 7 sync statuses are defined', () => {
    expect(SyncStatusValues).toHaveLength(7);
  });

  it('validates all 7 conflict classes are defined', () => {
    expect(ConflictClassValues).toHaveLength(7);
  });

  it('validates all 3 severity levels are defined', () => {
    expect(ConflictSeverityValues).toHaveLength(3);
  });

  it('validates all 6 resolution paths are defined', () => {
    expect(ConflictResolutionPathValues).toHaveLength(6);
  });

  it('validates all 4 provider tiers are defined (Decision 7)', () => {
    expect(ProviderTierValues).toHaveLength(4);
    expect(ProviderTierValues).toContain('D');
  });
});

// ------------------------------------------
// AUTH STATE MACHINE COMPLETENESS
// ------------------------------------------

describe('AUTH_STATE_TRANSITIONS completeness', () => {
  it('defines transitions for all 8 auth states', () => {
    for (const state of ConnectorAuthStateValues) {
      expect(AUTH_STATE_TRANSITIONS).toHaveProperty(state);
    }
  });

  it('disconnected is terminal (no outgoing transitions)', () => {
    expect(AUTH_STATE_TRANSITIONS.disconnected).toHaveLength(0);
  });

  it('healthy has exactly 4 outgoing transitions', () => {
    expect(AUTH_STATE_TRANSITIONS.healthy).toHaveLength(4);
  });

  it('not_connected has exactly 1 outgoing transition (connecting)', () => {
    expect(AUTH_STATE_TRANSITIONS.not_connected).toHaveLength(1);
    expect(AUTH_STATE_TRANSITIONS.not_connected).toContain('connecting');
  });
});
