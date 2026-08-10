import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  CaptureSnapshotParams,
  ContextSnapshot,
  V8ArtifactRef,
} from '../../../types/contextSnapshot.js';
import {
  CaptureSnapshotParamsSchema,
  ContextSnapshotSchema,
  DriftEventSchema,
  SourceRefSchema,
  V8ArtifactRefSchema,
} from '../../../types/contextSnapshot.js';

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
  getSnapshot,
  getSnapshotsByConversation,
  getSnapshotsByRun,
  recordDriftEvent,
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
const RUN_ID = '00000000-0000-4000-8000-000000000007';

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
    snapshot_id: '00000000-0000-4000-8000-aaaaaaaaaaaa',
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
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

describe('captureSnapshot', () => {
  it('creates and persists a snapshot with all required fields', async () => {
    const result = await captureSnapshot(makeParams());

    expect(result.snapshotId).toBeDefined();
    expect(result.snapshotVersion).toBe(1);
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.workspaceId).toBe(WORKSPACE_ID);
    expect(result.projectId).toBe(PROJECT_A);
    expect(result.conversationId).toBe(CONV_ID);
    expect(result.consumerClass).toBe('chat');
    expect(result.privacyMode).toBe(false);
    expect(result.artifactRefs).toHaveLength(1);
    expect(result.sourceContextRefs).toHaveLength(1);
    expect(result.driftEvents).toEqual([]);

    expect(mockDbRun).toHaveBeenCalledOnce();
    const insertArgs = mockDbRun.mock.calls[0];
    expect(insertArgs[0]).toContain('INSERT INTO v8_context_snapshots');
  });

  it('defaults privacyMode to false and sourceContextRefs to []', async () => {
    const params = makeParams({ privacyMode: undefined, sourceContextRefs: undefined });
    const result = await captureSnapshot(params);

    expect(result.privacyMode).toBe(false);
    expect(result.sourceContextRefs).toEqual([]);
  });

  it('allows null projectId for workspace-global snapshots', async () => {
    const result = await captureSnapshot(makeParams({ projectId: null }));
    expect(result.projectId).toBeNull();
  });

  it('rejects invalid consumerClass via Zod', async () => {
    await expect(captureSnapshot(makeParams({ consumerClass: 'invalid' as any }))).rejects.toThrow(
      ZodError
    );
  });

  it('rejects missing required fields via Zod', async () => {
    await expect(captureSnapshot({ organizationId: ORG_ID } as any)).rejects.toThrow(ZodError);
  });
});

describe('getSnapshot', () => {
  it('returns a snapshot when found with org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeRow());

    const result = await getSnapshot('00000000-0000-4000-8000-aaaaaaaaaaaa', ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.snapshotId).toBe('00000000-0000-4000-8000-aaaaaaaaaaaa');
    expect(result!.organizationId).toBe(ORG_ID);
    expect(result!.artifactRefs).toHaveLength(1);

    const query = mockDbGet.mock.calls[0][0] as string;
    expect(query).toContain('organization_id');
  });

  it('returns null when snapshot does not exist', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await getSnapshot('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });
});

describe('getSnapshotsByConversation', () => {
  it('returns snapshots ordered by captured_at', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeRow({ captured_at: '2026-03-23T10:00:00.000Z' }),
      makeFakeRow({ snapshot_id: 'snap-2', captured_at: '2026-03-23T11:00:00.000Z' }),
    ]);

    const results = await getSnapshotsByConversation(CONV_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].capturedAt).toBe('2026-03-23T10:00:00.000Z');
    expect(results[1].capturedAt).toBe('2026-03-23T11:00:00.000Z');
  });

  it('returns empty array when no snapshots exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getSnapshotsByConversation(CONV_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

describe('getSnapshotsByRun', () => {
  it('returns snapshots for an execution run', async () => {
    mockDbAll.mockResolvedValueOnce([makeFakeRow({ execution_run_id: RUN_ID })]);

    const results = await getSnapshotsByRun(RUN_ID, ORG_ID);

    expect(results).toHaveLength(1);
    expect(results[0].executionRunId).toBe(RUN_ID);
  });
});

describe('detectDrift', () => {
  function makeSnapshot(overrides?: Partial<ContextSnapshot>): ContextSnapshot {
    return {
      snapshotId: 'snap-1',
      snapshotVersion: 1,
      capturedAt: '2026-03-23T10:00:00.000Z',
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
      sourceContextRefs: [],
      driftEvents: [],
      ...overrides,
      // `Partial<ContextSnapshot>` makes the optional-but-non-undefined
      // `parentSnapshotId` widen to `| undefined` through the spread.
      parentSnapshotId: overrides?.parentSnapshotId ?? null,
    };
  }

  it('detects project switch', () => {
    const prev = makeSnapshot({ projectId: PROJECT_A });
    const curr = makeSnapshot({ projectId: PROJECT_B });

    const drifts = detectDrift(curr, prev);

    expect(drifts).toHaveLength(1);
    expect(drifts[0].driftType).toBe('project_switch');
    expect(drifts[0].previousValue).toBe(PROJECT_A);
    expect(drifts[0].currentValue).toBe(PROJECT_B);
  });

  it('detects role change', () => {
    const prev = makeSnapshot({ resolvedRoleRef: 'admin' });
    const curr = makeSnapshot({ resolvedRoleRef: 'viewer' });

    const drifts = detectDrift(curr, prev);

    expect(drifts).toHaveLength(1);
    expect(drifts[0].driftType).toBe('role_change');
  });

  it('detects artifact removal', () => {
    const prev = makeSnapshot({
      artifactRefs: [
        {
          artifactId: 'art-1',
          artifactType: 'initiative',
          artifactModule: 'execution',
          relationship: 'target',
        },
        {
          artifactId: 'art-2',
          artifactType: 'task',
          artifactModule: 'execution',
          relationship: 'reference',
        },
      ],
    });
    const curr = makeSnapshot({
      artifactRefs: [
        {
          artifactId: 'art-1',
          artifactType: 'initiative',
          artifactModule: 'execution',
          relationship: 'target',
        },
      ],
    });

    const drifts = detectDrift(curr, prev);

    expect(drifts).toHaveLength(1);
    expect(drifts[0].driftType).toBe('artifact_removed');
    expect(drifts[0].previousValue).toBe('art-2');
  });

  it('detects multiple drifts simultaneously', () => {
    const prev = makeSnapshot({
      projectId: PROJECT_A,
      resolvedRoleRef: 'admin',
    });
    const curr = makeSnapshot({
      projectId: PROJECT_B,
      resolvedRoleRef: 'viewer',
    });

    const drifts = detectDrift(curr, prev);
    expect(drifts).toHaveLength(2);

    const types = drifts.map((d) => d.driftType);
    expect(types).toContain('project_switch');
    expect(types).toContain('role_change');
  });

  it('returns empty array when no drift detected', () => {
    const snap = makeSnapshot();
    const drifts = detectDrift(snap, snap);
    expect(drifts).toEqual([]);
  });
});

describe('recordDriftEvent', () => {
  it('appends drift event to existing snapshot', async () => {
    mockDbGet.mockResolvedValueOnce({ drift_events: '[]' });

    await recordDriftEvent('snap-1', {
      driftType: 'role_change',
      detectedAt: '2026-03-23T12:00:00.000Z',
      previousValue: 'admin',
      currentValue: 'viewer',
      resolution: 'user_confirmed',
    });

    expect(mockDbRun).toHaveBeenCalledOnce();
    const updateArgs = mockDbRun.mock.calls[0];
    expect(updateArgs[0]).toContain('UPDATE v8_context_snapshots');

    const updatedJson = JSON.parse(updateArgs[1][0]);
    expect(updatedJson).toHaveLength(1);
    expect(updatedJson[0].driftType).toBe('role_change');
  });

  it('preserves existing drift events when appending', async () => {
    const existing = [
      {
        driftType: 'project_switch',
        detectedAt: '2026-03-23T10:00:00.000Z',
        previousValue: PROJECT_A,
        currentValue: PROJECT_B,
        resolution: 'revalidated',
      },
    ];
    mockDbGet.mockResolvedValueOnce({ drift_events: JSON.stringify(existing) });

    await recordDriftEvent('snap-1', {
      driftType: 'role_change',
      detectedAt: '2026-03-23T12:00:00.000Z',
      previousValue: 'admin',
      currentValue: 'viewer',
      resolution: 'user_confirmed',
    });

    const updatedJson = JSON.parse(mockDbRun.mock.calls[0][1][0]);
    expect(updatedJson).toHaveLength(2);
  });

  it('does not throw when snapshot not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      recordDriftEvent('nonexistent', {
        driftType: 'role_change',
        detectedAt: '2026-03-23T12:00:00.000Z',
        previousValue: 'admin',
        currentValue: 'viewer',
        resolution: 'user_confirmed',
      })
    ).resolves.toBeUndefined();

    expect(mockDbRun).not.toHaveBeenCalled();
  });
});

describe('Zod schema validation', () => {
  it('validates a correct ContextSnapshot', () => {
    const valid: ContextSnapshot = {
      snapshotId: '00000000-0000-4000-8000-aaaaaaaaaaaa',
      parentSnapshotId: null,
      snapshotVersion: 1,
      capturedAt: '2026-03-23T10:00:00.000Z',
      workspaceId: WORKSPACE_ID,
      organizationId: ORG_ID,
      projectId: null,
      conversationId: null,
      executionRunId: null,
      artifactRefs: [],
      effectiveScopeRef: 'org:' + ORG_ID,
      resolvedRoleRef: 'admin',
      initiatorUserId: USER_ID,
      consumerClass: 'chat',
      privacyMode: false,
      sourceContextRefs: [],
      driftEvents: [],
    };

    expect(() => ContextSnapshotSchema.parse(valid)).not.toThrow();
  });

  it('rejects snapshot with invalid UUID', () => {
    expect(() =>
      ContextSnapshotSchema.parse({
        snapshotId: 'not-a-uuid',
        snapshotVersion: 1,
        capturedAt: '2026-03-23T10:00:00.000Z',
        workspaceId: 'not-a-uuid',
        organizationId: ORG_ID,
        projectId: null,
        conversationId: null,
        executionRunId: null,
        artifactRefs: [],
        effectiveScopeRef: 'test',
        resolvedRoleRef: 'admin',
        initiatorUserId: USER_ID,
        consumerClass: 'chat',
        privacyMode: false,
        sourceContextRefs: [],
        driftEvents: [],
      })
    ).toThrow(ZodError);
  });

  it('validates V8ArtifactRef', () => {
    expect(() =>
      V8ArtifactRefSchema.parse({
        artifactId: 'art-1',
        artifactType: 'initiative',
        artifactModule: 'execution',
        relationship: 'target',
      })
    ).not.toThrow();

    expect(() =>
      V8ArtifactRefSchema.parse({
        artifactId: '',
        artifactType: 'initiative',
        artifactModule: 'execution',
        relationship: 'target',
      })
    ).toThrow(ZodError);
  });

  it('validates SourceRef', () => {
    expect(() =>
      SourceRefSchema.parse({
        sourceId: 'src-1',
        scopeType: 'session',
        sourceKind: 'conversation_history',
        freshnessAt: null,
      })
    ).not.toThrow();

    expect(() =>
      SourceRefSchema.parse({
        sourceId: 'src-1',
        scopeType: 'invalid_scope',
        sourceKind: 'test',
        freshnessAt: null,
      })
    ).toThrow(ZodError);
  });

  it('validates DriftEvent', () => {
    expect(() =>
      DriftEventSchema.parse({
        driftType: 'project_switch',
        detectedAt: '2026-03-23T10:00:00.000Z',
        previousValue: 'a',
        currentValue: 'b',
        resolution: 'revalidated',
      })
    ).not.toThrow();

    expect(() =>
      DriftEventSchema.parse({
        driftType: 'unknown_drift',
        detectedAt: '2026-03-23T10:00:00.000Z',
        previousValue: 'a',
        currentValue: 'b',
        resolution: 'revalidated',
      })
    ).toThrow(ZodError);
  });

  it('validates CaptureSnapshotParams', () => {
    const valid = makeParams();
    expect(() => CaptureSnapshotParamsSchema.parse(valid)).not.toThrow();
  });
});
