import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  ActorAttribution,
  CaptureSnapshotParams,
  RecordAuditEntryParams,
} from '../../../types/versionReplay.js';
import {
  ActorAttributionSchema,
  AuditActionValues,
  AuditEntrySchema,
  CaptureSnapshotParamsSchema,
  RecordAuditEntryParamsSchema,
  RequestRestoreParamsSchema,
  RestoreRequestSchema,
  RestoreStatusValues,
  SnapshotTriggerValues,
  VersionCompareResultSchema,
  VersionSnapshotSchema,
} from '../../../types/versionReplay.js';

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
  applyRestore,
  captureVersionSnapshot,
  compareVersions,
  getAuditTrail,
  getVersionHistory,
  getVersionSnapshot,
  recordAuditEntry,
  requestRestore,
} from '../versionReplayService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const ROOM_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const SNAPSHOT_ID_1 = '00000000-0000-4000-a000-000000000011';
const SNAPSHOT_ID_2 = '00000000-0000-4000-a000-000000000012';
const RESTORE_ID = '00000000-0000-4000-a000-000000000021';

const HUMAN_ACTOR: ActorAttribution = {
  actorId: '00000000-0000-4000-8000-000000000003',
  actorType: 'human',
  actorDisplayName: 'Jan Kowalski',
};

const AI_ACTOR: ActorAttribution = {
  actorId: 'ai-agent-001',
  actorType: 'ai_agent',
  actorDisplayName: 'Teresa AI',
};

const SYSTEM_ACTOR: ActorAttribution = {
  actorId: 'system',
  actorType: 'system',
  actorDisplayName: 'System',
};

function makeSnapshotParams(overrides?: Partial<CaptureSnapshotParams>): CaptureSnapshotParams {
  return {
    roomId: ROOM_ID,
    resourceType: 'workspace',
    resourceId: 'ws-001',
    organizationId: ORG_ID,
    stateData: { title: 'Test', content: 'Hello' },
    triggerType: 'manual_save',
    capturedBy: HUMAN_ACTOR,
    metadata: { source: 'test' },
    ...overrides,
  };
}

function makeFakeSnapshotRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    snapshot_id: SNAPSHOT_ID_1,
    room_id: ROOM_ID,
    resource_type: 'workspace',
    resource_id: 'ws-001',
    organization_id: ORG_ID,
    state_version: 0,
    state_data: JSON.stringify({ title: 'Test', content: 'Hello' }),
    trigger_type: 'manual_save',
    captured_by_actor_id: HUMAN_ACTOR.actorId,
    captured_by_actor_type: 'human',
    captured_by_display_name: 'Jan Kowalski',
    captured_at: '2026-03-23T10:00:00.000Z',
    metadata: JSON.stringify({ source: 'test' }),
    ...overrides,
  };
}

function makeFakeRestoreRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    restore_id: RESTORE_ID,
    room_id: ROOM_ID,
    resource_type: 'workspace',
    resource_id: 'ws-001',
    organization_id: ORG_ID,
    target_version_snapshot_id: SNAPSHOT_ID_1,
    requested_by_actor_id: HUMAN_ACTOR.actorId,
    requested_by_actor_type: 'human',
    requested_by_display_name: 'Jan Kowalski',
    status: 'pending',
    safety_snapshot_id: SNAPSHOT_ID_2,
    requested_at: '2026-03-23T10:05:00.000Z',
    resolved_at: null,
    ...overrides,
  };
}

function makeFakeAuditRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    entry_id: '00000000-0000-4000-a000-000000000031',
    room_id: ROOM_ID,
    resource_type: 'workspace',
    resource_id: 'ws-001',
    organization_id: ORG_ID,
    actor_id: HUMAN_ACTOR.actorId,
    actor_type: 'human',
    actor_display_name: 'Jan Kowalski',
    action: 'snapshot.created',
    state_version_before: null,
    state_version_after: 0,
    metadata: JSON.stringify({}),
    timestamp: '2026-03-23T10:00:00.000Z',
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
// captureVersionSnapshot
// ------------------------------------------

describe('captureVersionSnapshot', () => {
  it('captures a snapshot with the next monotonic stateVersion', async () => {
    mockDbGet.mockResolvedValueOnce({ max_version: null });

    const result = await captureVersionSnapshot(makeSnapshotParams());

    expect(result.snapshotId).toBeDefined();
    expect(result.stateVersion).toBe(0);
    expect(result.resourceType).toBe('workspace');
    expect(result.resourceId).toBe('ws-001');
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.triggerType).toBe('manual_save');
    expect(result.capturedBy).toEqual(HUMAN_ACTOR);
    expect(result.stateData).toEqual({ title: 'Test', content: 'Hello' });

    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_version_snapshots');
  });

  it('increments stateVersion from existing snapshots', async () => {
    mockDbGet.mockResolvedValueOnce({ max_version: 4 });

    const result = await captureVersionSnapshot(makeSnapshotParams());

    expect(result.stateVersion).toBe(5);
  });

  it('supports all trigger types', async () => {
    for (const trigger of SnapshotTriggerValues) {
      mockDbGet.mockResolvedValueOnce({ max_version: null });

      const result = await captureVersionSnapshot(makeSnapshotParams({ triggerType: trigger }));

      expect(result.triggerType).toBe(trigger);
    }
  });

  it('supports null roomId for out-of-room snapshots', async () => {
    mockDbGet.mockResolvedValueOnce({ max_version: null });

    const result = await captureVersionSnapshot(makeSnapshotParams({ roomId: null }));

    expect(result.roomId).toBeNull();
  });

  it('defaults metadata to empty object', async () => {
    mockDbGet.mockResolvedValueOnce({ max_version: null });

    const result = await captureVersionSnapshot(makeSnapshotParams({ metadata: undefined }));

    expect(result.metadata).toEqual({});
  });

  it('rejects missing required fields via Zod', async () => {
    await expect(captureVersionSnapshot({ organizationId: ORG_ID } as any)).rejects.toThrow(
      ZodError
    );
  });

  it('rejects invalid organizationId UUID', async () => {
    await expect(
      captureVersionSnapshot(makeSnapshotParams({ organizationId: 'not-uuid' }))
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// getVersionHistory
// ------------------------------------------

describe('getVersionHistory', () => {
  it('returns paginated version history ordered by stateVersion DESC', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSnapshotRow({ state_version: 2 }),
      makeFakeSnapshotRow({ snapshot_id: 'snap-2', state_version: 1 }),
    ]);

    const results = await getVersionHistory(ROOM_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].stateVersion).toBe(2);
    expect(results[1].stateVersion).toBe(1);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('ORDER BY state_version DESC');
  });

  it('filters by triggerType when provided', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeSnapshotRow({ trigger_type: 'auto_cadence' })]);

    const results = await getVersionHistory(ROOM_ID, ORG_ID, { triggerType: 'auto_cadence' });

    expect(results).toHaveLength(1);
    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('trigger_type = ?');
  });

  it('supports pagination with limit and offset', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getVersionHistory(ROOM_ID, ORG_ID, { limit: 10, offset: 20 });

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(10);
    expect(params).toContain(20);
  });

  it('returns empty array when no snapshots exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getVersionHistory(ROOM_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// getVersionSnapshot
// ------------------------------------------

describe('getVersionSnapshot', () => {
  it('returns a snapshot when found with org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSnapshotRow());

    const result = await getVersionSnapshot(SNAPSHOT_ID_1, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.snapshotId).toBe(SNAPSHOT_ID_1);
    expect(result!.organizationId).toBe(ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id = ?');
  });

  it('returns null when snapshot not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getVersionSnapshot('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation — different org returns null', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getVersionSnapshot(SNAPSHOT_ID_1, OTHER_ORG_ID);
    expect(result).toBeNull();
  });
});

// ------------------------------------------
// compareVersions
// ------------------------------------------

describe('compareVersions', () => {
  it('produces structural diff between two snapshots', async () => {
    mockDbGet
      .mockResolvedValueOnce(
        makeFakeSnapshotRow({
          snapshot_id: SNAPSHOT_ID_1,
          state_version: 0,
          state_data: JSON.stringify({ title: 'Old', content: 'Hello' }),
        })
      )
      .mockResolvedValueOnce(
        makeFakeSnapshotRow({
          snapshot_id: SNAPSHOT_ID_2,
          state_version: 1,
          state_data: JSON.stringify({ title: 'New', content: 'Hello', extra: true }),
        })
      );

    const result = await compareVersions(SNAPSHOT_ID_1, SNAPSHOT_ID_2, ORG_ID);

    expect(result.fromVersion).toBe(0);
    expect(result.toVersion).toBe(1);
    expect(result.fromSnapshotId).toBe(SNAPSHOT_ID_1);
    expect(result.toSnapshotId).toBe(SNAPSHOT_ID_2);

    const titleChange = result.changes.find((c) => c.path === 'title');
    expect(titleChange).toBeDefined();
    expect(titleChange!.changeType).toBe('modified');
    expect(titleChange!.before).toBe('Old');
    expect(titleChange!.after).toBe('New');

    const extraChange = result.changes.find((c) => c.path === 'extra');
    expect(extraChange).toBeDefined();
    expect(extraChange!.changeType).toBe('added');

    const contentChange = result.changes.find((c) => c.path === 'content');
    expect(contentChange).toBeUndefined();
  });

  it('detects removed keys', async () => {
    mockDbGet
      .mockResolvedValueOnce(
        makeFakeSnapshotRow({
          snapshot_id: SNAPSHOT_ID_1,
          state_version: 0,
          state_data: JSON.stringify({ title: 'Test', removed_field: 'gone' }),
        })
      )
      .mockResolvedValueOnce(
        makeFakeSnapshotRow({
          snapshot_id: SNAPSHOT_ID_2,
          state_version: 1,
          state_data: JSON.stringify({ title: 'Test' }),
        })
      );

    const result = await compareVersions(SNAPSHOT_ID_1, SNAPSHOT_ID_2, ORG_ID);

    const removedChange = result.changes.find((c) => c.path === 'removed_field');
    expect(removedChange).toBeDefined();
    expect(removedChange!.changeType).toBe('removed');
  });

  it('returns empty changes for identical snapshots', async () => {
    const data = JSON.stringify({ title: 'Same' });
    mockDbGet
      .mockResolvedValueOnce(makeFakeSnapshotRow({ snapshot_id: SNAPSHOT_ID_1, state_data: data }))
      .mockResolvedValueOnce(makeFakeSnapshotRow({ snapshot_id: SNAPSHOT_ID_2, state_data: data }));

    const result = await compareVersions(SNAPSHOT_ID_1, SNAPSHOT_ID_2, ORG_ID);
    expect(result.changes).toHaveLength(0);
  });

  it('throws when source snapshot not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(compareVersions('nonexistent', SNAPSHOT_ID_2, ORG_ID)).rejects.toThrow(
      'Source snapshot nonexistent not found'
    );
  });

  it('throws when target snapshot not found', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSnapshotRow()).mockResolvedValueOnce(null);

    await expect(compareVersions(SNAPSHOT_ID_1, 'nonexistent', ORG_ID)).rejects.toThrow(
      'Target snapshot nonexistent not found'
    );
  });

  it('throws when comparing snapshots from different resources', async () => {
    mockDbGet
      .mockResolvedValueOnce(makeFakeSnapshotRow({ resource_id: 'ws-001' }))
      .mockResolvedValueOnce(makeFakeSnapshotRow({ resource_id: 'ws-002' }));

    await expect(compareVersions(SNAPSHOT_ID_1, SNAPSHOT_ID_2, ORG_ID)).rejects.toThrow(
      'Cannot compare snapshots from different resources'
    );
  });
});

// ------------------------------------------
// requestRestore
// ------------------------------------------

describe('requestRestore', () => {
  it('creates a restore request with auto-captured safety snapshot', async () => {
    mockDbGet
      .mockResolvedValueOnce(makeFakeSnapshotRow({ snapshot_id: SNAPSHOT_ID_1 }))
      .mockResolvedValueOnce({ max_version: 2 });

    const result = await requestRestore({
      roomId: ROOM_ID,
      resourceType: 'workspace',
      resourceId: 'ws-001',
      organizationId: ORG_ID,
      targetVersionSnapshotId: SNAPSHOT_ID_1,
      requestedBy: HUMAN_ACTOR,
      currentStateData: { title: 'Current', content: 'Latest' },
    });

    expect(result.restoreId).toBeDefined();
    expect(result.status).toBe('pending');
    expect(result.targetVersionSnapshotId).toBe(SNAPSHOT_ID_1);
    expect(result.safetySnapshotId).toBeDefined();
    expect(result.safetySnapshotId).not.toBeNull();
    expect(result.requestedBy).toEqual(HUMAN_ACTOR);
    expect(result.resolvedAt).toBeNull();
  });

  it('throws when target snapshot not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      requestRestore({
        roomId: ROOM_ID,
        resourceType: 'workspace',
        resourceId: 'ws-001',
        organizationId: ORG_ID,
        targetVersionSnapshotId: SNAPSHOT_ID_1,
        requestedBy: HUMAN_ACTOR,
        currentStateData: {},
      })
    ).rejects.toThrow(`Target snapshot ${SNAPSHOT_ID_1} not found`);
  });
});

// ------------------------------------------
// applyRestore
// ------------------------------------------

describe('applyRestore', () => {
  it('applies a pending restore as a forward operation (stateVersion increments)', async () => {
    mockDbGet
      .mockResolvedValueOnce(makeFakeRestoreRow({ status: 'pending' }))
      .mockResolvedValueOnce(
        makeFakeSnapshotRow({
          snapshot_id: SNAPSHOT_ID_1,
          state_data: JSON.stringify({ title: 'Restored' }),
        })
      )
      .mockResolvedValueOnce({ max_version: 5 })
      .mockResolvedValueOnce(
        makeFakeSnapshotRow({
          snapshot_id: SNAPSHOT_ID_2,
          state_version: 3,
        })
      );

    const result = await applyRestore(RESTORE_ID, ORG_ID);

    expect(result.status).toBe('applied');
    expect(result.resolvedAt).not.toBeNull();

    const updateSql = mockDbRun.mock.calls.find((call) =>
      (call[0] as string).includes('UPDATE v8_restore_requests')
    );
    expect(updateSql).toBeDefined();
  });

  it('throws when restore request not found', async () => {
    mockDbGet.mockResolvedValue(null);

    await expect(applyRestore(RESTORE_ID, ORG_ID)).rejects.toThrow(
      `Restore request ${RESTORE_ID} not found`
    );

    mockDbGet.mockReset().mockResolvedValue(null);
  });

  it('throws when restore request is already applied', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRestoreRow({ status: 'applied' }));

    await expect(applyRestore(RESTORE_ID, ORG_ID)).rejects.toThrow('already applied, cannot apply');
  });

  it('throws when restore request is rejected', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRestoreRow({ status: 'rejected' }));

    await expect(applyRestore(RESTORE_ID, ORG_ID)).rejects.toThrow(
      'already rejected, cannot apply'
    );
  });
});

// ------------------------------------------
// Actor attribution
// ------------------------------------------

describe('actor attribution', () => {
  it('captures human actor attribution on snapshot', async () => {
    mockDbGet.mockResolvedValueOnce({ max_version: null });

    const result = await captureVersionSnapshot(makeSnapshotParams({ capturedBy: HUMAN_ACTOR }));

    expect(result.capturedBy.actorType).toBe('human');
    expect(result.capturedBy.actorDisplayName).toBe('Jan Kowalski');
  });

  it('captures AI actor attribution on snapshot', async () => {
    mockDbGet.mockResolvedValueOnce({ max_version: null });

    const result = await captureVersionSnapshot(makeSnapshotParams({ capturedBy: AI_ACTOR }));

    expect(result.capturedBy.actorType).toBe('ai_agent');
    expect(result.capturedBy.actorDisplayName).toBe('Teresa AI');
  });

  it('captures system actor attribution on snapshot', async () => {
    mockDbGet.mockResolvedValueOnce({ max_version: null });

    const result = await captureVersionSnapshot(
      makeSnapshotParams({
        capturedBy: SYSTEM_ACTOR,
        triggerType: 'auto_cadence',
      })
    );

    expect(result.capturedBy.actorType).toBe('system');
  });

  it('records actor attribution in audit entries', async () => {
    const result = await recordAuditEntry({
      roomId: ROOM_ID,
      resourceType: 'workspace',
      resourceId: 'ws-001',
      organizationId: ORG_ID,
      actorAttribution: AI_ACTOR,
      action: 'ai.proposal_accepted',
      stateVersionBefore: 1,
      stateVersionAfter: 2,
    });

    expect(result.actorAttribution.actorType).toBe('ai_agent');
    expect(result.actorAttribution.actorDisplayName).toBe('Teresa AI');
  });
});

// ------------------------------------------
// recordAuditEntry
// ------------------------------------------

describe('recordAuditEntry', () => {
  it('records an audit entry with all fields', async () => {
    const result = await recordAuditEntry({
      roomId: ROOM_ID,
      resourceType: 'workspace',
      resourceId: 'ws-001',
      organizationId: ORG_ID,
      actorAttribution: HUMAN_ACTOR,
      action: 'snapshot.created',
      stateVersionBefore: null,
      stateVersionAfter: 0,
      metadata: { trigger: 'manual_save' },
    });

    expect(result.entryId).toBeDefined();
    expect(result.action).toBe('snapshot.created');
    expect(result.stateVersionBefore).toBeNull();
    expect(result.stateVersionAfter).toBe(0);
    expect(result.metadata).toEqual({ trigger: 'manual_save' });

    const insertSql = mockDbRun.mock.calls[0][0] as string;
    expect(insertSql).toContain('INSERT INTO v8_audit_entries');
  });

  it('supports all audit action types', async () => {
    for (const action of AuditActionValues) {
      vi.clearAllMocks();

      const result = await recordAuditEntry({
        roomId: ROOM_ID,
        resourceType: 'workspace',
        resourceId: 'ws-001',
        organizationId: ORG_ID,
        actorAttribution: HUMAN_ACTOR,
        action,
      });

      expect(result.action).toBe(action);
    }
  });

  it('defaults metadata to empty object', async () => {
    const result = await recordAuditEntry({
      roomId: ROOM_ID,
      resourceType: 'workspace',
      resourceId: 'ws-001',
      organizationId: ORG_ID,
      actorAttribution: HUMAN_ACTOR,
      action: 'edit.committed',
    });

    expect(result.metadata).toEqual({});
  });

  it('rejects invalid action via Zod', async () => {
    await expect(
      recordAuditEntry({
        roomId: ROOM_ID,
        resourceType: 'workspace',
        resourceId: 'ws-001',
        organizationId: ORG_ID,
        actorAttribution: HUMAN_ACTOR,
        action: 'invalid.action' as any,
      })
    ).rejects.toThrow(ZodError);
  });
});

// ------------------------------------------
// getAuditTrail
// ------------------------------------------

describe('getAuditTrail', () => {
  it('returns paginated audit trail ordered by timestamp DESC', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeAuditRow({ timestamp: '2026-03-23T10:05:00.000Z' }),
      makeFakeAuditRow({ entry_id: 'e2', timestamp: '2026-03-23T10:00:00.000Z' }),
    ]);

    const results = await getAuditTrail(ROOM_ID, ORG_ID);

    expect(results).toHaveLength(2);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('ORDER BY timestamp DESC');
  });

  it('filters by action when provided', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeAuditRow({ action: 'restore.applied' })]);

    await getAuditTrail(ROOM_ID, ORG_ID, { action: 'restore.applied' });

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('action = ?');
  });

  it('filters by actorId when provided', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getAuditTrail(ROOM_ID, ORG_ID, { actorId: HUMAN_ACTOR.actorId });

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('actor_id = ?');
  });

  it('supports pagination with limit and offset', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getAuditTrail(ROOM_ID, ORG_ID, { limit: 10, offset: 20 });

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(10);
    expect(params).toContain(20);
  });

  it('returns empty array when no audit entries exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getAuditTrail(ROOM_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// Org isolation
// ------------------------------------------

describe('org isolation', () => {
  it('getVersionSnapshot enforces organization_id in query', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getVersionSnapshot(SNAPSHOT_ID_1, OTHER_ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id = ?');
    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });

  it('getVersionHistory enforces organization_id in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getVersionHistory(ROOM_ID, OTHER_ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id = ?');
  });

  it('getAuditTrail enforces organization_id in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getAuditTrail(ROOM_ID, OTHER_ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('organization_id = ?');
  });

  it('applyRestore enforces organization_id in query', async () => {
    mockDbGet.mockResolvedValue(null);

    await expect(applyRestore(RESTORE_ID, OTHER_ORG_ID)).rejects.toThrow(
      `Restore request ${RESTORE_ID} not found in organization ${OTHER_ORG_ID}`
    );

    mockDbGet.mockReset().mockResolvedValue(null);
  });
});

// ------------------------------------------
// Zod schema validation
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates ActorAttribution', () => {
    expect(() => ActorAttributionSchema.parse(HUMAN_ACTOR)).not.toThrow();
    expect(() => ActorAttributionSchema.parse(AI_ACTOR)).not.toThrow();
    expect(() => ActorAttributionSchema.parse(SYSTEM_ACTOR)).not.toThrow();
  });

  it('rejects ActorAttribution with invalid actorType', () => {
    expect(() => ActorAttributionSchema.parse({ ...HUMAN_ACTOR, actorType: 'robot' })).toThrow(
      ZodError
    );
  });

  it('validates VersionSnapshot', () => {
    expect(() =>
      VersionSnapshotSchema.parse({
        snapshotId: SNAPSHOT_ID_1,
        roomId: ROOM_ID,
        resourceType: 'workspace',
        resourceId: 'ws-001',
        organizationId: ORG_ID,
        stateVersion: 0,
        stateData: {},
        triggerType: 'manual_save',
        capturedBy: HUMAN_ACTOR,
        capturedAt: '2026-03-23T10:00:00.000Z',
        metadata: {},
      })
    ).not.toThrow();
  });

  it('rejects VersionSnapshot with invalid triggerType', () => {
    expect(() =>
      VersionSnapshotSchema.parse({
        snapshotId: SNAPSHOT_ID_1,
        roomId: ROOM_ID,
        resourceType: 'workspace',
        resourceId: 'ws-001',
        organizationId: ORG_ID,
        stateVersion: 0,
        stateData: {},
        triggerType: 'invalid_trigger',
        capturedBy: HUMAN_ACTOR,
        capturedAt: '2026-03-23T10:00:00.000Z',
        metadata: {},
      })
    ).toThrow(ZodError);
  });

  it('validates RestoreRequest', () => {
    expect(() =>
      RestoreRequestSchema.parse({
        restoreId: RESTORE_ID,
        roomId: ROOM_ID,
        resourceType: 'workspace',
        resourceId: 'ws-001',
        organizationId: ORG_ID,
        targetVersionSnapshotId: SNAPSHOT_ID_1,
        requestedBy: HUMAN_ACTOR,
        status: 'pending',
        safetySnapshotId: SNAPSHOT_ID_2,
        requestedAt: '2026-03-23T10:00:00.000Z',
        resolvedAt: null,
      })
    ).not.toThrow();
  });

  it('validates AuditEntry', () => {
    expect(() =>
      AuditEntrySchema.parse({
        entryId: '00000000-0000-4000-8000-aaaaaaaaaa01',
        roomId: ROOM_ID,
        resourceType: 'workspace',
        resourceId: 'ws-001',
        organizationId: ORG_ID,
        actorAttribution: HUMAN_ACTOR,
        action: 'snapshot.created',
        stateVersionBefore: null,
        stateVersionAfter: 0,
        metadata: {},
        timestamp: '2026-03-23T10:00:00.000Z',
      })
    ).not.toThrow();
  });

  it('validates CaptureSnapshotParams', () => {
    expect(() => CaptureSnapshotParamsSchema.parse(makeSnapshotParams())).not.toThrow();
  });

  it('validates RecordAuditEntryParams', () => {
    expect(() =>
      RecordAuditEntryParamsSchema.parse({
        roomId: ROOM_ID,
        resourceType: 'workspace',
        resourceId: 'ws-001',
        organizationId: ORG_ID,
        actorAttribution: HUMAN_ACTOR,
        action: 'snapshot.created',
      })
    ).not.toThrow();
  });

  it('validates RequestRestoreParams', () => {
    expect(() =>
      RequestRestoreParamsSchema.parse({
        roomId: ROOM_ID,
        resourceType: 'workspace',
        resourceId: 'ws-001',
        organizationId: ORG_ID,
        targetVersionSnapshotId: SNAPSHOT_ID_1,
        requestedBy: HUMAN_ACTOR,
        currentStateData: { title: 'Current' },
      })
    ).not.toThrow();
  });

  it('validates all SnapshotTrigger values', () => {
    for (const trigger of SnapshotTriggerValues) {
      expect(() =>
        CaptureSnapshotParamsSchema.parse(makeSnapshotParams({ triggerType: trigger }))
      ).not.toThrow();
    }
  });

  it('validates all RestoreStatus values', () => {
    for (const status of RestoreStatusValues) {
      expect(() =>
        RestoreRequestSchema.parse({
          restoreId: RESTORE_ID,
          roomId: ROOM_ID,
          resourceType: 'workspace',
          resourceId: 'ws-001',
          organizationId: ORG_ID,
          targetVersionSnapshotId: SNAPSHOT_ID_1,
          requestedBy: HUMAN_ACTOR,
          status,
          safetySnapshotId: null,
          requestedAt: '2026-03-23T10:00:00.000Z',
          resolvedAt: null,
        })
      ).not.toThrow();
    }
  });

  it('validates all AuditAction values', () => {
    for (const action of AuditActionValues) {
      expect(() =>
        AuditEntrySchema.parse({
          entryId: '00000000-0000-4000-8000-aaaaaaaaaa01',
          roomId: ROOM_ID,
          resourceType: 'workspace',
          resourceId: 'ws-001',
          organizationId: ORG_ID,
          actorAttribution: HUMAN_ACTOR,
          action,
          stateVersionBefore: null,
          stateVersionAfter: null,
          metadata: {},
          timestamp: '2026-03-23T10:00:00.000Z',
        })
      ).not.toThrow();
    }
  });
});
