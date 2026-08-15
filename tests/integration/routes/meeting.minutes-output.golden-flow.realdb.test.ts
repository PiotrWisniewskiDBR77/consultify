import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

import {
  addNoteEntry,
  closeMeeting,
  createMeetingCore,
  transitionMeeting,
} from '../../../server/src/services/meetingCore/meetingCoreService.js';
import {
  approveOutput,
  materializeOutput,
  proposeOutput,
} from '../../../server/src/services/meetingCore/outputs.js';
import { createProductionMaterializer } from '../../../server/src/services/meetingCore/outputsMaterializer.js';

const RUN_REAL_DB =
  process.env.NODE_ENV === 'test' &&
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  Boolean(process.env.DATABASE_URL);

describe.runIf(RUN_REAL_DB)('Meeting minutes output golden flow — full PostgreSQL', () => {
  let pool: Pool;
  const nonce = randomUUID();
  const organizationId = `meeting-golden-${nonce}`;
  const ownerId = `meeting-owner-${nonce}`;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query('INSERT INTO organizations (id) VALUES ($1)', [organizationId]);
    await pool.query('INSERT INTO users (id, organization_id) VALUES ($1, $2)', [
      ownerId,
      organizationId,
    ]);
  });

  afterAll(async () => {
    const { getDatabase } = await import('../../../server/src/database/Database.js');
    await getDatabase().close?.();
    await pool.end();
  });

  it('persists minutes and materializes exactly one task and decision after human approval', async () => {
    const meeting = await createMeetingCore(
      {
        organizationId,
        createdBy: ownerId,
        title: 'Golden flow steering meeting',
        startAt: '2026-08-15T12:00:00.000Z',
      },
      pool
    );
    for (const transition of ['START_PREPARING', 'MARK_READY', 'START_LIVE'] as const) {
      await transitionMeeting(
        { organizationId, meetingId: meeting.id, actorUserId: ownerId, transition },
        pool
      );
    }
    await addNoteEntry(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: ownerId,
        actorKind: 'human',
        entryType: 'discussion',
        content: 'Approve the recap and budget decision.',
      },
      pool
    );

    const taskProposal = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: ownerId,
        actorKind: 'human',
        outputKind: 'task',
        payload: { title: 'Send steering recap' },
        requestIdempotencyKey: 'golden-task-proposal',
      },
      pool
    );
    const taskReplay = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: ownerId,
        actorKind: 'human',
        outputKind: 'task',
        payload: { title: 'Send steering recap' },
        requestIdempotencyKey: 'golden-task-proposal',
      },
      pool
    );
    expect(taskReplay.id).toBe(taskProposal.id);

    const decisionProposal = await proposeOutput(
      {
        organizationId,
        meetingId: meeting.id,
        actorUserId: ownerId,
        actorKind: 'human',
        outputKind: 'decision',
        payload: { title: 'Approve transformation budget', decisionMakerId: ownerId },
        requestIdempotencyKey: 'golden-decision-proposal',
      },
      pool
    );

    const beforeApproval = await pool.query(
      `SELECT
         (SELECT count(*) FROM tasks WHERE organization_id=$1 AND source_type='MEETING_OUTPUT') AS tasks,
         (SELECT count(*) FROM decisions WHERE organization_id=$1 AND source_type='MEETING_OUTPUT') AS decisions`,
      [organizationId]
    );
    expect(beforeApproval.rows[0]).toMatchObject({ tasks: '0', decisions: '0' });

    const materializer = createProductionMaterializer(ownerId);
    for (const output of [taskProposal, decisionProposal]) {
      await approveOutput(
        { organizationId, meetingId: meeting.id, outputId: output.id, actorUserId: ownerId },
        pool
      );
      const result = await materializeOutput(
        {
          organizationId,
          meetingId: meeting.id,
          outputId: output.id,
          actorUserId: ownerId,
          requestIdempotencyKey: output.idempotencyKey,
        },
        materializer,
        pool
      );
      expect(result.status).toBe('MATERIALIZED');
    }

    await transitionMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: ownerId, transition: 'START_CLOSING' },
      pool
    );
    const closed = await closeMeeting(
      { organizationId, meetingId: meeting.id, actorUserId: ownerId },
      pool
    );
    expect(closed.meeting.lifecycleStatus).toBe('CLOSED');
    expect(closed.unresolvedOutputs).toEqual([]);
    expect(closed.materializingOutputs).toEqual([]);
    expect(closed.failedOutputs).toEqual([]);

    const readback = await pool.query(
      `SELECT
         (SELECT count(*) FROM meeting_participants WHERE meeting_id=$1) AS participants,
         (SELECT count(*) FROM meeting_note_entries WHERE meeting_id=$1) AS notes,
         (SELECT count(*) FROM meeting_outputs WHERE meeting_id=$1 AND status='MATERIALIZED') AS outputs,
         (SELECT count(*) FROM tasks WHERE organization_id=$2 AND source_type='MEETING_OUTPUT') AS tasks,
         (SELECT count(*) FROM decisions WHERE organization_id=$2 AND source_type='MEETING_OUTPUT') AS decisions,
         (SELECT count(*) FROM audit_events WHERE org_id=$2 AND resource_id=$1) AS audit_events`,
      [meeting.id, organizationId]
    );
    expect(readback.rows[0]).toMatchObject({
      participants: '2',
      notes: '1',
      outputs: '2',
      tasks: '1',
      decisions: '1',
    });
    expect(Number(readback.rows[0].audit_events)).toBeGreaterThan(0);
  });
});
