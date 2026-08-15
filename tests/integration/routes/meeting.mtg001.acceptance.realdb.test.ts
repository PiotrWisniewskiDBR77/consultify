/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  addNoteEntry,
  addParticipant,
  adoptLegacyMeetingCore,
  closeMeeting,
  getMeetingAggregate,
  transitionMeeting,
  updateMeetingPrep,
} from '../../../server/src/services/meetingCore/meetingCoreService';
import {
  approveOutput,
  materializeOutput,
  proposeOutput,
} from '../../../server/src/services/meetingCore/outputs';
import { createProductionMaterializer } from '../../../server/src/services/meetingCore/outputsMaterializer';
import { createMeeting } from '../../../server/src/services/meetingService';

const enabled =
  process.env.NODE_ENV === 'test' &&
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  Boolean(process.env.DATABASE_URL);

describe.runIf(enabled)('MTG-001 current-SHA executable acceptance', () => {
  const suffix = randomUUID();
  const organizationId = `mtg001-org-${suffix}`;
  const ownerId = `mtg001-owner-${suffix}`;
  const reviewerId = `mtg001-reviewer-${suffix}`;
  const observerId = `mtg001-observer-${suffix}`;
  const foreignOrganizationId = `mtg001-foreign-${suffix}`;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
    await pool.query(`INSERT INTO organizations(id) VALUES ($1),($2)`, [
      organizationId,
      foreignOrganizationId,
    ]);
    await pool.query(`INSERT INTO users(id,organization_id) VALUES ($1,$3),($2,$3),($4,$3)`, [
      ownerId,
      reviewerId,
      organizationId,
      observerId,
    ]);
  });

  afterAll(async () => {
    const { getDatabase } = await import('../../../server/src/database/Database.js');
    await getDatabase().close?.();
    await pool.end();
  });

  it('runs CRUD→agenda/material→minutes→proposal→approval→one task+decision→cold reopen with negative controls', async () => {
    const legacy = await createMeeting({
      organizationId,
      createdBy: ownerId,
      title: 'MTG-001 steering acceptance',
      startAt: '2026-08-17T09:00:00.000Z',
      endAt: '2026-08-17T10:00:00.000Z',
      agenda: ['Review evidence', 'Approve actions'],
      preRead: ['material://steering-pack/v1'],
      attendees: [ownerId, reviewerId],
      decisions: [],
    });
    const adopted = await adoptLegacyMeetingCore(
      {
        organizationId,
        meetingId: legacy.id,
        actorUserId: ownerId,
      },
      pool
    );
    expect(adopted.id).toBe(legacy.id);

    await addParticipant(
      {
        organizationId,
        meetingId: legacy.id,
        actorUserId: ownerId,
        userId: reviewerId,
        role: 'participant',
      },
      pool
    );
    await addParticipant(
      {
        organizationId,
        meetingId: legacy.id,
        actorUserId: ownerId,
        userId: observerId,
        role: 'observer',
      },
      pool
    );
    await updateMeetingPrep(
      {
        organizationId,
        meetingId: legacy.id,
        actorUserId: ownerId,
        purpose: 'Decide the next governed delivery actions',
        expectedOutcomes: 'One decision and one owned task',
        preparationNotes: 'Use the attached steering pack as the exact source.',
      },
      pool
    );
    for (const transition of ['START_PREPARING', 'MARK_READY', 'START_LIVE'] as const)
      await transitionMeeting(
        { organizationId, meetingId: legacy.id, actorUserId: ownerId, transition },
        pool
      );

    const note = await addNoteEntry(
      {
        organizationId,
        meetingId: legacy.id,
        actorUserId: ownerId,
        actorKind: 'human',
        entryType: 'discussion',
        content: 'The steering pack was reviewed; propose a decision and one follow-up.',
      },
      pool
    );
    const taskInput = {
      organizationId,
      meetingId: legacy.id,
      actorUserId: ownerId,
      actorKind: 'human' as const,
      outputKind: 'task' as const,
      payload: { title: 'Publish approved steering actions', assigneeId: reviewerId },
      sourceNoteEntryId: note.id,
      requestIdempotencyKey: 'mtg001-task-proposal',
    };
    const [taskA, taskB] = await Promise.all([
      proposeOutput(taskInput, pool),
      proposeOutput(taskInput, pool),
    ]);
    expect(taskA.id).toBe(taskB.id);
    await expect(
      proposeOutput({ ...taskInput, payload: { title: 'A different payload must conflict' } }, pool)
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    const decision = await proposeOutput(
      {
        organizationId,
        meetingId: legacy.id,
        actorUserId: ownerId,
        actorKind: 'human',
        outputKind: 'decision',
        payload: { title: 'Approve governed delivery actions', decisionMakerId: reviewerId },
        sourceNoteEntryId: note.id,
        requestIdempotencyKey: 'mtg001-decision-proposal',
      },
      pool
    );
    const beforeApproval = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM tasks WHERE organization_id=$1 AND source_type='MEETING_OUTPUT') tasks,
        (SELECT count(*)::int FROM decisions WHERE organization_id=$1 AND source_type='MEETING_OUTPUT') decisions`,
      [organizationId]
    );
    expect(beforeApproval.rows[0]).toEqual({ tasks: 0, decisions: 0 });

    await expect(
      approveOutput(
        { organizationId, meetingId: legacy.id, outputId: taskA.id, actorUserId: observerId },
        pool
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      approveOutput(
        {
          organizationId,
          meetingId: legacy.id,
          outputId: taskA.id,
          actorUserId: 'system:teresa',
        },
        pool
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      approveOutput(
        {
          organizationId: foreignOrganizationId,
          meetingId: legacy.id,
          outputId: taskA.id,
          actorUserId: reviewerId,
        },
        pool
      )
    ).rejects.toMatchObject({ code: 'MEETING_NOT_FOUND' });

    const materializer = createProductionMaterializer(reviewerId);
    for (const output of [taskA, decision]) {
      await approveOutput(
        { organizationId, meetingId: legacy.id, outputId: output.id, actorUserId: reviewerId },
        pool
      );
      const command = {
        organizationId,
        meetingId: legacy.id,
        outputId: output.id,
        actorUserId: reviewerId,
        requestIdempotencyKey: output.idempotencyKey,
      };
      const [first, second] = await Promise.allSettled([
        materializeOutput(command, materializer, pool),
        materializeOutput(command, materializer, pool),
      ]);
      expect([first.status, second.status]).toContain('fulfilled');
      const replay = await materializeOutput(command, materializer, pool);
      expect(replay.status).toBe('MATERIALIZED');
    }

    await transitionMeeting(
      { organizationId, meetingId: legacy.id, actorUserId: ownerId, transition: 'START_CLOSING' },
      pool
    );
    const closed = await closeMeeting(
      { organizationId, meetingId: legacy.id, actorUserId: ownerId },
      pool
    );
    expect(closed).toMatchObject({
      meeting: { lifecycleStatus: 'CLOSED' },
      unresolvedOutputs: [],
      materializingOutputs: [],
      failedOutputs: [],
    });

    const cold = await getMeetingAggregate({ organizationId, meetingId: legacy.id }, pool);
    expect(cold).not.toBeNull();
    expect(cold?.notes).toEqual([expect.objectContaining({ id: note.id, status: 'active' })]);
    expect(cold?.outputs).toHaveLength(2);
    expect(cold?.outputs.every((item) => item.status === 'MATERIALIZED')).toBe(true);
    expect(
      await getMeetingAggregate(
        { organizationId: foreignOrganizationId, meetingId: legacy.id },
        pool
      )
    ).toBeNull();

    const readback = await pool.query(
      `SELECT
        (SELECT agenda_json FROM meetings WHERE id=$1 AND organization_id=$2) agenda,
        (SELECT pre_read_json FROM meetings WHERE id=$1 AND organization_id=$2) materials,
        (SELECT count(*)::int FROM tasks WHERE organization_id=$2 AND source_type='MEETING_OUTPUT') tasks,
        (SELECT count(*)::int FROM decisions WHERE organization_id=$2 AND source_type='MEETING_OUTPUT') decisions,
        (SELECT count(*)::int FROM meeting_outputs WHERE meeting_id=$1 AND status='MATERIALIZED') outputs,
        (SELECT count(*)::int FROM audit_events WHERE org_id=$2 AND resource_id IN ($1,$3,$4)) audits`,
      [legacy.id, organizationId, taskA.id, decision.id]
    );
    expect(JSON.parse(readback.rows[0].agenda)).toEqual(['Review evidence', 'Approve actions']);
    expect(JSON.parse(readback.rows[0].materials)).toEqual(['material://steering-pack/v1']);
    expect(readback.rows[0]).toMatchObject({ tasks: 1, decisions: 1, outputs: 2 });
    expect(readback.rows[0].audits).toBeGreaterThan(0);

    const audit = await pool.query(
      `SELECT action,metadata_json,ts FROM audit_events
       WHERE org_id=$1 AND (resource_id=$2 OR metadata_json::text LIKE $3)
       ORDER BY ts,id`,
      [organizationId, legacy.id, `%${legacy.id}%`]
    );
    expect(audit.rows.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        'MEETING_CORE_ADOPTED',
        'MEETING_NOTE_ADDED',
        'MEETING_OUTPUT_PROPOSED',
        'MEETING_OUTPUT_APPROVED',
        'MEETING_OUTPUT_MATERIALIZED',
        'MEETING_TRANSITION_CLOSE',
      ])
    );
    // MTG-001 has no approved consent/retention policy authority. The
    // acceptance packet proves absence remains UNKNOWN: neither aggregate nor
    // audit metadata silently claims acceptance.
    expect(JSON.stringify(cold)).not.toMatch(/consentAccepted|retentionAccepted/i);
    expect(JSON.stringify(audit.rows)).not.toMatch(/consentAccepted|retentionAccepted/i);
  });
});
