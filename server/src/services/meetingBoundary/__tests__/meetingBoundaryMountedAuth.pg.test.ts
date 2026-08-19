/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
  throw new Error('MTG mounted-auth proof requires a disposable local PostgreSQL DATABASE_URL');
}

const JWT_SECRET = 'mtg-bvp-mounted-auth-test-secret-at-least-32-characters';
process.env.JWT_SECRET = JWT_SECRET;
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';

const prefix = `mtg-auth-${Date.now()}-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const memberA = `${prefix}-member-a`;
const participantA = `${prefix}-participant-a`;
const outsiderA = `${prefix}-outsider-a`;
const adminA = `${prefix}-admin-a`;
const adminB = `${prefix}-admin-b`;
const pool = new Pool({ connectionString: DATABASE_URL });

function token(userId: string, organizationId: string, role: string): string {
  return jwt.sign(
    { id: userId, email: `${userId}@example.test`, organizationId, role },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

const auth = (value: string) => ({ Authorization: `Bearer ${value}` });

describe('MTG-BVP-001 mounted production router with real auth and PostgreSQL', () => {
  let app: express.Express;
  let meetingId = '';
  let noteId = '';

  beforeAll(async () => {
    const now = new Date().toISOString();
    for (const [id, name] of [
      [orgA, 'Meeting Auth A'],
      [orgB, 'Meeting Auth B'],
    ]) {
      await pool.query(
        `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
         VALUES ($1,$2,'enterprise','active',1,$3)`,
        [id, `${prefix}-${name}`, now]
      );
    }
    for (const [id, org, role] of [
      [memberA, orgA, 'USER'],
      [participantA, orgA, 'USER'],
      [outsiderA, orgA, 'USER'],
      [adminA, orgA, 'ADMIN'],
      [adminB, orgB, 'ADMIN'],
    ]) {
      await pool.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, created_at)
         VALUES ($1,$2,$3,'test-not-used',$4,'active',$5)`,
        [id, org, `${id}@example.test`, role, now]
      );
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
         VALUES ($1,$2,$3,$4,'ACTIVE',$5)`,
        [`${prefix}-membership-${id}`, org, id, role, now]
      );
    }

    const routes = (await import('../../../routes/meeting.routes.js')).default;
    const aiOperatorRoutes = (await import('../../../routes/ai-operator.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/meeting', routes);
    app.use('/api/ai-operator', aiOperatorRoutes);
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(500).json({ error: String(err?.message || err), code: err?.code || null });
    });
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM artifact_handoff_receipts WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await pool.query(`DELETE FROM artifact_handoff_proposals WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await pool.query(`DELETE FROM meeting_notes WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(
      `DELETE FROM meeting_follow_ups WHERE meeting_id IN (SELECT id FROM meetings WHERE organization_id IN ($1,$2))`,
      [orgA, orgB]
    );
    await pool.query(`DELETE FROM meetings WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [
      orgA,
      orgB,
    ]);
    await pool.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [orgA, orgB]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    await pool.end();
  });

  it('rejects an anonymous caller at the mounted auth wall', async () => {
    const res = await request(app).get('/api/meeting');
    expect(res.status).toBe(401);
  });

  it('creates agenda/materials metadata and proposes durable notes through real member auth', async () => {
    const embeddedOutput = await request(app)
      .post('/api/meeting')
      .set(auth(token(memberA, orgA, 'USER')))
      .send({
        title: `${prefix}-invalid-output-meeting`,
        startAt: '2026-09-20T08:00:00.000Z',
        decisions: ['silent-loss-must-not-happen'],
      });
    expect(embeddedOutput.status).toBe(409);
    expect(embeddedOutput.body.code).toBe('MEETING_PROPOSAL_REQUIRED');

    const created = await request(app)
      .post('/api/meeting')
      .set(auth(token(memberA, orgA, 'USER')))
      .send({
        title: `${prefix}-meeting`,
        startAt: '2026-09-20T09:00:00.000Z',
        agenda: ['Review evidence'],
        preRead: ['material://source-1'],
        attendees: [`${participantA}@example.test`],
      });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    meetingId = created.body.meeting.id;

    const generated = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(auth(token(memberA, orgA, 'USER')))
      .send({
        transcript: `${prefix}: decision approve pilot. action item prepare evidence.`,
        idempotencyKey: `${prefix}-idem`,
      });
    expect(generated.status, JSON.stringify(generated.body)).toBe(201);
    expect(generated.body.proposal).toMatchObject({ state: 'pending', replayed: false });
    noteId = generated.body.meetingNoteId;

    const participantRead = await request(app)
      .get(`/api/meeting/${meetingId}/notes`)
      .set(auth(token(participantA, orgA, 'USER')));
    expect(participantRead.status, JSON.stringify(participantRead.body)).toBe(200);

    const outsiderRead = await request(app)
      .get(`/api/meeting/${meetingId}/notes`)
      .set(auth(token(outsiderA, orgA, 'USER')));
    expect(outsiderRead.status).toBe(404);

    const participantBrief = await request(app)
      .get(`/api/ai-operator/meetings/${meetingId}/brief`)
      .set(auth(token(participantA, orgA, 'USER')));
    expect(participantBrief.status, JSON.stringify(participantBrief.body)).toBe(200);

    const outsiderBrief = await request(app)
      .get(`/api/ai-operator/meetings/${meetingId}/brief`)
      .set(auth(token(outsiderA, orgA, 'USER')));
    expect(outsiderBrief.status).toBe(404);

    const replay = await request(app)
      .post(`/api/meeting/${meetingId}/generate-notes`)
      .set(auth(token(memberA, orgA, 'USER')))
      .send({
        transcript: `${prefix}: decision approve pilot. action item prepare evidence.`,
        idempotencyKey: `${prefix}-idem`,
      });
    expect(replay.status, JSON.stringify(replay.body)).toBe(201);
    expect(replay.body.meetingNoteId).toBe(noteId);
    expect(replay.body.proposal.replayed).toBe(true);
  });

  it('enforces tenant and role boundaries before human approval', async () => {
    const crossTenant = await request(app)
      .get(`/api/meeting/${meetingId}/notes`)
      .set(auth(token(adminB, orgB, 'ADMIN')));
    expect(crossTenant.status).toBe(404);

    const directDecision = await request(app)
      .post(`/api/meeting/${meetingId}/decisions`)
      .set(auth(token(memberA, orgA, 'USER')))
      .send({ decision: 'bypass' });
    expect(directDecision.status).toBe(410);
    expect(directDecision.body.code).toBe('MEETING_PROPOSAL_REQUIRED');

    const memberDecision = await request(app)
      .post(`/api/meeting/${meetingId}/notes/${noteId}/decision`)
      .set(auth(token(memberA, orgA, 'USER')))
      .send({ action: 'approve' });
    expect(memberDecision.status, JSON.stringify(memberDecision.body)).toBe(403);
  });

  it('approves once through real admin auth and cold-reads one immutable receipt', async () => {
    const adminToken = token(adminA, orgA, 'ADMIN');
    const [first, concurrent] = await Promise.all([
      request(app)
        .post(`/api/meeting/${meetingId}/notes/${noteId}/decision`)
        .set(auth(adminToken))
        .send({ action: 'approve' }),
      request(app)
        .post(`/api/meeting/${meetingId}/notes/${noteId}/decision`)
        .set(auth(adminToken))
        .send({ action: 'approve' }),
    ]);
    expect(
      [first.status, concurrent.status].every((status) => status === 200 || status === 409),
      JSON.stringify([first.body, concurrent.body])
    ).toBe(true);

    const cold = new Pool({ connectionString: DATABASE_URL, max: 1 });
    try {
      const rows = await cold.query(
        `SELECT r.receipt_id, r.organization_id, p.state
           FROM artifact_handoff_receipts r
           JOIN artifact_handoff_proposals p ON p.proposal_id = r.proposal_id
          WHERE p.organization_id = $1 AND p.producer_kind = 'meeting'
            AND p.producer_record_id = $2`,
        [orgA, meetingId]
      );
      expect(rows.rowCount).toBe(1);
      expect(rows.rows[0]).toMatchObject({ organization_id: orgA, state: 'materialized' });

      const reopened = await request(app)
        .get(`/api/meeting/${meetingId}/notes`)
        .set(auth(adminToken));
      expect(reopened.status, JSON.stringify(reopened.body)).toBe(200);
      expect(reopened.body.notes).toHaveLength(1);
      expect(reopened.body.notes[0]).toMatchObject({
        id: noteId,
        status: 'approved',
        proposalState: 'materialized',
        receiptId: rows.rows[0].receipt_id,
        targetKind: 'material',
        targetRecordId: noteId,
      });
      expect(reopened.body.notes[0].decidedBy).toBe(adminA);
      expect(reopened.body.notes[0].materializedAt).toBeTruthy();
    } finally {
      await cold.end();
    }
  });
});
