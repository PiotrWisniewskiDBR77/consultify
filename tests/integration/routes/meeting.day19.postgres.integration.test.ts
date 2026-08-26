/** @vitest-environment node */
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const organizationId = req.headers['x-test-org-id'];
    const id = req.headers['x-test-user-id'];
    if (!organizationId || !id) return res.status(401).json({ error: 'No token provided' });
    req.userRole = req.headers['x-test-role'] || 'administrator';
    req.user = { id, organizationId, role: req.userRole, email: `${id}@example.com` };
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const PREFIX = `day19-${randomUUID().slice(0, 8)}`;
const ORG_A = `${PREFIX}-org-a`;
const ORG_B = `${PREFIX}-org-b`;
const USER_A = `${PREFIX}-user-a`;
const headers = (org = ORG_A) => ({
  'x-test-org-id': org,
  'x-test-user-id': USER_A,
  'x-test-role': 'administrator',
});

describe('Meetings day19 routes — real router and PostgreSQL', () => {
  let app: express.Express;
  let pool: Pool;
  let meetingId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL || process.env.RUN_DB_TESTS !== '1')
      throw new Error('real local PG required');
    const { default: routes } = await import('../../../server/src/routes/meeting.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/meeting', routes);
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const created = await request(app).post('/api/meeting').set(headers()).send({
      title: 'Weekly operations review',
      startAt: '2026-10-18T08:00:00.000Z',
      endAt: '2026-10-18T09:00:00.000Z',
      timezone: 'Europe/Warsaw',
      recurrenceRule: 'FREQ=WEEKLY;COUNT=8',
    });
    expect(created.status).toBe(201);
    meetingId = created.body.meeting.id;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM meeting_attachments WHERE organization_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await pool.query(`DELETE FROM meeting_note_materializations WHERE organization_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await pool.query(`DELETE FROM artifact_handoff_receipts WHERE organization_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await pool.query(`DELETE FROM artifact_handoff_proposals WHERE organization_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await pool.query(`DELETE FROM meeting_notes WHERE organization_id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM meeting_participants WHERE organization_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await pool.query(`DELETE FROM meetings WHERE organization_id LIKE $1`, [`${PREFIX}%`]);
    await pool.end();
  });

  it('edits one occurrence idempotently without deleting the series', async () => {
    const body = {
      recurrenceId: '2026-10-25T08:00:00.000Z',
      scope: 'this',
      changes: { title: 'Shifted review' },
    };
    const first = await request(app)
      .patch(`/api/meeting/${meetingId}/occurrence`)
      .set(headers())
      .send(body);
    const second = await request(app)
      .patch(`/api/meeting/${meetingId}/occurrence`)
      .set(headers())
      .send(body);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.replayed).toBe(true);
    const { rows } = await pool.query(
      `SELECT * FROM meetings WHERE recurrence_parent_id=$1 AND recurrence_exception_at=$2`,
      [meetingId, body.recurrenceId]
    );
    expect(rows).toHaveLength(1);
  });

  it('splits this-and-following into a new master and preserves lineage', async () => {
    const res = await request(app)
      .patch(`/api/meeting/${meetingId}/occurrence`)
      .set(headers())
      .send({
        recurrenceId: '2026-11-01T08:00:00.000Z',
        scope: 'this_and_following',
        changes: { title: 'Future review' },
      });
    expect(res.status).toBe(200);
    expect(res.body.splitMeeting.splitFromMeetingId).toBe(meetingId);
    const old = await pool.query(`SELECT recurrence_rule FROM meetings WHERE id=$1`, [meetingId]);
    expect(old.rows[0].recurrence_rule).toContain('UNTIL=');
  });

  it('edits the whole master and increments invitation sequence', async () => {
    const before = await pool.query(`SELECT invitation_sequence FROM meetings WHERE id=$1`, [
      meetingId,
    ]);
    const res = await request(app)
      .patch(`/api/meeting/${meetingId}/occurrence`)
      .set(headers())
      .send({
        recurrenceId: '2026-10-18T08:00:00.000Z',
        scope: 'all',
        changes: { location: 'Room 4' },
      });
    expect(res.status).toBe(200);
    expect(res.body.meeting.location).toBe('Room 4');
    expect(res.body.meeting.invitationSequence).toBe(
      Number(before.rows[0].invitation_sequence) + 1
    );
  });

  it('rejects invalid recurrence input and a foreign tenant', async () => {
    const invalid = await request(app)
      .patch(`/api/meeting/${meetingId}/occurrence`)
      .set(headers())
      .send({ recurrenceId: 'bad\nvalue', scope: 'this', changes: {} });
    expect(invalid.status).toBe(400);
    const foreign = await request(app)
      .patch(`/api/meeting/${meetingId}/occurrence`)
      .set(headers(ORG_B))
      .send({ recurrenceId: '2026-10-25T08:00:00.000Z', scope: 'this', changes: {} });
    expect(foreign.status).toBe(404);
  });

  it('attaches a meeting note and hides all attachment data from another tenant', async () => {
    const generated = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(headers())
      .send({ transcript: 'Discussed delivery. Decision: ship Friday.' });
    expect(generated.status).toBe(201);
    const noteId = generated.body.meetingNoteId;
    const attached = await request(app)
      .post(`/api/meeting/${meetingId}/attachments`)
      .set(headers())
      .send({ artifactKind: 'note', artifactId: noteId });
    expect(attached.status).toBe(201);
    const list = await request(app).get(`/api/meeting/${meetingId}/attachments`).set(headers());
    expect(list.status).toBe(200);
    expect(list.body.attachments[0].accessible).toBe(true);
    const foreign = await request(app)
      .get(`/api/meeting/${meetingId}/attachments`)
      .set(headers(ORG_B));
    expect(foreign.status).toBe(404);
  });
});
