/**
 * INT-08 acceptance: tenant-isolation and role-capability negative controls
 * for the candidate-handoff endpoints. Mirrors the cross-org section of
 * tests/acceptance/interview-submit-review-lifecycle.e2e.test.ts (its
 * FOREIGN_ORG_ID/FOREIGN_USER_ID pattern) plus a same-org, wrong-role check.
 *
 * Org A (SEED org) creates and fully manager-approves one interview
 * submission — reaching a state where a candidate-handoff approve WOULD
 * succeed for an org-A actor with the right permission. Org B's token, and a
 * same-org actor without the right permission, must never be able to see or
 * mutate it: existence must never leak as a 403 (cross-org -> 404), and a
 * same-org actor without the permission must get 403 before any lookup runs.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

vi.mock('../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: vi.fn().mockRejectedValue(new Error('acceptance: AI enrichment offline')) },
}));

const PREFIX = 'odbior--int008neg--';
const RESPONDENT_ID = `${PREFIX}respondent`;
const RESPONDENT_EMAIL = `${PREFIX}respondent@acceptance.local`;
const FOREIGN_ORG_ID = `${PREFIX}foreign-org`;
const FOREIGN_USER_ID = `${PREFIX}foreign-user`;
const FOREIGN_EMAIL = `${PREFIX}foreign@acceptance.local`;

const SESSION_ID = `${PREFIX}session`;
const ASSIGNMENT_ID = `${PREFIX}assignment`;
const QUESTION_ID = `${PREFIX}question`;
const TEMPLATE_ID = `${PREFIX}template`;
const ANSWER_TEXT = 'Głównym ryzykiem jest brak zasobów wdrożeniowych w Q3.';
const NONEXISTENT_FINDING_ID = `${PREFIX}nonexistent-finding`;

let app: Express;
let managerToken: string;
let respondentToken: string; // same-org, role USER -> lacks INTERVIEW_ASSIGN_MANAGE/INTERVIEW_INSIGHTS_HANDOFF
let foreignToken: string; // org B, role ADMIN in org B

beforeAll(async () => {
  await seed();
  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();

    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, $3) ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_ORG_ID, 'INT-08 negative-controls foreign org', now]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'unused', 'USER', 'active', 'Respondent', 'INT008NEG', $4)
       ON CONFLICT (id) DO NOTHING`,
      [RESPONDENT_ID, SEED.ORG_ID, RESPONDENT_EMAIL, now]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'unused', 'ADMIN', 'active', 'Foreign', 'INT008NEG', $4)
       ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_USER_ID, FOREIGN_ORG_ID, FOREIGN_EMAIL, now]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE', $4) ON CONFLICT (id) DO NOTHING`,
      [`${PREFIX}respondent-membership`, SEED.ORG_ID, RESPONDENT_ID, now]
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
      [SESSION_ID, SEED.ORG_ID, `${PREFIX}session`, RESPONDENT_ID, TEMPLATE_ID, ASSIGNMENT_ID, now]
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
      [QUESTION_ID, SESSION_ID, SEED.ORG_ID, ANSWER_TEXT, RESPONDENT_ID, now]
    );
  } finally {
    await client.end();
  }

  const interviewRouter = (await import('../../server/src/routes/interview.routes.js')).default;
  const candidateHandoffRouter = (
    await import('../../server/src/routes/interviewCandidateHandoff.routes.js')
  ).default;

  app = express();
  app.use(express.json());
  app.use('/api/interview', interviewRouter);
  app.use('/api/interview/candidate-handoff', candidateHandoffRouter);

  managerToken = mintToken({ role: 'ADMIN' });
  respondentToken = mintToken({ id: RESPONDENT_ID, email: RESPONDENT_EMAIL, role: 'USER' });
  foreignToken = mintToken({
    id: FOREIGN_USER_ID,
    email: FOREIGN_EMAIL,
    organizationId: FOREIGN_ORG_ID,
    organization_id: FOREIGN_ORG_ID,
    role: 'ADMIN',
  });

  // Reach a state where org A's own candidate-handoff approve WOULD succeed —
  // but this suite never actually calls it as org A, so both tables must stay
  // at zero rows for ASSIGNMENT_ID throughout.
  const submit = await request(app)
    .post(`/api/interview/assignments/${ASSIGNMENT_ID}/submit`)
    .set('Authorization', `Bearer ${respondentToken}`)
    .send({ language: 'pl' });
  if (submit.status !== 200) {
    throw new Error(`setup submit failed: ${submit.status} ${JSON.stringify(submit.body)}`);
  }
  const approve = await request(app)
    .post(`/api/interview/assignments/${ASSIGNMENT_ID}/approve`)
    .set('Authorization', `Bearer ${managerToken}`)
    .send({});
  if (approve.status !== 200) {
    throw new Error(`setup approve failed: ${approve.status} ${JSON.stringify(approve.body)}`);
  }
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(`DELETE FROM interview_candidate_handoffs WHERE source_id = $1`, [
      ASSIGNMENT_ID,
    ]);
    await client.query(`DELETE FROM initiative_candidates WHERE source_id = $1`, [ASSIGNMENT_ID]);
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

describe('INT-08 — tenant and role negative controls', () => {
  it('cross-org preview returns 404 SUBMISSION_NOT_FOUND, never 403, and leaks nothing', async () => {
    const res = await request(app)
      .get(`/api/interview/candidate-handoff/submission/${ASSIGNMENT_ID}/preview`)
      .set('Authorization', `Bearer ${foreignToken}`);
    expect(res.status, JSON.stringify(res.body)).toBe(404);
    expect(res.status).not.toBe(403);
    expect(res.body.code).toBe('SUBMISSION_NOT_FOUND');
  });

  it('cross-org approve returns 404 SUBMISSION_NOT_FOUND, never 403, and creates nothing', async () => {
    const res = await request(app)
      .post(`/api/interview/candidate-handoff/submission/${ASSIGNMENT_ID}/approve`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .send({});
    expect(res.status, JSON.stringify(res.body)).toBe(404);
    expect(res.status).not.toBe(403);
    expect(res.body.code).toBe('SUBMISSION_NOT_FOUND');

    const client = pgClient();
    await client.connect();
    try {
      const candidateCount = await client.query(
        `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
        [ASSIGNMENT_ID]
      );
      expect(candidateCount.rows[0].n).toBe(0);
      const handoffCount = await client.query(
        `SELECT count(*)::int AS n FROM interview_candidate_handoffs WHERE source_id = $1`,
        [ASSIGNMENT_ID]
      );
      expect(handoffCount.rows[0].n).toBe(0);
    } finally {
      await client.end();
    }
  });

  it('cross-org lineage read-back returns 404 NO_CANDIDATE_HANDOFF, never 403', async () => {
    const res = await request(app)
      .get(`/api/interview/candidate-handoff/submission/${ASSIGNMENT_ID}`)
      .set('Authorization', `Bearer ${foreignToken}`);
    expect(res.status, JSON.stringify(res.body)).toBe(404);
    expect(res.status).not.toBe(403);
    expect(res.body.code).toBe('NO_CANDIDATE_HANDOFF');
  });

  it('same-org actor without INTERVIEW_ASSIGN_MANAGE cannot approve a submission handoff', async () => {
    const res = await request(app)
      .post(`/api/interview/candidate-handoff/submission/${ASSIGNMENT_ID}/approve`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({});
    expect(res.status, JSON.stringify(res.body)).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');

    const client = pgClient();
    await client.connect();
    try {
      const candidateCount = await client.query(
        `SELECT count(*)::int AS n FROM initiative_candidates WHERE source_id = $1`,
        [ASSIGNMENT_ID]
      );
      expect(candidateCount.rows[0].n).toBe(0);
    } finally {
      await client.end();
    }
  });

  it('same-org actor without INTERVIEW_INSIGHTS_HANDOFF cannot approve an insight-finding handoff', async () => {
    const res = await request(app)
      .post(`/api/interview/candidate-handoff/insight-finding/${NONEXISTENT_FINDING_ID}/approve`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({});
    expect(res.status, JSON.stringify(res.body)).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });
});
