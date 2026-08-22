/** @vitest-environment node */

/**
 * Lane C (closure) — MTG-BVP-001: route-level evidence for the meeting
 * boundary, against a REAL local Postgres (no mocks), through the REAL
 * production `meeting.routes.ts` router.
 *
 * Lives under `server/src/services/meetingBoundary/__tests__/` (not
 * `tests/<newdir>/`) for the same collection reason as
 * `meetingBoundaryService.pg.test.ts` and
 * `server/src/services/artifactHandoff/__tests__/handoffSpine.pg.test.ts`.
 *
 * This file covers exactly the two things that live at the ROUTE layer and
 * cannot be exercised by calling `meetingBoundaryService.ts` directly:
 *   - the role gate on `POST /:id/notes/:noteId/decision` (non-permitted
 *     role denied — mirrors the existing DELETE/status-change gate);
 *   - the changed DEFAULT on `POST /:id/generate-notes` — proving the new
 *     default no longer silently auto-persists into
 *     `meetings.decisions_json` / `meeting_follow_ups`, and that the
 *     explicit `persist: true` compatibility path still does.
 * Deeper governance (concurrency, replay, exactly-one, reject, tenant
 * isolation at the service boundary) is covered in
 * `meetingBoundaryService.pg.test.ts` — not duplicated here.
 *
 * Auth is mocked the same way `tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts`
 * mocks it (parametrised per request via test headers); everything else
 * (routing, `meetingService`, `meetingBoundaryService`, `handoffSpineService`,
 * `DbPromise`/`PostgresDatabase`) is REAL.
 *
 * Run (root config, no --config flag):
 *   export DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:55432/consultinity"
 *   export DB_TYPE=postgres CI=true MOCK_DB=false RUN_DB_TESTS=1
 *   npx vitest run server/src/services/meetingBoundary --no-file-parallelism --maxWorkers=1
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { meetingIntelligenceService } from '../../ai/meetingIntelligenceService.js';

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const orgId = req.headers['x-test-org-id'];
    const userId = req.headers['x-test-user-id'];
    if (!orgId || !userId) {
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

vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function requireLocalDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      `meetingBoundaryRoutes.pg.test.ts requires a LOCAL DATABASE_URL (got: ${url || '(unset)'}).`
    );
  }
  return url;
}

const RUN_ID = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const PREFIX = `claude_c_${RUN_ID}-`;
const ORG_A = `${PREFIX}org-a`;
const ORG_B = `${PREFIX}org-b`;
const USER_A = `${PREFIX}user-a`;
const USER_B = `${PREFIX}user-b`;

const member = (org = ORG_A, user = USER_A) => ({
  'x-test-org-id': org,
  'x-test-user-id': user,
  'x-test-role': 'member',
});
const betaAdmin = (org = ORG_A, user = USER_A) => ({
  'x-test-org-id': org,
  'x-test-user-id': user,
  'x-test-role': 'administrator',
});
const admin = (org = ORG_A, user = USER_A) => ({
  'x-test-org-id': org,
  'x-test-user-id': user,
  'x-test-role': 'admin',
});

describe('meeting boundary — route layer (real Postgres)', () => {
  let app: express.Express;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: requireLocalDatabaseUrl() });
    const { default: meetingRoutes } = await import('../../../routes/meeting.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/meeting', meetingRoutes);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM artifact_handoff_receipts WHERE organization_id LIKE $1`, [
      `${PREFIX}%`,
    ]);
    await pool.query(
      `DELETE FROM artifact_handoff_proposals WHERE organization_id LIKE $1 AND producer_kind = 'meeting'`,
      [`${PREFIX}%`]
    );
    await pool.query(`DELETE FROM meeting_notes WHERE organization_id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(
      `DELETE FROM meeting_follow_ups WHERE meeting_id IN (SELECT id FROM meetings WHERE organization_id LIKE $1)`,
      [`${PREFIX}%`]
    );
    await pool.query(`DELETE FROM meetings WHERE organization_id LIKE $1`, [`${PREFIX}%`]);

    const remaining = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM meeting_notes WHERE organization_id LIKE $1) AS notes,
         (SELECT COUNT(*)::int FROM meetings WHERE organization_id LIKE $1) AS meetings,
         (SELECT COUNT(*)::int FROM artifact_handoff_proposals WHERE organization_id LIKE $1 AND producer_kind = 'meeting') AS proposals,
         (SELECT COUNT(*)::int FROM artifact_handoff_receipts WHERE organization_id LIKE $1) AS receipts`,
      [`${PREFIX}%`]
    );
    expect(remaining.rows[0]).toEqual({ notes: 0, meetings: 0, proposals: 0, receipts: 0 });
    await pool.end();
  });

  const createMeeting = async (org = ORG_A) =>
    request(app)
      .post('/api/meeting')
      .set(betaAdmin(org))
      .send({ title: `${PREFIX}route-meeting`, startAt: '2026-09-20T09:00:00.000Z' });

  it('generate-notes DEFAULT no longer auto-persists into decisions_json / meeting_follow_ups, and creates a proposal instead', async () => {
    const created = await createMeeting();
    const meetingId = created.body.meeting.id;

    const res = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(betaAdmin())
      .send({
        transcript: `${PREFIX} Ann: we decided to ship the pilot on Friday. Bob: action item - Bob will prepare the rollout plan by Monday.`,
        language: 'en',
      });
    expect(res.status).toBe(201);
    expect(res.body.note).toBeTruthy();
    expect(res.body.meetingNoteId).toBeTruthy();
    expect(res.body.proposal?.proposalId).toBeTruthy();
    expect(res.body.proposal?.state).toBe('pending');

    const meetingRow = await pool.query(`SELECT decisions_json FROM meetings WHERE id = $1`, [
      meetingId,
    ]);
    expect(JSON.parse(meetingRow.rows[0].decisions_json || '[]')).toEqual([]);
    const followUps = await pool.query(
      `SELECT COUNT(*)::int AS n FROM meeting_follow_ups WHERE meeting_id = $1`,
      [meetingId]
    );
    expect(followUps.rows[0].n).toBe(0);

    const noteRow = await pool.query(`SELECT status FROM meeting_notes WHERE id = $1`, [
      res.body.meetingNoteId,
    ]);
    expect(noteRow.rows[0].status).toBe('proposed');
  });

  it('replays a completed command before invoking meeting intelligence again', async () => {
    const created = await createMeeting();
    const meetingId = created.body.meeting.id;
    const payload = {
      transcript: `${PREFIX} stable replay source text`,
      language: 'en',
      idempotencyKey: `${PREFIX}route-replay-before-ai`,
    };
    const generation = vi.spyOn(meetingIntelligenceService, 'generateMeetingNotes');
    generation.mockClear();

    const first = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(betaAdmin())
      .send(payload);
    const replay = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(betaAdmin())
      .send(payload);

    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.body.meetingNoteId).toBe(first.body.meetingNoteId);
    expect(replay.body.proposal).toMatchObject({
      proposalId: first.body.proposal.proposalId,
      replayed: true,
    });
    expect(generation).toHaveBeenCalledTimes(1);
    generation.mockRestore();
  });

  it('generate-notes with persist:true fails closed and performs no direct legacy write', async () => {
    const created = await createMeeting();
    const meetingId = created.body.meeting.id;

    const res = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(betaAdmin())
      .send({
        transcript: `${PREFIX} Ann: we decided to ship the beta on Tuesday. Bob: action item - Bob will write release notes.`,
        language: 'en',
        persist: true,
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNSUPPORTED_MEETING_NOTE_FIELD');

    const meetingRow = await pool.query(`SELECT decisions_json FROM meetings WHERE id = $1`, [
      meetingId,
    ]);
    const followUps = await pool.query(
      `SELECT COUNT(*)::int AS n FROM meeting_follow_ups WHERE meeting_id = $1`,
      [meetingId]
    );
    expect(JSON.parse(meetingRow.rows[0].decisions_json || '[]')).toEqual([]);
    expect(followUps.rows[0].n).toBe(0);
  });

  it('a regular member cannot approve/reject a note (403); an admin can', async () => {
    const created = await createMeeting();
    const meetingId = created.body.meeting.id;
    const genRes = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(betaAdmin())
      .send({ transcript: `${PREFIX} role gate transcript, decided A, action B` });
    const noteId = genRes.body.meetingNoteId;

    const memberAttempt = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/decision`)
      .set(member())
      .send({ action: 'approve' });
    expect(memberAttempt.status).toBe(403);

    const noteRowBefore = await pool.query(`SELECT status FROM meeting_notes WHERE id = $1`, [
      noteId,
    ]);
    expect(noteRowBefore.rows[0].status).toBe('proposed');

    const adminAttempt = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/decision`)
      .set(admin())
      .send({ action: 'approve' });
    expect(adminAttempt.status).toBe(200);
    expect(adminAttempt.body.note.status).toBe('approved');
    expect(adminAttempt.body.receipt).toBeTruthy();
  });

  it('an invalid decision action is rejected 400', async () => {
    const created = await createMeeting();
    const meetingId = created.body.meeting.id;
    const genRes = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(betaAdmin())
      .send({ transcript: `${PREFIX} invalid action transcript` });
    const noteId = genRes.body.meetingNoteId;

    const res = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/decision`)
      .set(admin())
      .send({ action: 'maybe' });
    expect(res.status).toBe(400);
  });

  it('an unknown noteId is 404', async () => {
    const created = await createMeeting();
    const meetingId = created.body.meeting.id;
    const res = await request(app)
      .post(`/api/meeting/${meetingId}/notes/meeting-note-does-not-exist/decision`)
      .set(admin())
      .send({ action: 'approve' });
    expect(res.status).toBe(404);
  });

  it('org B cannot read or decide an org A meeting note (404), and org A data is untouched', async () => {
    const created = await createMeeting(ORG_A);
    const meetingId = created.body.meeting.id;
    const genRes = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(betaAdmin(ORG_A))
      .send({ transcript: `${PREFIX} tenant isolation route transcript` });
    const noteId = genRes.body.meetingNoteId;

    const crossOrgList = await request(app)
      .get(`/api/meeting/${meetingId}/notes`)
      .set(betaAdmin(ORG_B, USER_B));
    expect(crossOrgList.status).toBe(404);

    const crossOrgDecision = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/decision`)
      .set(admin(ORG_B, USER_B))
      .send({ action: 'approve' });
    expect(crossOrgDecision.status).toBe(404);

    const noteRow = await pool.query(`SELECT status FROM meeting_notes WHERE id = $1`, [noteId]);
    expect(noteRow.rows[0].status).toBe('proposed');

    const ownOrgList = await request(app)
      .get(`/api/meeting/${meetingId}/notes`)
      .set(betaAdmin(ORG_A));
    expect(ownOrgList.status).toBe(200);
    expect(ownOrgList.body.notes.some((n: any) => n.id === noteId)).toBe(true);
  });
});
