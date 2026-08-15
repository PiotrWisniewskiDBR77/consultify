/**
 * concurrency.test.ts — Scenario 19 ("Równoczesne żądania zamknięcia dają
 * JEDNO przejście") plus two closely related concurrency checks that the
 * same root cause (a SELECT-then-UPDATE "check then act" pattern with no
 * optimistic-concurrency guard and no row lock) also breaks: generic
 * lifecycle transitions and output materialization.
 *
 * All tests below drive the REAL, unmutated meetingCoreService/outputs/repo
 * functions against real Postgres — no mocks, no fake timers.
 *
 * FINDING (see report): these tests are EXPECTED TO FAIL against the current
 * implementation. That is the honest signal, not a mistake in the test.
 * `closeMeeting`/`transitionMeeting` (repo.ts: setMeetingClosedRow /
 * setMeetingLifecycleRow) issue an UPDATE keyed only on
 * `id + organization_id` — never on the CURRENT lifecycle_status. Two
 * transactions that both read the row while it is still e.g. CLOSING (before
 * either commits) both pass the in-app `assertTransitionAllowed` check
 * (which runs against that stale read) and BOTH UPDATEs then succeed
 * (Postgres READ COMMITTED re-evaluates the WHERE clause, which never
 * mentioned status, against the row's latest committed version — it does not
 * reject the second writer). The result: N "successful" closes, N audit
 * rows, and a `closed_by` that is silently whichever request happened to
 * commit last — not an error, not a single winner.
 *
 * The same missing guard makes `materializeOutput` create MULTIPLE target
 * task/decision rows for a single approved output under concurrent retries
 * (tasks.source_id / decisions.source_id have only a plain, non-unique index
 * — see server/migrations-v2/001_baseline_20260413.sql "idx_tasks_source" /
 * "idx_decisions_source" — nothing in the schema stops a second INSERT with
 * the same source_id).
 *
 * TWO PROOF STYLES, DELIBERATELY BOTH INCLUDED:
 *  - DETERMINISTIC ("forced interleave"): manually drives two raw PoolClients
 *    through the EXACT SAME repo.ts/auditLog.ts calls closeMeeting() makes
 *    internally, with explicit awaits guaranteeing both SELECTs happen
 *    before either UPDATE commits. This is 100% reproducible every run —
 *    the primary, authoritative proof for Scenario 19.
 *  - REAL PUBLIC API ("Promise.allSettled over N calls", as the task
 *    explicitly asks for): timing-dependent — on a fast local Docker
 *    Postgres, Node's I/O scheduling sometimes happens to fully serialize N
 *    independent closeMeeting() calls, which would make a single attempt a
 *    false negative. Repeated 5x with N=8 (40 total close attempts across 5
 *    independent meetings) to make that false-negative probability
 *    negligible while still exercising the literal call pattern requested.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { writeAuditEvent } from '../../../server/src/services/meetingCore/auditLog.js';
import {
  createMeetingCore,
  transitionMeeting,
  closeMeeting,
} from '../../../server/src/services/meetingCore/meetingCoreService.js';
import {
  approveOutput,
  materializeOutput,
  proposeOutput,
} from '../../../server/src/services/meetingCore/outputs.js';
import {
  getMeetingRow,
  setMeetingClosedRow,
} from '../../../server/src/services/meetingCore/repo.js';
import { countTasksBySource, createFakeMaterializer } from '../domain/fakeMaterializer.js';
import { makeOrgId, makeUserId, setupDomainTestDb, type DomainTestDb } from '../domain/helpers.js';

const N = 8;
const ATTEMPTS = 5;

async function makeClosingMeeting(db: DomainTestDb, title: string) {
  const organizationId = makeOrgId();
  const owner = makeUserId('owner');
  const meeting = await createMeetingCore(
    { organizationId, createdBy: owner, title, startAt: '2026-07-01T09:00:00.000Z' },
    db.pool
  );
  await transitionMeeting(
    { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_PREPARING' },
    db.pool
  );
  await transitionMeeting(
    { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'MARK_READY' },
    db.pool
  );
  await transitionMeeting(
    { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_LIVE' },
    db.pool
  );
  await transitionMeeting(
    { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_CLOSING' },
    db.pool
  );
  return { organizationId, owner, meetingId: meeting.id };
}

describe('Meeting Core — concurrency on real Postgres (Scenario 19 + related races)', () => {
  let db: DomainTestDb;

  beforeAll(async () => {
    db = await setupDomainTestDb();
  }, 90_000);

  afterAll(async () => {
    if (db) await db.teardown();
  }, 30_000);

  it('SCENARIO 19 (deterministic, authoritative): two transactions that BOTH read lifecycle_status=CLOSING before either writes must not both be allowed to close — the second must be rejected, not silently overwrite', async () => {
    const { organizationId, owner, meetingId } = await makeClosingMeeting(db, 'Deterministic race');

    const clientA = await db.pool.connect();
    const clientB = await db.pool.connect();
    try {
      await clientA.query('BEGIN');
      await clientB.query('BEGIN');

      // Force the exact interleave: both transactions read the row (via the
      // REAL getMeetingRow) while it is still CLOSING, BEFORE either has
      // written anything.
      const rowA = await getMeetingRow(clientA, organizationId, meetingId);
      const rowB = await getMeetingRow(clientB, organizationId, meetingId);
      expect(rowA?.lifecycleStatus).toBe('CLOSING');
      expect(rowB?.lifecycleStatus).toBe('CLOSING');

      // TxA performs the REAL setMeetingClosedRow + REAL writeAuditEvent
      // (exactly what closeMeeting() does internally), then commits first.
      await setMeetingClosedRow(clientA, organizationId, meetingId, owner);
      await writeAuditEvent(clientA, {
        actorId: owner,
        action: 'MEETING_TRANSITION_CLOSE',
        resourceType: 'meeting',
        resourceId: meetingId,
        organizationId,
        metadata: { from: 'CLOSING', to: 'CLOSED' },
      });
      await clientA.query('COMMIT');

      // TxB now attempts the SAME real UPDATE, using ITS OWN pre-commit read
      // (CLOSING) as the in-app "is this allowed" basis — exactly what
      // meetingCoreService.closeMeeting()'s assertTransitionAllowed check
      // would have already passed on, before ever reaching this UPDATE.
      const otherActor = makeUserId('second-closer');
      let updateBError: unknown = null;
      try {
        await setMeetingClosedRow(clientB, organizationId, meetingId, otherActor);
      } catch (err) {
        updateBError = err;
      }

      if (!updateBError) {
        // If the UPDATE didn't error, the real code path would proceed to
        // also write a second audit row and commit — reproduce that here to
        // measure the full blast radius.
        await writeAuditEvent(clientB, {
          actorId: otherActor,
          action: 'MEETING_TRANSITION_CLOSE',
          resourceType: 'meeting',
          resourceId: meetingId,
          organizationId,
          metadata: { from: 'CLOSING', to: 'CLOSED' },
        });
        await clientB.query('COMMIT');
      } else {
        await clientB.query('ROLLBACK');
      }

      // SAFE expectation: TxB's UPDATE should have been refused (e.g. by an
      // optimistic-concurrency WHERE lifecycle_status='CLOSING' guard that
      // the real code does not have) once TxA had already closed the
      // meeting. Currently it is NOT refused.
      expect(updateBError).not.toBeNull();
    } finally {
      clientA.release();
      clientB.release();
    }

    const auditRows = await db.pool.query(
      `SELECT actor_id FROM audit_events WHERE resource_type = 'meeting' AND resource_id = $1 AND action = 'MEETING_TRANSITION_CLOSE'`,
      [meetingId]
    );
    expect(auditRows.rows).toHaveLength(1); // SAFE expectation — currently 2 (both TxA and TxB "closed" it)
  });

  it('SCENARIO 19 (real public API, repeated): N genuinely concurrent closeMeeting() calls via Promise.allSettled must produce exactly ONE winner and ONE audit row, every attempt', async () => {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const { organizationId, owner, meetingId } = await makeClosingMeeting(
        db,
        `Public API race attempt ${attempt}`
      );

      const results = await Promise.allSettled(
        Array.from({ length: N }, () =>
          closeMeeting({ organizationId, meetingId, actorUserId: owner }, db.pool)
        )
      );
      const fulfilledCount = results.filter((r) => r.status === 'fulfilled').length;

      const auditRows = await db.pool.query(
        `SELECT count(*)::int AS n FROM audit_events WHERE resource_type = 'meeting' AND resource_id = $1 AND action = 'MEETING_TRANSITION_CLOSE'`,
        [meetingId]
      );
      const auditCount = auditRows.rows[0].n as number;

      // SAFE expectation for every attempt: exactly one of the N concurrent
      // callers wins. Currently this fails on most attempts (multiple/all N
      // callers report success).
      expect({ attempt, fulfilledCount, auditCount }).toEqual({
        attempt,
        fulfilledCount: 1,
        auditCount: 1,
      });
    }
  }, 30_000);

  it('generic transitionMeeting() has the same race: N concurrent START_PREPARING calls from DRAFT, repeated, must always produce exactly one winner', async () => {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const organizationId = makeOrgId();
      const owner = makeUserId('owner');
      const meeting = await createMeetingCore(
        {
          organizationId,
          createdBy: owner,
          title: `Concurrent generic transition ${attempt}`,
          startAt: '2026-07-02T09:00:00.000Z',
        },
        db.pool
      );

      const results = await Promise.allSettled(
        Array.from({ length: N }, () =>
          transitionMeeting(
            {
              organizationId,
              meetingId: meeting.id,
              actorUserId: owner,
              transition: 'START_PREPARING',
            },
            db.pool
          )
        )
      );
      const fulfilled = results.filter((r) => r.status === 'fulfilled').length;

      const auditRows = await db.pool.query(
        `SELECT count(*)::int AS n FROM audit_events WHERE resource_type = 'meeting' AND resource_id = $1 AND action = 'MEETING_TRANSITION_START_PREPARING'`,
        [meeting.id]
      );
      const auditCount = auditRows.rows[0].n as number;

      // Documents the defect precisely: fulfilled count and audit-row count
      // always match each other (every "successful" call really did write a
      // row) — the bug is that this shared number can be > 1, not that the
      // two ever disagree with each other.
      expect(auditCount).toBe(fulfilled);
      expect({ attempt, fulfilled }).toEqual({ attempt, fulfilled: 1 });
    }
  }, 30_000);

  it('SCENARIO 13/14 under real concurrency, repeated: materializeOutput() must create the target row exactly once even when N concurrent materialize calls race on the same APPROVED output', async () => {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const organizationId = makeOrgId();
      const owner = makeUserId('owner');
      const meeting = await createMeetingCore(
        {
          organizationId,
          createdBy: owner,
          title: `Concurrent materialize ${attempt}`,
          startAt: '2026-07-03T09:00:00.000Z',
        },
        db.pool
      );
      const proposed = await proposeOutput(
        {
          organizationId,
          meetingId: meeting.id,
          actorUserId: owner,
          actorKind: 'human',
          outputKind: 'task',
          payload: { title: 'Race condition target' },
        },
        db.pool
      );
      await approveOutput(
        { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
        db.pool
      );

      const materializer = createFakeMaterializer(db.pool);
      await Promise.allSettled(
        Array.from({ length: N }, () =>
          materializeOutput(
            { organizationId, meetingId: meeting.id, outputId: proposed.id, actorUserId: owner },
            materializer,
            db.pool
          )
        )
      );

      const taskCount = await countTasksBySource(db.pool, organizationId, proposed.idempotencyKey);

      // "Materializuje się DOKŁADNIE RAZ" — under real concurrency this must
      // hold even though every individual call reports success (materialize
      // is designed to be a safe no-op retry). One canonical task row, no
      // matter how many callers raced for it.
      expect({ attempt, taskCount }).toEqual({ attempt, taskCount: 1 });
    }
  }, 30_000);
});
