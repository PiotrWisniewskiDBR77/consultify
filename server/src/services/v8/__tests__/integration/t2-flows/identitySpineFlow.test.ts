import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ContextSnapshot,
  SourceRef,
  V8ArtifactRef,
} from '../../../../../types/contextSnapshot.js';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true, changes: 1 });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../../../utils/Logger.js', () => ({
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
  getInheritanceChain,
  validateConsumerClass,
} from '../../../contextConsumerBindingService.js';
import {
  captureSnapshot,
  detectDrift,
  getDriftEventsByOrg,
  getLatestSnapshotForSession,
  getSnapshot,
  getSnapshotChain,
  getSnapshotsByConversation,
  markForArchival,
} from '../../../contextSnapshotService.js';

// ==========================================
// TEST FIXTURES
// ==========================================

const ORG_ID = '11111111-1111-4111-a111-111111111111';
const WORKSPACE_ID = '22222222-2222-4222-a222-222222222222';
const USER_ID = '33333333-3333-4333-a333-333333333333';
const CONV_ID = '44444444-4444-4444-a444-444444444444';
const PROJECT_ID = '55555555-5555-4555-a555-555555555555';
const RUN_ID = '66666666-6666-4666-a666-666666666666';

const ARTIFACT_REF: V8ArtifactRef = {
  artifactId: '77777777-7777-4777-a777-777777777777',
  artifactType: 'initiative',
  artifactModule: 'initiatives',
  relationship: 'target',
};

function makeSnapshotRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    snapshot_id: overrides.snapshot_id ?? 'a0000000-0000-4000-a000-000000000001',
    snapshot_version: overrides.snapshot_version ?? 1,
    captured_at: overrides.captured_at ?? '2026-03-23T10:00:00.000Z',
    workspace_id: WORKSPACE_ID,
    organization_id: ORG_ID,
    project_id: overrides.project_id ?? PROJECT_ID,
    conversation_id: overrides.conversation_id ?? CONV_ID,
    execution_run_id: overrides.execution_run_id ?? null,
    artifact_refs: JSON.stringify([ARTIFACT_REF]),
    effective_scope_ref: 'scope:org:default',
    resolved_role_ref: 'role:member',
    initiator_user_id: USER_ID,
    consumer_class: overrides.consumer_class ?? 'chat',
    privacy_mode: 0,
    source_context_refs: '[]',
    drift_events: overrides.drift_events ?? '[]',
    parent_snapshot_id: overrides.parent_snapshot_id ?? null,
    archived_at: null,
    created_at: '2026-03-23T10:00:00.000Z',
    ...overrides,
  };
}

// ==========================================
// INTEGRATION FLOW TESTS
// ==========================================

describe('WP-20W2-04 — Identity Spine Integration Proof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('F01: Chat → Execution → Retrieval identity chain', () => {
    it('captures chat snapshot, execution inherits it, retrieval binds to execution', async () => {
      mockDbAll.mockResolvedValueOnce([]);

      const chatSnapshot = await captureForChat({
        conversationId: CONV_ID,
        workspaceId: WORKSPACE_ID,
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        artifactRefs: [ARTIFACT_REF],
        effectiveScopeRef: 'scope:org:default',
        resolvedRoleRef: 'role:member',
        initiatorUserId: USER_ID,
      });

      expect(chatSnapshot.consumerClass).toBe('chat');
      expect(chatSnapshot.conversationId).toBe(CONV_ID);
      expect(chatSnapshot.parentSnapshotId).toBeNull();
      expect(chatSnapshot.snapshotVersion).toBe(1);

      mockDbGet.mockResolvedValueOnce(
        makeSnapshotRow({
          snapshot_id: chatSnapshot.snapshotId,
          snapshot_version: 1,
          consumer_class: 'chat',
        })
      );

      const execSnapshot = await captureForExecution({
        chatSnapshotId: chatSnapshot.snapshotId,
        workspaceId: WORKSPACE_ID,
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        artifactRefs: [ARTIFACT_REF],
        effectiveScopeRef: 'scope:org:default',
        resolvedRoleRef: 'role:member',
        initiatorUserId: USER_ID,
        executionRunId: RUN_ID,
      });

      expect(execSnapshot.consumerClass).toBe('execution');
      expect(execSnapshot.executionRunId).toBe(RUN_ID);
      expect(execSnapshot.parentSnapshotId).toBe(chatSnapshot.snapshotId);

      mockDbGet.mockResolvedValueOnce(
        makeSnapshotRow({
          snapshot_id: execSnapshot.snapshotId,
          snapshot_version: 2,
          consumer_class: 'execution',
          parent_snapshot_id: chatSnapshot.snapshotId,
        })
      );

      const retrievalSnapshot = await captureForRetrieval({
        activeSnapshotId: execSnapshot.snapshotId,
        organizationId: ORG_ID,
        workspaceId: WORKSPACE_ID,
        effectiveScopeRef: 'scope:org:default',
        initiatorUserId: USER_ID,
      });

      expect(retrievalSnapshot.consumerClass).toBe('retrieval');
      expect(retrievalSnapshot.parentSnapshotId).toBe(execSnapshot.snapshotId);
    });
  });

  describe('F02: Drift detection fires on project switch mid-session', () => {
    it('detects project_switch drift when chat snapshot changes project', async () => {
      const snap1: ContextSnapshot = {
        snapshotId: 'a0000000-0000-4000-a000-000000000001',
        parentSnapshotId: null,
        snapshotVersion: 1,
        capturedAt: '2026-03-23T10:00:00.000Z',
        workspaceId: WORKSPACE_ID,
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        conversationId: CONV_ID,
        executionRunId: null,
        artifactRefs: [ARTIFACT_REF],
        effectiveScopeRef: 'scope:org:default',
        resolvedRoleRef: 'role:member',
        initiatorUserId: USER_ID,
        consumerClass: 'chat',
        privacyMode: false,
        sourceContextRefs: [],
        driftEvents: [],
      };

      const snap2: ContextSnapshot = {
        ...snap1,
        snapshotId: 'a0000000-0000-4000-a000-000000000002',
        snapshotVersion: 2,
        parentSnapshotId: snap1.snapshotId,
        projectId: '99999999-9999-4999-a999-999999999999',
      };

      const drifts = detectDrift(snap2, snap1);

      expect(drifts.length).toBeGreaterThanOrEqual(1);
      expect(drifts.some((d) => d.driftType === 'project_switch')).toBe(true);
      expect(drifts[0].previousValue).toBe(PROJECT_ID);
      expect(drifts[0].currentValue).toBe('99999999-9999-4999-a999-999999999999');
    });
  });

  describe('F03: Snapshot chain traversal from leaf to root', () => {
    it('traverses 3-level chain: chat → execution → retrieval', async () => {
      const chatRow = makeSnapshotRow({
        snapshot_id: 'a0000000-0000-4000-a000-000000000001',
        consumer_class: 'chat',
        parent_snapshot_id: null,
        snapshot_version: 1,
      });
      const execRow = makeSnapshotRow({
        snapshot_id: 'a0000000-0000-4000-a000-000000000002',
        consumer_class: 'execution',
        parent_snapshot_id: 'a0000000-0000-4000-a000-000000000001',
        snapshot_version: 2,
      });
      const retrievalRow = makeSnapshotRow({
        snapshot_id: 'a0000000-0000-4000-a000-000000000003',
        consumer_class: 'retrieval',
        parent_snapshot_id: 'a0000000-0000-4000-a000-000000000002',
        snapshot_version: 3,
      });

      mockDbGet
        .mockResolvedValueOnce(retrievalRow)
        .mockResolvedValueOnce(execRow)
        .mockResolvedValueOnce(chatRow);

      const chain = await getSnapshotChain('a0000000-0000-4000-a000-000000000003', ORG_ID);

      expect(chain).toHaveLength(3);
      expect(chain[0].consumerClass).toBe('chat');
      expect(chain[1].consumerClass).toBe('execution');
      expect(chain[2].consumerClass).toBe('retrieval');
      expect(chain[0].parentSnapshotId).toBeNull();
      expect(chain[2].parentSnapshotId).toBe('a0000000-0000-4000-a000-000000000002');
    });
  });

  describe('F04: Consumer class validation', () => {
    it('validates correct consumer class', async () => {
      mockDbGet.mockResolvedValueOnce(
        makeSnapshotRow({
          snapshot_id: 'a0000000-0000-4000-a000-000000000001',
          consumer_class: 'execution',
        })
      );

      const result = await validateConsumerClass(
        'a0000000-0000-4000-a000-000000000001',
        'execution',
        ORG_ID
      );

      expect(result.valid).toBe(true);
      expect(result.actualClass).toBe('execution');
    });

    it('rejects mismatched consumer class', async () => {
      mockDbGet.mockResolvedValueOnce(
        makeSnapshotRow({
          snapshot_id: 'a0000000-0000-4000-a000-000000000001',
          consumer_class: 'chat',
        })
      );

      const result = await validateConsumerClass(
        'a0000000-0000-4000-a000-000000000001',
        'execution',
        ORG_ID
      );

      expect(result.valid).toBe(false);
      expect(result.actualClass).toBe('chat');
      expect(result.expectedClass).toBe('execution');
    });
  });

  describe('F05: Drift audit query by organization', () => {
    it('returns snapshots with drift events in date range', async () => {
      const driftRow = makeSnapshotRow({
        snapshot_id: 'a0000000-0000-4000-a000-000000000001',
        drift_events: JSON.stringify([
          {
            driftType: 'project_switch',
            detectedAt: '2026-03-23T10:05:00.000Z',
            previousValue: PROJECT_ID,
            currentValue: '99999999-9999-4999-a999-999999999999',
            resolution: 'revalidated',
          },
        ]),
      });

      mockDbAll.mockResolvedValueOnce([driftRow]);

      const results = await getDriftEventsByOrg(
        ORG_ID,
        '2026-03-23T00:00:00.000Z',
        '2026-03-24T00:00:00.000Z'
      );

      expect(results).toHaveLength(1);
      expect(results[0].driftEvents).toHaveLength(1);
      expect(results[0].driftEvents[0].driftType).toBe('project_switch');
    });
  });

  describe('F06: Retention and archival', () => {
    it('marks old snapshots for archival', async () => {
      mockDbRun.mockResolvedValueOnce({ success: true, changes: 5 });

      const count = await markForArchival(ORG_ID, 30);

      expect(count).toBe(5);
      expect(mockDbRun).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE v8_context_snapshots'),
        expect.arrayContaining([ORG_ID])
      );
    });
  });

  describe('F07: Multi-turn chat chaining', () => {
    it('second chat turn chains to first via parentSnapshotId', async () => {
      mockDbAll.mockResolvedValueOnce([]);
      const turn1 = await captureForChat({
        conversationId: CONV_ID,
        workspaceId: WORKSPACE_ID,
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        artifactRefs: [ARTIFACT_REF],
        effectiveScopeRef: 'scope:org:default',
        resolvedRoleRef: 'role:member',
        initiatorUserId: USER_ID,
      });

      expect(turn1.parentSnapshotId).toBeNull();

      const turn1Row = makeSnapshotRow({
        snapshot_id: turn1.snapshotId,
        consumer_class: 'chat',
        snapshot_version: 1,
      });
      mockDbAll.mockResolvedValueOnce([turn1Row]);

      mockDbGet.mockResolvedValueOnce(turn1Row);

      const turn2 = await captureForChat({
        conversationId: CONV_ID,
        workspaceId: WORKSPACE_ID,
        organizationId: ORG_ID,
        projectId: PROJECT_ID,
        artifactRefs: [ARTIFACT_REF],
        effectiveScopeRef: 'scope:org:default',
        resolvedRoleRef: 'role:member',
        initiatorUserId: USER_ID,
      });

      expect(turn2.parentSnapshotId).toBe(turn1.snapshotId);
      expect(turn2.snapshotVersion).toBe(2);
    });
  });

  describe('F08: Inheritance chain query', () => {
    it('returns ordered chain for chat → execution flow', async () => {
      const chatRow = makeSnapshotRow({
        snapshot_id: 'a0000000-0000-4000-a000-000000000001',
        consumer_class: 'chat',
        parent_snapshot_id: null,
      });
      const execRow = makeSnapshotRow({
        snapshot_id: 'a0000000-0000-4000-a000-000000000002',
        consumer_class: 'execution',
        parent_snapshot_id: 'a0000000-0000-4000-a000-000000000001',
      });

      mockDbGet.mockResolvedValueOnce(execRow).mockResolvedValueOnce(chatRow);

      const chain = await getInheritanceChain('a0000000-0000-4000-a000-000000000002', ORG_ID);

      expect(chain).toHaveLength(2);
      expect(chain[0].consumerClass).toBe('chat');
      expect(chain[1].consumerClass).toBe('execution');
    });
  });
});
