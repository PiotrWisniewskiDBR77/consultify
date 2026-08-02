import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const SUMMARY =
  'Order approval takes five days instead of two, delaying delivery and creating avoidable follow-up work. Manual handoffs between Sales and Finance are the main reported cause, but the conclusion still requires confirmation from Finance.';

vi.mock('../../server/src/services/ai/llmService.js', () => ({
  llmService: {
    generateResponse: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        schema_version: 'v6',
        executive_summary: SUMMARY,
        themes: [
          {
            title: 'Manual approval handoffs',
            description:
              'The respondent reports that three manual handoffs add roughly three days to the order approval cycle and obscure end-to-end ownership.',
            evidence_refs: ['odbior--int07--question'],
            strength: 'moderate',
          },
        ],
        issues: [
          {
            title: 'No end-to-end owner',
            description: 'Responsibility is split across Sales, Controlling and Finance.',
            severity: 'high',
            evidence_refs: ['odbior--int07--question'],
          },
        ],
        opportunities: [],
        signals: [],
        evidence_map: [
          {
            answer_id: 'odbior--int07--question',
            question_text: 'How long does order approval take?',
            answer_snippet: 'Five days because of manual handoffs.',
            linked_themes: ['Manual approval handoffs'],
            linked_issues: ['No end-to-end owner'],
          },
        ],
        missing_data: ['Finance confirmation is missing.'],
        material_quality: {
          overall_material_score: 55,
          answer_quality_posture: 'usable',
          coverage_posture: 'single_perspective',
          missing_voices: ['Finance'],
          limitations: ['One respondent only.'],
          recommended_followups: ['Confirm the baseline with Finance.'],
        },
      }),
      usage: { totalTokens: 321 },
    }),
  },
}));

const PREFIX = 'odbior--int07--';
const SESSION_ID = `${PREFIX}session`;
const QUESTION_ID = `${PREFIX}question`;
const FOREIGN_ORG_ID = `${PREFIX}foreign-org`;
const FOREIGN_USER_ID = `${PREFIX}foreign-user`;
let app: Express;
let ownerToken: string;
let foreignToken: string;
let insightId = '';

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
       VALUES ($1, 'INT-07 foreign org', 'enterprise', 'active', 1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_ORG_ID, now]
    );
    await client.query(
      `INSERT INTO users
         (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'unused', 'ADMIN', 'active', 'INT07', 'Foreign', $4)
       ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_USER_ID, FOREIGN_ORG_ID, `${PREFIX}foreign@acceptance.local`, now]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', $4) ON CONFLICT (id) DO NOTHING`,
      [`${PREFIX}foreign-membership`, FOREIGN_ORG_ID, FOREIGN_USER_ID, now]
    );
    await client.query(
      `INSERT INTO interview_sessions
         (id, organization_id, name, owner_id, status, total_questions, answered_questions,
          started_at, completed_at, last_activity_at, created_at, updated_at)
       VALUES ($1, $2, 'INT-07 source', $3, 'completed', 1, 1, $4, $4, $4, $4, $4)`,
      [SESSION_ID, SEED.ORG_ID, SEED.USER_ID, now]
    );
    await client.query(
      `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, answer_text, status,
          answered_by, answered_at, sort_order, is_required, created_at, updated_at)
       VALUES ($1, $2, $3, 'operations', 'How long does order approval take?',
               'Five days because of manual handoffs.', 'answered', $4, $5, 1, 1, $5, $5)`,
      [QUESTION_ID, SESSION_ID, SEED.ORG_ID, SEED.USER_ID, now]
    );
  } finally {
    await client.end();
  }

  const router = (await import('../../server/src/routes/interview.routes.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/interview', router);
  ownerToken = mintToken();
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
    if (insightId) {
      await client.query('DELETE FROM interview_insight_activity WHERE insight_id = $1', [
        insightId,
      ]);
      await client.query('DELETE FROM interview_insights WHERE id = $1', [insightId]);
    }
    await client.query('DELETE FROM interview_questions WHERE id = $1', [QUESTION_ID]);
    await client.query('DELETE FROM interview_sessions WHERE id = $1', [SESSION_ID]);
    await client.query('DELETE FROM organization_members WHERE id = $1', [
      `${PREFIX}foreign-membership`,
    ]);
    await client.query('DELETE FROM users WHERE id = $1', [FOREIGN_USER_ID]);
    await client.query('DELETE FROM organizations WHERE id = $1', [FOREIGN_ORG_ID]);
  } finally {
    await client.end();
  }
}, 30_000);

describe('INT-07 — durable insight generation and reopen', () => {
  it('generates from an approved source, persists completed content, reopens it, and hides it cross-tenant', async () => {
    const created = await request(app)
      .post('/api/interview/insights')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sessionIds: [SESSION_ID], title: 'INT-07 durable insight', promptType: 'summary' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    insightId = created.body.id;
    expect(insightId).toBeTruthy();

    const deadline = Date.now() + 15_000;
    let persisted: Record<string, unknown> | undefined;
    while (Date.now() < deadline) {
      const client = pgClient();
      await client.connect();
      try {
        const result = await client.query(
          `SELECT status, executive_summary, source_session_ids, evidence_map_json
             FROM interview_insights WHERE id = $1`,
          [insightId]
        );
        persisted = result.rows[0];
      } finally {
        await client.end();
      }
      if (persisted?.status === 'completed') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(persisted).toMatchObject({ status: 'completed', executive_summary: SUMMARY });
    expect(JSON.parse(String(persisted?.source_session_ids))).toEqual([SESSION_ID]);
    expect(JSON.parse(String(persisted?.evidence_map_json))).toEqual(
      expect.arrayContaining([expect.objectContaining({ answer_id: QUESTION_ID })])
    );

    const reopened = await request(app)
      .get(`/api/interview/insights/${insightId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(reopened.status, JSON.stringify(reopened.body)).toBe(200);
    expect(reopened.body).toMatchObject({
      id: insightId,
      status: 'completed',
      executiveSummary: SUMMARY,
      sourceSessionIds: [SESSION_ID],
    });

    const foreignRead = await request(app)
      .get(`/api/interview/insights/${insightId}`)
      .set('Authorization', `Bearer ${foreignToken}`);
    expect(foreignRead.status).toBe(404);
  });
});
