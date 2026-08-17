/** INT-BVP-001 — invite expiry/revoke/public wall on real PostgreSQL. */
import { randomUUID } from 'node:crypto';

import express from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = String(process.env.DATABASE_URL || '');
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
if (REAL_PG) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_PG)('interview invite governance (real PostgreSQL)', () => {
  let pool: Pool;
  let service: typeof import('../../../services/interviewEnterpriseService.js').interviewEnterpriseService;
  let app: express.Express;

  const tag = randomUUID();
  const orgA = `int-invite-org-a-${tag}`;
  const orgB = `int-invite-org-b-${tag}`;
  const owner = `int-invite-owner-${tag}`;
  const sessionId = `int-invite-session-${tag}`;
  const otherSessionId = `int-invite-other-session-${tag}`;
  const questionA = `int-invite-question-a-${tag}`;
  const questionB = `int-invite-question-b-${tag}`;
  const foreignQuestion = `int-invite-question-foreign-${tag}`;
  const distributionIds: string[] = [];

  beforeAll(async () => {
    const { Pool: PgPool } = await import('pg');
    pool = new PgPool({ connectionString: DATABASE_URL });
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1,'A'),($2,'B')`, [orgA, orgB]);
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role) VALUES ($1,$2,$3,'OWNER')`,
      [owner, orgA, `${owner}@example.test`]
    );
    await pool.query(
      `INSERT INTO interview_sessions (id, organization_id, owner_id, status, is_anonymous)
       VALUES ($1,$3,$4,'in_progress',true),($2,$3,$4,'in_progress',true)`,
      [sessionId, otherSessionId, orgA, owner]
    );
    await pool.query(
      `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, answer_text,
          context_note, status, is_required, sort_order)
       VALUES
         ($1,$3,$4,'strategy','Second question',NULL,NULL,'pending',0,2),
         ($2,$3,$4,'strategy','First question','existing','context','answered',1,1)`,
      [questionB, questionA, sessionId, orgA]
    );
    await pool.query(
      `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, status, is_required, sort_order)
       VALUES ($1,$2,$3,'strategy','Foreign session question','pending',0,1)`,
      [foreignQuestion, otherSessionId, orgA]
    );
    ({ interviewEnterpriseService: service } =
      await import('../../../services/interviewEnterpriseService.js'));
    const { default: router } = await import('../../../routes/interview-enterprise.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/interview-v4', router);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM interview_distributions WHERE id = ANY($1)`, [distributionIds]);
    await pool.query(`DELETE FROM interview_questions WHERE id IN ($1,$2,$3)`, [
      questionA,
      questionB,
      foreignQuestion,
    ]);
    await pool.query(`DELETE FROM interview_sessions WHERE id IN ($1,$2)`, [
      sessionId,
      otherSessionId,
    ]);
    await pool.query(`DELETE FROM users WHERE id=$1`, [owner]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgA, orgB]);
    await pool.end();
  });

  async function invite(expiresAt?: string) {
    const created = await service.createDistribution(orgA, sessionId, {
      channel: 'email',
      recipientEmail: 'private.respondent@example.test',
      recipientName: 'Private Respondent',
      anonymityMode: 'anonymous',
      expiresAt,
    });
    distributionIds.push(created.id);
    return created;
  }

  it('creates a durable invite and the unauthenticated resolver exposes no recipient or tenant identity', async () => {
    const created = await invite();
    expect(new Date(created.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const res = await request(app).get(
      `/api/interview-v4/public/distributions/${created.publicToken}`
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      distributionId: created.id,
      sessionId,
      status: 'opened',
      anonymityMode: 'anonymous',
      questions: [
        {
          id: questionA,
          questionText: 'First question',
          answerText: 'existing',
          contextNote: 'context',
          isRequired: true,
        },
        {
          id: questionB,
          questionText: 'Second question',
          answerText: null,
          contextNote: null,
          isRequired: false,
        },
      ],
    });
    expect(res.body.questions.every((question: { updatedAt?: string }) => question.updatedAt)).toBe(
      true
    );
    expect(JSON.stringify(res.body)).not.toContain('Foreign session question');
    expect(JSON.stringify(res.body)).not.toContain('private.respondent');
    expect(JSON.stringify(res.body)).not.toContain(orgA);
    expect(JSON.stringify(res.body)).not.toContain(created.publicToken);
  });

  it('fails closed after expiry and persists terminal expired state for cold readback', async () => {
    const created = await invite();
    await pool.query(
      `UPDATE interview_distributions SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1`,
      [created.id]
    );
    const res = await request(app).get(
      `/api/interview-v4/public/distributions/${created.publicToken}`
    );
    expect(res.status).toBe(410);
    expect(res.body).toEqual({ error: 'INVITE_EXPIRED' });

    const { Pool: PgPool } = await import('pg');
    const cold = new PgPool({ connectionString: DATABASE_URL, max: 1 });
    try {
      const row = await cold.query(`SELECT status FROM interview_distributions WHERE id=$1`, [
        created.id,
      ]);
      expect(row.rows[0].status).toBe('expired');
    } finally {
      await cold.end();
    }
  });

  it('revocation is tenant-scoped, durable, idempotently denied and immediately closes token access', async () => {
    const created = await invite();
    expect(await service.revokeDistribution(orgB, created.id, 'foreign')).toBe(false);
    expect(await service.revokeDistribution(orgA, created.id, owner)).toBe(true);
    expect(await service.revokeDistribution(orgA, created.id, owner)).toBe(false);

    const res = await request(app).get(
      `/api/interview-v4/public/distributions/${created.publicToken}`
    );
    expect(res.status).toBe(410);
    expect(res.body).toEqual({ error: 'INVITE_REVOKED' });
    const row = await pool.query(
      `SELECT status, revoked_by, revoked_at FROM interview_distributions WHERE id=$1`,
      [created.id]
    );
    expect(row.rows[0]).toMatchObject({ status: 'revoked', revoked_by: owner });
    expect(row.rows[0].revoked_at).toBeTruthy();
  });

  it('resolve/revoke concurrency leaves a revoked terminal row and every later read denied', async () => {
    const created = await invite();
    await Promise.allSettled([
      service.resolveActiveDistributionByToken(created.publicToken),
      service.revokeDistribution(orgA, created.id, owner),
    ]);
    const row = await pool.query(
      `SELECT status, revoked_at FROM interview_distributions WHERE id=$1`,
      [created.id]
    );
    expect(row.rows[0].status).toBe('revoked');
    expect(row.rows[0].revoked_at).toBeTruthy();
    await expect(
      service.resolveActiveDistributionByToken(created.publicToken)
    ).rejects.toMatchObject({
      code: 'INVITE_REVOKED',
      statusCode: 410,
    });
  });

  it('rejects cross-tenant/nonexistent session invites and malformed public tokens', async () => {
    await expect(
      service.createDistribution(orgB, sessionId, { channel: 'link' })
    ).rejects.toMatchObject({ code: 'INVITE_NOT_FOUND', statusCode: 404 });
    const res = await request(app).get('/api/interview-v4/public/distributions/not-a-token');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'INVITE_NOT_FOUND' });
  });
});
