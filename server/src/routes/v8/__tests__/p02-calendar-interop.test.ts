/**
 * P02 Calendar Interoperability — Canon + Service integration tests
 *
 * Canon: verifies frozen acceptance checklist, providers, recurrence, conflict,
 *        permission, lifecycle, anti-duplicate, error posture constants.
 * Service: mocks DbPromise and exercises real service logic for CRUD, sync,
 *          conflict-safe writes, permission/lifecycle derivation, error mapping.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Canon imports ──────────────────────────────────────────────────────
import {
  P02_ACCEPTANCE_CHECKLIST,
  P02_ANTI_DUPLICATE_RULES,
  P02_CONFLICT_WRITES_MODEL,
  P02_DECLARED_PROVIDERS,
  P02_ERROR_POSTURE,
  P02_LIFECYCLE_STATES,
  P02_LIFECYCLE_TRANSITIONS,
  P02_PERMISSION_GRADIENTS,
  P02_RECURRENCE_DOCTRINE,
} from '../../../services/v8/calendarInteropCanon.js';

// ── Mock DbPromise before service import ───────────────────────────────
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Service imports (after mock) ───────────────────────────────────────
import {
  computeEffectiveMode,
  conditionalWriteItem,
  createCalendarSource,
  getSourceHealth,
  handleSyncError,
  mapProviderError,
  performFullResync,
  performIncrementalSync,
  resolveConflict,
  updateSourceLifecycle,
  type CalendarSource,
  type EffectiveMode,
  type PermissionGradient,
  type SourceLifecycleState,
} from '../../../services/v8/calendarInteropService.js';

// ── Helpers ────────────────────────────────────────────────────────────

function fakeSourceRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    calendar_source_id: 'src-1',
    organization_id: 'org-1',
    user_id: 'usr-1',
    provider: 'google',
    account_ref: 'test@example.com',
    selected_calendars_json: '[]',
    declared_mode: 'bidir',
    effective_mode: 'bidir',
    permission_gradient: 'write',
    lifecycle_state: 'connected',
    requires_action_reason: null,
    last_ok_at: '2026-03-31T00:00:00.000Z',
    last_sync_at: '2026-03-31T00:00:00.000Z',
    sync_checkpoint_json: JSON.stringify({
      cursor: 'cur-1',
      rangeWatermark: null,
      lastFullSyncAt: null,
      lastIncrementalSyncAt: '2026-03-31T00:00:00.000Z',
      integrityGuards: [],
    }),
    last_error: null,
    created_at: '2026-03-31T00:00:00.000Z',
    updated_at: '2026-03-31T00:00:00.000Z',
    ...overrides,
  };
}

function fakeItemRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    calendar_item_id: 'item-1',
    organization_id: 'org-1',
    source_id: 'src-1',
    item_type: 'meeting',
    source_system: 'google_calendar',
    source_object_ref: 'ext-ref-1',
    title: 'Test Meeting',
    start_at: '2026-04-01T10:00:00.000Z',
    end_at: '2026-04-01T11:00:00.000Z',
    all_day: 0,
    timezone: 'Europe/Warsaw',
    visibility_class: 'details',
    edit_authority: 'remote_owner',
    recurrence_model_json: null,
    sync_state: 'in_sync',
    etag: 'etag-abc',
    created_at: '2026-03-31T00:00:00.000Z',
    updated_at: '2026-03-31T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════
// §1  Canon unit tests
// ═══════════════════════════════════════════════════════════════════════

describe('P02 Canon — frozen constants', () => {
  it('P02_ACCEPTANCE_CHECKLIST has exactly 11 items, all testable', () => {
    expect(P02_ACCEPTANCE_CHECKLIST).toHaveLength(11);
    for (const item of P02_ACCEPTANCE_CHECKLIST) {
      expect(item.testable).toBe(true);
      expect(item.id).toMatch(/^AC-\d{2}$/);
      expect(item.requirement.length).toBeGreaterThan(10);
    }
  });

  it('P02_DECLARED_PROVIDERS has exactly 3 providers: google, microsoft, caldav', () => {
    const keys = Object.keys(P02_DECLARED_PROVIDERS);
    expect(keys).toHaveLength(3);
    expect(keys).toEqual(expect.arrayContaining(['google', 'microsoft', 'caldav']));

    expect(P02_DECLARED_PROVIDERS.google.bidir).toBe(true);
    expect(P02_DECLARED_PROVIDERS.microsoft.bidir).toBe(true);
    expect(P02_DECLARED_PROVIDERS.caldav.write).toBe(false);
    expect(P02_DECLARED_PROVIDERS.caldav.bidir).toBe(false);
  });

  it('P02_RECURRENCE_DOCTRINE has all 6 required fields', () => {
    expect(P02_RECURRENCE_DOCTRINE.seriesMasterNotInstance).toBe(true);
    expect(P02_RECURRENCE_DOCTRINE.noInstanceExplosion).toBe(true);
    expect(P02_RECURRENCE_DOCTRINE.noSilentLoss).toBe(true);
    expect(P02_RECURRENCE_DOCTRINE.correctMapping).toBe(true);
    expect(P02_RECURRENCE_DOCTRINE.cancellationTruth).toBe(true);
    expect(P02_RECURRENCE_DOCTRINE.materializationRule).toBe('window_only');
  });

  it('P02_CONFLICT_WRITES_MODEL has all 4 required fields', () => {
    expect(P02_CONFLICT_WRITES_MODEL.conditionalWritesRequired).toBe(true);
    expect(P02_CONFLICT_WRITES_MODEL.conflictIsProductState).toBe(true);
    expect(P02_CONFLICT_WRITES_MODEL.idempotentCreateWhereAvailable).toBe(true);
    expect(P02_CONFLICT_WRITES_MODEL.noSilentOverwrite).toBe(true);
  });

  it('P02_PERMISSION_GRADIENTS has exactly 4 levels in correct order', () => {
    expect(P02_PERMISSION_GRADIENTS).toHaveLength(4);
    expect([...P02_PERMISSION_GRADIENTS]).toEqual(['free_busy', 'read', 'write', 'delegate']);
  });

  it('P02_LIFECYCLE_STATES has exactly 5 states', () => {
    expect(P02_LIFECYCLE_STATES).toHaveLength(5);
    expect([...P02_LIFECYCLE_STATES]).toEqual(
      expect.arrayContaining(['connected', 'degraded', 'requires_action', 'blocked', 'recoverable']),
    );
  });

  it('P02_LIFECYCLE_TRANSITIONS covers all 5 states with valid targets', () => {
    for (const state of P02_LIFECYCLE_STATES) {
      expect(P02_LIFECYCLE_TRANSITIONS[state]).toBeDefined();
      expect(P02_LIFECYCLE_TRANSITIONS[state].length).toBeGreaterThan(0);
      for (const target of P02_LIFECYCLE_TRANSITIONS[state]) {
        expect([...P02_LIFECYCLE_STATES]).toContain(target);
      }
    }
  });

  it('P02_ANTI_DUPLICATE_RULES has exactly 3 rules', () => {
    expect(P02_ANTI_DUPLICATE_RULES).toHaveLength(3);
    for (const rule of P02_ANTI_DUPLICATE_RULES) {
      expect(rule.length).toBeGreaterThan(20);
    }
  });

  it('P02_ERROR_POSTURE has exactly 8 scenarios with correct shape', () => {
    expect(P02_ERROR_POSTURE).toHaveLength(8);
    for (const entry of P02_ERROR_POSTURE) {
      expect(entry).toHaveProperty('scenario');
      expect(entry).toHaveProperty('sourceState');
      expect(entry).toHaveProperty('itemState');
      expect(entry).toHaveProperty('recovery');
      expect(entry.scenario.length).toBeGreaterThan(5);
      expect(entry.recovery.length).toBeGreaterThan(5);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §2  Service unit tests — computeEffectiveMode (pure function)
// ═══════════════════════════════════════════════════════════════════════

describe('computeEffectiveMode', () => {
  const cases: Array<{
    declared: 'read' | 'write' | 'bidir';
    perm: PermissionGradient;
    lifecycle: SourceLifecycleState;
    expected: EffectiveMode;
  }> = [
    { declared: 'bidir', perm: 'write', lifecycle: 'blocked', expected: 'read' },
    { declared: 'bidir', perm: 'write', lifecycle: 'requires_action', expected: 'read' },
    { declared: 'bidir', perm: 'write', lifecycle: 'connected', expected: 'bidir' },
    { declared: 'bidir', perm: 'delegate', lifecycle: 'connected', expected: 'bidir' },
    { declared: 'bidir', perm: 'read', lifecycle: 'connected', expected: 'read' },
    { declared: 'bidir', perm: 'free_busy', lifecycle: 'connected', expected: 'read' },
    { declared: 'write', perm: 'write', lifecycle: 'connected', expected: 'write' },
    { declared: 'write', perm: 'delegate', lifecycle: 'connected', expected: 'write' },
    { declared: 'write', perm: 'read', lifecycle: 'connected', expected: 'read' },
    { declared: 'write', perm: 'free_busy', lifecycle: 'connected', expected: 'read' },
    { declared: 'read', perm: 'write', lifecycle: 'connected', expected: 'read' },
    { declared: 'read', perm: 'delegate', lifecycle: 'connected', expected: 'read' },
    { declared: 'read', perm: 'read', lifecycle: 'connected', expected: 'read' },
    { declared: 'read', perm: 'free_busy', lifecycle: 'connected', expected: 'read' },
    { declared: 'bidir', perm: 'write', lifecycle: 'degraded', expected: 'bidir' },
    { declared: 'bidir', perm: 'write', lifecycle: 'recoverable', expected: 'bidir' },
  ];

  it.each(cases)(
    'declared=$declared perm=$perm lifecycle=$lifecycle → $expected',
    ({ declared, perm, lifecycle, expected }) => {
      const result = computeEffectiveMode({
        declaredMode: declared,
        permissionGradient: perm,
        lifecycleState: lifecycle,
      } as CalendarSource);
      expect(result).toBe(expected);
    },
  );
});

// ═══════════════════════════════════════════════════════════════════════
// §3  Service unit tests — createCalendarSource
// ═══════════════════════════════════════════════════════════════════════

describe('createCalendarSource', () => {
  it('creates a source with correct defaults and reads it back', async () => {
    mockDbRun.mockResolvedValue({ changes: 1 });
    mockDbGet.mockResolvedValue(fakeSourceRow());

    const result = await createCalendarSource({
      organizationId: 'org-1',
      userId: 'usr-1',
      provider: 'google',
      accountRef: 'test@example.com',
      declaredMode: 'bidir',
    });

    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const insertArgs = mockDbRun.mock.calls[0];
    expect(insertArgs[0]).toContain('INSERT INTO v8_calendar_sources');
    const params = insertArgs[1] as unknown[];
    expect(params[3]).toBe('google');
    expect(params[6]).toBe('bidir');
    expect(params[8]).toBe('read'); // default permissionGradient
    expect(params[9]).toBe('connected'); // default lifecycle

    expect(result.provider).toBe('google');
    expect(result.organizationId).toBe('org-1');
  });

  it('throws when read-back fails', async () => {
    mockDbRun.mockResolvedValue({ changes: 1 });
    mockDbGet.mockResolvedValue(null);

    await expect(
      createCalendarSource({
        organizationId: 'org-1',
        userId: 'usr-1',
        provider: 'microsoft',
        accountRef: 'test@outlook.com',
        declaredMode: 'write',
      }),
    ).rejects.toThrow('Failed to read back created source');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §4  Service unit tests — updateSourceLifecycle
// ═══════════════════════════════════════════════════════════════════════

describe('updateSourceLifecycle', () => {
  it('transitions state and recomputes effectiveMode', async () => {
    mockDbGet
      .mockResolvedValueOnce(fakeSourceRow({ lifecycle_state: 'connected' }))
      .mockResolvedValueOnce(fakeSourceRow({ lifecycle_state: 'degraded', effective_mode: 'bidir' }));
    mockDbRun.mockResolvedValue({ changes: 1 });

    const result = await updateSourceLifecycle('src-1', 'org-1', 'degraded', 'rate limit');
    expect(result).not.toBeNull();
    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const updateArgs = mockDbRun.mock.calls[0];
    expect(updateArgs[0]).toContain('UPDATE v8_calendar_sources');
    expect(updateArgs[1][0]).toBe('degraded');
    expect(updateArgs[1][1]).toBe('rate limit');
  });

  it('returns null when source not found', async () => {
    mockDbGet.mockResolvedValue(null);
    const result = await updateSourceLifecycle('missing', 'org-1', 'blocked');
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §5  Service unit tests — performIncrementalSync
// ═══════════════════════════════════════════════════════════════════════

describe('performIncrementalSync', () => {
  it('skips sync for blocked source', async () => {
    mockDbGet.mockResolvedValue(
      fakeSourceRow({ lifecycle_state: 'blocked', requires_action_reason: 'account suspended' }),
    );

    const result = await performIncrementalSync('src-1', 'org-1');
    expect(result.itemsProcessed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('blocked');
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('skips sync for requires_action source', async () => {
    mockDbGet.mockResolvedValue(
      fakeSourceRow({ lifecycle_state: 'requires_action', requires_action_reason: 'reauth needed' }),
    );

    const result = await performIncrementalSync('src-1', 'org-1');
    expect(result.itemsProcessed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('requires action');
  });

  it('processes pending items for connected source', async () => {
    mockDbGet.mockResolvedValue(fakeSourceRow({ lifecycle_state: 'connected' }));
    mockDbAll.mockResolvedValue([
      fakeItemRow({ calendar_item_id: 'item-1', sync_state: 'pending' }),
      fakeItemRow({ calendar_item_id: 'item-2', sync_state: 'pending' }),
    ]);
    mockDbRun.mockResolvedValue({ changes: 1 });

    const result = await performIncrementalSync('src-1', 'org-1');
    expect(result.syncType).toBe('incremental');
    expect(result.itemsProcessed).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(result.checkpoint.lastIncrementalSyncAt).toBeTruthy();
    expect(result.checkpoint.cursor).toBeTruthy();
  });

  it('throws when source not found', async () => {
    mockDbGet.mockResolvedValue(null);
    await expect(performIncrementalSync('missing', 'org-1')).rejects.toThrow('not found');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §6  Service unit tests — performFullResync
// ═══════════════════════════════════════════════════════════════════════

describe('performFullResync', () => {
  it('resets checkpoint and sets all items to in_sync', async () => {
    mockDbGet.mockResolvedValue(fakeSourceRow({ lifecycle_state: 'recoverable' }));
    mockDbAll.mockResolvedValue([
      fakeItemRow({ calendar_item_id: 'item-1' }),
      fakeItemRow({ calendar_item_id: 'item-2' }),
      fakeItemRow({ calendar_item_id: 'item-3' }),
    ]);
    mockDbRun.mockResolvedValue({ changes: 1 });

    const result = await performFullResync('src-1', 'org-1');
    expect(result.syncType).toBe('full');
    expect(result.itemsProcessed).toBe(3);
    expect(result.checkpoint.cursor).toBeNull();
    expect(result.checkpoint.lastFullSyncAt).toBeTruthy();
    expect(result.checkpoint.lastIncrementalSyncAt).toBeNull();
    expect(result.errors).toHaveLength(0);
  });

  it('skips full resync for blocked source', async () => {
    mockDbGet.mockResolvedValue(fakeSourceRow({ lifecycle_state: 'blocked' }));

    const result = await performFullResync('src-1', 'org-1');
    expect(result.itemsProcessed).toBe(0);
    expect(result.errors[0]).toContain('blocked');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §7  Service unit tests — conditionalWriteItem (conflict detection)
// ═══════════════════════════════════════════════════════════════════════

describe('conditionalWriteItem', () => {
  it('detects etag mismatch and returns ConflictInfo', async () => {
    mockDbGet.mockResolvedValue(fakeItemRow({ etag: 'etag-server' }));
    mockDbRun.mockResolvedValue({ changes: 1 });

    const result = await conditionalWriteItem('item-1', 'org-1', { title: 'Updated' }, 'etag-stale');

    expect('itemId' in result).toBe(true);
    if ('itemId' in result) {
      expect(result.currentEtag).toBe('etag-server');
      expect(result.providedEtag).toBe('etag-stale');
      expect(result.syncState).toBe('conflict');
    }
  });

  it('succeeds when etag matches', async () => {
    mockDbGet
      .mockResolvedValueOnce(fakeItemRow({ etag: 'etag-match' }))
      .mockResolvedValueOnce(fakeItemRow({ etag: 'etag-match' }))
      .mockResolvedValueOnce(fakeItemRow({ etag: 'etag-new', title: 'Updated' }));
    mockDbRun.mockResolvedValue({ changes: 1 });

    const result = await conditionalWriteItem('item-1', 'org-1', { title: 'Updated' }, 'etag-match');

    expect('calendarItemId' in result).toBe(true);
  });

  it('throws when item not found', async () => {
    mockDbGet.mockResolvedValue(null);
    await expect(
      conditionalWriteItem('missing', 'org-1', { title: 'X' }, 'etag-x'),
    ).rejects.toThrow('not found');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §8  Service unit tests — resolveConflict
// ═══════════════════════════════════════════════════════════════════════

describe('resolveConflict', () => {
  it('accept_local transitions conflict → pending', async () => {
    mockDbGet
      .mockResolvedValueOnce(fakeItemRow({ sync_state: 'conflict' }))
      .mockResolvedValueOnce(fakeItemRow({ sync_state: 'pending' }));
    mockDbRun.mockResolvedValue({ changes: 1 });

    const result = await resolveConflict('item-1', 'org-1', 'accept_local');
    expect(result).not.toBeNull();
    expect(mockDbRun).toHaveBeenCalledTimes(1);
    const runArgs = mockDbRun.mock.calls[0][1] as unknown[];
    expect(runArgs[0]).toBe('pending');
  });

  it('accept_remote transitions conflict → in_sync', async () => {
    mockDbGet
      .mockResolvedValueOnce(fakeItemRow({ sync_state: 'conflict' }))
      .mockResolvedValueOnce(fakeItemRow({ sync_state: 'in_sync' }));
    mockDbRun.mockResolvedValue({ changes: 1 });

    const result = await resolveConflict('item-1', 'org-1', 'accept_remote');
    expect(result).not.toBeNull();
    const runArgs = mockDbRun.mock.calls[0][1] as unknown[];
    expect(runArgs[0]).toBe('in_sync');
  });

  it('merge transitions conflict → pending', async () => {
    mockDbGet
      .mockResolvedValueOnce(fakeItemRow({ sync_state: 'conflict' }))
      .mockResolvedValueOnce(fakeItemRow({ sync_state: 'pending' }));
    mockDbRun.mockResolvedValue({ changes: 1 });

    const result = await resolveConflict('item-1', 'org-1', 'merge');
    expect(result).not.toBeNull();
    const runArgs = mockDbRun.mock.calls[0][1] as unknown[];
    expect(runArgs[0]).toBe('pending');
  });

  it('returns existing item if syncState is not conflict', async () => {
    mockDbGet.mockResolvedValue(fakeItemRow({ sync_state: 'in_sync' }));

    const result = await resolveConflict('item-1', 'org-1', 'accept_local');
    expect(result).not.toBeNull();
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('returns null when item not found', async () => {
    mockDbGet.mockResolvedValue(null);
    const result = await resolveConflict('missing', 'org-1', 'accept_local');
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §9  Service unit tests — handleSyncError + mapProviderError
// ═══════════════════════════════════════════════════════════════════════

describe('handleSyncError', () => {
  it('maps token_expired → requires_action', async () => {
    mockDbRun.mockResolvedValue({ changes: 1 });
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(fakeSourceRow({ lifecycle_state: 'requires_action' }));

    await handleSyncError('src-1', 'org-1', 'token_expired');

    const runArgs = mockDbRun.mock.calls[0][1] as unknown[];
    expect(runArgs[0]).toBe('requires_action');
  });

  it('maps rate_limited → degraded', async () => {
    mockDbRun.mockResolvedValue({ changes: 1 });
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(fakeSourceRow({ lifecycle_state: 'degraded' }));

    await handleSyncError('src-1', 'org-1', 'rate_limited');

    const runArgs = mockDbRun.mock.calls[0][1] as unknown[];
    expect(runArgs[0]).toBe('degraded');
  });

  it('maps sync_token_invalid → recoverable', async () => {
    mockDbRun.mockResolvedValue({ changes: 1 });
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(fakeSourceRow({ lifecycle_state: 'recoverable' }));

    await handleSyncError('src-1', 'org-1', 'sync_token_invalid');

    const runArgs = mockDbRun.mock.calls[0][1] as unknown[];
    expect(runArgs[0]).toBe('recoverable');
  });

  it('maps calendar_deleted → blocked', async () => {
    mockDbRun.mockResolvedValue({ changes: 1 });
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(fakeSourceRow({ lifecycle_state: 'blocked' }));

    await handleSyncError('src-1', 'org-1', 'calendar_deleted');

    const runArgs = mockDbRun.mock.calls[0][1] as unknown[];
    expect(runArgs[0]).toBe('blocked');
  });
});

describe('mapProviderError', () => {
  it.each([
    ['token_expired', 'requires_action'],
    ['token_revoked', 'requires_action'],
    ['insufficient_permissions', 'requires_action'],
    ['rate_limited', 'degraded'],
    ['quota_exceeded', 'degraded'],
    ['provider_unavailable', 'degraded'],
    ['network_error', 'degraded'],
    ['calendar_not_found', 'requires_action'],
    ['calendar_deleted', 'blocked'],
    ['sync_token_invalid', 'recoverable'],
    ['data_corruption', 'blocked'],
    ['account_suspended', 'blocked'],
  ] as const)('maps %s → sourceState=%s', (errorType, expectedState) => {
    const mapping = mapProviderError(errorType);
    expect(mapping.sourceState).toBe(expectedState);
    expect(mapping.recovery.length).toBeGreaterThan(10);
  });

  it('returns default degraded mapping for unknown errors', () => {
    const mapping = mapProviderError('totally_unknown_error');
    expect(mapping.sourceState).toBe('degraded');
    expect(mapping.itemState).toBe('stale');
    expect(mapping.recovery).toContain('unexpected');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// §10  Service unit tests — getSourceHealth
// ═══════════════════════════════════════════════════════════════════════

describe('getSourceHealth', () => {
  it('aggregates lifecycle states correctly', async () => {
    mockDbAll.mockResolvedValue([
      fakeSourceRow({ calendar_source_id: 's1', lifecycle_state: 'connected' }),
      fakeSourceRow({ calendar_source_id: 's2', lifecycle_state: 'connected' }),
      fakeSourceRow({ calendar_source_id: 's3', lifecycle_state: 'degraded' }),
      fakeSourceRow({ calendar_source_id: 's4', lifecycle_state: 'requires_action' }),
      fakeSourceRow({ calendar_source_id: 's5', lifecycle_state: 'blocked' }),
    ]);

    const health = await getSourceHealth('org-1');
    expect(health.totalSources).toBe(5);
    expect(health.connected).toBe(2);
    expect(health.degraded).toBe(1);
    expect(health.requiresAction).toBe(1);
    expect(health.blocked).toBe(1);
    expect(health.recoverable).toBe(0);
  });

  it('returns zeroes for org with no sources', async () => {
    mockDbAll.mockResolvedValue([]);

    const health = await getSourceHealth('org-empty');
    expect(health.totalSources).toBe(0);
    expect(health.connected).toBe(0);
    expect(health.degraded).toBe(0);
  });
});
