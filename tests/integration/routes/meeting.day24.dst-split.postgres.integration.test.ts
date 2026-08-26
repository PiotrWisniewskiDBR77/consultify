/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import { DateTime } from 'luxon';
import { Pool } from 'pg';
import RRulePackage from 'rrule';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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

const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error('disposable local PostgreSQL required');
const prefix = `day24-dst-${randomUUID().slice(0, 8)}`;
const org = `${prefix}-org`;
const user = `${prefix}-admin`;
const pool = new Pool({ connectionString: url });
const headers = { 'x-org': org, 'x-user': user };
const { rrulestr } = (RRulePackage as any).default || (RRulePackage as any);

const formatRRuleDate = (value: Date) =>
  value
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
const seriesGrid = (dtstart: string) =>
  (rrulestr(`DTSTART:${dtstart}Z\nRRULE:FREQ=WEEKLY;COUNT=8`).all() as Date[]).map((wall) =>
    DateTime.fromObject(
      {
        year: wall.getUTCFullYear(),
        month: wall.getUTCMonth() + 1,
        day: wall.getUTCDate(),
        hour: wall.getUTCHours(),
        minute: wall.getUTCMinutes(),
        second: wall.getUTCSeconds(),
      },
      { zone: 'Europe/Warsaw' }
    ).toJSDate()
  );

describe('Meetings day24 C — UTC UNTIL across both Warsaw DST boundaries', () => {
  let app: express.Express;
  beforeAll(async () => {
    const routes = (await import('../../../server/src/routes/meeting.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/meeting', routes);
  });
  afterAll(async () => {
    await pool.query(`DELETE FROM meeting_invitation_deliveries WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM meeting_participants WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM meetings WHERE organization_id=$1`, [org]);
    await pool.end();
  });

  for (const scenario of [
    {
      name: 'autumn CEST to CET',
      startAt: '2026-10-18T07:00:00.000Z',
      dtstart: '20261018T090000',
      expectedOccurrence: '2026-11-01T08:00:00.000Z',
    },
    {
      name: 'spring CET to CEST',
      startAt: '2027-03-21T08:00:00.000Z',
      dtstart: '20270321T090000',
      expectedOccurrence: '2027-04-04T07:00:00.000Z',
    },
  ]) {
    it(scenario.name, async () => {
      const grid = seriesGrid(scenario.dtstart);
      const recurrenceId = grid[2].toISOString();
      expect(recurrenceId).toBe(scenario.expectedOccurrence);
      const created = await request(app).post('/api/meeting').set(headers).send({
        title: scenario.name,
        startAt: scenario.startAt,
        timezone: 'Europe/Warsaw',
        recurrenceRule: 'FREQ=WEEKLY;COUNT=8',
      });
      expect(created.status).toBe(201);
      const meetingId = created.body.meeting.id;
      const split = await request(app)
        .patch(`/api/meeting/${meetingId}/occurrence`)
        .set(headers)
        .send({ recurrenceId, scope: 'this_and_following', changes: {} });
      expect(split.status, JSON.stringify(split.body)).toBe(200);
      const cold = await pool.query(
        `SELECT recurrence_rule FROM meetings WHERE id=$1 AND organization_id=$2`,
        [meetingId, org]
      );
      const expected = formatRRuleDate(new Date(grid[2].getTime() - 1000));
      const until = String(cold.rows[0].recurrence_rule).match(/UNTIL=([^;]+)/)?.[1];
      expect(until).toBe(expected);
      expect(until).toMatch(/Z$/);
      expect(until).not.toBe(formatRRuleDate(new Date(grid[2].getTime() - 3601000)));
      expect(split.body.splitMeeting.splitFromMeetingId).toBe(meetingId);
      const newMaster = await pool.query(
        `SELECT recurrence_parent_id,split_from_meeting_id FROM meetings WHERE id=$1`,
        [split.body.splitMeeting.id]
      );
      expect(newMaster.rows[0]).toMatchObject({
        recurrence_parent_id: null,
        split_from_meeting_id: meetingId,
      });
    });

    it(`${scenario.name} documents that an explicit-zone instant outside the series grid is accepted`, async () => {
      const grid = seriesGrid(scenario.dtstart);
      const outsideGrid = new Date(grid[2].getTime() + 60 * 60 * 1000).toISOString();
      expect(grid.map((value) => value.toISOString())).not.toContain(outsideGrid);
      const created = await request(app)
        .post('/api/meeting')
        .set(headers)
        .send({
          title: `${scenario.name} outside grid`,
          startAt: scenario.startAt,
          timezone: 'Europe/Warsaw',
          recurrenceRule: 'FREQ=WEEKLY;COUNT=8',
        });
      expect(created.status).toBe(201);
      const response = await request(app)
        .patch(`/api/meeting/${created.body.meeting.id}/occurrence`)
        .set(headers)
        .send({ recurrenceId: outsideGrid, scope: 'this_and_following', changes: {} });
      expect(response.status, JSON.stringify(response.body)).toBe(200);
    });
  }
});
