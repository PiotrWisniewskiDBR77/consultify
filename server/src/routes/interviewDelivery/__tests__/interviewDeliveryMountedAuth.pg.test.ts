/** INT-DELIVERY-OPS-001 — production router, JWT, active membership and tenant proof. */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

const mockLlmCall = vi.fn();
vi.mock('../../../services/ai/ingestionPipeline.js', () => ({
  IngestionPipeline: class { async ingestText() { return { documentId: null }; } },
}));
vi.mock('../../../services/ai/llmService.js', () => ({ llmService: { call: mockLlmCall } }));
vi.mock('../../../services/notificationService.js', () => ({
  default: { send: vi.fn().mockResolvedValue('notification') },
}));
vi.mock('../../../services/organizationContext/OrganizationContextService.js', () => ({
  default: { recordInterviewEvidence: vi.fn(), recordInterviewAnswer: vi.fn() },
}));
vi.mock('../../../services/pdfParserService.js', () => ({ default: {} }));
vi.mock('../../../services/workflow/gatePolicy.js', () => ({ evaluateGatePolicy: vi.fn() }));

describe.skipIf(!REAL_DB)('INT-DELIVERY-OPS mounted auth — real PostgreSQL', () => {
  const suffix = randomUUID().slice(0, 8);
  const id = (part: string) => `int_delivery_${part}_${suffix}`;
  const orgA = id('org_a');
  const orgB = id('org_b');
  const ownerA = id('owner_a');
  const ownerB = id('owner_b');
  const staleA = id('stale_a');
  const sessionA = id('session_a');
  const questionA = id('question_a');
  const assignmentA = id('assignment_a');
  let pool: Pool;
  let app: Express;
  let tokenA = '';
  let tokenB = '';
  let staleToken = '';

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    for (const [organizationId, name] of [[orgA, 'Interview A'], [orgB, 'Interview B']]) {
      await pool.query(`INSERT INTO organizations (id,name) VALUES ($1,$2)`, [organizationId, name]);
    }
    for (const [userId, organizationId, status] of [
      [ownerA, orgA, 'ACTIVE'], [ownerB, orgB, 'ACTIVE'], [staleA, orgA, 'INACTIVE'],
    ]) {
      await pool.query(
        `INSERT INTO users (id,organization_id,email,password,role,status) VALUES ($1,$2,$3,'unused','OWNER','active')`,
        [userId, organizationId, `${userId}@example.test`]
      );
      await pool.query(
        `INSERT INTO organization_members (id,organization_id,user_id,role,status) VALUES ($1,$2,$3,'OWNER',$4)`,
        [id(`membership_${userId}`), organizationId, userId, status]
      );
    }
    await pool.query(
      `INSERT INTO interview_sessions (id,organization_id,owner_id,status) VALUES ($1,$2,$3,'in_progress')`,
      [sessionA, orgA, ownerA]
    );
    await pool.query(
      `INSERT INTO interview_questions
       (id,session_id,organization_id,category,question_text,answer_text,status,is_required)
       VALUES ($1,$2,$3,'strategy','Mounted question','initial','answered',0)`,
      [questionA, sessionA, orgA]
    );
    await pool.query(
      `INSERT INTO interview_assignments
         (id, organization_id, assignee_user_id, template_id, session_id)
       VALUES ($1,$2,$3,'mounted-evaluation',$4)`,
      [assignmentA, orgA, ownerA, sessionA]
    );

    mockLlmCall.mockResolvedValue({
      object: { questionEvaluations: [], recommendations: [] }, usage: {},
    });
    const { default: config } = await import('../../../config/Config.js');
    const sign = (userId: string, organizationId: string) =>
      jwt.sign({ id: userId, organizationId, role: 'OWNER', email: `${userId}@example.test` }, config.JWT_SECRET, { expiresIn: '10m' });
    tokenA = sign(ownerA, orgA);
    tokenB = sign(ownerB, orgB);
    staleToken = sign(staleA, orgA);

    const { default: interviewRouter } = await import('../../interview.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/interview', interviewRouter);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM interview_assignments WHERE id=$1`, [assignmentA]);
    await pool.query(`DELETE FROM interview_questions WHERE id=$1`, [questionA]);
    await pool.query(`DELETE FROM interview_sessions WHERE id=$1`, [sessionA]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[ownerA, ownerB, staleA]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it('requires authentication on the mounted mutation route', async () => {
    const response = await request(app).patch(`/api/interview/questions/${questionA}`).send({});
    expect(response.status).toBe(401);
  });

  it('active owner updates with CAS and can evaluate through the mounted router', async () => {
    const current = await pool.query(`SELECT updated_at FROM interview_questions WHERE id=$1`, [questionA]);
    const expectedUpdatedAt = new Date(current.rows[0].updated_at).toISOString();
    const updated = await request(app)
      .patch(`/api/interview/questions/${questionA}`)
      .set(bearer(tokenA))
      .send({ answerText: 'mounted winner', expectedUpdatedAt });
    expect(updated.status).toBe(200);
    const evaluated = await request(app)
      .post(`/api/interview/sessions/${sessionA}/evaluate-answers`)
      .set(bearer(tokenA))
      .send({ language: 'en' });
    expect(evaluated.status).toBe(200);

    const cold = new Pool({ connectionString: DATABASE_URL });
    try {
      const persisted = await cold.query(
        `SELECT ai_review_snapshot_json, ai_reviewed_at FROM interview_assignments WHERE id=$1`,
        [assignmentA]
      );
      expect(persisted.rows[0].ai_reviewed_at).toBeTruthy();
      const snapshot =
        typeof persisted.rows[0].ai_review_snapshot_json === 'string'
          ? JSON.parse(persisted.rows[0].ai_review_snapshot_json)
          : persisted.rows[0].ai_review_snapshot_json;
      expect(snapshot).toMatchObject({ rubricVersion: 'oxford-v1' });
      const answer = await cold.query(`SELECT answer_text FROM interview_questions WHERE id=$1`, [
        questionA,
      ]);
      expect(answer.rows[0].answer_text).toBe('mounted winner');
    } finally {
      await cold.end();
    }
  });

  it('foreign tenant cannot mutate the question', async () => {
    const current = await pool.query(`SELECT updated_at FROM interview_questions WHERE id=$1`, [questionA]);
    const response = await request(app)
      .patch(`/api/interview/questions/${questionA}`)
      .set(bearer(tokenB))
      .send({ answerText: 'foreign', expectedUpdatedAt: new Date(current.rows[0].updated_at).toISOString() });
    expect(response.status).toBe(404);
  });

  it('foreign tenant cannot evaluate the session', async () => {
    const response = await request(app)
      .post(`/api/interview/sessions/${sessionA}/evaluate-answers`)
      .set(bearer(tokenB))
      .send({ language: 'en' });
    expect(response.status).toBe(404);
  });

  it('stale JWT with inactive membership is denied before the controller', async () => {
    const response = await request(app)
      .post(`/api/interview/sessions/${sessionA}/evaluate-answers`)
      .set(bearer(staleToken))
      .send({ language: 'en' });
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
  });

  it('inactive membership cannot mutate even with a valid signed JWT', async () => {
    const current = await pool.query(`SELECT updated_at FROM interview_questions WHERE id=$1`, [questionA]);
    const response = await request(app)
      .patch(`/api/interview/questions/${questionA}`)
      .set(bearer(staleToken))
      .send({ answerText: 'revoked', expectedUpdatedAt: new Date(current.rows[0].updated_at).toISOString() });
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
  });
});
