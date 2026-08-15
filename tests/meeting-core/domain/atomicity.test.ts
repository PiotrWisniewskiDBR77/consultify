/**
 * atomicity.test.ts — BLOKER 1 proof, on real scratch-PG:
 *  (a) pgTransaction.withPgTransaction rolls back EVERY statement on the
 *      pinned client when the callback throws, and re-throws the original
 *      error unchanged (never swallowed, never replaced by a rollback
 *      error).
 *  (b) a lifecycle transition and its audit_events row commit together —
 *      querying audit_events directly (bypassing meetingCoreService)
 *      confirms the row exists with the SAME column pair
 *      AuditEventsService.log()/query() use: actor_id, action,
 *      resource_type, resource_id (server/src/services/AuditEventsService.ts:58-61,163-165).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withPgTransaction } from '../../../server/src/utils/pgTransaction.js';
import {
  createMeetingCore,
  getMeetingAggregate,
  transitionMeeting,
} from '../../../server/src/services/meetingCore/meetingCoreService.js';
import { makeOrgId, makeUserId, setupDomainTestDb, type DomainTestDb } from './helpers.js';

describe('Meeting Core — atomicity on real Postgres', () => {
  let db: DomainTestDb;

  beforeAll(async () => {
    db = await setupDomainTestDb();
  }, 90_000);

  afterAll(async () => {
    if (db) await db.teardown();
  }, 30_000);

  it('withPgTransaction rolls back every statement when the callback throws, and re-throws the original error', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Original title',
        startAt: '2026-05-01T09:00:00.000Z',
      },
      db.pool
    );

    await expect(
      withPgTransaction(async (client) => {
        await client.query(`UPDATE meetings SET title = $1 WHERE id = $2`, [
          'SHOULD NOT STICK',
          meeting.id,
        ]);
        // Prove the UPDATE really executed on THIS client before we blow up —
        // otherwise "it rolled back" would be indistinguishable from "it never ran".
        const midTx = await client.query(`SELECT title FROM meetings WHERE id = $1`, [meeting.id]);
        expect(midTx.rows[0].title).toBe('SHOULD NOT STICK');
        throw new Error('boom — deliberate mid-transaction failure');
      }, db.pool)
    ).rejects.toThrow('boom — deliberate mid-transaction failure');

    const after = await getMeetingAggregate({ organizationId, meetingId: meeting.id }, db.pool);
    expect(after?.meeting.title).toBe('Original title');
  });

  it('a lifecycle transition and its audit_events row commit together, using the actor_id/action/resource_type/resource_id column pair', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Audit pairing check',
        startAt: '2026-05-02T09:00:00.000Z',
      },
      db.pool
    );

    const updated = await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_PREPARING' },
      db.pool
    );
    expect(updated.lifecycleStatus).toBe('PREPARING');

    const auditRows = await db.pool.query(
      `SELECT actor_id, action, resource_type, resource_id, org_id
       FROM audit_events
       WHERE resource_type = 'meeting' AND resource_id = $1 AND action = 'MEETING_TRANSITION_START_PREPARING'`,
      [meeting.id]
    );
    expect(auditRows.rows).toHaveLength(1);
    expect(auditRows.rows[0]).toMatchObject({
      actor_id: owner,
      action: 'MEETING_TRANSITION_START_PREPARING',
      resource_type: 'meeting',
      resource_id: meeting.id,
      org_id: organizationId,
    });
  });

  it('an illegal transition writes NEITHER the status change NOR an audit row (checked before any write happens)', async () => {
    const organizationId = makeOrgId();
    const owner = makeUserId('owner');
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: owner,
        title: 'Illegal transition leaves no trace',
        startAt: '2026-05-03T09:00:00.000Z',
      },
      db.pool
    );

    await expect(
      transitionMeeting(
        { organizationId, meetingId: meeting.id, actorUserId: owner, transition: 'START_LIVE' },
        db.pool
      )
    ).rejects.toThrow();

    const after = await getMeetingAggregate({ organizationId, meetingId: meeting.id }, db.pool);
    expect(after?.meeting.lifecycleStatus).toBe('DRAFT');

    const auditRows = await db.pool.query(
      `SELECT 1 FROM audit_events WHERE resource_type = 'meeting' AND resource_id = $1`,
      [meeting.id]
    );
    // Only the MEETING_CREATED audit row from createMeetingCore — zero for
    // the rejected START_LIVE attempt.
    expect(auditRows.rows).toHaveLength(1);
  });
});
