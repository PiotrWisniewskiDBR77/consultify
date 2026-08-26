/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const organizationId = req.headers['x-test-org-id'];
    const id = req.headers['x-test-user-id'];
    if (!organizationId || !id) return res.status(401).json({ error: 'No token provided' });
    req.userRole = req.headers['x-test-role'] || 'ADMIN';
    req.user = { id, organizationId, role: req.userRole, email: `${id}@example.test` };
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error('disposable local PostgreSQL required');
const prefix = `day24-f-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const adminA = randomUUID();
const memberA = randomUUID();
const adminB = randomUUID();
const deniedProject = randomUUID();
const pool = new Pool({ connectionString: url });
const headers = (org = orgA, user = adminA, role = 'ADMIN') => ({
  'x-test-org-id': org,
  'x-test-user-id': user,
  'x-test-role': role,
});

describe('Meetings day24 F — approved note action item to My Work task', () => {
  let app: express.Express;
  let meetingId = '';
  let noteId = '';
  let proposedNoteId = '';
  let rejectedNoteId = '';
  let firstApprovalReceiptId = '';

  beforeAll(async () => {
    const now = new Date().toISOString();
    for (const org of [orgA, orgB]) {
      await pool.query(
        `INSERT INTO organizations (id,name,plan,status,is_active,created_at) VALUES ($1,$2,'enterprise','active',1,$3)`,
        [org, org, now]
      );
    }
    for (const [id, org, role] of [
      [adminA, orgA, 'ADMIN'],
      [memberA, orgA, 'USER'],
      [adminB, orgB, 'ADMIN'],
    ]) {
      await pool.query(
        `INSERT INTO users (id,organization_id,email,password,role,status,created_at) VALUES ($1,$2,$3,'unused',$4,'active',$5)`,
        [id, org, `${id}@example.test`, role, now]
      );
    }
    await pool.query(
      `INSERT INTO projects (id,organization_id,name,owner_id) VALUES ($1,$2,$3,$4)`,
      [deniedProject, orgA, `${prefix}-denied-project`, memberA]
    );
    const routes = (await import('../../../server/src/routes/meeting.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/meeting', routes);
    app.use(errorHandlerMiddleware);
    const created = await request(app)
      .post('/api/meeting')
      .set(headers())
      .send({ title: 'Action funnel', startAt: '2026-11-01T09:00:00.000Z' });
    meetingId = created.body.meeting.id;
    const generated = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(headers())
      .send({ transcript: 'Action item: prepare the evidence pack by Friday.' });
    noteId = generated.body.meetingNoteId;
    expect(generated.body.note.actionItems.length).toBeGreaterThan(0);
    const approved = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/decision`)
      .set(headers())
      .send({ action: 'approve' });
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    firstApprovalReceiptId = approved.body.receipt?.receiptId || '';
    expect(firstApprovalReceiptId).toBeTruthy();
    const proposed = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(headers())
      .send({
        transcript: 'Action item: leave this proposal pending.',
        idempotencyKey: `${prefix}-pending`,
      });
    proposedNoteId = proposed.body.meetingNoteId;
    const rejected = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(headers())
      .send({
        transcript: 'Action item: reject this proposal.',
        idempotencyKey: `${prefix}-rejected`,
      });
    rejectedNoteId = rejected.body.meetingNoteId;
    const rejection = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${rejectedNoteId}/decision`)
      .set(headers())
      .send({ action: 'reject', reason: 'Not accepted' });
    expect(rejection.status).toBe(200);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM tasks WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM meeting_note_materializations WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await pool.query(`DELETE FROM artifact_handoff_receipts WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await pool.query(`DELETE FROM artifact_handoff_proposals WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await pool.query(`DELETE FROM meeting_notes WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM meetings WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM projects WHERE id=$1`, [deniedProject]);
    await pool.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    await pool.end();
  });

  it('creates one task and independently reads its lineage back', async () => {
    const result = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/action-items/0/task`)
      .set(headers());
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body.replayed).toBe(false);
    const cold = await pool.query(
      `SELECT id,source_type,source_id FROM tasks WHERE organization_id=$1 AND idempotency_key=$2`,
      [orgA, `meeting-note-action:${noteId}:0`]
    );
    expect(cold.rows).toHaveLength(1);
    expect(cold.rows[0].source_type).toBe('meeting_note_action_item');
    expect(cold.rows[0].source_id).toBe(`${meetingId}:${noteId}:0`);
  });

  it('replays without a second task row', async () => {
    const before = await pool.query(
      `SELECT count(*)::int AS n FROM tasks WHERE organization_id=$1`,
      [orgA]
    );
    const result = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/action-items/0/task`)
      .set(headers());
    expect(result.status).toBe(200);
    expect(result.body.replayed).toBe(true);
    const after = await pool.query(
      `SELECT count(*)::int AS n FROM tasks WHERE organization_id=$1`,
      [orgA]
    );
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('rejects pending notes and missing indexes without writes', async () => {
    const before = await pool.query(
      `SELECT count(*)::int AS n FROM tasks WHERE organization_id=$1`,
      [orgA]
    );
    const pending = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${proposedNoteId}/action-items/0/task`)
      .set(headers());
    const missing = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/action-items/99/task`)
      .set(headers());
    expect(pending.status).toBe(409);
    expect(pending.body.code).toBe('NOTE_NOT_APPROVED');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('ACTION_ITEM_NOT_FOUND');
    const after = await pool.query(
      `SELECT count(*)::int AS n FROM tasks WHERE organization_id=$1`,
      [orgA]
    );
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('rejects a rejected note without writing a task', async () => {
    const before = await pool.query(
      `SELECT count(*)::int AS n FROM tasks WHERE organization_id=$1`,
      [orgA]
    );
    const response = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${rejectedNoteId}/action-items/0/task`)
      .set(headers());
    const after = await pool.query(
      `SELECT count(*)::int AS n FROM tasks WHERE organization_id=$1`,
      [orgA]
    );
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('NOTE_NOT_APPROVED');
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('rejects an unprivileged role and a foreign tenant without writes', async () => {
    const member = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/action-items/0/task`)
      .set(headers(orgA, memberA, 'USER'));
    const foreign = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/action-items/0/task`)
      .set(headers(orgB, adminB, 'ADMIN'));
    expect(member.status).toBe(403);
    expect(foreign.status).toBe(404);
    expect(
      (await pool.query(`SELECT count(*)::int AS n FROM tasks WHERE organization_id=$1`, [orgB]))
        .rows[0].n
    ).toBe(0);
  });

  it('maps project authorization failure through the production error handler', async () => {
    await pool.query(`DELETE FROM tasks WHERE organization_id=$1 AND idempotency_key=$2`, [
      orgA,
      `meeting-note-action:${noteId}:0`,
    ]);
    await pool.query(`UPDATE meetings SET project_id=$1 WHERE id=$2`, [deniedProject, meetingId]);
    const before = await pool.query(
      `SELECT count(*)::int AS n FROM tasks WHERE organization_id=$1`,
      [orgA]
    );
    const response = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/action-items/0/task`)
      .set(headers());
    await pool.query(`UPDATE meetings SET project_id=NULL WHERE id=$1`, [meetingId]);
    const after = await pool.query(
      `SELECT count(*)::int AS n FROM tasks WHERE organization_id=$1`,
      [orgA]
    );
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('AUTHORIZATION_ERROR');
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('collapses two concurrent replays to the same single row', async () => {
    await pool.query(`DELETE FROM tasks WHERE organization_id=$1 AND idempotency_key=$2`, [
      orgA,
      `meeting-note-action:${noteId}:0`,
    ]);
    const [a, b] = await Promise.all([
      request(app)
        .post(`/api/meeting/${meetingId}/notes/${noteId}/action-items/0/task`)
        .set(headers()),
      request(app)
        .post(`/api/meeting/${meetingId}/notes/${noteId}/action-items/0/task`)
        .set(headers()),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a.body.replayed, b.body.replayed].sort()).toEqual([false, true]);
    const cold = await pool.query(
      `SELECT count(*)::int AS n FROM tasks WHERE organization_id=$1 AND idempotency_key=$2`,
      [orgA, `meeting-note-action:${noteId}:0`]
    );
    expect(cold.rows[0].n).toBe(1);
  });

  // FIX-2 (day28 duty fix-round, P1-1): decision is the funnel's OTHER entry
  // point (POST /:id/notes/:noteId/decision), and it has its own idempotent
  // replay path (meetingBoundaryService.ts decideMeetingNote, comment block
  // above the `try { await approveProposal(...) }` call). It also exercises
  // a read path the action-items funnel above never reaches: on a REPLAY of
  // an already-materialized note, decideMeetingNote's own getMeetingNote
  // call (meetingBoundaryService.ts:796-802) now finds a real
  // material_artifact_id and, because userId is set, resolves it through
  // getArtifactForUser(organizationId, artifactId, userId, roleKey) — on the
  // FIRST approve that branch is a no-op (nothing materialized yet), so this
  // is the only test in the suite that exercises it for real. This proves
  // the caller who just approved+materialized a note can safely replay their
  // own approve call without that access check tripping.
  it('replays an approve decision without a second materialization', async () => {
    const beforeReceipts = await pool.query(
      `SELECT count(*)::int AS n FROM artifact_handoff_receipts WHERE organization_id=$1 AND proposal_id=(SELECT proposal_id FROM meeting_notes WHERE id=$2)`,
      [orgA, noteId]
    );
    const replay = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/decision`)
      .set(headers())
      .send({ action: 'approve' });
    expect(replay.status, JSON.stringify(replay.body)).toBe(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.receipt?.receiptId).toBe(firstApprovalReceiptId);
    const afterReceipts = await pool.query(
      `SELECT count(*)::int AS n FROM artifact_handoff_receipts WHERE organization_id=$1 AND proposal_id=(SELECT proposal_id FROM meeting_notes WHERE id=$2)`,
      [orgA, noteId]
    );
    expect(afterReceipts.rows[0].n).toBe(beforeReceipts.rows[0].n);
    expect(afterReceipts.rows[0].n).toBe(1);
  });
});
