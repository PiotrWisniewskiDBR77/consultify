/** @vitest-environment node */

/**
 * M12 Meeting — 35 golden flows against a REAL Postgres database.
 *
 * Boots the real, production `meeting.routes.ts` router + the real
 * `meetingService` / `DbPromise` / `PostgresDatabase` stack against whatever
 * `DATABASE_URL` points at. Nothing about persistence, tenancy or validation is
 * mocked — every "saved" assertion is verified with an independent SQL
 * read-back through a separate `pg.Pool`, never from the API envelope
 * (`DbPromise.run` defaults to `fallback: true` and therefore cannot be trusted
 * to reject on a failed write — see M15/M09 acceptance findings).
 *
 * Only infrastructure edges outside M12's scope are stubbed: auth
 * (parametrised per request via test headers so tenant/role cases can be
 * exercised) and Logger (silenced, not behaviourally mocked). `betaGate` stays
 * REAL because whether it actually gates is one of the things under test.
 *
 * REQUIRES a real Postgres reachable via `DATABASE_URL` with
 * `NODE_ENV=test RUN_DB_TESTS=1` (see `server/src/database/Database.ts` —
 * `NODE_ENV=test` WITHOUT `RUN_DB_TESTS=1` silently swaps in a mock DB and this
 * whole suite would pass against nothing). Run:
 *
 *   DATABASE_URL=postgresql://consultinity:consultinity@localhost:55712/consultinity \
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
 *   npx vitest run tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts
 */
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const orgId = req.headers['x-test-org-id'];
    const userId = req.headers['x-test-user-id'];
    if (req.headers['x-test-unauth'] === '1' || !orgId || !userId) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = userId;
    req.organizationId = orgId;
    req.userRole = req.headers['x-test-role'] || 'member';
    req.user = { id: userId, organizationId: orgId, role: req.headers['x-test-role'] || 'member' };
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const ORG_A = `org-m12-a-${uuidv4().slice(0, 8)}`;
const ORG_B = `org-m12-b-${uuidv4().slice(0, 8)}`;
const USER_A = `user-m12-a-${uuidv4().slice(0, 8)}`;
const USER_B = `user-m12-b-${uuidv4().slice(0, 8)}`;
const PROJECT_A = `proj-m12-${uuidv4().slice(0, 8)}`;

/** Regular org member (default role in this repo's auth payload). */
const member = (org = ORG_A, user = USER_A) => ({
  'x-test-org-id': org,
  'x-test-user-id': user,
  'x-test-role': 'member',
});
/** Org admin — the role gate on DELETE / PATCH :id/status. */
const admin = (org = ORG_A, user = USER_A) => ({
  'x-test-org-id': org,
  'x-test-user-id': user,
  'x-test-role': 'admin',
});

describe('M12 Meeting — golden flows (real Postgres)', () => {
  let app: express.Express;
  let pool: Pool;

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_DB_TESTS !== '1') {
      throw new Error(
        'This suite requires NODE_ENV=test RUN_DB_TESTS=1 with DATABASE_URL pointed at a real Postgres.'
      );
    }
    const { default: meetingRoutes } = await import('../../../server/src/routes/meeting.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/meeting', meetingRoutes);
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    // Probes clean up after themselves (CLAUDE.md — zero test records left).
    await pool.query(
      `DELETE FROM meeting_follow_ups WHERE meeting_id IN (SELECT id FROM meetings WHERE organization_id = ANY($1))`,
      [[ORG_A, ORG_B]]
    );
    await pool.query(`DELETE FROM meetings WHERE organization_id = ANY($1)`, [[ORG_A, ORG_B]]);
    await pool.end();
  });

  /** Independent read-back: the DB is the authority, never the API envelope. */
  const rowById = async (id: string) => {
    const { rows } = await pool.query(`SELECT * FROM meetings WHERE id = $1`, [id]);
    return rows[0] || null;
  };
  const followUpRows = async (meetingId: string) => {
    const { rows } = await pool.query(
      `SELECT * FROM meeting_follow_ups WHERE meeting_id = $1 ORDER BY created_at ASC`,
      [meetingId]
    );
    return rows;
  };

  const createMeeting = async (body: Record<string, unknown>, headers = member()) =>
    request(app).post('/api/meeting').set(headers).send(body);

  // ── GROUP A — open / list ────────────────────────────────────────────────
  describe('A. open', () => {
    it('GF-01 unauthenticated list is rejected, not silently empty', async () => {
      const res = await request(app).get('/api/meeting').set({ 'x-test-unauth': '1' });
      expect(res.status).toBe(401);
    });

    it('GF-02 fresh org opens to an honest empty list (200 + [])', async () => {
      const res = await request(app).get('/api/meeting').set(member(ORG_B, USER_B));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.meetings)).toBe(true);
      expect(res.body.meetings).toHaveLength(0);
    });

    it('GF-03 ensureMeetingTables() really creates the schema on Postgres', async () => {
      const { rows } = await pool.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema='public' AND table_name IN ('meetings','meeting_follow_ups')`
      );
      expect(rows.map((r) => r.table_name).sort()).toEqual(['meeting_follow_ups', 'meetings']);
    });

    it('GF-04 list returns created meetings ordered by start_at ascending', async () => {
      await createMeeting({ title: 'Later', startAt: '2026-09-02T10:00:00.000Z' });
      await createMeeting({ title: 'Earlier', startAt: '2026-09-01T10:00:00.000Z' });
      const res = await request(app).get('/api/meeting').set(member());
      expect(res.status).toBe(200);
      const titles = res.body.meetings.map((m: any) => m.title);
      expect(titles.indexOf('Earlier')).toBeLessThan(titles.indexOf('Later'));
    });

    it('GF-05 projectId query filter narrows the list', async () => {
      await createMeeting({
        title: 'Project scoped',
        startAt: '2026-09-03T10:00:00.000Z',
        projectId: PROJECT_A,
      });
      const res = await request(app).get(`/api/meeting?projectId=${PROJECT_A}`).set(member());
      expect(res.status).toBe(200);
      expect(res.body.meetings).toHaveLength(1);
      expect(res.body.meetings[0].title).toBe('Project scoped');
    });

    it('GF-06 betaGate is mounted on the router and does NOT block MODULE_MEETING', async () => {
      // meeting.routes.ts:51 claims the gate "flips to 403 BETA_LOCKED when
      // MODULE_MEETING is set closed in betaAccess.ts". It is set to 'closed'.
      // This asserts the real runtime behaviour, whatever the comment says.
      const res = await request(app).get('/api/meeting').set(member());
      expect(res.status).toBe(200);
    });
  });

  // ── GROUP B — create ─────────────────────────────────────────────────────
  describe('B. create', () => {
    it('GF-07 create persists a row that a separate SQL read-back can see', async () => {
      const res = await createMeeting({
        title: 'Steering committee',
        startAt: '2026-09-10T09:00:00.000Z',
        endAt: '2026-09-10T10:00:00.000Z',
        location: 'Room 4',
      });
      expect(res.status).toBe(201);
      const row = await rowById(res.body.meeting.id);
      expect(row).not.toBeNull();
      expect(row.title).toBe('Steering committee');
      expect(row.location).toBe('Room 4');
      expect(row.organization_id).toBe(ORG_A);
      expect(row.created_by).toBe(USER_A);
      expect(row.status).toBe('scheduled');
    });

    it('GF-08 create round-trips agenda / attendees / pre-read arrays', async () => {
      const res = await createMeeting({
        title: 'Kickoff',
        startAt: '2026-09-11T09:00:00.000Z',
        attendees: ['Ann', 'Bob'],
        preRead: ['https://example.test/deck'],
        agenda: ['Scope', 'Risks', 'Next steps'],
      });
      expect(res.status).toBe(201);
      const row = await rowById(res.body.meeting.id);
      expect(JSON.parse(row.attendees_json)).toEqual(['Ann', 'Bob']);
      expect(JSON.parse(row.agenda_json)).toEqual(['Scope', 'Risks', 'Next steps']);
      expect(JSON.parse(row.pre_read_json)).toEqual(['https://example.test/deck']);
    });

    it('GF-09 create without title is rejected 400 and writes nothing', async () => {
      const before = (
        await pool.query(`SELECT count(*) c FROM meetings WHERE organization_id=$1`, [ORG_A])
      ).rows[0].c;
      const res = await createMeeting({ startAt: '2026-09-12T09:00:00.000Z' });
      expect(res.status).toBe(400);
      const after = (
        await pool.query(`SELECT count(*) c FROM meetings WHERE organization_id=$1`, [ORG_A])
      ).rows[0].c;
      expect(after).toBe(before);
    });

    it('GF-10 create without startAt is rejected 400', async () => {
      const res = await createMeeting({ title: 'No date' });
      expect(res.status).toBe(400);
    });

    it('GF-11 missing endAt defaults to startAt (no null/undefined leaks into the row)', async () => {
      const res = await createMeeting({ title: 'One point', startAt: '2026-09-13T09:00:00.000Z' });
      const row = await rowById(res.body.meeting.id);
      expect(row.end_at).toBe('2026-09-13T09:00:00.000Z');
    });

    it('GF-12 create is org-stamped from the token, not from the request body', async () => {
      const res = await createMeeting({
        title: 'Org spoof attempt',
        startAt: '2026-09-14T09:00:00.000Z',
        organizationId: ORG_B,
        createdBy: USER_B,
      });
      const row = await rowById(res.body.meeting.id);
      expect(row.organization_id).toBe(ORG_A);
      expect(row.created_by).toBe(USER_A);
    });
  });

  // ── GROUP C — edit / save ────────────────────────────────────────────────
  describe('C. edit & save', () => {
    let id: string;
    beforeAll(async () => {
      const res = await createMeeting({
        title: 'Editable',
        startAt: '2026-09-20T09:00:00.000Z',
        agenda: ['Old'],
      });
      id = res.body.meeting.id;
    });

    it('GF-13 update persists the new title (verified by SQL read-back)', async () => {
      const res = await request(app)
        .put(`/api/meeting/${id}`)
        .set(member())
        .send({ title: 'Edited title' });
      expect(res.status).toBe(200);
      expect((await rowById(id)).title).toBe('Edited title');
    });

    it('GF-14 update replaces array fields wholesale', async () => {
      await request(app)
        .put(`/api/meeting/${id}`)
        .set(member())
        .send({ agenda: ['New A', 'New B'], attendees: ['Zoe'] });
      const row = await rowById(id);
      expect(JSON.parse(row.agenda_json)).toEqual(['New A', 'New B']);
      expect(JSON.parse(row.attendees_json)).toEqual(['Zoe']);
    });

    it('GF-15 empty title is rejected 400 and does not blank the stored title', async () => {
      const res = await request(app).put(`/api/meeting/${id}`).set(member()).send({ title: '   ' });
      expect(res.status).toBe(400);
      expect((await rowById(id)).title).toBe('Edited title');
    });

    it('GF-16 empty startAt is rejected 400', async () => {
      const res = await request(app).put(`/api/meeting/${id}`).set(member()).send({ startAt: '' });
      expect(res.status).toBe(400);
    });

    it('GF-17 update of an unknown id is 404, not a fabricated success envelope', async () => {
      const res = await request(app)
        .put(`/api/meeting/meeting-does-not-exist`)
        .set(member())
        .send({ title: 'ghost' });
      expect(res.status).toBe(404);
    });

    it('GF-18 update bumps updated_at', async () => {
      const before = (await rowById(id)).updated_at;
      await new Promise((r) => setTimeout(r, 5));
      await request(app).put(`/api/meeting/${id}`).set(member()).send({ location: 'Room 9' });
      const after = (await rowById(id)).updated_at;
      expect(after).not.toBe(before);
    });
  });

  // ── GROUP D — fresh reopen ───────────────────────────────────────────────
  describe('D. fresh reopen', () => {
    let id: string;
    beforeAll(async () => {
      const res = await createMeeting({
        title: 'Reopen me',
        startAt: '2026-09-25T09:00:00.000Z',
        agenda: ['A1'],
        attendees: ['Ann'],
      });
      id = res.body.meeting.id;
    });

    it('GF-19 a fresh list request returns the saved meeting with all fields intact', async () => {
      const res = await request(app).get('/api/meeting').set(member());
      const found = res.body.meetings.find((m: any) => m.id === id);
      expect(found).toBeTruthy();
      expect(found.agenda).toEqual(['A1']);
      expect(found.attendees).toEqual(['Ann']);
      expect(found.status).toBe('scheduled');
    });

    it('GF-20 follow-ups survive the reopen and are attached to the right meeting', async () => {
      await request(app)
        .post(`/api/meeting/${id}/follow-ups`)
        .set(member())
        .send({ title: 'Send minutes', owner: 'Ann' });
      const res = await request(app).get('/api/meeting').set(member());
      const found = res.body.meetings.find((m: any) => m.id === id);
      expect(found.followUps).toHaveLength(1);
      expect(found.followUps[0].title).toBe('Send minutes');
      expect(found.followUps[0].status).toBe('open');
    });

    it('GF-21 decisions survive the reopen', async () => {
      await request(app)
        .post(`/api/meeting/${id}/decisions`)
        .set(member())
        .send({ decision: 'Ship on Friday' });
      const res = await request(app).get('/api/meeting').set(member());
      const found = res.body.meetings.find((m: any) => m.id === id);
      expect(found.decisions).toEqual(['Ship on Friday']);
    });
  });

  // ── GROUP E — decisions & follow-ups ─────────────────────────────────────
  describe('E. decisions & follow-ups', () => {
    let id: string;
    beforeAll(async () => {
      const res = await createMeeting({ title: 'Outcomes', startAt: '2026-10-01T09:00:00.000Z' });
      id = res.body.meeting.id;
    });

    it('GF-22 add decision persists into decisions_json', async () => {
      const res = await request(app)
        .post(`/api/meeting/${id}/decisions`)
        .set(member())
        .send({ decision: 'Approve budget' });
      expect(res.status).toBe(201);
      expect(JSON.parse((await rowById(id)).decisions_json)).toEqual(['Approve budget']);
    });

    it('GF-23 empty decision is rejected 400', async () => {
      const res = await request(app)
        .post(`/api/meeting/${id}/decisions`)
        .set(member())
        .send({ decision: '  ' });
      expect(res.status).toBe(400);
    });

    it('GF-24 add follow-up creates a real child row', async () => {
      const res = await request(app)
        .post(`/api/meeting/${id}/follow-ups`)
        .set(member())
        .send({ title: 'Book room', owner: 'Bob' });
      expect(res.status).toBe(201);
      const rows = await followUpRows(id);
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe('Book room');
      expect(rows[0].owner).toBe('Bob');
      expect(rows[0].status).toBe('open');
    });

    it('GF-25 empty follow-up title is rejected 400', async () => {
      const res = await request(app)
        .post(`/api/meeting/${id}/follow-ups`)
        .set(member())
        .send({ title: '' });
      expect(res.status).toBe(400);
    });

    it('GF-26 toggling a follow-up to done persists the new status', async () => {
      const followUpId = (await followUpRows(id))[0].id;
      const res = await request(app)
        .patch(`/api/meeting/${id}/follow-ups/${followUpId}`)
        .set(member())
        .send({ status: 'done' });
      expect(res.status).toBe(200);
      const rows = await followUpRows(id);
      expect(rows.find((r) => r.id === followUpId).status).toBe('done');
    });

    it('GF-27 an invalid follow-up status is rejected 400', async () => {
      const followUpId = (await followUpRows(id))[0].id;
      const res = await request(app)
        .patch(`/api/meeting/${id}/follow-ups/${followUpId}`)
        .set(member())
        .send({ status: 'maybe' });
      expect(res.status).toBe(400);
    });

    it('GF-28 toggling a follow-up that does not exist must NOT report success', async () => {
      const res = await request(app)
        .patch(`/api/meeting/${id}/follow-ups/meeting-fu-does-not-exist`)
        .set(member())
        .send({ status: 'done' });
      expect(res.status).toBe(404);
    });

    it('GF-29 a follow-up id belonging to another meeting must NOT be toggled', async () => {
      const other = await createMeeting({
        title: 'Other meeting',
        startAt: '2026-10-02T09:00:00.000Z',
      });
      const otherId = other.body.meeting.id;
      await request(app)
        .post(`/api/meeting/${otherId}/follow-ups`)
        .set(member())
        .send({ title: 'Belongs elsewhere' });
      const foreignFollowUpId = (await followUpRows(otherId))[0].id;

      const res = await request(app)
        .patch(`/api/meeting/${id}/follow-ups/${foreignFollowUpId}`)
        .set(member())
        .send({ status: 'done' });

      // Whatever the status code, the foreign row must be untouched.
      const stillOpen = (await followUpRows(otherId))[0].status;
      expect(stillOpen).toBe('open');
      expect(res.status).toBe(404);
    });
  });

  // ── GROUP F — main action: AI notes from transcript ───────────────────────
  describe('F. generate notes (main action)', () => {
    let id: string;
    beforeAll(async () => {
      const res = await createMeeting({
        title: 'Transcript meeting',
        startAt: '2026-10-05T09:00:00.000Z',
        attendees: ['Ann', 'Bob'],
        agenda: ['Status'],
      });
      id = res.body.meeting.id;
    });

    it('GF-30 generate-notes without a transcript is rejected 400', async () => {
      const res = await request(app)
        .post(`/api/meeting/${id}/generate-notes`)
        .set(member())
        .send({});
      expect(res.status).toBe(400);
    });

    it('GF-31 generate-notes on an unknown meeting is 404', async () => {
      const res = await request(app)
        .post(`/api/meeting/meeting-nope/generate-notes`)
        .set(member())
        .send({ transcript: 'we decided to ship' });
      expect(res.status).toBe(404);
    });

    it('GF-32 generate-notes returns notes and honestly labels the heuristic path', async () => {
      const res = await request(app).post(`/api/meeting/${id}/generate-notes`).set(member()).send({
        transcript:
          'Ann: we decided to ship the pilot on Friday. Bob: action item - Bob will prepare the rollout plan by Monday.',
        language: 'en',
      });
      expect(res.status).toBe(201);
      expect(res.body.note).toBeTruthy();
      // No OPENAI_API_KEY in this environment → must self-declare as heuristic,
      // never present keyword extraction as AI output.
      expect(res.body.note.source).toBe('heuristic');
    });

    it('GF-33 extracted decisions/action items are actually persisted, not only returned', async () => {
      const row = await rowById(id);
      const followUps = await followUpRows(id);
      const decisions = JSON.parse(row.decisions_json || '[]');
      // The route claims (route comment + UI header "Decisions saved") that
      // extracted outcomes become first-class records. Prove it against SQL.
      expect(decisions.length + followUps.length).toBeGreaterThan(0);
    });
  });

  // ── GROUP G — status transitions & role gate ─────────────────────────────
  describe('G. status & roles', () => {
    let id: string;
    beforeAll(async () => {
      const res = await createMeeting({
        title: 'Status flow',
        startAt: '2026-10-10T09:00:00.000Z',
      });
      id = res.body.meeting.id;
    });

    it('GF-34 a regular member cannot flip meeting status (403)', async () => {
      const res = await request(app)
        .patch(`/api/meeting/${id}/status`)
        .set(member())
        .send({ status: 'completed' });
      expect(res.status).toBe(403);
      expect((await rowById(id)).status).toBe('scheduled');
    });

    it('GF-35 an admin can flip status to completed and it persists', async () => {
      const res = await request(app)
        .patch(`/api/meeting/${id}/status`)
        .set(admin())
        .send({ status: 'completed' });
      expect(res.status).toBe(200);
      expect((await rowById(id)).status).toBe('completed');
    });

    it('GF-36 an invalid status value is rejected 400', async () => {
      const res = await request(app)
        .patch(`/api/meeting/${id}/status`)
        .set(admin())
        .send({ status: 'cancelled' });
      expect(res.status).toBe(400);
    });

    it('GF-37 a regular member cannot delete a meeting (403) and the row survives', async () => {
      const res = await request(app).delete(`/api/meeting/${id}`).set(member());
      expect(res.status).toBe(403);
      expect(await rowById(id)).not.toBeNull();
    });

    it('GF-38 an admin delete removes the meeting AND its follow-ups', async () => {
      await request(app)
        .post(`/api/meeting/${id}/follow-ups`)
        .set(member())
        .send({ title: 'Will be cascaded' });
      expect(await followUpRows(id)).toHaveLength(1);

      const res = await request(app).delete(`/api/meeting/${id}`).set(admin());
      expect(res.status).toBe(200);
      expect(await rowById(id)).toBeNull();
      expect(await followUpRows(id)).toHaveLength(0);
    });
  });

  // ── GROUP H — tenant isolation ───────────────────────────────────────────
  describe('H. tenant isolation', () => {
    let orgAMeetingId: string;
    beforeAll(async () => {
      const res = await createMeeting({
        title: 'Org A private',
        startAt: '2026-10-15T09:00:00.000Z',
      });
      orgAMeetingId = res.body.meeting.id;
    });

    it('GF-39 org B does not see org A meetings in its list', async () => {
      const res = await request(app).get('/api/meeting').set(member(ORG_B, USER_B));
      expect(res.body.meetings.some((m: any) => m.id === orgAMeetingId)).toBe(false);
    });

    it('GF-40 org B cannot update an org A meeting (404, and the row is unchanged)', async () => {
      const res = await request(app)
        .put(`/api/meeting/${orgAMeetingId}`)
        .set(member(ORG_B, USER_B))
        .send({ title: 'Hijacked' });
      expect(res.status).toBe(404);
      expect((await rowById(orgAMeetingId)).title).toBe('Org A private');
    });

    it('GF-41 org B cannot append a decision to an org A meeting', async () => {
      const res = await request(app)
        .post(`/api/meeting/${orgAMeetingId}/decisions`)
        .set(member(ORG_B, USER_B))
        .send({ decision: 'Cross-tenant write' });
      expect(res.status).toBe(404);
      expect(JSON.parse((await rowById(orgAMeetingId)).decisions_json || '[]')).toEqual([]);
    });

    it('GF-42 org B cannot add a follow-up to an org A meeting', async () => {
      const res = await request(app)
        .post(`/api/meeting/${orgAMeetingId}/follow-ups`)
        .set(member(ORG_B, USER_B))
        .send({ title: 'Cross-tenant follow-up' });
      expect(res.status).toBe(404);
      expect(await followUpRows(orgAMeetingId)).toHaveLength(0);
    });

    it('GF-43 an org B admin cannot delete an org A meeting', async () => {
      const res = await request(app)
        .delete(`/api/meeting/${orgAMeetingId}`)
        .set(admin(ORG_B, USER_B));
      expect(res.status).toBe(404);
      expect(await rowById(orgAMeetingId)).not.toBeNull();
    });

    it('GF-44 an org B admin cannot flip status on an org A meeting', async () => {
      const res = await request(app)
        .patch(`/api/meeting/${orgAMeetingId}/status`)
        .set(admin(ORG_B, USER_B))
        .send({ status: 'completed' });
      expect(res.status).toBe(404);
      expect((await rowById(orgAMeetingId)).status).toBe('scheduled');
    });

    it('GF-45 org B cannot generate notes against an org A meeting', async () => {
      const res = await request(app)
        .post(`/api/meeting/${orgAMeetingId}/generate-notes`)
        .set(member(ORG_B, USER_B))
        .send({ transcript: 'cross tenant transcript' });
      expect(res.status).toBe(404);
    });
  });

  // ── GROUP I — error surfaces ─────────────────────────────────────────────
  describe('I. error handling', () => {
    it('GF-46 every mutating route rejects an unauthenticated caller', async () => {
      const unauth = { 'x-test-unauth': '1' };
      const calls = [
        request(app).post('/api/meeting').set(unauth).send({ title: 'x', startAt: 'y' }),
        request(app).put('/api/meeting/whatever').set(unauth).send({ title: 'x' }),
        request(app).delete('/api/meeting/whatever').set(unauth),
        request(app)
          .patch('/api/meeting/whatever/status')
          .set(unauth)
          .send({ status: 'completed' }),
        request(app).post('/api/meeting/whatever/decisions').set(unauth).send({ decision: 'x' }),
        request(app).post('/api/meeting/whatever/follow-ups').set(unauth).send({ title: 'x' }),
        request(app)
          .post('/api/meeting/whatever/generate-notes')
          .set(unauth)
          .send({ transcript: 'x' }),
      ];
      const results = await Promise.all(calls);
      expect(results.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401, 401]);
    });

    it('GF-47 a database failure on create surfaces as an error, never as a fabricated 201', async () => {
      // A BEFORE INSERT trigger that RAISEs is a genuine statement failure —
      // the honest way to test fail-closed instead of stubbing the driver.
      await pool.query(`
        CREATE OR REPLACE FUNCTION m12_block_insert() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'm12 forced failure'; END;
        $$ LANGUAGE plpgsql;
      `);
      await pool.query(
        `CREATE TRIGGER m12_block_insert_trg BEFORE INSERT ON meetings
         FOR EACH ROW EXECUTE FUNCTION m12_block_insert()`
      );
      try {
        const res = await createMeeting({
          title: 'Should not survive',
          startAt: '2026-11-01T09:00:00.000Z',
        });
        expect(res.status).not.toBe(201);
        const { rows } = await pool.query(
          `SELECT count(*) c FROM meetings WHERE title = 'Should not survive'`
        );
        expect(Number(rows[0].c)).toBe(0);
      } finally {
        await pool.query(`DROP TRIGGER IF EXISTS m12_block_insert_trg ON meetings`);
        await pool.query(`DROP FUNCTION IF EXISTS m12_block_insert()`);
      }
    });

    it('GF-48 a silently-swallowing write (trigger returns NULL) must not be reported as saved', async () => {
      const created = await createMeeting({
        title: 'Silent write probe',
        startAt: '2026-11-02T09:00:00.000Z',
      });
      const id = created.body.meeting.id;
      // RETURN NULL => the statement reports success and writes nothing. This is
      // exactly the "false success" shape DbPromise's fallback:true cannot see.
      await pool.query(`
        CREATE OR REPLACE FUNCTION m12_swallow_update() RETURNS trigger AS $$
        BEGIN RETURN NULL; END;
        $$ LANGUAGE plpgsql;
      `);
      await pool.query(
        `CREATE TRIGGER m12_swallow_update_trg BEFORE UPDATE ON meetings
         FOR EACH ROW EXECUTE FUNCTION m12_swallow_update()`
      );
      try {
        const res = await request(app)
          .put(`/api/meeting/${id}`)
          .set(member())
          .send({ title: 'Renamed but not really' });
        const row = await rowById(id);
        expect(row.title).toBe('Silent write probe'); // nothing was written
        // The API must not claim the new title was saved.
        expect(res.body?.meeting?.title).not.toBe('Renamed but not really');
      } finally {
        await pool.query(`DROP TRIGGER IF EXISTS m12_swallow_update_trg ON meetings`);
        await pool.query(`DROP FUNCTION IF EXISTS m12_swallow_update()`);
      }
    });
  });
});
