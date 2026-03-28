import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CaptureSnapshotParams, ContextSnapshot } from '../../../types/contextSnapshot.js';

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
  captureSnapshot,
  detectDrift,
  getDriftEventsByOrg,
  getLatestSnapshotForSession,
  getSnapshotChain,
  markForArchival,
} from '../contextSnapshotService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const WORKSPACE_ID = '00000000-0000-4000-8000-000000000002';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const PROJECT_A = '00000000-0000-4000-8000-000000000004';
const PROJECT_B = '00000000-0000-4000-8000-000000000005';
const CONV_ID = '00000000-0000-4000-8000-000000000006';
const SNAP_A = '00000000-0000-4000-8000-aaaaaaaaaa01';
const SNAP_B = '00000000-0000-4000-8000-aaaaaaaaaa02';
const SNAP_C = '00000000-0000-4000-8000-aaaaaaaaaa03';

function makeParams(overrides?: Partial<CaptureSnapshotParams>): CaptureSnapshotParams {
  return {
    workspaceId: WORKSPACE_ID,
    organizationId: ORG_ID,
    projectId: PROJECT_A,
    conversationId: CONV_ID,
    executionRunId: null,
    artifactRefs: [
      {
        artifactId: 'art-1',
        artifactType: 'initiative',
        artifactModule: 'execution',
        relationship: 'target',
      },
    ],
    effectiveScopeRef: 'project:' + PROJECT_A,
    resolvedRoleRef: 'admin',
    initiatorUserId: USER_ID,
    consumerClass: 'chat',
    privacyMode: false,
    sourceContextRefs: [
      {
        sourceId: 'src-1',
        scopeType: 'session',
        sourceKind: 'conversation_history',
        freshnessAt: null,
      },
    ],
    ...overrides,
  };
}

function makeFakeRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    snapshot_id: SNAP_A,
    parent_snapshot_id: null,
    snapshot_version: 1,
    captured_at: '2026-03-23T10:00:00.000Z',
    workspace_id: WORKSPACE_ID,
    organization_id: ORG_ID,
    project_id: PROJECT_A,
    conversation_id: CONV_ID,
    execution_run_id: null,
    artifact_refs: JSON.stringify([
      {
        artifactId: 'art-1',
        artifactType: 'initiative',
        artifactModule: 'execution',
        relationship: 'target',
      },
    ]),
    effective_scope_ref: 'project:' + PROJECT_A,
    resolved_role_ref: 'admin',
    initiator_user_id: USER_ID,
    consumer_class: 'chat',
    privacy_mode: 0,
    source_context_refs: JSON.stringify([
      {
        sourceId: 'src-1',
        scopeType: 'session',
        sourceKind: 'conversation_history',
        freshnessAt: null,
      },
    ]),
    drift_events: '[]',
    created_at: '2026-03-23T10:00:00.000Z',
    archived_at: null,
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

describe('captureSnapshot with parentSnapshotId', () => {
  it('auto-increments version when parent exists', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRow({ snapshot_version: 3 }));

    const result = await captureSnapshot(makeParams({ parentSnapshotId: SNAP_A }));

    expect(result.snapshotVersion).toBe(4);
    expect(result.parentSnapshotId).toBe(SNAP_A);
  });

  it('falls back to version 1 when parent not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await captureSnapshot(makeParams({ parentSnapshotId: SNAP_A }));

    expect(result.snapshotVersion).toBe(1);
    expect(result.parentSnapshotId).toBe(SNAP_A);
  });

  it('sets parentSnapshotId to null when not provided', async () => {
    const result = await captureSnapshot(makeParams());

    expect(result.parentSnapshotId).toBeNull();
    expect(result.snapshotVersion).toBe(1);
  });

  it('includes parent_snapshot_id in the INSERT statement', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRow());

    await captureSnapshot(makeParams({ parentSnapshotId: SNAP_A }));

    const insertCall = mockDbRun.mock.calls[0];
    expect(insertCall[0]).toContain('parent_snapshot_id');
    expect(insertCall[1]).toContain(SNAP_A);
  });

  it('auto-detects drift against parent on capture', async () => {
    mockDbGet
      .mockResolvedValueOnce(makeFakeRow({ project_id: PROJECT_A, resolved_role_ref: 'admin' }))
      .mockResolvedValueOnce({ drift_events: '[]' });

    const result = await captureSnapshot(
      makeParams({
        parentSnapshotId: SNAP_A,
        projectId: PROJECT_B,
        resolvedRoleRef: 'viewer',
      })
    );

    expect(result.driftEvents).toHaveLength(2);
    const types = result.driftEvents.map((d) => d.driftType);
    expect(types).toContain('project_switch');
    expect(types).toContain('role_change');
  });

  it('records drift events via recordDriftEvent when drift detected', async () => {
    mockDbGet
      .mockResolvedValueOnce(makeFakeRow({ project_id: PROJECT_A }))
      .mockResolvedValueOnce({ drift_events: '[]' });

    await captureSnapshot(makeParams({ parentSnapshotId: SNAP_A, projectId: PROJECT_B }));

    const insertCall = mockDbRun.mock.calls[0];
    expect(insertCall[0]).toContain('INSERT INTO v8_context_snapshots');

    const updateCalls = mockDbRun.mock.calls.filter((call: unknown[]) =>
      (call[0] as string).includes('UPDATE')
    );
    expect(updateCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('does not detect drift when parent and child are identical', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRow());

    const result = await captureSnapshot(makeParams({ parentSnapshotId: SNAP_A }));

    expect(result.driftEvents).toEqual([]);
  });
});

describe('getSnapshotChain', () => {
  it('returns correct chain order from root to leaf', async () => {
    const rootRow = makeFakeRow({
      snapshot_id: SNAP_A,
      parent_snapshot_id: null,
      snapshot_version: 1,
    });
    const midRow = makeFakeRow({
      snapshot_id: SNAP_B,
      parent_snapshot_id: SNAP_A,
      snapshot_version: 2,
    });
    const leafRow = makeFakeRow({
      snapshot_id: SNAP_C,
      parent_snapshot_id: SNAP_B,
      snapshot_version: 3,
    });

    mockDbGet
      .mockResolvedValueOnce(leafRow)
      .mockResolvedValueOnce(midRow)
      .mockResolvedValueOnce(rootRow);

    const chain = await getSnapshotChain(SNAP_C, ORG_ID);

    expect(chain).toHaveLength(3);
    expect(chain[0].snapshotId).toBe(SNAP_A);
    expect(chain[1].snapshotId).toBe(SNAP_B);
    expect(chain[2].snapshotId).toBe(SNAP_C);
  });

  it('returns single-element chain for root snapshot', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRow({ snapshot_id: SNAP_A, parent_snapshot_id: null }));

    const chain = await getSnapshotChain(SNAP_A, ORG_ID);

    expect(chain).toHaveLength(1);
    expect(chain[0].snapshotId).toBe(SNAP_A);
  });

  it('returns empty chain when snapshot not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const chain = await getSnapshotChain('nonexistent', ORG_ID);
    expect(chain).toEqual([]);
  });

  it('stops at 100 hops to prevent infinite loops', async () => {
    for (let i = 0; i < 105; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      const parentId = i > 0 ? `00000000-0000-4000-8000-${String(i - 1).padStart(12, '0')}` : null;
      mockDbGet.mockResolvedValueOnce(
        makeFakeRow({
          snapshot_id: id,
          parent_snapshot_id: parentId,
          snapshot_version: i + 1,
        })
      );
    }

    const leafId = `00000000-0000-4000-8000-${String(104).padStart(12, '0')}`;
    const chain = await getSnapshotChain(leafId, ORG_ID);

    expect(chain.length).toBeLessThanOrEqual(100);
  });

  it('breaks on circular reference via visited set', async () => {
    mockDbGet.mockReset();

    const rowA = makeFakeRow({
      snapshot_id: SNAP_A,
      parent_snapshot_id: SNAP_B,
    });
    const rowB = makeFakeRow({
      snapshot_id: SNAP_B,
      parent_snapshot_id: SNAP_A,
    });

    mockDbGet.mockResolvedValueOnce(rowA).mockResolvedValueOnce(rowB).mockResolvedValue(null);

    const chain = await getSnapshotChain(SNAP_A, ORG_ID);

    expect(chain.length).toBe(2);
  });
});

describe('getLatestSnapshotForSession', () => {
  it('returns the most recent snapshot for a conversation', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeRow({
        snapshot_id: SNAP_B,
        captured_at: '2026-03-23T12:00:00.000Z',
      })
    );

    const result = await getLatestSnapshotForSession(CONV_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.snapshotId).toBe(SNAP_B);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('ORDER BY captured_at DESC');
    expect(query).toContain('LIMIT 1');
  });

  it('returns null when no snapshots exist for conversation', async () => {
    mockDbGet.mockReset();
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getLatestSnapshotForSession(CONV_ID, ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces organization isolation', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await getLatestSnapshotForSession(CONV_ID, ORG_ID);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
    const params = mockDbGet.mock.calls[0][1] as string[];
    expect(params).toContain(ORG_ID);
  });
});

describe('getDriftEventsByOrg', () => {
  it('returns snapshots with non-empty drift events in date range', async () => {
    const driftEvents = [
      {
        driftType: 'project_switch',
        detectedAt: '2026-03-23T10:00:00.000Z',
        previousValue: PROJECT_A,
        currentValue: PROJECT_B,
        resolution: 'revalidated',
      },
    ];

    mockDbAll.mockResolvedValueOnce([
      makeFakeRow({
        snapshot_id: SNAP_A,
        drift_events: JSON.stringify(driftEvents),
        captured_at: '2026-03-23T10:00:00.000Z',
      }),
    ]);

    const results = await getDriftEventsByOrg(
      ORG_ID,
      '2026-03-23T00:00:00.000Z',
      '2026-03-24T00:00:00.000Z'
    );

    expect(results).toHaveLength(1);
    expect(results[0].driftEvents).toHaveLength(1);
    expect(results[0].driftEvents[0].driftType).toBe('project_switch');
  });

  it('returns empty array when no drift events exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const results = await getDriftEventsByOrg(
      ORG_ID,
      '2026-03-23T00:00:00.000Z',
      '2026-03-24T00:00:00.000Z'
    );

    expect(results).toEqual([]);
  });

  it('filters by date range and excludes empty drift_events', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    await getDriftEventsByOrg(ORG_ID, '2026-03-01T00:00:00.000Z', '2026-03-31T23:59:59.000Z');

    const query = mockDbAll.mock.calls[0][0] as string;
    expect(query).toContain('captured_at >=');
    expect(query).toContain('captured_at <=');
    expect(query).toContain("drift_events != '[]'");
  });
});

describe('markForArchival', () => {
  it('marks old snapshots with archived_at', async () => {
    mockDbRun.mockResolvedValueOnce({ changes: 5 });

    const count = await markForArchival(ORG_ID, 90);

    expect(count).toBe(5);
    expect(mockDbRun).toHaveBeenCalledOnce();

    const query = mockDbRun.mock.calls[0][0] as string;
    expect(query).toContain('UPDATE v8_context_snapshots');
    expect(query).toContain('SET archived_at');
    expect(query).toContain('archived_at IS NULL');
  });

  it('returns 0 when no snapshots qualify', async () => {
    mockDbRun.mockResolvedValueOnce({ changes: 0 });

    const count = await markForArchival(ORG_ID, 30);
    expect(count).toBe(0);
  });

  it('only targets snapshots for the specified organization', async () => {
    mockDbRun.mockResolvedValueOnce({ changes: 2 });

    await markForArchival(ORG_ID, 60);

    const params = mockDbRun.mock.calls[0][1] as string[];
    expect(params[1]).toBe(ORG_ID);
  });

  it('skips already-archived snapshots', async () => {
    mockDbRun.mockResolvedValueOnce({ changes: 0 });

    await markForArchival(ORG_ID, 30);

    const query = mockDbRun.mock.calls[0][0] as string;
    expect(query).toContain('archived_at IS NULL');
  });
});
