/**
 * INT-BVP-001 (6) — optional per-answer CAS guard on `updateQuestion`
 * (`PATCH /interview/questions/:questionId`), and
 * INT-DELIVERY-OPS-001 (3) — nullable `fixType` structured output, both
 * proved against a REAL PostgreSQL.
 *
 * (6) BEFORE: a plain `UPDATE interview_questions SET ... WHERE id = ?` with
 * no version predicate — last-write-wins, the only guard being the coarse
 * session-status lock. `updated_at` already existed but was never exposed to
 * the client, so nothing could round-trip it back as an "expected" version.
 * AFTER: `buildQuestionResponse` now returns `updatedAt`; a client that sends
 * it back as `expectedUpdatedAt` gets `AND updated_at = ?` appended to the
 * UPDATE and a 409 on a lost race. Omitting the field keeps the exact
 * pre-existing (documented) last-write-wins behaviour — proved explicitly
 * below as a characterization test, not a passing guarantee.
 *
 * (3) `EvalSchema.fixType` is `z.enum([...]).nullable()`. Proved here: (a) a
 * provider response with `fixType: null` does not crash the endpoint, and
 * (b) `normalizeInterviewAiFixType` (the read-side consumer) never leaks a
 * literal `null` into the API response — it deterministically normalizes
 * `null` to a concrete member of `INTERVIEW_AI_FIX_TYPES` via verdict/feedback
 * heuristics. That is by design (see the comment at the schema definition:
 * "null is the explicit no-remediation value and is normalized by the read
 * side"), so the correct assertion is "no crash + a valid enum value", not
 * "the response contains a literal null".
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

const mockLlmCall = vi.fn();

vi.mock('../../../services/ai/ingestionPipeline.js', () => ({
  IngestionPipeline: class {},
  ingestInterviewTextArtifact: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../services/ai/llmService.js', () => ({ llmService: { call: mockLlmCall } }));
vi.mock('../../../services/notificationService.js', () => ({
  default: { send: vi.fn().mockResolvedValue('notif-mock') },
}));
vi.mock('../../../services/organizationContext/OrganizationContextService.js', () => ({
  default: { recordInterviewEvidence: vi.fn(), recordInterviewAnswer: vi.fn() },
}));
vi.mock('../../../services/pdfParserService.js', () => ({ default: {} }));
vi.mock('../../../services/workflow/gatePolicy.js', () => ({ evaluateGatePolicy: vi.fn() }));

const RUBRIC_KEYS = ['concreteness', 'evidence', 'depth', 'measurability', 'coherence'];
const FIX_TYPES = [
  'clarify',
  'add_evidence',
  'expand_answer',
  'make_specific',
  'complete_required_fields',
  'correct_meaning',
];

describe.skipIf(!REAL_DB)('updateQuestion CAS + nullable fixType — real PostgreSQL', () => {
  let pool: Pool;
  let app: Express;
  const tag = randomUUID();
  const orgId = `org-cas-${tag}`;
  const userId = `user-cas-${tag}`;
  const sessionId = `session-cas-${tag}`;
  const questionId = `question-cas-${tag}`;
  const questionId2 = `question-cas2-${tag}`;

  beforeAll(async () => {
    const { Pool: PgPool } = await import('pg');
    pool = new PgPool({ connectionString: CONNECTION_STRING });

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, 'CAS fixture')`, [orgId]);
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, 'MEMBER')`,
      [userId, orgId, `${userId}@example.test`]
    );
    await pool.query(
      `INSERT INTO interview_sessions (id, organization_id, owner_id, status)
       VALUES ($1, $2, $3, 'in_progress')`,
      [sessionId, orgId, userId]
    );
    await pool.query(
      `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, answer_text, status, is_required)
       VALUES ($1, $2, $3, 'strategy', 'What is your goal?', 'initial answer', 'answered', 0)`,
      [questionId, sessionId, orgId]
    );
    await pool.query(
      `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, answer_text, status, is_required)
       VALUES ($1, $2, $3, 'strategy', 'What is your risk?', 'initial answer 2', 'answered', 0)`,
      [questionId2, sessionId, orgId]
    );

    const { InterviewController } = await import('../../../controllers/InterviewController.js');
    app = express();
    app.use(express.json());
    app.use((req: express.Request & { user?: unknown }, _res, next) => {
      req.user = { id: userId, organizationId: orgId, role: 'MEMBER' };
      next();
    });
    app.patch('/api/interview/questions/:questionId', (InterviewController as any).updateQuestion);
    app.post(
      '/api/interview/sessions/:sessionId/evaluate-answers',
      (InterviewController as any).evaluateSessionAnswers
    );
  }, 60000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM interview_questions WHERE session_id = $1`, [sessionId]);
    await pool.query(`DELETE FROM interview_sessions WHERE id = $1`, [sessionId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    await pool.end();
  });

  describe('CAS guard', () => {
    it('a PATCH without expectedUpdatedAt (default) is plain last-write-wins — CHARACTERIZATION of the known, documented gap, not a guarantee', async () => {
      const first = await request(app)
        .patch(`/api/interview/questions/${questionId}`)
        .send({ answerText: 'lww-v1' });
      expect(first.status).toBe(200);

      const second = await request(app)
        .patch(`/api/interview/questions/${questionId}`)
        .send({ answerText: 'lww-v2' });
      expect(second.status).toBe(200);

      const row = await pool.query(`SELECT answer_text FROM interview_questions WHERE id = $1`, [
        questionId,
      ]);
      expect(row.rows[0].answer_text).toBe('lww-v2');
    });

    it('a PATCH with a CURRENT expectedUpdatedAt succeeds and returns a fresh updatedAt', async () => {
      const before = await request(app)
        .patch(`/api/interview/questions/${questionId2}`)
        .send({ answerText: 'cas-baseline' });
      expect(before.status).toBe(200);
      const t0 = before.body.updatedAt;
      expect(t0).toBeTruthy();

      await new Promise((r) => setTimeout(r, 10));

      const winner = await request(app)
        .patch(`/api/interview/questions/${questionId2}`)
        .send({ answerText: 'cas-winner', expectedUpdatedAt: t0 });
      expect(winner.status).toBe(200);
      expect(winner.body.updatedAt).toBeTruthy();
      expect(winner.body.updatedAt).not.toBe(t0);

      const row = await pool.query(`SELECT answer_text FROM interview_questions WHERE id = $1`, [
        questionId2,
      ]);
      expect(row.rows[0].answer_text).toBe('cas-winner');
    });

    it('HEADLINE: a PATCH with a STALE expectedUpdatedAt (lost race) is refused with 409 and does not clobber the winner', async () => {
      // questionId2 is now at 'cas-winner' with a fresh updated_at (previous
      // test). t0 (the value BEFORE that write) is now stale — exactly the
      // shape of two concurrent clients that both read the row before either
      // wrote, one of them losing the race.
      const before = await request(app)
        .patch(`/api/interview/questions/${questionId2}`)
        .send({ answerText: 'cas-rebaseline' });
      const staleVersion = before.body.updatedAt;

      await new Promise((r) => setTimeout(r, 10));
      const legit = await request(app)
        .patch(`/api/interview/questions/${questionId2}`)
        .send({ answerText: 'cas-legit-winner', expectedUpdatedAt: staleVersion });
      expect(legit.status).toBe(200);

      // Loser: still presents the now-stale `staleVersion` it read before the
      // winner's write landed.
      const loser = await request(app)
        .patch(`/api/interview/questions/${questionId2}`)
        .send({ answerText: 'cas-loser-should-not-land', expectedUpdatedAt: staleVersion });
      expect(loser.status).toBe(409);
      expect(loser.body.error).toMatch(/modified by another update/i);

      const row = await pool.query(`SELECT answer_text FROM interview_questions WHERE id = $1`, [
        questionId2,
      ]);
      expect(row.rows[0].answer_text).toBe('cas-legit-winner');
    });

    it('cold readback: a fresh pool/connection sees the CAS-winning value', async () => {
      const { Pool: PgPool } = await import('pg');
      const freshPool = new PgPool({ connectionString: CONNECTION_STRING });
      try {
        const row = await freshPool.query(
          `SELECT answer_text FROM interview_questions WHERE id = $1`,
          [questionId2]
        );
        expect(row.rows[0].answer_text).toBe('cas-legit-winner');
      } finally {
        await freshPool.end();
      }
    });
  });

  describe('nullable fixType structured output', () => {
    it('a provider response with fixType: null is accepted without crashing, and normalizes to a valid enum value', async () => {
      mockLlmCall.mockResolvedValueOnce({
        object: {
          questionEvaluations: [
            {
              questionId,
              rubric: RUBRIC_KEYS.map((criterion) => ({
                criterion,
                score: 3,
                justification: 'solid',
              })),
              feedback: 'Good answer, could be more specific.',
              fixType: null,
            },
          ],
          recommendations: ['Add one concrete example.'],
        },
        usage: {},
      });

      const res = await request(app).post(
        `/api/interview/sessions/${sessionId}/evaluate-answers`
      );
      expect(res.status).toBe(200);
      expect(res.body.overallVerdict).not.toBe('timeout');
      const evalForQ1 = res.body.questionEvaluations.find((q: any) => q.questionId === questionId);
      expect(evalForQ1).toBeTruthy();
      // The literal `null` never survives to the API response by design — the
      // read side (normalizeInterviewAiFixType) always normalizes it to a
      // concrete remediation type. The proof here is "did not crash / did not
      // 500", not "the response contains null".
      expect(evalForQ1.fixType).not.toBeNull();
      expect(FIX_TYPES).toContain(evalForQ1.fixType);
    });
  });
});
