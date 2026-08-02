import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

vi.mock('../../server/src/services/ai/llmService.js', () => ({
  llmService: {
    resolveModelConfig: vi.fn().mockResolvedValue({
      id: 'int04-acceptance-model',
      provider: 'acceptance-provider',
    }),
    call: vi.fn().mockResolvedValue({
      object: {
        answerText: 'Teresa draft based on organization context.',
        tags: ['priority'],
        confidenceScore: 4,
      },
    }),
  },
}));

const PREFIX = 'odbior--int04--';
const FOREIGN_ORG_ID = `${PREFIX}foreign-org`;
const FOREIGN_USER_ID = `${PREFIX}foreign-user`;
const SESSION_ID = `${PREFIX}session`;
const QUESTION_ID = `${PREFIX}question`;
const FINAL_ANSWER = 'Human-reviewed and adjusted Teresa draft.';

let app: Express;
let respondentToken: string;
let foreignToken: string;

beforeAll(async () => {
  await seed();
  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();
    await client.query('DELETE FROM interview_questions WHERE id = $1', [QUESTION_ID]);
    await client.query('DELETE FROM interview_sessions WHERE id = $1', [SESSION_ID]);
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, 'INT-04 foreign org', 'enterprise', 'active', 1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_ORG_ID, now]
    );
    for (const [id, orgId, email, role] of [
      [FOREIGN_USER_ID, FOREIGN_ORG_ID, `${PREFIX}foreign@acceptance.local`, 'ADMIN'],
    ]) {
      await client.query(
        `INSERT INTO users
           (id, organization_id, email, password, role, status, first_name, last_name, created_at)
         VALUES ($1, $2, $3, 'unused', $4, 'active', 'INT04', 'Acceptance', $5)
         ON CONFLICT (id) DO NOTHING`,
        [id, orgId, email, role, now]
      );
    }
    for (const [id, orgId, userId, role] of [
      [`${PREFIX}foreign-membership`, FOREIGN_ORG_ID, FOREIGN_USER_ID, 'OWNER'],
    ]) {
      await client.query(
        `INSERT INTO organization_members
           (id, organization_id, user_id, role, status, created_at)
         VALUES ($1, $2, $3, $4, 'ACTIVE', $5) ON CONFLICT (id) DO NOTHING`,
        [id, orgId, userId, role, now]
      );
    }
    await client.query(
      `INSERT INTO interview_sessions
         (id, organization_id, name, owner_id, status, total_questions, answered_questions,
          started_at, last_activity_at, created_at, updated_at)
       VALUES ($1, $2, 'INT-04 audit', $3, 'active', 1, 0, $4, $4, $4, $4)`,
      [SESSION_ID, SEED.ORG_ID, SEED.USER_ID, now]
    );
    await client.query(
      `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, status, sort_order,
          is_required, created_at, updated_at)
       VALUES ($1, $2, $3, 'strategy', 'What should change?', 'not_started', 1, 1, $4, $4)`,
      [QUESTION_ID, SESSION_ID, SEED.ORG_ID, now]
    );
  } finally {
    await client.end();
  }

  const router = (await import('../../server/src/routes/interview.routes.js')).default;
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  app = express();
  app.use(express.json());
  app.get('/__auth-context', verifyToken as any, (req: any, res) => res.json(req.user));
  app.use('/api/interview', router);
  app.use(
    (error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: error.message });
    }
  );
  respondentToken = mintToken();
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
    const auditTable = await client.query(
      `SELECT to_regclass('public.interview_ai_suggestion_audit') AS name`
    );
    if (auditTable.rows[0]?.name) {
      await client.query('DELETE FROM interview_ai_suggestion_audit WHERE question_id = $1', [
        QUESTION_ID,
      ]);
    }
    await client.query('DELETE FROM interview_questions WHERE id = $1', [QUESTION_ID]);
    await client.query('DELETE FROM interview_sessions WHERE id = $1', [SESSION_ID]);
    await client.query('DELETE FROM organization_members WHERE id LIKE $1', [`${PREFIX}%`]);
    await client.query('DELETE FROM users WHERE id = $1', [FOREIGN_USER_ID]);
    await client.query('DELETE FROM organizations WHERE id = $1', [FOREIGN_ORG_ID]);
  } finally {
    await client.end();
  }
}, 30_000);

describe('INT-04 — durable Teresa suggestion provenance', () => {
  it('audits generation, atomically accepts an edited draft, rejects another, and isolates tenants', async () => {
    const authContext = await request(app)
      .get('/__auth-context')
      .set('Authorization', `Bearer ${respondentToken}`);
    expect(authContext.status, JSON.stringify(authContext.body)).toBe(200);
    expect(authContext.body).toMatchObject({ id: SEED.USER_ID, organizationId: SEED.ORG_ID });
    const queryHelpers = await import('../../server/src/utils/queryHelpers.js');
    const visibleQuestion = await queryHelpers.queryOne(
      `SELECT id FROM interview_questions WHERE id = ? AND organization_id = ?`,
      [QUESTION_ID, SEED.ORG_ID]
    );
    expect(visibleQuestion).toMatchObject({ id: QUESTION_ID });

    const generated = await request(app)
      .post(`/api/interview/questions/${QUESTION_ID}/ai-suggest`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({});
    expect(generated.status, JSON.stringify(generated.body)).toBe(200);
    expect(generated.body).toMatchObject({
      answerText: 'Teresa draft based on organization context.',
      suggestionId: expect.any(String),
    });

    const suggestionId = generated.body.suggestionId as string;
    const client = pgClient();
    await client.connect();
    try {
      const pending = await client.query(
        `SELECT organization_id, generated_by, source, model_id, provider, prompt_version,
                suggested_answer_text, decision
           FROM interview_ai_suggestion_audit WHERE id = $1`,
        [suggestionId]
      );
      expect(pending.rows[0]).toMatchObject({
        organization_id: SEED.ORG_ID,
        generated_by: SEED.USER_ID,
        source: 'interview_question_ai_suggest',
        model_id: 'int04-acceptance-model',
        provider: 'acceptance-provider',
        prompt_version: 'int04-v1',
        suggested_answer_text: 'Teresa draft based on organization context.',
        decision: 'pending',
      });
    } finally {
      await client.end();
    }

    const foreignRead = await request(app)
      .get(`/api/interview/questions/${QUESTION_ID}/ai-suggestions`)
      .set('Authorization', `Bearer ${foreignToken}`);
    expect(foreignRead.status).toBe(404);

    const accepted = await request(app)
      .patch(`/api/interview/questions/${QUESTION_ID}`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answerText: FINAL_ANSWER, status: 'answered', aiSuggestionId: suggestionId });
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);

    const replay = await request(app)
      .patch(`/api/interview/questions/${QUESTION_ID}`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({
        answerText: 'Replay must not win.',
        status: 'answered',
        aiSuggestionId: suggestionId,
      });
    expect(replay.status).toBe(409);

    const generatedForReject = await request(app)
      .post(`/api/interview/questions/${QUESTION_ID}/ai-suggest`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({});
    expect(generatedForReject.status).toBe(200);
    const rejectedId = generatedForReject.body.suggestionId as string;

    const foreignReject = await request(app)
      .post(`/api/interview/questions/${QUESTION_ID}/ai-suggestions/${rejectedId}/reject`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .send({});
    expect(foreignReject.status).toBe(404);

    const rejected = await request(app)
      .post(`/api/interview/questions/${QUESTION_ID}/ai-suggestions/${rejectedId}/reject`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({});
    expect(rejected.status, JSON.stringify(rejected.body)).toBe(200);

    const reopened = await request(app)
      .get(`/api/interview/questions/${QUESTION_ID}/ai-suggestions`)
      .set('Authorization', `Bearer ${respondentToken}`);
    expect(reopened.status).toBe(200);
    expect(reopened.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: suggestionId,
          decision: 'accepted',
          finalAnswerText: FINAL_ANSWER,
          decidedBy: SEED.USER_ID,
        }),
        expect.objectContaining({ id: rejectedId, decision: 'rejected', decidedBy: SEED.USER_ID }),
      ])
    );

    const verify = pgClient();
    await verify.connect();
    try {
      const question = await verify.query(
        'SELECT answer_text FROM interview_questions WHERE id = $1',
        [QUESTION_ID]
      );
      expect(question.rows[0]?.answer_text).toBe(FINAL_ANSWER);
    } finally {
      await verify.end();
    }
  });
});
