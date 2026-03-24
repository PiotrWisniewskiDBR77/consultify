import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { ContextSnapshot, V8ArtifactRef } from '../../../types/contextSnapshot.js';

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
  captureForChat,
  captureForExecution,
  captureForRetrieval,
  validateConsumerClass,
  getInheritanceChain,
} from '../contextConsumerBindingService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const WORKSPACE_ID = '00000000-0000-4000-8000-000000000002';
const USER_ID = '00000000-0000-4000-8000-000000000003';
const PROJECT_ID = '00000000-0000-4000-8000-000000000004';
const CONV_ID = '00000000-0000-4000-8000-000000000006';
const RUN_ID = '00000000-0000-4000-8000-000000000007';
const SNAPSHOT_A = '00000000-0000-4000-8000-aaaaaaaaaa01';
const SNAPSHOT_B = '00000000-0000-4000-8000-aaaaaaaaaa02';
const SNAPSHOT_C = '00000000-0000-4000-8000-aaaaaaaaaa03';

const ARTIFACT_REF: V8ArtifactRef = {
  artifactId: 'art-1',
  artifactType: 'initiative',
  artifactModule: 'execution',
  relationship: 'target',
};

function makeFakeSnapshotRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    snapshot_id: SNAPSHOT_A,
    snapshot_version: 1,
    captured_at: '2026-03-23T10:00:00.000Z',
    workspace_id: WORKSPACE_ID,
    organization_id: ORG_ID,
    project_id: PROJECT_ID,
    conversation_id: CONV_ID,
    execution_run_id: null,
    artifact_refs: JSON.stringify([ARTIFACT_REF]),
    effective_scope_ref: 'project:' + PROJECT_ID,
    resolved_role_ref: 'admin',
    initiator_user_id: USER_ID,
    consumer_class: 'chat',
    privacy_mode: 0,
    source_context_refs: '[]',
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

describe('captureForChat', () => {
  it('creates snapshot with consumer class chat', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const result = await captureForChat({
      conversationId: CONV_ID,
      workspaceId: WORKSPACE_ID,
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      artifactRefs: [ARTIFACT_REF],
      effectiveScopeRef: 'project:' + PROJECT_ID,
      resolvedRoleRef: 'admin',
      initiatorUserId: USER_ID,
    });

    expect(result.consumerClass).toBe('chat');
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.conversationId).toBe(CONV_ID);
    expect(result.artifactRefs).toHaveLength(1);

    const insertCall = mockDbRun.mock.calls[0];
    expect(insertCall[0]).toContain('INSERT INTO v8_context_snapshots');
  });

  it('chains to previous conversation snapshot', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeSnapshotRow({ snapshot_id: SNAPSHOT_A }),
      makeFakeSnapshotRow({ snapshot_id: SNAPSHOT_B, captured_at: '2026-03-23T11:00:00.000Z' }),
    ]);

    const result = await captureForChat({
      conversationId: CONV_ID,
      workspaceId: WORKSPACE_ID,
      organizationId: ORG_ID,
      artifactRefs: [ARTIFACT_REF],
      effectiveScopeRef: 'project:' + PROJECT_ID,
      resolvedRoleRef: 'admin',
      initiatorUserId: USER_ID,
    });

    expect(result.consumerClass).toBe('chat');
    expect(result.snapshotId).toBeDefined();

    expect(mockDbAll).toHaveBeenCalledOnce();
    const queryArgs = mockDbAll.mock.calls[0];
    expect(queryArgs[0]).toContain('conversation_id');
    expect(queryArgs[1]).toContain(CONV_ID);
  });

  it('creates root snapshot when no previous conversation snapshots exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);

    const result = await captureForChat({
      conversationId: CONV_ID,
      workspaceId: WORKSPACE_ID,
      organizationId: ORG_ID,
      artifactRefs: [],
      effectiveScopeRef: 'org:' + ORG_ID,
      resolvedRoleRef: 'admin',
      initiatorUserId: USER_ID,
    });

    expect(result.consumerClass).toBe('chat');
    expect(result.snapshotId).toBeDefined();
  });
});

describe('captureForExecution', () => {
  it('inherits from chat snapshot with execution consumer class', async () => {
    const result = await captureForExecution({
      chatSnapshotId: SNAPSHOT_A,
      workspaceId: WORKSPACE_ID,
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
      artifactRefs: [ARTIFACT_REF],
      effectiveScopeRef: 'project:' + PROJECT_ID,
      resolvedRoleRef: 'admin',
      initiatorUserId: USER_ID,
      executionRunId: RUN_ID,
    });

    expect(result.consumerClass).toBe('execution');
    expect(result.executionRunId).toBe(RUN_ID);
    expect(result.organizationId).toBe(ORG_ID);

    const insertCall = mockDbRun.mock.calls[0];
    expect(insertCall[0]).toContain('INSERT INTO v8_context_snapshots');
  });

  it('sets executionRunId on the captured snapshot', async () => {
    const result = await captureForExecution({
      chatSnapshotId: SNAPSHOT_A,
      workspaceId: WORKSPACE_ID,
      organizationId: ORG_ID,
      artifactRefs: [],
      effectiveScopeRef: 'org:' + ORG_ID,
      resolvedRoleRef: 'admin',
      initiatorUserId: USER_ID,
      executionRunId: RUN_ID,
    });

    expect(result.executionRunId).toBe(RUN_ID);
    expect(result.conversationId).toBeNull();
  });
});

describe('captureForRetrieval', () => {
  it('binds to active snapshot with retrieval consumer class', async () => {
    const result = await captureForRetrieval({
      activeSnapshotId: SNAPSHOT_A,
      organizationId: ORG_ID,
      workspaceId: WORKSPACE_ID,
      effectiveScopeRef: 'project:' + PROJECT_ID,
      initiatorUserId: USER_ID,
    });

    expect(result.consumerClass).toBe('retrieval');
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.artifactRefs).toEqual([]);
    expect(result.resolvedRoleRef).toBe('system');

    const insertCall = mockDbRun.mock.calls[0];
    expect(insertCall[0]).toContain('INSERT INTO v8_context_snapshots');
  });

  it('passes sourceContextRefs when provided', async () => {
    const sourceRefs = [
      { sourceId: 'src-1', scopeType: 'session' as const, sourceKind: 'working_memory', freshnessAt: null },
    ];

    const result = await captureForRetrieval({
      activeSnapshotId: SNAPSHOT_A,
      organizationId: ORG_ID,
      workspaceId: WORKSPACE_ID,
      effectiveScopeRef: 'org:' + ORG_ID,
      initiatorUserId: USER_ID,
      sourceContextRefs: sourceRefs,
    });

    expect(result.sourceContextRefs).toHaveLength(1);
    expect(result.sourceContextRefs[0].sourceId).toBe('src-1');
  });
});

describe('validateConsumerClass', () => {
  it('returns valid when consumer class matches', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeSnapshotRow({ consumer_class: 'chat' }),
    );

    const result = await validateConsumerClass(SNAPSHOT_A, 'chat', ORG_ID);

    expect(result.valid).toBe(true);
    expect(result.actualClass).toBe('chat');
    expect(result.expectedClass).toBe('chat');
  });

  it('returns invalid when consumer class does not match', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeSnapshotRow({ consumer_class: 'execution' }),
    );

    const result = await validateConsumerClass(SNAPSHOT_A, 'chat', ORG_ID);

    expect(result.valid).toBe(false);
    expect(result.actualClass).toBe('execution');
    expect(result.expectedClass).toBe('chat');
  });

  it('returns invalid with unknown class when snapshot not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const result = await validateConsumerClass('nonexistent', 'chat', ORG_ID);

    expect(result.valid).toBe(false);
    expect(result.actualClass).toBe('unknown');
    expect(result.expectedClass).toBe('chat');
  });
});

describe('getInheritanceChain', () => {
  it('returns ordered chain from root to leaf', async () => {
    mockDbGet
      .mockResolvedValueOnce(
        makeFakeSnapshotRow({
          snapshot_id: SNAPSHOT_C,
          consumer_class: 'retrieval',
          parent_snapshot_id: SNAPSHOT_B,
        }),
      )
      .mockResolvedValueOnce(
        makeFakeSnapshotRow({
          snapshot_id: SNAPSHOT_B,
          consumer_class: 'execution',
          parent_snapshot_id: SNAPSHOT_A,
        }),
      )
      .mockResolvedValueOnce(
        makeFakeSnapshotRow({
          snapshot_id: SNAPSHOT_A,
          consumer_class: 'chat',
          parent_snapshot_id: null,
        }),
      );

    const chain = await getInheritanceChain(SNAPSHOT_C, ORG_ID);

    expect(chain).toHaveLength(3);
    expect(chain[0].snapshotId).toBe(SNAPSHOT_A);
    expect(chain[0].consumerClass).toBe('chat');
    expect(chain[1].snapshotId).toBe(SNAPSHOT_B);
    expect(chain[1].consumerClass).toBe('execution');
    expect(chain[2].snapshotId).toBe(SNAPSHOT_C);
    expect(chain[2].consumerClass).toBe('retrieval');
  });

  it('returns single-element chain for root snapshot', async () => {
    mockDbGet.mockResolvedValueOnce(
      makeFakeSnapshotRow({
        snapshot_id: SNAPSHOT_A,
        consumer_class: 'chat',
        parent_snapshot_id: null,
      }),
    );

    const chain = await getInheritanceChain(SNAPSHOT_A, ORG_ID);

    expect(chain).toHaveLength(1);
    expect(chain[0].snapshotId).toBe(SNAPSHOT_A);
  });

  it('returns empty chain when snapshot not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const chain = await getInheritanceChain('nonexistent', ORG_ID);
    expect(chain).toEqual([]);
  });

  it('handles circular references gracefully via visited set', async () => {
    mockDbGet
      .mockResolvedValueOnce(
        makeFakeSnapshotRow({
          snapshot_id: SNAPSHOT_A,
          consumer_class: 'chat',
          parent_snapshot_id: SNAPSHOT_A,
        }),
      );

    const chain = await getInheritanceChain(SNAPSHOT_A, ORG_ID);

    expect(chain).toHaveLength(1);
    expect(chain[0].snapshotId).toBe(SNAPSHOT_A);
  });
});
