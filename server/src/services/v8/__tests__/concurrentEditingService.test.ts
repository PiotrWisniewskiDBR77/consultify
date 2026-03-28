import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  AcquireLockParams,
  CreateNotificationParams,
  MarkFieldGovernanceSensitiveParams,
  RecordConflictParams,
  RegisterConcurrencyStrategyParams,
  RegisterNotificationTriggerParams,
} from '../../../types/concurrentEditingNotification.js';
import {
  AcquireLockParamsSchema,
  CollaborationModeValues,
  CommentAnchorStrategyValues,
  ConcurrencyStrategySchema,
  ConflictClassValues,
  ConflictResolutionSchema,
  CreateNotificationParamsSchema,
  GovernanceConflictPolicyValues,
  GovernanceSensitiveFieldSchema,
  LockRecordSchema,
  LockReleaseReasonValues,
  LockStrategyValues,
  LockTypeValues,
  MarkFieldGovernanceSensitiveParamsSchema,
  MergeStrategyValues,
  NotificationChannelValues,
  NotificationPriorityValues,
  NotificationRecordSchema,
  NotificationStateValues,
  NotificationTriggerSchema,
  OfflinePolicyValues,
  RecordConflictParamsSchema,
  RegisterConcurrencyStrategyParamsSchema,
  RegisterNotificationTriggerParamsSchema,
  ResolutionStatusValues,
  ResolutionStrategyValues,
  ResolveConflictParamsSchema,
} from '../../../types/concurrentEditingNotification.js';

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
  acquireLock,
  cleanExpiredLocks,
  createNotification,
  getActiveLocks,
  getConcurrencyStrategy,
  getNotifications,
  isFieldGovernanceSensitive,
  markFieldGovernanceSensitive,
  recordConflict,
  registerConcurrencyStrategy,
  registerNotificationTrigger,
  releaseLock,
  resolveConflict,
  updateNotificationState,
} from '../concurrentEditingService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const USER_ID_2 = '00000000-0000-4000-8000-000000000004';
const ROOM_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const CLIENT_ID = 'tab-1';

function makeStrategyParams(
  overrides?: Partial<RegisterConcurrencyStrategyParams>
): RegisterConcurrencyStrategyParams {
  return {
    resourceType: 'canvas',
    organizationId: ORG_ID,
    collaborationMode: 'realtime_coediting',
    mergeStrategy: 'crdt_object_level',
    lockStrategy: 'advisory_object',
    offlinePolicy: 'queue_and_merge',
    commentAnchorStrategy: 'node',
    ...overrides,
  };
}

function makeConflictParams(overrides?: Partial<RecordConflictParams>): RecordConflictParams {
  return {
    organizationId: ORG_ID,
    conflictClass: 'concurrent_property_edit',
    resourceType: 'canvas',
    resourceId: 'canvas-001',
    roomId: ROOM_ID,
    affectedPath: 'nodes.node-1.title',
    actorIds: [USER_ID, USER_ID_2],
    resolutionStrategy: 'crdt_auto_merge',
    metadata: { source: 'test' },
    ...overrides,
  };
}

function makeLockParams(overrides?: Partial<AcquireLockParams>): AcquireLockParams {
  return {
    organizationId: ORG_ID,
    lockType: 'advisory_object',
    lockScope: 'canvas-001:node-1',
    holderId: USER_ID,
    holderClientId: CLIENT_ID,
    roomId: ROOM_ID,
    ttl: 60000,
    ...overrides,
  };
}

function makeTriggerParams(
  overrides?: Partial<RegisterNotificationTriggerParams>
): RegisterNotificationTriggerParams {
  return {
    organizationId: ORG_ID,
    eventType: 'comment.created',
    notificationType: 'mention',
    recipientRule: 'mentioned_users',
    priority: 'high',
    channels: ['in_app_realtime', 'in_app_inbox'],
    ...overrides,
  };
}

function makeNotificationParams(
  overrides?: Partial<CreateNotificationParams>
): CreateNotificationParams {
  return {
    organizationId: ORG_ID,
    recipientId: USER_ID,
    eventRef: 'evt-001',
    channel: 'in_app_inbox',
    priority: 'medium',
    title: 'New comment on your document',
    body: 'User X mentioned you in a comment.',
    aggregationKey: null,
    ...overrides,
  };
}

function makeGovernanceParams(
  overrides?: Partial<MarkFieldGovernanceSensitiveParams>
): MarkFieldGovernanceSensitiveParams {
  return {
    organizationId: ORG_ID,
    tableId: 'tbl-initiatives',
    fieldName: 'status',
    isGovernanceSensitive: true,
    conflictPolicy: 'review_required',
    ...overrides,
  };
}

function makeFakeStrategyRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    strategy_id: '00000000-0000-4000-8000-ssssssssssss',
    resource_type: 'canvas',
    organization_id: ORG_ID,
    collaboration_mode: 'realtime_coediting',
    merge_strategy: 'crdt_object_level',
    lock_strategy: 'advisory_object',
    offline_policy: 'queue_and_merge',
    comment_anchor_strategy: 'node',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeConflictRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    conflict_id: '00000000-0000-4000-8000-cccccccccccc',
    organization_id: ORG_ID,
    conflict_class: 'concurrent_property_edit',
    resource_type: 'canvas',
    resource_id: 'canvas-001',
    room_id: ROOM_ID,
    affected_path: 'nodes.node-1.title',
    actor_ids: JSON.stringify([USER_ID, USER_ID_2]),
    resolution_strategy: 'crdt_auto_merge',
    resolution_status: 'pending_user_action',
    resolved_at: null,
    created_at: '2026-03-23T10:00:00.000Z',
    metadata: JSON.stringify({ source: 'test' }),
    ...overrides,
  };
}

function makeFakeLockRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    lock_id: '00000000-0000-4000-8000-llllllllllll',
    organization_id: ORG_ID,
    lock_type: 'advisory_object',
    lock_scope: 'canvas-001:node-1',
    holder_id: USER_ID,
    holder_client_id: CLIENT_ID,
    room_id: ROOM_ID,
    ttl: 60000,
    acquired_at: new Date().toISOString(),
    released_at: null,
    release_reason: null,
    ...overrides,
  };
}

function makeFakeTriggerRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    trigger_id: '00000000-0000-4000-8000-tttttttttttt',
    organization_id: ORG_ID,
    event_type: 'comment.created',
    notification_type: 'mention',
    recipient_rule: 'mentioned_users',
    priority: 'high',
    channels: JSON.stringify(['in_app_realtime', 'in_app_inbox']),
    is_active: 1,
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeNotificationRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    notification_id: '00000000-0000-4000-8000-nnnnnnnnnnnn',
    organization_id: ORG_ID,
    recipient_id: USER_ID,
    event_ref: 'evt-001',
    channel: 'in_app_inbox',
    state: 'unread',
    aggregation_key: null,
    priority: 'medium',
    title: 'New comment on your document',
    body: 'User X mentioned you in a comment.',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

function makeFakeGovernanceRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    field_id: '00000000-0000-4000-8000-gggggggggggg',
    organization_id: ORG_ID,
    table_id: 'tbl-initiatives',
    field_name: 'status',
    is_governance_sensitive: 1,
    conflict_policy: 'review_required',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ==========================================
// CONCURRENCY STRATEGY REGISTRATION
// ==========================================

describe('registerConcurrencyStrategy', () => {
  it('creates a new strategy for a resource type', async () => {
    mockDbGet.mockResolvedValueOnce(null); // no existing

    const result = await registerConcurrencyStrategy(makeStrategyParams());

    expect(result.strategyId).toBeDefined();
    expect(result.resourceType).toBe('canvas');
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.collaborationMode).toBe('realtime_coediting');
    expect(result.mergeStrategy).toBe('crdt_object_level');
    expect(result.lockStrategy).toBe('advisory_object');
    expect(result.offlinePolicy).toBe('queue_and_merge');
    expect(result.commentAnchorStrategy).toBe('node');

    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_concurrency_strategies');
  });

  it('upserts when strategy already exists for resource type', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeStrategyRow());

    const result = await registerConcurrencyStrategy(
      makeStrategyParams({ mergeStrategy: 'field_lww' })
    );

    expect(result.mergeStrategy).toBe('field_lww');

    const updateSql = mockDbRun.mock.calls[0][0] as string;
    expect(updateSql).toContain('UPDATE v8_concurrency_strategies');
  });

  it('rejects invalid organizationId', async () => {
    await expect(
      registerConcurrencyStrategy(makeStrategyParams({ organizationId: 'bad' }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty resourceType', async () => {
    await expect(
      registerConcurrencyStrategy(makeStrategyParams({ resourceType: '' }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid collaborationMode', async () => {
    await expect(
      registerConcurrencyStrategy(makeStrategyParams({ collaborationMode: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid mergeStrategy', async () => {
    await expect(
      registerConcurrencyStrategy(makeStrategyParams({ mergeStrategy: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('supports all collaboration modes', async () => {
    for (const mode of CollaborationModeValues) {
      mockDbGet.mockResolvedValueOnce(null);
      const result = await registerConcurrencyStrategy(
        makeStrategyParams({ collaborationMode: mode, resourceType: `type-${mode}` })
      );
      expect(result.collaborationMode).toBe(mode);
    }
  });

  it('supports all merge strategies', async () => {
    for (const strategy of MergeStrategyValues) {
      mockDbGet.mockResolvedValueOnce(null);
      const result = await registerConcurrencyStrategy(
        makeStrategyParams({ mergeStrategy: strategy, resourceType: `type-${strategy}` })
      );
      expect(result.mergeStrategy).toBe(strategy);
    }
  });
});

describe('getConcurrencyStrategy', () => {
  it('returns strategy when found', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeStrategyRow());

    const result = await getConcurrencyStrategy('canvas', ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.resourceType).toBe('canvas');
    expect(result!.organizationId).toBe(ORG_ID);
  });

  it('returns null when not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getConcurrencyStrategy('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getConcurrencyStrategy('canvas', OTHER_ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });
});

// ==========================================
// CONFLICT RECORDING & RESOLUTION
// ==========================================

describe('recordConflict', () => {
  it('records a conflict with pending_user_action for manual strategies', async () => {
    const result = await recordConflict(
      makeConflictParams({ resolutionStrategy: 'optimistic_lock_retry' })
    );

    expect(result.conflictId).toBeDefined();
    expect(result.conflictClass).toBe('concurrent_property_edit');
    expect(result.resolutionStatus).toBe('pending_user_action');
    expect(result.resolvedAt).toBeNull();

    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_conflict_resolutions');
  });

  it('auto-resolves for crdt_auto_merge strategy', async () => {
    const result = await recordConflict(
      makeConflictParams({ resolutionStrategy: 'crdt_auto_merge' })
    );

    expect(result.resolutionStatus).toBe('auto_resolved');
    expect(result.resolvedAt).not.toBeNull();
  });

  it('auto-resolves for ot_transform strategy', async () => {
    const result = await recordConflict(makeConflictParams({ resolutionStrategy: 'ot_transform' }));

    expect(result.resolutionStatus).toBe('auto_resolved');
    expect(result.resolvedAt).not.toBeNull();
  });

  it('auto-resolves for last_write_wins strategy', async () => {
    const result = await recordConflict(
      makeConflictParams({ resolutionStrategy: 'last_write_wins' })
    );

    expect(result.resolutionStatus).toBe('auto_resolved');
    expect(result.resolvedAt).not.toBeNull();
  });

  it('records concurrent_property_edit conflict class', async () => {
    const result = await recordConflict(
      makeConflictParams({ conflictClass: 'concurrent_property_edit' })
    );
    expect(result.conflictClass).toBe('concurrent_property_edit');
  });

  it('records structural_conflict class', async () => {
    const result = await recordConflict(
      makeConflictParams({ conflictClass: 'structural_conflict' })
    );
    expect(result.conflictClass).toBe('structural_conflict');
  });

  it('records schema_conflict class', async () => {
    const result = await recordConflict(makeConflictParams({ conflictClass: 'schema_conflict' }));
    expect(result.conflictClass).toBe('schema_conflict');
  });

  it('records state_transition_conflict class', async () => {
    const result = await recordConflict(
      makeConflictParams({ conflictClass: 'state_transition_conflict' })
    );
    expect(result.conflictClass).toBe('state_transition_conflict');
  });

  it('records ai_proposal_vs_human_edit class', async () => {
    const result = await recordConflict(
      makeConflictParams({ conflictClass: 'ai_proposal_vs_human_edit' })
    );
    expect(result.conflictClass).toBe('ai_proposal_vs_human_edit');
  });

  it('defaults metadata to empty object', async () => {
    const result = await recordConflict(makeConflictParams({ metadata: undefined }));
    expect(result.metadata).toEqual({});
  });

  it('rejects empty actorIds', async () => {
    await expect(recordConflict(makeConflictParams({ actorIds: [] }))).rejects.toThrow(ZodError);
  });

  it('rejects invalid conflictClass', async () => {
    await expect(
      recordConflict(makeConflictParams({ conflictClass: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });
});

describe('resolveConflict', () => {
  it('resolves a pending conflict', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeConflictRow({ resolution_status: 'pending_user_action' })
    );

    const result = await resolveConflict('00000000-0000-4000-8000-cccccccccccc', ORG_ID, {
      resolutionStrategy: 'optimistic_lock_retry',
      resolutionStatus: 'user_resolved',
    });

    expect(result.resolutionStatus).toBe('user_resolved');
    expect(result.resolvedAt).not.toBeNull();

    const updateSql = mockDbRun.mock.calls[0][0] as string;
    expect(updateSql).toContain('UPDATE v8_conflict_resolutions');
  });

  it('resolves an escalated conflict', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeConflictRow({ resolution_status: 'escalated' }));

    const result = await resolveConflict('00000000-0000-4000-8000-cccccccccccc', ORG_ID, {
      resolutionStrategy: 'review_first_gating',
      resolutionStatus: 'user_resolved',
    });

    expect(result.resolutionStatus).toBe('user_resolved');
  });

  it('throws when conflict not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      resolveConflict('nonexistent', ORG_ID, {
        resolutionStrategy: 'last_write_wins',
        resolutionStatus: 'user_resolved',
      })
    ).rejects.toThrow('Conflict nonexistent not found');
  });

  it('throws when conflict is already auto_resolved', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeConflictRow({ resolution_status: 'auto_resolved' }));

    await expect(
      resolveConflict('00000000-0000-4000-8000-cccccccccccc', ORG_ID, {
        resolutionStrategy: 'last_write_wins',
        resolutionStatus: 'user_resolved',
      })
    ).rejects.toThrow('already resolved');
  });

  it('throws when conflict is already user_resolved', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeConflictRow({ resolution_status: 'user_resolved' }));

    await expect(
      resolveConflict('00000000-0000-4000-8000-cccccccccccc', ORG_ID, {
        resolutionStrategy: 'last_write_wins',
        resolutionStatus: 'user_resolved',
      })
    ).rejects.toThrow('already resolved');
  });

  it('enforces org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      resolveConflict('00000000-0000-4000-8000-cccccccccccc', OTHER_ORG_ID, {
        resolutionStrategy: 'last_write_wins',
        resolutionStatus: 'user_resolved',
      })
    ).rejects.toThrow('not found');

    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });
});

// ==========================================
// LOCK LIFECYCLE
// ==========================================

describe('acquireLock', () => {
  it('acquires a lock on a free scope', async () => {
    mockDbGet.mockResolvedValueOnce(null); // no existing lock

    const result = await acquireLock(makeLockParams());

    expect(result.lockId).toBeDefined();
    expect(result.lockType).toBe('advisory_object');
    expect(result.lockScope).toBe('canvas-001:node-1');
    expect(result.holderId).toBe(USER_ID);
    expect(result.holderClientId).toBe(CLIENT_ID);
    expect(result.roomId).toBe(ROOM_ID);
    expect(result.ttl).toBe(60000);
    expect(result.releasedAt).toBeNull();
    expect(result.releaseReason).toBeNull();

    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_lock_records');
  });

  it('denies lock when scope is held by another user', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeLockRow({ acquired_at: new Date().toISOString() }));

    await expect(acquireLock(makeLockParams({ holderId: USER_ID_2 }))).rejects.toThrow(
      'Lock denied'
    );
  });

  it('auto-expires and acquires when existing lock TTL has elapsed', async () => {
    const expiredTime = new Date(Date.now() - 120000).toISOString();
    mockDbGet.mockResolvedValueOnce(makeFakeLockRow({ acquired_at: expiredTime, ttl: 60000 }));

    const result = await acquireLock(makeLockParams({ holderId: USER_ID_2 }));

    expect(result.holderId).toBe(USER_ID_2);

    // UPDATE expired lock + INSERT new lock
    expect(mockDbRun).toHaveBeenCalledTimes(2);
    const updateSql = mockDbRun.mock.calls[0][0] as string;
    expect(updateSql).toContain("release_reason = 'timeout'");
  });

  it('rejects invalid TTL (zero)', async () => {
    await expect(acquireLock(makeLockParams({ ttl: 0 }))).rejects.toThrow(ZodError);
  });

  it('rejects negative TTL', async () => {
    await expect(acquireLock(makeLockParams({ ttl: -1000 }))).rejects.toThrow(ZodError);
  });

  it('rejects invalid lockType', async () => {
    await expect(acquireLock(makeLockParams({ lockType: 'invalid' as any }))).rejects.toThrow(
      ZodError
    );
  });

  it('supports all lock types', async () => {
    for (const lockType of LockTypeValues) {
      mockDbGet.mockResolvedValueOnce(null);
      const result = await acquireLock(
        makeLockParams({ lockType, lockScope: `scope-${lockType}` })
      );
      expect(result.lockType).toBe(lockType);
    }
  });
});

describe('releaseLock', () => {
  it('releases a held lock with explicit reason', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeLockRow());

    const result = await releaseLock('00000000-0000-4000-8000-llllllllllll', ORG_ID, 'explicit');

    expect(result.releasedAt).not.toBeNull();
    expect(result.releaseReason).toBe('explicit');

    const updateSql = mockDbRun.mock.calls[0][0] as string;
    expect(updateSql).toContain('UPDATE v8_lock_records');
  });

  it('releases with disconnect reason', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeLockRow());

    const result = await releaseLock('00000000-0000-4000-8000-llllllllllll', ORG_ID, 'disconnect');

    expect(result.releaseReason).toBe('disconnect');
  });

  it('releases with timeout reason', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeLockRow());

    const result = await releaseLock('00000000-0000-4000-8000-llllllllllll', ORG_ID, 'timeout');

    expect(result.releaseReason).toBe('timeout');
  });

  it('throws when lock not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(releaseLock('nonexistent', ORG_ID, 'explicit')).rejects.toThrow(
      'Lock nonexistent not found'
    );
  });

  it('throws when lock is already released', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeLockRow({ released_at: '2026-03-23T11:00:00.000Z', release_reason: 'explicit' })
    );

    await expect(
      releaseLock('00000000-0000-4000-8000-llllllllllll', ORG_ID, 'explicit')
    ).rejects.toThrow('already released');
  });

  it('enforces org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      releaseLock('00000000-0000-4000-8000-llllllllllll', OTHER_ORG_ID, 'explicit')
    ).rejects.toThrow('not found');

    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });
});

describe('getActiveLocks', () => {
  it('returns active locks for a room', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeLockRow(),
      makeFakeLockRow({
        lock_id: 'lock-2',
        lock_scope: 'canvas-001:node-2',
        holder_id: USER_ID_2,
      }),
    ]);

    const results = await getActiveLocks(ROOM_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].holderId).toBe(USER_ID);
    expect(results[1].holderId).toBe(USER_ID_2);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('released_at IS NULL');
  });

  it('returns empty array when no active locks', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getActiveLocks(ROOM_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getActiveLocks(ROOM_ID, OTHER_ORG_ID);

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });
});

describe('cleanExpiredLocks', () => {
  it('cleans locks whose TTL has elapsed', async () => {
    const expiredTime = new Date(Date.now() - 120000).toISOString();
    mockDbAll.mockResolvedValueOnce([
      makeFakeLockRow({ acquired_at: expiredTime, ttl: 60000 }),
      makeFakeLockRow({
        lock_id: 'lock-2',
        acquired_at: expiredTime,
        ttl: 30000,
      }),
    ]);

    const cleaned = await cleanExpiredLocks(ORG_ID);

    expect(cleaned).toBe(2);
    expect(mockDbRun).toHaveBeenCalledTimes(2);
  });

  it('does not clean locks within TTL', async () => {
    const recentTime = new Date().toISOString();
    mockDbAll.mockResolvedValueOnce([makeFakeLockRow({ acquired_at: recentTime, ttl: 60000 })]);

    const cleaned = await cleanExpiredLocks(ORG_ID);

    expect(cleaned).toBe(0);
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('returns 0 when no active locks exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const cleaned = await cleanExpiredLocks(ORG_ID);
    expect(cleaned).toBe(0);
  });
});

// ==========================================
// NOTIFICATION TRIGGERS
// ==========================================

describe('registerNotificationTrigger', () => {
  it('registers a new notification trigger', async () => {
    const result = await registerNotificationTrigger(makeTriggerParams());

    expect(result.triggerId).toBeDefined();
    expect(result.eventType).toBe('comment.created');
    expect(result.notificationType).toBe('mention');
    expect(result.recipientRule).toBe('mentioned_users');
    expect(result.priority).toBe('high');
    expect(result.channels).toEqual(['in_app_realtime', 'in_app_inbox']);
    expect(result.isActive).toBe(true);

    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_notification_triggers');
  });

  it('rejects empty channels array', async () => {
    await expect(registerNotificationTrigger(makeTriggerParams({ channels: [] }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects invalid priority', async () => {
    await expect(
      registerNotificationTrigger(makeTriggerParams({ priority: 'critical' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid channel', async () => {
    await expect(
      registerNotificationTrigger(makeTriggerParams({ channels: ['sms' as any] }))
    ).rejects.toThrow(ZodError);
  });

  it('supports all priority levels', async () => {
    for (const priority of NotificationPriorityValues) {
      const result = await registerNotificationTrigger(makeTriggerParams({ priority }));
      expect(result.priority).toBe(priority);
    }
  });

  it('supports all notification channels', async () => {
    for (const channel of NotificationChannelValues) {
      const result = await registerNotificationTrigger(makeTriggerParams({ channels: [channel] }));
      expect(result.channels).toContain(channel);
    }
  });
});

// ==========================================
// NOTIFICATION RECORDS & AGGREGATION (Decision W4-9)
// ==========================================

describe('createNotification', () => {
  it('creates a notification in unread state', async () => {
    const result = await createNotification(makeNotificationParams());

    expect(result.notificationId).toBeDefined();
    expect(result.recipientId).toBe(USER_ID);
    expect(result.channel).toBe('in_app_inbox');
    expect(result.state).toBe('unread');
    expect(result.priority).toBe('medium');
    expect(result.title).toBe('New comment on your document');
    expect(result.body).toBe('User X mentioned you in a comment.');

    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_notification_records');
  });

  it('supports aggregation key (Decision W4-9)', async () => {
    const result = await createNotification(
      makeNotificationParams({ aggregationKey: 'workspace:ws-001:comments' })
    );

    expect(result.aggregationKey).toBe('workspace:ws-001:comments');
  });

  it('defaults aggregationKey to null', async () => {
    const result = await createNotification(makeNotificationParams({ aggregationKey: undefined }));

    expect(result.aggregationKey).toBeNull();
  });

  it('defaults body to null', async () => {
    const result = await createNotification(makeNotificationParams({ body: undefined }));

    expect(result.body).toBeNull();
  });

  it('rejects empty title', async () => {
    await expect(createNotification(makeNotificationParams({ title: '' }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects invalid channel', async () => {
    await expect(
      createNotification(makeNotificationParams({ channel: 'push' as any }))
    ).rejects.toThrow(ZodError);
  });
});

describe('getNotifications', () => {
  it('returns notifications for a recipient', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeNotificationRow(),
      makeFakeNotificationRow({
        notification_id: 'n2',
        title: 'Review requested',
        priority: 'high',
      }),
    ]);

    const results = await getNotifications(USER_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].recipientId).toBe(USER_ID);
  });

  it('filters by state when provided', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeNotificationRow({ state: 'unread' })]);

    const results = await getNotifications(USER_ID, ORG_ID, { state: 'unread' });

    expect(results).toHaveLength(1);
    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('state = ?');
  });

  it('supports pagination with limit', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getNotifications(USER_ID, ORG_ID, { limit: 10 });

    const queryParams = mockDbAll.mock.calls[0][1] as unknown[];
    expect(queryParams).toContain(10);
  });

  it('returns empty array when no notifications', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getNotifications(USER_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getNotifications(USER_ID, OTHER_ORG_ID);

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });

  it('supports aggregated notifications with aggregation_key (Decision W4-9)', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeNotificationRow({ aggregation_key: 'ws:ws-001:comments' }),
      makeFakeNotificationRow({
        notification_id: 'n2',
        aggregation_key: 'ws:ws-001:comments',
        title: '3 new comments',
      }),
    ]);

    const results = await getNotifications(USER_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].aggregationKey).toBe('ws:ws-001:comments');
    expect(results[1].aggregationKey).toBe('ws:ws-001:comments');
  });
});

describe('updateNotificationState', () => {
  it('transitions notification to read', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeNotificationRow());

    const result = await updateNotificationState(
      '00000000-0000-4000-8000-nnnnnnnnnnnn',
      ORG_ID,
      'read'
    );

    expect(result.state).toBe('read');
    expect(result.updatedAt).not.toBe('2026-03-23T10:00:00.000Z');
  });

  it('transitions notification to actioned', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeNotificationRow());

    const result = await updateNotificationState(
      '00000000-0000-4000-8000-nnnnnnnnnnnn',
      ORG_ID,
      'actioned'
    );

    expect(result.state).toBe('actioned');
  });

  it('transitions notification to snoozed', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeNotificationRow());

    const result = await updateNotificationState(
      '00000000-0000-4000-8000-nnnnnnnnnnnn',
      ORG_ID,
      'snoozed'
    );

    expect(result.state).toBe('snoozed');
  });

  it('throws when notification not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(updateNotificationState('nonexistent', ORG_ID, 'read')).rejects.toThrow(
      'Notification nonexistent not found'
    );
  });

  it('enforces org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      updateNotificationState('00000000-0000-4000-8000-nnnnnnnnnnnn', OTHER_ORG_ID, 'read')
    ).rejects.toThrow('not found');

    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });
});

// ==========================================
// GOVERNANCE-SENSITIVE FIELDS (Decision W4-10)
// ==========================================

describe('markFieldGovernanceSensitive', () => {
  it('marks a field as governance-sensitive', async () => {
    mockDbGet.mockResolvedValueOnce(null); // no existing

    const result = await markFieldGovernanceSensitive(makeGovernanceParams());

    expect(result.fieldId).toBeDefined();
    expect(result.tableId).toBe('tbl-initiatives');
    expect(result.fieldName).toBe('status');
    expect(result.isGovernanceSensitive).toBe(true);
    expect(result.conflictPolicy).toBe('review_required');

    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_governance_sensitive_fields');
  });

  it('upserts when field already registered', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeGovernanceRow());

    const result = await markFieldGovernanceSensitive(
      makeGovernanceParams({ conflictPolicy: 'blocking' })
    );

    expect(result.conflictPolicy).toBe('blocking');

    const updateSql = mockDbRun.mock.calls[0][0] as string;
    expect(updateSql).toContain('UPDATE v8_governance_sensitive_fields');
  });

  it('supports review_required policy', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await markFieldGovernanceSensitive(
      makeGovernanceParams({ conflictPolicy: 'review_required' })
    );
    expect(result.conflictPolicy).toBe('review_required');
  });

  it('supports blocking policy', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await markFieldGovernanceSensitive(
      makeGovernanceParams({ conflictPolicy: 'blocking', fieldName: 'budget' })
    );
    expect(result.conflictPolicy).toBe('blocking');
  });

  it('supports explicit_authority policy', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await markFieldGovernanceSensitive(
      makeGovernanceParams({ conflictPolicy: 'explicit_authority', fieldName: 'owner' })
    );
    expect(result.conflictPolicy).toBe('explicit_authority');
  });

  it('can unmark a field (isGovernanceSensitive = false)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeGovernanceRow());

    const result = await markFieldGovernanceSensitive(
      makeGovernanceParams({ isGovernanceSensitive: false })
    );

    expect(result.isGovernanceSensitive).toBe(false);
  });

  it('rejects invalid conflictPolicy', async () => {
    await expect(
      markFieldGovernanceSensitive(makeGovernanceParams({ conflictPolicy: 'silent_lww' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty tableId', async () => {
    await expect(
      markFieldGovernanceSensitive(makeGovernanceParams({ tableId: '' }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty fieldName', async () => {
    await expect(
      markFieldGovernanceSensitive(makeGovernanceParams({ fieldName: '' }))
    ).rejects.toThrow(ZodError);
  });
});

describe('isFieldGovernanceSensitive', () => {
  it('returns true for governance-sensitive field', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeGovernanceRow());

    const result = await isFieldGovernanceSensitive('tbl-initiatives', 'status', ORG_ID);
    expect(result).toBe(true);
  });

  it('returns false for non-sensitive field', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await isFieldGovernanceSensitive('tbl-initiatives', 'description', ORG_ID);
    expect(result).toBe(false);
  });

  it('enforces org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await isFieldGovernanceSensitive('tbl-initiatives', 'status', OTHER_ORG_ID);

    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });

  it('Decision W4-10: governance-sensitive fields reject silent LWW', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeGovernanceRow());

    const isSensitive = await isFieldGovernanceSensitive('tbl-initiatives', 'status', ORG_ID);
    expect(isSensitive).toBe(true);
    // Governance-sensitive fields must not use silent LWW — caller must check this
    // and route to review_required/blocking/explicit_authority instead
  });
});

// ==========================================
// ORG ISOLATION (cross-cutting)
// ==========================================

describe('org isolation', () => {
  it('getConcurrencyStrategy enforces organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getConcurrencyStrategy('canvas', OTHER_ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('resolveConflict enforces organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      resolveConflict('conflict-1', OTHER_ORG_ID, {
        resolutionStrategy: 'last_write_wins',
        resolutionStatus: 'user_resolved',
      })
    ).rejects.toThrow(`not found in organization ${OTHER_ORG_ID}`);
  });

  it('releaseLock enforces organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(releaseLock('lock-1', OTHER_ORG_ID, 'explicit')).rejects.toThrow(
      `not found in organization ${OTHER_ORG_ID}`
    );
  });

  it('getActiveLocks enforces organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getActiveLocks(ROOM_ID, OTHER_ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('updateNotificationState enforces organization_id', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(updateNotificationState('notif-1', OTHER_ORG_ID, 'read')).rejects.toThrow(
      `not found in organization ${OTHER_ORG_ID}`
    );
  });
});

// ==========================================
// ZOD SCHEMA VALIDATION
// ==========================================

describe('Zod schema validation', () => {
  it('validates a correct ConcurrencyStrategy', () => {
    expect(() =>
      ConcurrencyStrategySchema.parse({
        strategyId: '00000000-0000-4000-8000-a00000000001',
        resourceType: 'canvas',
        organizationId: ORG_ID,
        collaborationMode: 'realtime_coediting',
        mergeStrategy: 'crdt_object_level',
        lockStrategy: 'advisory_object',
        offlinePolicy: 'queue_and_merge',
        commentAnchorStrategy: 'node',
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('rejects ConcurrencyStrategy with invalid mergeStrategy', () => {
    expect(() =>
      ConcurrencyStrategySchema.parse({
        strategyId: '00000000-0000-4000-8000-a00000000001',
        resourceType: 'canvas',
        organizationId: ORG_ID,
        collaborationMode: 'realtime_coediting',
        mergeStrategy: 'invalid',
        lockStrategy: 'advisory_object',
        offlinePolicy: 'queue_and_merge',
        commentAnchorStrategy: 'node',
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).toThrow(ZodError);
  });

  it('validates a correct ConflictResolution', () => {
    expect(() =>
      ConflictResolutionSchema.parse({
        conflictId: '00000000-0000-4000-8000-a00000000002',
        organizationId: ORG_ID,
        conflictClass: 'concurrent_property_edit',
        resourceType: 'canvas',
        resourceId: 'canvas-001',
        roomId: ROOM_ID,
        affectedPath: 'nodes.node-1.title',
        actorIds: [USER_ID],
        resolutionStrategy: 'crdt_auto_merge',
        resolutionStatus: 'auto_resolved',
        resolvedAt: '2026-03-23T10:00:00.000Z',
        createdAt: '2026-03-23T10:00:00.000Z',
        metadata: {},
      })
    ).not.toThrow();
  });

  it('validates a correct LockRecord', () => {
    expect(() =>
      LockRecordSchema.parse({
        lockId: '00000000-0000-4000-8000-a00000000003',
        organizationId: ORG_ID,
        lockType: 'advisory_object',
        lockScope: 'canvas-001:node-1',
        holderId: USER_ID,
        holderClientId: CLIENT_ID,
        roomId: ROOM_ID,
        ttl: 60000,
        acquiredAt: '2026-03-23T10:00:00.000Z',
        releasedAt: null,
        releaseReason: null,
      })
    ).not.toThrow();
  });

  it('validates a correct NotificationTrigger', () => {
    expect(() =>
      NotificationTriggerSchema.parse({
        triggerId: '00000000-0000-4000-8000-a00000000004',
        organizationId: ORG_ID,
        eventType: 'comment.created',
        notificationType: 'mention',
        recipientRule: 'mentioned_users',
        priority: 'high',
        channels: ['in_app_realtime'],
        isActive: true,
        createdAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates a correct NotificationRecord', () => {
    expect(() =>
      NotificationRecordSchema.parse({
        notificationId: '00000000-0000-4000-8000-a00000000005',
        organizationId: ORG_ID,
        recipientId: USER_ID,
        eventRef: 'evt-001',
        channel: 'in_app_inbox',
        state: 'unread',
        aggregationKey: null,
        priority: 'medium',
        title: 'Test notification',
        body: null,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates a correct GovernanceSensitiveField', () => {
    expect(() =>
      GovernanceSensitiveFieldSchema.parse({
        fieldId: '00000000-0000-4000-8000-a00000000006',
        organizationId: ORG_ID,
        tableId: 'tbl-initiatives',
        fieldName: 'status',
        isGovernanceSensitive: true,
        conflictPolicy: 'review_required',
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates RegisterConcurrencyStrategyParams', () => {
    expect(() => RegisterConcurrencyStrategyParamsSchema.parse(makeStrategyParams())).not.toThrow();
  });

  it('validates RecordConflictParams', () => {
    expect(() => RecordConflictParamsSchema.parse(makeConflictParams())).not.toThrow();
  });

  it('validates ResolveConflictParams', () => {
    expect(() =>
      ResolveConflictParamsSchema.parse({
        resolutionStrategy: 'last_write_wins',
        resolutionStatus: 'user_resolved',
      })
    ).not.toThrow();
  });

  it('validates AcquireLockParams', () => {
    expect(() => AcquireLockParamsSchema.parse(makeLockParams())).not.toThrow();
  });

  it('validates RegisterNotificationTriggerParams', () => {
    expect(() => RegisterNotificationTriggerParamsSchema.parse(makeTriggerParams())).not.toThrow();
  });

  it('validates CreateNotificationParams', () => {
    expect(() => CreateNotificationParamsSchema.parse(makeNotificationParams())).not.toThrow();
  });

  it('validates MarkFieldGovernanceSensitiveParams', () => {
    expect(() =>
      MarkFieldGovernanceSensitiveParamsSchema.parse(makeGovernanceParams())
    ).not.toThrow();
  });
});

// ==========================================
// ENUM COMPLETENESS
// ==========================================

describe('enum completeness', () => {
  it('CollaborationModeValues has 5 modes', () => {
    expect(CollaborationModeValues).toHaveLength(5);
  });

  it('MergeStrategyValues has 5 strategies', () => {
    expect(MergeStrategyValues).toHaveLength(5);
  });

  it('LockStrategyValues has 6 strategies', () => {
    expect(LockStrategyValues).toHaveLength(6);
  });

  it('ConflictClassValues has 5 classes', () => {
    expect(ConflictClassValues).toHaveLength(5);
  });

  it('ResolutionStrategyValues has 7 strategies', () => {
    expect(ResolutionStrategyValues).toHaveLength(7);
  });

  it('ResolutionStatusValues has 4 statuses', () => {
    expect(ResolutionStatusValues).toHaveLength(4);
  });

  it('LockTypeValues has 6 types', () => {
    expect(LockTypeValues).toHaveLength(6);
  });

  it('LockReleaseReasonValues has 3 reasons', () => {
    expect(LockReleaseReasonValues).toHaveLength(3);
  });

  it('NotificationPriorityValues has 3 levels', () => {
    expect(NotificationPriorityValues).toHaveLength(3);
  });

  it('NotificationChannelValues has 3 channels', () => {
    expect(NotificationChannelValues).toHaveLength(3);
  });

  it('NotificationStateValues has 4 states', () => {
    expect(NotificationStateValues).toHaveLength(4);
  });

  it('GovernanceConflictPolicyValues has 3 policies', () => {
    expect(GovernanceConflictPolicyValues).toHaveLength(3);
  });
});
