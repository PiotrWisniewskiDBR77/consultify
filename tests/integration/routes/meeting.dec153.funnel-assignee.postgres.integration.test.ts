/** @vitest-environment node */
/**
 * DEC-153 (odbiór dyżuru 28, DEC-147/153, delegacja właściciela,
 * 2026-08-28) — a task created via the meeting-note-action-item funnel
 * (`POST /:id/notes/:noteId/action-items/:index/task`,
 * `meetingNoteTaskFunnelService.ts`) must carry a non-null `assignee_id`.
 * Before this fix it was always NULL, and every My Work read filters
 * `assignee_id = ?` (`my-work.routes.ts`), so the task was a ghost: it
 * existed in `tasks` but was invisible to literally everyone.
 *
 * Rule: assignee = the action item's owner; if none, the note's author.
 *
 * `MeetingNoteActionItem.owner` (meetingBoundaryService.ts) is free text the
 * AI/heuristic extractor lifts from the transcript — there is no structured
 * `ownerUserId` field on the action item (unlike `meeting_follow_ups`, which
 * does carry one). Resolving that text to a real user would require
 * heuristic name-matching, explicitly out of scope (a wrong match silently
 * mis-assigns a task, worse than today's bug). So the rule always resolves
 * to its fallback branch in the current data model: the note's author. Test
 * (a) below proves that holds even when the owner text IS populated (it is
 * simply not usable), and test (b) proves the no-owner case resolves the
 * same way — both end-to-end through the real My Work route, not just an
 * INSERT.
 */
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
  requireRole:
    (..._roles: any[]) =>
    (_req: any, _res: any, next: () => void) =>
      next(),
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error('disposable local PostgreSQL required');
const prefix = `dec153-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const adminA = randomUUID(); // converts notes into tasks (the "actor")
const memberA = randomUUID(); // authors the note (expected assignee) — a
// DIFFERENT org-A admin than adminA. Both must be ADMIN-tier: the whole
// meeting module sits behind closedBetaModuleGate (betaGate.middleware.ts),
// which 403s any non-OWNER/ADMIN/ADMINISTRATOR/SUPERADMIN role outright, so
// a plain USER/MEMBER cannot reach ANY meeting route in this environment —
// the note-author-vs-actor distinction has to be two distinct admins, not
// an admin-vs-member split.
const adminB = randomUUID(); // foreign org — tenant-corruption control
const pool = new Pool({ connectionString: url });
const headers = (org = orgA, user = adminA, role = 'ADMIN') => ({
  'x-test-org-id': org,
  'x-test-user-id': user,
  'x-test-role': role,
});

describe('DEC-153 — funnel task assignee (meeting-note action item -> task)', () => {
  let app: express.Express;
  let meetingId = '';
  let noteId = '';

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
      [memberA, orgA, 'ADMIN'],
      [adminB, orgB, 'ADMIN'],
    ]) {
      await pool.query(
        `INSERT INTO users (id,organization_id,email,password,role,status,created_at) VALUES ($1,$2,$3,'unused',$4,'active',$5)`,
        [id, org, `${id}@example.test`, role, now]
      );
    }

    const meetingRoutes = (await import('../../../server/src/routes/meeting.routes.js')).default;
    const myWorkRoutes = (await import('../../../server/src/routes/my-work.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/meeting', meetingRoutes);
    app.use('/api/my-work', myWorkRoutes);
    app.use(errorHandlerMiddleware);

    // adminA schedules the meeting (as its creator + admin); memberA is
    // listed as an attendee too, which is not strictly required now that
    // memberA is also ADMIN-tier (isMeetingAdmin() alone would grant
    // access), but keeps this realistic — a genuine second participant.
    const created = await request(app)
      .post('/api/meeting')
      .set(headers())
      .send({
        title: 'DEC-153 funnel assignee',
        startAt: '2026-12-01T09:00:00.000Z',
        attendees: [memberA],
      });
    meetingId = created.body.meeting.id;

    // memberA authors the note -> note.createdBy = memberA.
    const generated = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(headers(orgA, memberA, 'ADMIN'))
      .send({ transcript: 'Action item: prepare the evidence pack by Friday.' });
    noteId = generated.body.meetingNoteId;
    expect(generated.body.note.actionItems.length).toBeGreaterThan(0);

    // Overwrite the action items with two entries: index 0 carries a
    // free-text owner name (unresolvable to a real user — see file header);
    // index 1 carries none. Both must resolve to the SAME assignee (the
    // note's author, memberA).
    await pool.query(`UPDATE meeting_notes SET action_items_json = $1 WHERE id = $2`, [
      JSON.stringify([
        { task: 'Prepare the evidence pack', owner: 'Kasia Nowak', priority: 'medium' },
        { task: 'Circulate the agenda', owner: '', priority: 'low' },
      ]),
      noteId,
    ]);
    // adminA (meeting admin, NOT the note's author) approves the note —
    // POST .../decision requires the meeting-admin role gate.
    const approved = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/decision`)
      .set(headers())
      .send({ action: 'approve' });
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
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
    await pool.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    await pool.end();
  });

  it('(a) action item WITH an owner label still assigns to the NOTE AUTHOR (not the converting actor) and is visible to them via GET /api/my-work/tasks', async () => {
    const result = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/action-items/0/task`)
      .set(headers()); // actor = adminA
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    const taskId = result.body.task.id;

    const row = await pool.query(`SELECT assignee_id FROM tasks WHERE id = $1`, [taskId]);
    expect(row.rows[0].assignee_id).toBe(memberA);
    expect(row.rows[0].assignee_id).not.toBe(adminA);

    // End-to-end proof through the REAL My Work read route, not just a row read.
    const asAuthor = await request(app)
      .get('/api/my-work/tasks')
      .set(headers(orgA, memberA, 'ADMIN'));
    expect(asAuthor.status, JSON.stringify(asAuthor.body)).toBe(200);
    expect(asAuthor.body.some((t: any) => t.id === taskId)).toBe(true);

    // The actor who clicked "create task" is NOT the assignee and must not
    // see it in their own My Work.
    const asActor = await request(app).get('/api/my-work/tasks').set(headers(orgA, adminA, 'ADMIN'));
    expect(asActor.status).toBe(200);
    expect(asActor.body.some((t: any) => t.id === taskId)).toBe(false);
  });

  it('(b) action item WITHOUT an owner label falls back to the note author the same way, and is visible in My Work', async () => {
    const result = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/action-items/1/task`)
      .set(headers()); // actor = adminA
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    const taskId = result.body.task.id;

    const row = await pool.query(`SELECT assignee_id FROM tasks WHERE id = $1`, [taskId]);
    expect(row.rows[0].assignee_id).toBe(memberA);

    const asAuthor = await request(app)
      .get('/api/my-work/tasks')
      .set(headers(orgA, memberA, 'ADMIN'));
    expect(asAuthor.status, JSON.stringify(asAuthor.body)).toBe(200);
    expect(asAuthor.body.some((t: any) => t.id === taskId)).toBe(true);
  });

  it('(c) tenant guard: a note whose stored author no longer belongs to this org never leaks an assignment to that foreign user', async () => {
    // Simulate historical drift / data corruption: created_by points at a
    // user from a DIFFERENT organization than the note itself (e.g. the
    // user was later moved/removed). Must never result in assigning a task
    // to someone outside the task's own organization.
    const secondMeeting = await request(app)
      .post('/api/meeting')
      .set(headers())
      .send({
        title: 'DEC-153 tenant guard',
        startAt: '2026-12-02T09:00:00.000Z',
        attendees: [memberA],
      });
    const meetingId2 = secondMeeting.body.meeting.id;
    const generated = await request(app)
      .post(`/api/meeting/${meetingId2}/generate-notes`)
      .set(headers(orgA, memberA, 'ADMIN'))
      .send({ transcript: 'Action item: tenant guard control.' });
    const noteId2 = generated.body.meetingNoteId;

    await pool.query(`UPDATE meeting_notes SET created_by = $1 WHERE id = $2`, [adminB, noteId2]);

    const approved = await request(app)
      .post(`/api/meeting/${meetingId2}/notes/${noteId2}/decision`)
      .set(headers())
      .send({ action: 'approve' });
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);

    const result = await request(app)
      .post(`/api/meeting/${meetingId2}/notes/${noteId2}/action-items/0/task`)
      .set(headers()); // actor = adminA
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    const taskId = result.body.task.id;

    const row = await pool.query(`SELECT assignee_id, organization_id FROM tasks WHERE id = $1`, [
      taskId,
    ]);
    expect(row.rows[0].organization_id).toBe(orgA);
    expect(row.rows[0].assignee_id).not.toBe(adminB); // no cross-org leak
    expect(row.rows[0].assignee_id).toBe(adminA); // falls back to the actor

    // No visibility leak into the foreign org's own My Work either.
    const asForeign = await request(app)
      .get('/api/my-work/tasks')
      .set(headers(orgB, adminB, 'ADMIN'));
    expect(asForeign.status).toBe(200);
    expect(asForeign.body.some((t: any) => t.id === taskId)).toBe(false);
  });
});
