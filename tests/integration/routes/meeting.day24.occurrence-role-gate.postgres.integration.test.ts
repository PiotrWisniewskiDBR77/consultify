/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { sendMeetingInvitationsSpy } = vi.hoisted(() => ({
  sendMeetingInvitationsSpy: vi.fn(async () => []),
}));

vi.mock('../../../src/utils/betaAccess.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, BETA_MENU_STATUS: { ...actual.BETA_MENU_STATUS, MODULE_MEETING: 'open' } };
});
vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.userRole = req.headers['x-role'];
    req.user = {
      id: req.headers['x-user'],
      organizationId: req.headers['x-org'],
      role: req.userRole,
      email: `${req.headers['x-user']}@example.test`,
    };
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
const prefix = `day24-e-${randomUUID().slice(0, 8)}`;
const org = `${prefix}-org`;
const foreign = `${prefix}-foreign`;
const creator = `${prefix}-creator`;
const attendee = `${prefix}-attendee`;
const admin = `${prefix}-admin`;
const pool = new Pool({ connectionString: url });
const h = (user: string, role: string, tenant = org) => ({
  'x-user': user,
  'x-role': role,
  'x-org': tenant,
});

describe('Meetings day24 E — occurrence role gates', () => {
  let app: express.Express;
  const createSeries = async () => {
    const result = await request(app)
      .post('/api/meeting')
      .set(h(creator, 'ADMIN'))
      .send({
        title: 'Role-gated series',
        startAt: '2026-10-18T08:00:00.000Z',
        attendees: [`${attendee}@example.test`],
        recurrenceRule: 'FREQ=WEEKLY;COUNT=8',
      });
    expect(result.status).toBe(201);
    return result.body.meeting.id as string;
  };
  beforeAll(async () => {
    const routes = (await import('../../../server/src/routes/meeting.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/meeting', routes);
  });
  afterAll(async () => {
    await pool.query(`DELETE FROM meeting_invitation_deliveries WHERE organization_id IN ($1,$2)`, [
      org,
      foreign,
    ]);
    await pool.query(`DELETE FROM meeting_participants WHERE organization_id IN ($1,$2)`, [
      org,
      foreign,
    ]);
    await pool.query(`DELETE FROM meetings WHERE organization_id IN ($1,$2)`, [org, foreign]);
    await pool.end();
  });

  it('allows the USER creator to PATCH but not DELETE', async () => {
    sendMeetingInvitationsSpy.mockClear();
    const id = await createSeries();
    const patch = await request(app)
      .patch(`/api/meeting/${id}/occurrence`)
      .set(h(creator, 'USER'))
      .send({
        recurrenceId: '2026-10-25T08:00:00.000Z',
        scope: 'all',
        changes: { location: 'Room E' },
      });
    expect(patch.status).toBe(200);
    const beforeDelete = await pool.query(`SELECT recurrence_status FROM meetings WHERE id=$1`, [
      id,
    ]);
    const del = await request(app)
      .delete(`/api/meeting/${id}/occurrence`)
      .set(h(creator, 'USER'))
      .send({ recurrenceId: '2026-10-25T08:00:00.000Z', scope: 'all' });
    expect(del.status).toBe(403);
    const afterDelete = await pool.query(`SELECT recurrence_status FROM meetings WHERE id=$1`, [
      id,
    ]);
    expect(afterDelete.rows[0]).toEqual(beforeDelete.rows[0]);
    expect(sendMeetingInvitationsSpy).toHaveBeenCalledTimes(1);
  });

  it('denies a non-creator attendee PATCH and DELETE with zero changes', async () => {
    sendMeetingInvitationsSpy.mockClear();
    const id = await createSeries();
    const before = await pool.query(`SELECT * FROM meetings WHERE id=$1`, [id]);
    const patch = await request(app)
      .patch(`/api/meeting/${id}/occurrence`)
      .set(h(attendee, 'USER'))
      .send({
        recurrenceId: '2026-10-25T08:00:00.000Z',
        scope: 'all',
        changes: { location: 'Leak' },
      });
    const del = await request(app)
      .delete(`/api/meeting/${id}/occurrence`)
      .set(h(attendee, 'USER'))
      .send({ recurrenceId: '2026-10-25T08:00:00.000Z', scope: 'all' });
    expect(patch.status).toBe(404);
    expect(del.status).toBe(403);
    const after = await pool.query(`SELECT * FROM meetings WHERE id=$1`, [id]);
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(sendMeetingInvitationsSpy).not.toHaveBeenCalled();
  });

  it('allows ADMIN PATCH and destructive cancellation', async () => {
    sendMeetingInvitationsSpy.mockClear();
    const id = await createSeries();
    expect(
      (
        await request(app)
          .patch(`/api/meeting/${id}/occurrence`)
          .set(h(admin, 'ADMIN'))
          .send({
            recurrenceId: '2026-10-25T08:00:00.000Z',
            scope: 'all',
            changes: { location: 'Admin room' },
          })
      ).status
    ).toBe(200);
    expect(
      (
        await request(app).delete(`/api/meeting/${id}/occurrence`).set(h(admin, 'ADMIN')).send({
          recurrenceId: '2026-10-25T08:00:00.000Z',
          scope: 'all',
        })
      ).status
    ).toBe(200);
    expect(
      (await pool.query(`SELECT recurrence_status FROM meetings WHERE id=$1`, [id])).rows[0]
        .recurrence_status
    ).toBe('cancelled');
    expect(sendMeetingInvitationsSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps foreign tenant requests at 404 with zero mutation', async () => {
    sendMeetingInvitationsSpy.mockClear();
    const id = await createSeries();
    const patch = await request(app)
      .patch(`/api/meeting/${id}/occurrence`)
      .set(h(admin, 'ADMIN', foreign))
      .send({
        recurrenceId: '2026-10-25T08:00:00.000Z',
        scope: 'all',
        changes: { title: 'Foreign leak' },
      });
    const result = await request(app)
      .delete(`/api/meeting/${id}/occurrence`)
      .set(h(admin, 'ADMIN', foreign))
      .send({ recurrenceId: '2026-10-25T08:00:00.000Z', scope: 'all' });
    expect(patch.status).toBe(404);
    expect(result.status).toBe(404);
    expect(JSON.stringify([patch.body, result.body])).not.toContain('Role-gated series');
    expect(
      (await pool.query(`SELECT recurrence_status FROM meetings WHERE id=$1`, [id])).rows[0]
        .recurrence_status
    ).toBeNull();
    expect(sendMeetingInvitationsSpy).not.toHaveBeenCalled();
  });
});
