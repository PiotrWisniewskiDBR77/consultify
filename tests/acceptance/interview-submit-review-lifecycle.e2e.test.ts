/**
 * INT-05/INT-06 acceptance: real interview router + auth + local PostgreSQL.
 * AI scoring is deliberately failed fast; submit is designed to keep the
 * deterministic required-answer gate operational when enrichment is down.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

vi.mock('../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: vi.fn().mockRejectedValue(new Error('acceptance: AI enrichment offline')) },
}));

const PREFIX = 'odbior--int0506--';
const RESPONDENT_ID = `${PREFIX}respondent`;
const RESPONDENT_EMAIL = `${PREFIX}respondent@acceptance.local`;
const FOREIGN_ORG_ID = `${PREFIX}foreign-org`;
const FOREIGN_USER_ID = `${PREFIX}foreign-user`;
const SESSION_ID = `${PREFIX}session`;
const ASSIGNMENT_ID = `${PREFIX}assignment`;
const QUESTION_ID = `${PREFIX}question`;
const TEMPLATE_ID = `${PREFIX}template`;
const ORIGINAL_ANSWER = 'Pierwsza wersja odpowiedzi przekazana do oceny.';
const REVISED_ANSWER = 'Druga, uzupełniona wersja odpowiedzi po informacji zwrotnej.';

let app: Express;
let respondentToken: string;
let managerToken: string;
let foreignToken: string;

beforeAll(async () => {
  await seed();
  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, $3) ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_ORG_ID, 'INT-05/06 foreign org', now]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'unused', $4, 'active', $5, 'INT0506', $6)
       ON CONFLICT (id) DO NOTHING`,
      [RESPONDENT_ID, SEED.ORG_ID, RESPONDENT_EMAIL, 'USER', 'Respondent', now]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'unused', 'ADMIN', 'active', 'Foreign', 'INT0506', $4)
       ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_USER_ID, FOREIGN_ORG_ID, `${PREFIX}foreign@acceptance.local`, now]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5) ON CONFLICT (id) DO NOTHING`,
      [`${PREFIX}respondent-membership`, SEED.ORG_ID, RESPONDENT_ID, 'MEMBER', now]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', $4) ON CONFLICT (id) DO NOTHING`,
      [`${PREFIX}foreign-membership`, FOREIGN_ORG_ID, FOREIGN_USER_ID, now]
    );
    await client.query(
      `INSERT INTO interview_sessions
         (id, organization_id, name, owner_id, status, total_questions, answered_questions,
          template_id, assignment_id, started_at, last_activity_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', 1, 1, $5, $6, $7, $7, $7, $7)`,
      [
        SESSION_ID,
        SEED.ORG_ID,
        `${PREFIX}lifecycle`,
        RESPONDENT_ID,
        TEMPLATE_ID,
        ASSIGNMENT_ID,
        now,
      ]
    );
    await client.query(
      `INSERT INTO interview_assignments
         (id, organization_id, assignee_user_id, template_id, template_version, status,
          session_id, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 1, 'in_progress', $5, $6, $7, $7)`,
      [ASSIGNMENT_ID, SEED.ORG_ID, RESPONDENT_ID, TEMPLATE_ID, SESSION_ID, SEED.USER_ID, now]
    );
    await client.query(
      `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, answer_text, status,
          answered_by, answered_at, sort_order, is_required, created_at, updated_at)
       VALUES ($1, $2, $3, 'strategy', 'Jakie są priorytety?', $4, 'answered',
               $5, $6, 1, 1, $6, $6)`,
      [QUESTION_ID, SESSION_ID, SEED.ORG_ID, ORIGINAL_ANSWER, RESPONDENT_ID, now]
    );
  } finally {
    await client.end();
  }

  const interviewRouter = (await import('../../server/src/routes/interview.routes.js')).default;
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  app = express();
  app.use(express.json());
  app.get('/__auth-context', verifyToken as any, (req: any, res) => res.json(req.user));
  app.use('/api/interview', interviewRouter);
  respondentToken = mintToken({
    id: RESPONDENT_ID,
    email: RESPONDENT_EMAIL,
    role: 'USER',
  });
  managerToken = mintToken({ role: 'ADMIN' });
  foreignToken = mintToken({
    id: FOREIGN_USER_ID,
    email: `${PREFIX}foreign@acceptance.local`,
    organizationId: FOREIGN_ORG_ID,
    organization_id: FOREIGN_ORG_ID,
    role: 'ADMIN',
  });
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    await client.query('DELETE FROM interview_answer_history WHERE assignment_id = $1', [
      ASSIGNMENT_ID,
    ]);
    await client.query('DELETE FROM interview_questions WHERE id = $1', [QUESTION_ID]);
    await client.query('DELETE FROM interview_assignments WHERE id = $1', [ASSIGNMENT_ID]);
    await client.query('DELETE FROM interview_sessions WHERE id = $1', [SESSION_ID]);
    await client.query('DELETE FROM organization_members WHERE id LIKE $1', [`${PREFIX}%`]);
    await client.query('DELETE FROM users WHERE id IN ($1, $2)', [RESPONDENT_ID, FOREIGN_USER_ID]);
    await client.query('DELETE FROM organizations WHERE id = $1', [FOREIGN_ORG_ID]);
  } finally {
    await client.end();
  }
}, 30_000);

describe('INT-05/INT-06 — immutable submit and manager review lifecycle', () => {
  it('persists each submission, locks review state, supports send-back/resubmit, and freezes approval', async () => {
    const authContext = await request(app)
      .get('/__auth-context')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(authContext.status).toBe(200);
    expect(authContext.body).toMatchObject({ id: SEED.USER_ID, organizationId: SEED.ORG_ID });

    const submit1 = await request(app)
      .post(`/api/interview/assignments/${ASSIGNMENT_ID}/submit`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ language: 'pl' });
    expect(submit1.status, JSON.stringify(submit1.body)).toBe(200);

    const client = pgClient();
    await client.connect();
    try {
      const firstSnapshot = await client.query(
        `SELECT answer_text, reason FROM interview_answer_history
         WHERE assignment_id = $1 ORDER BY saved_at, id`,
        [ASSIGNMENT_ID]
      );
      expect(firstSnapshot.rows).toEqual([
        expect.objectContaining({ answer_text: ORIGINAL_ANSWER, reason: 'submission' }),
      ]);
    } finally {
      await client.end();
    }

    const mutateWhileSubmitted = await request(app)
      .patch(`/api/interview/questions/${QUESTION_ID}`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answerText: 'Niedozwolona cicha zmiana', status: 'answered' });
    expect(mutateWhileSubmitted.status).toBe(409);

    const foreignMutation = await request(app)
      .patch(`/api/interview/questions/${QUESTION_ID}`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .send({ answerText: 'Atak między tenantami', status: 'answered' });
    expect(foreignMutation.status).toBe(404);

    const respondentApprove = await request(app)
      .post(`/api/interview/assignments/${ASSIGNMENT_ID}/approve`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({});
    expect(respondentApprove.status).toBe(403);

    const sendBack = await request(app)
      .post(`/api/interview/assignments/${ASSIGNMENT_ID}/send-back`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ reason: 'Dodaj konkretny przykład.' });
    expect(sendBack.status).toBe(200);
    expect(sendBack.body?.assignment?.status).toBe('in_progress');

    const revise = await request(app)
      .patch(`/api/interview/questions/${QUESTION_ID}`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answerText: REVISED_ANSWER, status: 'answered' });
    expect(revise.status).toBe(200);

    const submit2 = await request(app)
      .post(`/api/interview/assignments/${ASSIGNMENT_ID}/submit`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ language: 'pl' });
    expect(submit2.status).toBe(200);

    const approve = await request(app)
      .post(`/api/interview/assignments/${ASSIGNMENT_ID}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
    expect(approve.status).toBe(200);
    expect(approve.body?.assignment?.status).toBe('approved');
    expect(approve.body?.session?.status).toBe('completed');

    const history = await request(app)
      .get(`/api/interview/assignments/${ASSIGNMENT_ID}/answer-history`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(history.status).toBe(200);
    const versions = history.body?.byQuestion?.[QUESTION_ID] || [];
    expect(versions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ answerText: ORIGINAL_ANSWER, reason: 'submission' }),
        expect.objectContaining({ answerText: ORIGINAL_ANSWER, reason: 'send_back' }),
        expect.objectContaining({ answerText: REVISED_ANSWER, reason: 'submission' }),
      ])
    );

    const mutateAfterApproval = await request(app)
      .patch(`/api/interview/questions/${QUESTION_ID}`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answerText: 'Niedozwolona zmiana po akceptacji', status: 'answered' });
    expect(mutateAfterApproval.status).toBe(409);
  });
});
