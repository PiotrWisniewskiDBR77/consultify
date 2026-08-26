/** @vitest-environment node */

/**
 * FIX-1 (day19-fixes, 2026-08-26): before this fix, `DELETE /:id/occurrence`
 * consumed the `cancel` flag ONLY in the `scope: 'this'` branch.
 * `scope: 'all'` ran the exact same UPDATE as a normal PATCH (no field
 * reflected the cancellation) and `scope: 'this_and_following'` split the
 * series into a brand-new ACTIVE master — in both cases the route then went
 * on to send a `METHOD:CANCEL` invitation for a meeting that, per the
 * database, was completely unchanged. This suite proves, on a real router +
 * real Postgres, that for ALL THREE scopes: (a) the database visibly flips
 * to a real cancelled state, and (b) the CANCEL delivery is only ever
 * requested alongside that real change — never a "dry" cancel notice.
 *
 * `sendMeetingInvitations` itself (and its own test file) is out of scope
 * for this task (Z17), so it is wrapped — NOT behaviourally replaced — with
 * a `vi.fn()` spy: `importOriginal()` supplies the real implementation and
 * every call still runs it, this only records the arguments the route
 * passed in (in particular `method: 'CANCEL' | 'REQUEST'`). That is the
 * "spy — was CANCEL sent" evidence the fix instructions ask for, independent
 * of whether any individual recipient's delivery attempt itself succeeds.
 *
 * REQUIRES a real Postgres reachable via DATABASE_URL with
 * NODE_ENV=test RUN_DB_TESTS=1.
 */
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const sendMeetingInvitationsSpy = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const organizationId = req.headers['x-test-org-id'];
    const id = req.headers['x-test-user-id'];
    if (!organizationId || !id) return res.status(401).json({ error: 'No token provided' });
    req.userRole = req.headers['x-test-role'] || 'admin';
    req.user = { id, organizationId, role: req.userRole, email: `${id}@example.com` };
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../server/src/services/meeting/meetingInvitationService.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../server/src/services/meeting/meetingInvitationService.js')>();
  return {
    ...actual,
    // Faithful pass-through — records call args, changes no behaviour.
    sendMeetingInvitations: (
      ...args: Parameters<typeof actual.sendMeetingInvitations>
    ): ReturnType<typeof actual.sendMeetingInvitations> => {
      sendMeetingInvitationsSpy(...args);
      return actual.sendMeetingInvitations(...args);
    },
  };
});

const PREFIX = `day19fix1-${randomUUID().slice(0, 8)}`;
const ORG_A = `${PREFIX}-org-a`;
const USER_A = `${PREFIX}-user-a`;
const headers = () => ({
  'x-test-org-id': ORG_A,
  'x-test-user-id': USER_A,
  'x-test-role': 'admin',
});

function methodsRequested(): Array<'REQUEST' | 'CANCEL'> {
  return sendMeetingInvitationsSpy.mock.calls.map((call) => call[0]?.method || 'REQUEST');
}

describe('Meetings day19-fixes FIX-1 — occurrence cancellation is real, not a dry CANCEL send', () => {
  let app: express.Express;
  let pool: Pool;

  async function createRecurringMeeting(title: string): Promise<string> {
    const created = await request(app).post('/api/meeting').set(headers()).send({
      title,
      startAt: '2026-11-02T08:00:00.000Z',
      endAt: '2026-11-02T09:00:00.000Z',
      timezone: 'Europe/Warsaw',
      recurrenceRule: 'FREQ=WEEKLY;COUNT=6',
    });
    expect(created.status).toBe(201);
    return created.body.meeting.id;
  }

  beforeAll(async () => {
    if (!process.env.DATABASE_URL || process.env.RUN_DB_TESTS !== '1')
      throw new Error('real local PG required');
    const { default: routes } = await import('../../../server/src/routes/meeting.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/meeting', routes);
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM meeting_invitation_deliveries WHERE organization_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await pool.query(`DELETE FROM meeting_participants WHERE organization_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await pool.query(`DELETE FROM meetings WHERE organization_id LIKE $1`, [`${PREFIX}%`]);
    await pool.end();
  });

  it('scope=this: real per-occurrence exception, DB changes before CANCEL is requested', async () => {
    const meetingId = await createRecurringMeeting('this-scope cancel');
    sendMeetingInvitationsSpy.mockClear();
    const recurrenceId = '2026-11-09T08:00:00.000Z';

    const before = await pool.query(
      `SELECT id FROM meetings WHERE recurrence_parent_id=$1 AND recurrence_exception_at=$2`,
      [meetingId, recurrenceId]
    );
    expect(before.rows).toHaveLength(0);

    const res = await request(app)
      .delete(`/api/meeting/${meetingId}/occurrence`)
      .set(headers())
      .send({ recurrenceId, scope: 'this' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const after = await pool.query(
      `SELECT status, recurrence_status FROM meetings WHERE recurrence_parent_id=$1 AND recurrence_exception_at=$2`,
      [meetingId, recurrenceId]
    );
    expect(after.rows).toHaveLength(1);
    expect(after.rows[0].recurrence_status).toBe('cancelled');
    expect(methodsRequested()).toEqual(['CANCEL']);
    expect(sendMeetingInvitationsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ meetingId: res.body.meeting.id, method: 'CANCEL' })
    );
  });

  it('scope=all: the WHOLE series is marked cancelled in the DB before CANCEL is requested (was: silent no-op)', async () => {
    const meetingId = await createRecurringMeeting('all-scope cancel');
    sendMeetingInvitationsSpy.mockClear();

    const before = await pool.query(
      `SELECT status, recurrence_status, recurrence_rule FROM meetings WHERE id=$1`,
      [meetingId]
    );
    expect(before.rows[0].status).toBe('scheduled');
    expect(before.rows[0].recurrence_status).toBeNull();

    const res = await request(app)
      .delete(`/api/meeting/${meetingId}/occurrence`)
      .set(headers())
      .send({ recurrenceId: '2026-11-02T08:00:00.000Z', scope: 'all' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.meeting.recurrenceStatus).toBe('cancelled');

    const after = await pool.query(
      `SELECT status, recurrence_status, recurrence_rule FROM meetings WHERE id=$1`,
      [meetingId]
    );
    // The bug this closes: BEFORE the fix this row was byte-for-byte
    // unchanged (status still 'scheduled', recurrence_status still NULL)
    // while a CANCEL notice went out anyway. Now the state really flips.
    expect(after.rows[0].recurrence_status).toBe('cancelled');
    // The recurrence rule itself is preserved (cancellation is a status
    // flag, not a rewrite/deletion of the series definition — no DELETE
    // anywhere in this path).
    expect(after.rows[0].recurrence_rule).toBe(before.rows[0].recurrence_rule);
    expect(methodsRequested()).toEqual(['CANCEL']);
    expect(sendMeetingInvitationsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ meetingId, method: 'CANCEL' })
    );
  });

  it('scope=this_and_following: the split series is created ALREADY cancelled, not as a new active master', async () => {
    const meetingId = await createRecurringMeeting('this-and-following cancel');
    sendMeetingInvitationsSpy.mockClear();

    const res = await request(app)
      .delete(`/api/meeting/${meetingId}/occurrence`)
      .set(headers())
      .send({ recurrenceId: '2026-11-16T08:00:00.000Z', scope: 'this_and_following' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.splitMeeting).toBeTruthy();
    expect(res.body.splitMeeting.splitFromMeetingId).toBe(meetingId);
    // This is the exact bug: the split row used to be created as a fully
    // live, active master (recurrenceStatus null) and STILL got a CANCEL
    // notice sent for it.
    expect(res.body.splitMeeting.recurrenceStatus).toBe('cancelled');

    const splitId = res.body.splitMeeting.id;
    const splitRow = await pool.query(
      `SELECT recurrence_status, split_from_meeting_id FROM meetings WHERE id=$1`,
      [splitId]
    );
    expect(splitRow.rows[0].recurrence_status).toBe('cancelled');
    expect(splitRow.rows[0].split_from_meeting_id).toBe(meetingId);

    // The ORIGINAL master is capped at the cutover (unaffected occurrences
    // before it stay valid — this half was already correct pre-fix).
    const oldMaster = await pool.query(`SELECT recurrence_rule FROM meetings WHERE id=$1`, [
      meetingId,
    ]);
    expect(oldMaster.rows[0].recurrence_rule).toContain('UNTIL=');

    expect(methodsRequested()).toEqual(['CANCEL']);
    expect(sendMeetingInvitationsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ meetingId: splitId, method: 'CANCEL' })
    );
  });
});
