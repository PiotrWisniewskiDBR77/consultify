import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActorAttribution } from '../../../types/versionReplay.js';

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
  detectAIStaleness,
  getAuditSummary,
  getLatestSnapshot,
  getPendingRestores,
  getResourceHistory,
  getSnapshotsByResource,
  rejectRestore,
  rollbackToSnapshot,
} from '../versionReplayService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const RESOURCE_ID = 'ws-001';
const ROOM_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';
const SNAPSHOT_ID_1 = '00000000-0000-4000-a000-000000000011';
const SNAPSHOT_ID_2 = '00000000-0000-4000-a000-000000000012';
const RESTORE_ID = '00000000-0000-4000-a000-000000000021';

const HUMAN_ACTOR: ActorAttribution = {
  actorId: '00000000-0000-4000-8000-000000000003',
  actorType: 'human',
  actorDisplayName: 'Jan Kowalski',
};

function makeFakeSnapshotRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    snapshot_id: SNAPSHOT_ID_1,
    room_id: ROOM_ID,
    resource_type: 'workspace',
    resource_id: RESOURCE_ID,
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
    resource_id: RESOURCE_ID,
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
    resource_id: RESOURCE_ID,
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
// getSnapshotsByResource
// ------------------------------------------

describe('getSnapshotsByResource', () => {
  it('returns snapshots for a resource ordered by version desc', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSnapshotRow({ state_version: 3 }),
      makeFakeSnapshotRow({ snapshot_id: SNAPSHOT_ID_2, state_version: 2 }),
    ]);

    const results = await getSnapshotsByResource(RESOURCE_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].stateVersion).toBe(3);
    expect(results[1].stateVersion).toBe(2);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('resource_id = ?');
    expect(query).toContain('organization_id = ?');
    expect(query).toContain('ORDER BY state_version DESC');
  });

  it('uses default limit of 50', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getSnapshotsByResource(RESOURCE_ID, ORG_ID);

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params[2]).toBe(50);
  });

  it('accepts custom limit', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getSnapshotsByResource(RESOURCE_ID, ORG_ID, 10);

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params[2]).toBe(10);
  });

  it('returns empty array when no snapshots exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getSnapshotsByResource(RESOURCE_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// getLatestSnapshot
// ------------------------------------------

describe('getLatestSnapshot', () => {
  it('returns the most recent snapshot for a resource', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeSnapshotRow({ state_version: 5 }));

    const result = await getLatestSnapshot(RESOURCE_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.stateVersion).toBe(5);
    expect(result!.resourceId).toBe(RESOURCE_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('ORDER BY state_version DESC');
    expect(query).toContain('LIMIT 1');
  });

  it('returns null when no snapshots exist', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getLatestSnapshot(RESOURCE_ID, ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await getLatestSnapshot(RESOURCE_ID, ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id = ?');
    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(ORG_ID);
  });
});

// ------------------------------------------
// rollbackToSnapshot
// ------------------------------------------

describe('rollbackToSnapshot', () => {
  it('performs full rollback flow and returns applied restore request', async () => {
    // getVersionSnapshot (target)
    mockDbGet.mockResolvedValueOnce(
      makeFakeSnapshotRow({ snapshot_id: SNAPSHOT_ID_1, state_version: 2 })
    );
    // getLatestSnapshot
    mockDbGet.mockResolvedValueOnce(
      makeFakeSnapshotRow({ state_version: 5, state_data: JSON.stringify({ title: 'Current' }) })
    );
    // requestRestore → getVersionSnapshot (target again)
    mockDbGet.mockResolvedValueOnce(
      makeFakeSnapshotRow({ snapshot_id: SNAPSHOT_ID_1, state_version: 2 })
    );
    // requestRestore → captureVersionSnapshot → getNextStateVersion
    mockDbGet.mockResolvedValueOnce({ max_version: 5 });
    // applyRestore → dbGet restore row
    mockDbGet.mockResolvedValueOnce(makeFakeRestoreRow({ status: 'pending' }));
    // applyRestore → getVersionSnapshot (target)
    mockDbGet.mockResolvedValueOnce(
      makeFakeSnapshotRow({ snapshot_id: SNAPSHOT_ID_1, state_version: 2 })
    );
    // applyRestore → captureVersionSnapshot → getNextStateVersion
    mockDbGet.mockResolvedValueOnce({ max_version: 6 });
    // applyRestore → recordAuditEntry → getVersionSnapshot (safety)
    mockDbGet.mockResolvedValueOnce(
      makeFakeSnapshotRow({ snapshot_id: SNAPSHOT_ID_2, state_version: 6 })
    );

    const result = await rollbackToSnapshot(SNAPSHOT_ID_1, ORG_ID, HUMAN_ACTOR);

    expect(result.status).toBe('applied');
    expect(result.resolvedAt).not.toBeNull();
  });

  it('throws when target snapshot not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(rollbackToSnapshot(SNAPSHOT_ID_1, ORG_ID, HUMAN_ACTOR)).rejects.toThrow(
      `Snapshot ${SNAPSHOT_ID_1} not found`
    );
  });
});

// ------------------------------------------
// detectAIStaleness
// ------------------------------------------

describe('detectAIStaleness', () => {
  it('returns not stale when no AI snapshot exists', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await detectAIStaleness(RESOURCE_ID, ORG_ID);

    expect(result.isStale).toBe(false);
    expect(result.lastAISnapshotAt).toBeNull();
    expect(result.ageMs).toBeNull();
  });

  it('returns stale when AI snapshot is older than threshold', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    mockDbGet.mockResolvedValueOnce(
      makeFakeSnapshotRow({
        trigger_type: 'ai_proposal_accepted',
        captured_at: twoHoursAgo,
      })
    );

    const result = await detectAIStaleness(RESOURCE_ID, ORG_ID);

    expect(result.isStale).toBe(true);
    expect(result.lastAISnapshotAt).toBe(twoHoursAgo);
    expect(result.ageMs).toBeGreaterThan(60 * 60 * 1000);
  });

  it('returns not stale when AI snapshot is within threshold', async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    mockDbGet.mockResolvedValueOnce(
      makeFakeSnapshotRow({
        trigger_type: 'ai_proposal_accepted',
        captured_at: fiveMinutesAgo,
      })
    );

    const result = await detectAIStaleness(RESOURCE_ID, ORG_ID);

    expect(result.isStale).toBe(false);
    expect(result.lastAISnapshotAt).toBe(fiveMinutesAgo);
    expect(result.ageMs).toBeLessThan(60 * 60 * 1000);
  });

  it('accepts custom maxAgeMs', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    mockDbGet.mockResolvedValueOnce(
      makeFakeSnapshotRow({
        trigger_type: 'ai_proposal_accepted',
        captured_at: tenMinutesAgo,
      })
    );

    const result = await detectAIStaleness(RESOURCE_ID, ORG_ID, 5 * 60 * 1000);

    expect(result.isStale).toBe(true);
  });

  it('queries only ai_proposal_accepted trigger type', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await detectAIStaleness(RESOURCE_ID, ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain("trigger_type = 'ai_proposal_accepted'");
  });
});

// ------------------------------------------
// getAuditSummary
// ------------------------------------------

describe('getAuditSummary', () => {
  it('aggregates audit entries by action type', async () => {
    mockDbAll.mockResolvedValueOnce([
      { action: 'snapshot.created', count: 5 },
      { action: 'restore.applied', count: 2 },
      { action: 'edit.committed', count: 10 },
    ]);

    const result = await getAuditSummary(
      RESOURCE_ID,
      ORG_ID,
      '2026-03-01T00:00:00.000Z',
      '2026-03-31T23:59:59.999Z'
    );

    expect(result).toBeInstanceOf(Map);
    expect(result.get('snapshot.created')).toBe(5);
    expect(result.get('restore.applied')).toBe(2);
    expect(result.get('edit.committed')).toBe(10);
    expect(result.size).toBe(3);
  });

  it('returns empty map when no entries in range', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const result = await getAuditSummary(
      RESOURCE_ID,
      ORG_ID,
      '2026-03-01T00:00:00.000Z',
      '2026-03-31T23:59:59.999Z'
    );

    expect(result.size).toBe(0);
  });

  it('passes date range to query', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const from = '2026-03-01T00:00:00.000Z';
    const to = '2026-03-31T23:59:59.999Z';

    await getAuditSummary(RESOURCE_ID, ORG_ID, from, to);

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(from);
    expect(params).toContain(to);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('timestamp >= ?');
    expect(query).toContain('timestamp <= ?');
    expect(query).toContain('GROUP BY action');
  });
});

// ------------------------------------------
// getPendingRestores
// ------------------------------------------

describe('getPendingRestores', () => {
  it('returns pending restore requests for an org', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeRestoreRow({ status: 'pending', requested_at: '2026-03-23T10:05:00.000Z' }),
      makeFakeRestoreRow({
        restore_id: '00000000-0000-4000-a000-000000000022',
        status: 'pending',
        requested_at: '2026-03-23T10:00:00.000Z',
      }),
    ]);

    const results = await getPendingRestores(ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe('pending');
    expect(results[1].status).toBe('pending');
  });

  it('queries only pending status', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getPendingRestores(ORG_ID);

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain("status = 'pending'");
    expect(query).toContain('organization_id = ?');
  });

  it('returns empty array when no pending restores', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getPendingRestores(ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// rejectRestore
// ------------------------------------------

describe('rejectRestore', () => {
  it('rejects a pending restore request', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRestoreRow({ status: 'pending' }));

    const result = await rejectRestore(RESTORE_ID, ORG_ID, HUMAN_ACTOR, 'Not needed');

    expect(result.status).toBe('rejected');
    expect(result.resolvedAt).not.toBeNull();

    const updateCall = mockDbRun.mock.calls.find((call) =>
      (call[0] as string).includes('UPDATE v8_restore_requests')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![0] as string).toContain("status = 'rejected'");
  });

  it('records restore.rejected audit entry', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRestoreRow({ status: 'pending' }));

    await rejectRestore(RESTORE_ID, ORG_ID, HUMAN_ACTOR, 'Rejected by admin');

    const auditInsert = mockDbRun.mock.calls.find((call) =>
      (call[0] as string).includes('INSERT INTO v8_audit_entries')
    );
    expect(auditInsert).toBeDefined();
    const auditParams = auditInsert![1] as unknown[];
    expect(auditParams).toContain('restore.rejected');
  });

  it('throws when restore request not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(rejectRestore(RESTORE_ID, ORG_ID, HUMAN_ACTOR, 'reason')).rejects.toThrow(
      `Restore request ${RESTORE_ID} not found`
    );
  });

  it('throws when restore request is already applied', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRestoreRow({ status: 'applied' }));

    await expect(rejectRestore(RESTORE_ID, ORG_ID, HUMAN_ACTOR, 'reason')).rejects.toThrow(
      'already applied, cannot reject'
    );
  });

  it('throws when restore request is already rejected', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRestoreRow({ status: 'rejected' }));

    await expect(rejectRestore(RESTORE_ID, ORG_ID, HUMAN_ACTOR, 'reason')).rejects.toThrow(
      'already rejected, cannot reject'
    );
  });
});

// ------------------------------------------
// getResourceHistory
// ------------------------------------------

describe('getResourceHistory', () => {
  it('returns combined timeline sorted by timestamp desc', async () => {
    mockDbAll
      .mockResolvedValueOnce([makeFakeSnapshotRow({ captured_at: '2026-03-23T10:00:00.000Z' })])
      .mockResolvedValueOnce([makeFakeAuditRow({ timestamp: '2026-03-23T10:05:00.000Z' })])
      .mockResolvedValueOnce([makeFakeRestoreRow({ requested_at: '2026-03-23T10:03:00.000Z' })]);

    const results = await getResourceHistory(RESOURCE_ID, ORG_ID);

    expect(results).toHaveLength(3);
    expect(results[0].type).toBe('audit');
    expect(results[0].timestamp).toBe('2026-03-23T10:05:00.000Z');
    expect(results[1].type).toBe('restore');
    expect(results[1].timestamp).toBe('2026-03-23T10:03:00.000Z');
    expect(results[2].type).toBe('snapshot');
    expect(results[2].timestamp).toBe('2026-03-23T10:00:00.000Z');
  });

  it('returns empty array when no history exists', async () => {
    mockDbAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const results = await getResourceHistory(RESOURCE_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('queries all three tables with resource_id and organization_id', async () => {
    mockDbAll.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await getResourceHistory(RESOURCE_ID, ORG_ID);

    expect(mockDbAll).toHaveBeenCalledTimes(3);

    for (let i = 0; i < 3; i++) {
      const query = mockDbAll.mock.calls[i][0] as string;
      expect(query).toContain('resource_id = ?');
      expect(query).toContain('organization_id = ?');
      const params = mockDbAll.mock.calls[i][1] as unknown[];
      expect(params).toContain(RESOURCE_ID);
      expect(params).toContain(ORG_ID);
    }
  });

  it('handles mixed entry types correctly', async () => {
    mockDbAll
      .mockResolvedValueOnce([
        makeFakeSnapshotRow({ captured_at: '2026-03-23T10:00:00.000Z' }),
        makeFakeSnapshotRow({
          snapshot_id: SNAPSHOT_ID_2,
          captured_at: '2026-03-23T10:10:00.000Z',
          state_version: 1,
        }),
      ])
      .mockResolvedValueOnce([makeFakeAuditRow({ timestamp: '2026-03-23T10:05:00.000Z' })])
      .mockResolvedValueOnce([]);

    const results = await getResourceHistory(RESOURCE_ID, ORG_ID);

    expect(results).toHaveLength(3);
    expect(results[0].type).toBe('snapshot');
    expect(results[0].timestamp).toBe('2026-03-23T10:10:00.000Z');
    expect(results[1].type).toBe('audit');
    expect(results[2].type).toBe('snapshot');
  });
});
