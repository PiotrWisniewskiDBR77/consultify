/**
 * INT-BVP-001 (2) — server-side AI review timeout, proved against a REAL
 * PostgreSQL with a stubbed (deliberately slow) LLM provider.
 *
 * BEFORE: `evaluateSessionAnswers` awaited `evaluateInterviewSessionAnswers`
 * (which calls `llmService.call`) with NO bound anywhere on the server. Only
 * the CLIENT raced it against a 12s timer and gave up — the server request
 * (and the provider call) kept running indefinitely.
 *
 * AFTER: the handler races the evaluation against
 * `INTERVIEW_AI_REVIEW_TIMEOUT_MS` (env `INTERVIEW_AI_REVIEW_TIMEOUT_MS`,
 * default 20000ms — set here via env to a small value BEFORE importing the
 * controller, since the constant is computed once at module load). On a
 * timeout it returns an EXPLICIT, non-fabricated fallback
 * (`overallScore: 0, overallVerdict: 'timeout', timedOut: true`, empty
 * questionEvaluations/recommendations) rather than inventing a score, and the
 * endpoint never writes to `interview_questions` at all, so the user's
 * already-persisted answer is provably untouched either way.
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

// Must be set BEFORE the controller module is imported — the
// INTERVIEW_AI_REVIEW_TIMEOUT_MS constant is computed once, at module load,
// from process.env.
const TEST_TIMEOUT_MS = 300;
process.env.INTERVIEW_AI_REVIEW_TIMEOUT_MS = String(TEST_TIMEOUT_MS);

// Deliberately far longer than TEST_TIMEOUT_MS — this is the "hung provider".
const PROVIDER_DELAY_MS = 2500;

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

describe.skipIf(!REAL_DB)('evaluateSessionAnswers server-side timeout — real PostgreSQL', () => {
  let pool: Pool;
  let app: Express;
  const tag = randomUUID();
  const orgId = `org-timeout-${tag}`;
  const userId = `user-timeout-${tag}`;
  const sessionId = `session-timeout-${tag}`;
  const questionId = `question-timeout-${tag}`;
  const assignmentId = `assignment-timeout-${tag}`;

  beforeAll(async () => {
    const { Pool: PgPool } = await import('pg');
    pool = new PgPool({ connectionString: CONNECTION_STRING });

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, 'AI timeout fixture')`, [
      orgId,
    ]);
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
       VALUES ($1, $2, $3, 'strategy', 'What is your goal?', 'the user''s already-persisted answer', 'answered', 0)`,
      [questionId, sessionId, orgId]
    );
    await pool.query(
      `INSERT INTO interview_assignments
         (id, organization_id, assignee_user_id, template_id, session_id)
       VALUES ($1, $2, $3, 'tmpl-timeout', $4)`,
      [assignmentId, orgId, userId, sessionId]
    );

    // The "hung provider": resolves long after our bound, with a well-formed
    // payload (proves the FALLBACK path, not a malformed-response path).
    mockLlmCall.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                object: {
                  questionEvaluations: [
                    {
                      questionId,
                      rubric: ['concreteness', 'evidence', 'depth', 'measurability', 'coherence'].map(
                        (criterion) => ({ criterion, score: 4, justification: 'late but real' })
                      ),
                      feedback: 'late response',
                      fixType: null,
                    },
                  ],
                  recommendations: [],
                },
                usage: {},
              }),
            PROVIDER_DELAY_MS
          );
        })
    );

    const { InterviewController } = await import('../../../controllers/InterviewController.js');
    app = express();
    app.use(express.json());
    app.use((req: express.Request & { user?: unknown }, _res, next) => {
      req.user = { id: userId, organizationId: orgId, role: 'MEMBER' };
      next();
    });
    app.post(
      '/api/interview/sessions/:sessionId/evaluate-answers',
      (InterviewController as any).evaluateSessionAnswers
    );
  }, 60000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(
      `DELETE FROM audit_log WHERE action = 'ai.interview_review.timeout' AND resource_id = $1`,
      [sessionId]
    );
    await pool.query(`DELETE FROM interview_assignments WHERE id = $1`, [assignmentId]);
    await pool.query(`DELETE FROM interview_questions WHERE session_id = $1`, [sessionId]);
    await pool.query(`DELETE FROM interview_sessions WHERE id = $1`, [sessionId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    await pool.end();
  });

  it('HEADLINE: responds within the bound with an explicit, non-fabricated fallback — and the persisted answer is untouched', async () => {
    const { getRequestMetrics } = await import('../../../middleware/metrics.middleware.js');
    const metricsBefore = getRequestMetrics().aiTimeouts;
    const startedAt = Date.now();
    const res = await request(app).post(
      `/api/interview/sessions/${sessionId}/evaluate-answers`
    );
    const elapsedMs = Date.now() - startedAt;

    // Must return well before the (deliberately much longer) provider delay —
    // proves the server enforces its own bound rather than just hoping the
    // provider respects timeoutMs.
    expect(elapsedMs).toBeLessThan(PROVIDER_DELAY_MS - 500);

    expect(res.status).toBe(200);
    expect(res.body.timedOut).toBe(true);
    expect(res.body.overallVerdict).toBe('timeout');
    // Not fabricated: zero score, empty evaluations — never a guessed number.
    expect(res.body.overallScore).toBe(0);
    expect(res.body.questionEvaluations).toEqual([]);
    expect(res.body.recommendations).toEqual([]);
    expect(getRequestMetrics().aiTimeouts).toBe(metricsBefore + 1);

    const row = await pool.query(`SELECT answer_text FROM interview_questions WHERE id = $1`, [questionId]);
    expect(row.rows[0].answer_text).toBe("the user's already-persisted answer");

    const persisted = await pool.query(
      `SELECT ai_review_snapshot_json, ai_reviewed_at FROM interview_assignments WHERE id = $1`,
      [assignmentId]
    );
    expect(persisted.rows[0].ai_reviewed_at).toBeTruthy();
    const timeoutSnapshot =
      typeof persisted.rows[0].ai_review_snapshot_json === 'string'
        ? JSON.parse(persisted.rows[0].ai_review_snapshot_json)
        : persisted.rows[0].ai_review_snapshot_json;
    expect(timeoutSnapshot).toMatchObject({
      overallVerdict: 'timeout',
      timedOut: true,
      questionEvaluations: [],
    });
  });

  it('the late provider response does not crash the process and does not corrupt the persisted answer once it finally resolves', async () => {
    // Let the "hung provider" from the previous test actually resolve
    // (background persistSnapshot path) and confirm the answer row is still
    // exactly what it was — the AI review endpoint never writes to
    // interview_questions under any timing.
    await new Promise((r) => setTimeout(r, PROVIDER_DELAY_MS - TEST_TIMEOUT_MS + 300));
    const row = await pool.query(`SELECT answer_text FROM interview_questions WHERE id = $1`, [
      questionId,
    ]);
    expect(row.rows[0].answer_text).toBe("the user's already-persisted answer");

    const { Pool: PgPool } = await import('pg');
    const cold = new PgPool({ connectionString: CONNECTION_STRING });
    try {
      const persisted = await cold.query(
        `SELECT ai_review_snapshot_json FROM interview_assignments WHERE id = $1`,
        [assignmentId]
      );
      const snapshot =
        typeof persisted.rows[0].ai_review_snapshot_json === 'string'
          ? JSON.parse(persisted.rows[0].ai_review_snapshot_json)
          : persisted.rows[0].ai_review_snapshot_json;
      expect(snapshot).toMatchObject({ overallVerdict: 'timeout', timedOut: true });

      const audit = await cold.query(
        `SELECT action, result, resource_id, organization_id, metadata
           FROM audit_log
          WHERE action = 'ai.interview_review.timeout'
            AND resource_id = $1 AND organization_id = $2`,
        [sessionId, orgId]
      );
      expect(audit.rows).toHaveLength(1);
      expect(audit.rows[0]).toMatchObject({ result: 'failure', resource_id: sessionId, organization_id: orgId });
      const metadata =
        typeof audit.rows[0].metadata === 'string'
          ? JSON.parse(audit.rows[0].metadata)
          : audit.rows[0].metadata;
      expect(metadata).toMatchObject({ timeoutMs: TEST_TIMEOUT_MS, terminalVerdict: 'timeout' });
    } finally {
      await cold.end();
    }
  }, 10000);
});
