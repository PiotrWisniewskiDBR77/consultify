/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMeetingInvitationsSpy } = vi.hoisted(() => ({
  sendMeetingInvitationsSpy: vi.fn(async () => []),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.userRole = 'ADMIN';
    req.user = { id: req.headers['x-user'], organizationId: req.headers['x-org'], role: 'ADMIN' };
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../server/src/services/meeting/meetingInvitationService.js', () => ({
  sendMeetingInvitations: sendMeetingInvitationsSpy,
}));

const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error('disposable local PostgreSQL required');
const prefix = `day28-tz-${randomUUID().slice(0, 8)}`;
const org = `${prefix}-org`;
const user = `${prefix}-admin`;
const pool = new Pool({ connectionString: url });
const headers = { 'x-org': org, 'x-user': user };

describe('Meetings day28 A — occurrence IDs require an explicit time zone', () => {
  let app: express.Express;

  beforeAll(async () => {
    const routes = (await import('../../../server/src/routes/meeting.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/meeting', routes);
  });

  beforeEach(() => sendMeetingInvitationsSpy.mockClear());

  afterAll(async () => {
    await pool.query(`DELETE FROM meeting_invitation_deliveries WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM meeting_participants WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM meetings WHERE organization_id=$1`, [org]);
    await pool.end();
  });

  const createSeries = async (suffix: string) => {
    const response = await request(app)
      .post('/api/meeting')
      .set(headers)
      .send({
        title: `Timezone measurement ${suffix}`,
        startAt: '2026-10-18T08:00:00.000Z',
        timezone: 'Europe/Warsaw',
        recurrenceRule: 'FREQ=WEEKLY;COUNT=8',
      });
    expect(response.status).toBe(201);
    return response.body.meeting.id as string;
  };

  it('accepts Z for scope=this and stores the exact occurrence instant', async () => {
    const meetingId = await createSeries('z-this');
    const response = await request(app)
      .patch(`/api/meeting/${meetingId}/occurrence`)
      .set(headers)
      .send({ recurrenceId: '2026-11-01T08:00:00.000Z', scope: 'this', changes: {} });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const cold = await pool.query(
      `SELECT recurrence_exception_at FROM meetings
        WHERE organization_id=$1 AND recurrence_parent_id=$2`,
      [org, meetingId]
    );
    expect(cold.rowCount).toBe(1);
    expect(cold.rows[0].recurrence_exception_at).toBe('2026-11-01T08:00:00.000Z');
  });

  it('accepts an offset for scope=this_and_following and stores the UTC UNTIL', async () => {
    const meetingId = await createSeries('offset-following');
    const response = await request(app)
      .patch(`/api/meeting/${meetingId}/occurrence`)
      .set(headers)
      .send({
        recurrenceId: '2026-11-01T08:00:00+01:00',
        scope: 'this_and_following',
        changes: {},
      });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const cold = await pool.query(
      `SELECT recurrence_rule FROM meetings WHERE organization_id=$1 AND id=$2`,
      [org, meetingId]
    );
    const until = String(cold.rows[0].recurrence_rule).match(/UNTIL=([^;]+)/)?.[1];
    expect(until).toBe('20261101T065959Z');
  });

  it('rejects a zone-less scope=this without adding an exception row', async () => {
    const meetingId = await createSeries('reject-this');
    const before = await pool.query(
      `SELECT count(*)::int AS count FROM meetings WHERE organization_id=$1 AND recurrence_parent_id=$2`,
      [org, meetingId]
    );
    const response = await request(app)
      .patch(`/api/meeting/${meetingId}/occurrence`)
      .set(headers)
      .send({ recurrenceId: '2026-11-01T08:00:00', scope: 'this', changes: {} });
    const after = await pool.query(
      `SELECT count(*)::int AS count FROM meetings WHERE organization_id=$1 AND recurrence_parent_id=$2`,
      [org, meetingId]
    );
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_OCCURRENCE');
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });

  it('rejects a zone-less split without changing the master rule', async () => {
    const meetingId = await createSeries('reject-following');
    const before = await pool.query(`SELECT recurrence_rule FROM meetings WHERE id=$1`, [
      meetingId,
    ]);
    const response = await request(app)
      .patch(`/api/meeting/${meetingId}/occurrence`)
      .set(headers)
      .send({ recurrenceId: '2026-11-01T08:00:00', scope: 'this_and_following', changes: {} });
    const after = await pool.query(`SELECT recurrence_rule FROM meetings WHERE id=$1`, [meetingId]);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_OCCURRENCE');
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('rejects a zone-less DELETE scope=all without mutation or delivery', async () => {
    const meetingId = await createSeries('reject-all');
    const before = await pool.query(`SELECT recurrence_status FROM meetings WHERE id=$1`, [
      meetingId,
    ]);
    const response = await request(app)
      .delete(`/api/meeting/${meetingId}/occurrence`)
      .set(headers)
      .send({ recurrenceId: '2026-11-01T08:00:00', scope: 'all' });
    const after = await pool.query(`SELECT recurrence_status FROM meetings WHERE id=$1`, [
      meetingId,
    ]);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_OCCURRENCE');
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(sendMeetingInvitationsSpy).not.toHaveBeenCalled();
  });

  it('rejects a recurrenceRule UNTIL date-time without Z and preserves the series', async () => {
    const meetingId = await createSeries('reject-until');
    const before = await pool.query(`SELECT recurrence_rule FROM meetings WHERE id=$1`, [
      meetingId,
    ]);
    const response = await request(app)
      .patch(`/api/meeting/${meetingId}/occurrence`)
      .set(headers)
      .send({
        recurrenceId: '2026-11-01T08:00:00.000Z',
        scope: 'all',
        changes: { recurrenceRule: 'FREQ=WEEKLY;UNTIL=20261101T075959' },
      });
    const after = await pool.query(`SELECT recurrence_rule FROM meetings WHERE id=$1`, [meetingId]);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_RECURRENCE_RULE');
    expect(after.rows[0]).toEqual(before.rows[0]);
  });
});
