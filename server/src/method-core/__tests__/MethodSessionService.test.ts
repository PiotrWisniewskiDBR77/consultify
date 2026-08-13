/**
 * MethodSessionService — session lifecycle.
 *
 * Covers kernel test requirements:
 *  1. every legal transition in METHOD_SESSION_TRANSITIONS succeeds; every
 *     other (from,to) pair is refused with `illegal_transition`.
 *  2. frozen -> active is legal and creates a REVISION (new session row,
 *     revisionOfSessionId pointing back); the original frozen row/snapshot
 *     is never mutated.
 *  3. missing `approver` role -> freeze refused with `missing_permission`.
 *  9. pack readiness `draft` (canStartSession=false) -> createSession
 *     refused with `pack_not_released`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createKernelTestDb, type KernelTestDbHandle } from './kernelTestDb.js';
import {
  METHOD_SESSION_STATES,
  TRANSITION_AUTHORITY,
  canTransition,
  type MethodSessionState,
} from '../contracts/index.js';
import type { PackReadinessLookup } from '../MethodSessionService.js';

let testDb: KernelTestDbHandle;

vi.mock('../../utils/DbPromise.js', async () => {
  const { createKernelTestDb } = await import('./kernelTestDb.js');
  testDb = createKernelTestDb();
  return { ...testDb, default: testDb };
});

const { MethodEventStore } = await import('../MethodEventStore.js');
const { MethodSessionService } = await import('../MethodSessionService.js');

const organizationId = 'org-1';

describe('MethodSessionService', () => {
  let events: InstanceType<typeof MethodEventStore>;
  let packReadinessResult: { canStart: boolean } | null;
  const packs: PackReadinessLookup = {
    async getReadiness() {
      return packReadinessResult;
    },
  };
  let service: InstanceType<typeof MethodSessionService>;

  beforeEach(() => {
    testDb.reset();
    events = new MethodEventStore();
    packReadinessResult = { canStart: true };
    service = new MethodSessionService(packs, events);
  });

  async function createDraftSession(actorUserId = 'owner-1') {
    const result = await service.createSession({
      organizationId,
      projectId: null,
      module: 'assessment',
      methodPackId: 'drd',
      methodPackVersion: '1.0.0',
      ownerUserId: actorUserId,
      mode: 'guided_manual',
    });
    if (!result.ok) throw new Error('test setup: createSession failed: ' + JSON.stringify(result));
    return result.session;
  }

  function forceState(sessionId: string, state: MethodSessionState): void {
    const row = testDb.getRows('method_sessions').find((r) => r.id === sessionId);
    if (!row) throw new Error(`test setup: no method_sessions row for ${sessionId}`);
    row.state = state;
  }

  // ---------------------------------------------------------------------
  // Requirement 9 — pack readiness gate
  // ---------------------------------------------------------------------
  describe('createSession pack-readiness gate', () => {
    it('refuses when the pack is not released/pilot (e.g. draft readiness)', async () => {
      packReadinessResult = { canStart: false };
      const result = await service.createSession({
        organizationId,
        projectId: null,
        module: 'assessment',
        methodPackId: 'drd',
        methodPackVersion: '0.1.0',
        ownerUserId: 'owner-1',
        mode: 'guided_manual',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.refusal).toEqual({ kind: 'pack_not_released', methodPackId: 'drd' });
      }
      expect(testDb.getRows('method_sessions')).toHaveLength(0);
    });

    it('refuses when the pack does not exist at all', async () => {
      packReadinessResult = null;
      const result = await service.createSession({
        organizationId,
        projectId: null,
        module: 'assessment',
        methodPackId: 'unknown-pack',
        methodPackVersion: '1.0.0',
        ownerUserId: 'owner-1',
        mode: 'guided_manual',
      });
      expect(result.ok).toBe(false);
    });

    it('allows creation when the pack is released/pilot', async () => {
      packReadinessResult = { canStart: true };
      const result = await service.createSession({
        organizationId,
        projectId: null,
        module: 'assessment',
        methodPackId: 'drd',
        methodPackVersion: '1.0.0',
        ownerUserId: 'owner-1',
        mode: 'guided_manual',
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.session.state).toBe('draft');
    });
  });

  // ---------------------------------------------------------------------
  // Requirement 1 — exhaustive transition matrix
  // ---------------------------------------------------------------------
  describe('transition matrix (exhaustive over METHOD_SESSION_STATES x METHOD_SESSION_STATES)', () => {
    const pairs: Array<{ from: MethodSessionState; to: MethodSessionState; legal: boolean }> = [];
    for (const from of METHOD_SESSION_STATES) {
      for (const to of METHOD_SESSION_STATES) {
        pairs.push({ from, to, legal: canTransition(from, to) });
      }
    }

    it.each(pairs)('$from -> $to (legal=$legal)', async ({ from, to, legal }) => {
      const session = await createDraftSession();
      forceState(session.id, from);

      const requiredRoles = TRANSITION_AUTHORITY[to];
      if (legal && requiredRoles && requiredRoles.length > 0) {
        await service.assignRole(organizationId, session.id, 'actor-1', requiredRoles[0]);
      }

      const result = await service.transition({
        sessionId: session.id,
        to,
        actorKind: 'human',
        actorUserId: 'actor-1',
        idempotencyKey: `${session.id}-${from}-${to}`,
      });

      if (legal) {
        expect(result.ok, `expected ${from} -> ${to} to succeed: ${JSON.stringify(result)}`).toBe(true);
      } else {
        expect(result.ok, `expected ${from} -> ${to} to be refused`).toBe(false);
        if (!result.ok) {
          expect(result.refusal).toEqual({ kind: 'illegal_transition', from, to });
        }
      }
    });
  });

  // ---------------------------------------------------------------------
  // Requirement 3 — missing approver role blocks freeze
  // ---------------------------------------------------------------------
  it('freeze (in_review -> frozen) without an `approver` role is refused with missing_permission', async () => {
    const session = await createDraftSession();
    forceState(session.id, 'in_review');

    const result = await service.transition({
      sessionId: session.id,
      to: 'frozen',
      actorKind: 'human',
      actorUserId: 'actor-without-role',
      idempotencyKey: 'freeze-1',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal).toEqual({ kind: 'missing_permission', requiredRole: 'approver' });
    }
    // Nothing changed: still in_review, no snapshot written.
    const row = testDb.getRows('method_sessions').find((r) => r.id === session.id);
    expect(row?.state).toBe('in_review');
    expect(testDb.getRows('method_snapshots')).toHaveLength(0);
  });

  it('freeze succeeds once the actor holds `approver` and writes an immutable snapshot', async () => {
    const session = await createDraftSession();
    forceState(session.id, 'in_review');
    await service.assignRole(organizationId, session.id, 'approver-1', 'approver');

    const result = await service.transition({
      sessionId: session.id,
      to: 'frozen',
      actorKind: 'human',
      actorUserId: 'approver-1',
      idempotencyKey: 'freeze-2',
    });

    expect(result.ok).toBe(true);
    const row = testDb.getRows('method_sessions').find((r) => r.id === session.id);
    expect(row?.state).toBe('frozen');
    expect(row?.frozen_snapshot_id).toBeTruthy();
    expect(testDb.getRows('method_snapshots')).toHaveLength(1);
  });

  // ---------------------------------------------------------------------
  // Requirement 2 — frozen -> active reopens as a NEW revision
  // ---------------------------------------------------------------------
  it('frozen -> active creates a new revision and never mutates the frozen row/snapshot', async () => {
    const session = await createDraftSession();
    forceState(session.id, 'frozen');
    const frozenRow = testDb.getRows('method_sessions').find((r) => r.id === session.id)!;
    frozenRow.frozen_snapshot_id = 'snap-existing';
    frozenRow.version = 7;

    await service.assignRole(organizationId, session.id, 'reopener-1', 'owner');

    const result = await service.transition({
      sessionId: session.id,
      to: 'active',
      actorKind: 'human',
      actorUserId: 'reopener-1',
      idempotencyKey: 'reopen-1',
    });

    expect(result.ok).toBe(true);

    // Original row: completely untouched.
    const originalAfter = testDb.getRows('method_sessions').find((r) => r.id === session.id);
    expect(originalAfter?.state).toBe('frozen');
    expect(originalAfter?.frozen_snapshot_id).toBe('snap-existing');
    expect(originalAfter?.version).toBe(7);

    // A new revision exists, chained back to the original.
    const revisions = await service.listRevisions(organizationId, session.id);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].state).toBe('active');
    expect(revisions[0].revisionOfSessionId).toBe(session.id);
    expect(revisions[0].frozenSnapshotId).toBeNull();
    expect(revisions[0].id).not.toBe(session.id);
  });
});
