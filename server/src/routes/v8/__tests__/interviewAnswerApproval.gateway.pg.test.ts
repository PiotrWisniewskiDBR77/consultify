import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { errorHandler } from '../../../middleware/errorHandler.js';
import { applyInterviewAnswerDecisionCommand } from '../../../services/interview/interviewAnswerDecisionService.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)(
  'Interview answer approvals — real ApiGateway, JWT and PostgreSQL',
  () => {
    let app: Express;
    let pool: Pool;
    let managerToken: string;
    let respondentToken: string;
    const tag = randomUUID();
    const orgId = `iaa-gateway-org-${tag}`;
    const managerId = `iaa-gateway-manager-${tag}`;
    const respondentId = `iaa-gateway-respondent-${tag}`;
    const sessionId = `iaa-gateway-session-${tag}`;
    const assignmentId = `iaa-gateway-assignment-${tag}`;
    const questionId = `iaa-gateway-question-${tag}`;
    const submissionId = `iaa-gateway-submission-${tag}`;

    beforeAll(async () => {
    process.env.ENABLE_INTERVIEW_ANSWER_APPROVAL = 'true';
      process.env.ENABLE_V8_GLOBAL = 'true';
      process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
      const target = new URL(DATABASE_URL);
      expect(target.hostname).toBe('127.0.0.1');
      const configuredDatabaseName = process.env.INTERVIEW_APPROVAL_TEST_DATABASE?.trim();
      expect(target.pathname).toMatch(/^\/[A-Za-z0-9_-]+$/);
      if (configuredDatabaseName) expect(target.pathname).toBe(`/${configuredDatabaseName}`);
      const { Pool: PgPool } = await import('pg');
      pool = new PgPool({ connectionString: DATABASE_URL });
      await pool.query(`INSERT INTO organizations (id, name) VALUES ($1,'IAA gateway')`, [orgId]);
      for (const [userId, role] of [
        [managerId, 'ADMIN'],
        [respondentId, 'MEMBER'],
      ] as const) {
        await pool.query(
          `INSERT INTO users (id, organization_id, email, password, role, status)
         VALUES ($1,$2,$3,'local-fixture-not-login',$4,'active')`,
          [userId, orgId, `${userId}@example.invalid`, role]
        );
        await pool.query(
          `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1,$2,$3,$4,'ACTIVE')`,
          [randomUUID(), orgId, userId, role]
        );
      }
      await pool.query(
        `INSERT INTO organization_ai_policy (organization_id, policy)
       VALUES ($1,$2::jsonb)`,
        [orgId, JSON.stringify({ interview: { answerApproval: { version: 1, enabled: true, mode: 'manager' } } })]
      );
      await pool.query(
        `INSERT INTO interview_sessions (id, organization_id, name, owner_id, status)
       VALUES ($1,$2,'IAA gateway session',$3,'in_progress')`,
        [sessionId, orgId, managerId]
      );
      await pool.query(
        `INSERT INTO interview_assignments
         (id, organization_id, assignee_user_id, created_by, template_id,
          template_version, status, session_id)
       VALUES ($1,$2,$3,$4,'template-gateway',1,'in_progress',$5)`,
        [assignmentId, orgId, respondentId, managerId, sessionId]
      );
      await pool.query(
        `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, answer_text,
          status, is_required, answer_type, answer_mode, answer_payload)
       VALUES ($1,$2,$3,'strategy','Gateway question','Gateway answer',
               'answered',1,'open','text',$4::jsonb)`,
        [questionId, sessionId, orgId, JSON.stringify({ text: 'Gateway answer' })]
      );
      await applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        assignmentId,
        sessionId,
        submissionId,
        clientRequestId: `iaa-gateway-submit-${tag}`,
        commandType: 'submit',
        actor: { type: 'human', id: respondentId },
      });
      await pool.query(`UPDATE interview_assignments SET status='submitted' WHERE id=$1`, [
        assignmentId,
      ]);

      const config = (await import('../../../config/Config.js')).default;
      managerToken = jwt.sign(
        { id: managerId, organizationId: orgId, role: 'ADMIN' },
        config.JWT_SECRET,
        { expiresIn: '15m' }
      );
      respondentToken = jwt.sign(
        { id: respondentId, organizationId: orgId, role: 'MEMBER' },
        config.JWT_SECRET,
        { expiresIn: '15m' }
      );
      const { ApiGateway } = await import('../../../Gateway.js');
      app = express();
      app.use(express.json());
      ApiGateway.getInstance().initializeRoutes(app);
      app.use(errorHandler);
    }, 60_000);

    afterAll(async () => {
      if (!pool) return;
      await pool.query(`DELETE FROM interview_assignments WHERE id=$1`, [assignmentId]);
      await pool.query(`DELETE FROM interview_questions WHERE id=$1`, [questionId]);
      await pool.query(`DELETE FROM interview_sessions WHERE id=$1`, [sessionId]);
      await pool.query(`DELETE FROM organization_ai_policy WHERE organization_id=$1`, [orgId]);
      await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [orgId]);
      await pool.query(`DELETE FROM users WHERE organization_id=$1`, [orgId]);
      await pool.query(`DELETE FROM organizations WHERE id=$1`, [orgId]);
      const remaining = await pool.query(
        `SELECT
         (SELECT count(*)::int FROM interview_answer_decision_commands WHERE organization_id=$1) commands,
         (SELECT count(*)::int FROM interview_answer_decisions WHERE organization_id=$1) decisions,
         (SELECT count(*)::int FROM interview_assignments WHERE organization_id=$1) assignments,
         (SELECT count(*)::int FROM users WHERE organization_id=$1) users`,
        [orgId]
      );
      expect(remaining.rows[0]).toEqual({ commands: 0, decisions: 0, assignments: 0, users: 0 });
      await pool.end();
      const database = await import('../../../database/PostgresDatabase.js');
      await database.default.close();
    });

    it('serves the respondent-safe submitted projection through the mounted V8 route', async () => {
      const response = await request(app)
        .get(`/api/v8/interview/assignments/${assignmentId}/answer-approvals`)
        .set('Authorization', `Bearer ${respondentToken}`);

      expect(response.status, response.text).toBe(200);
      expect(response.body.data).toMatchObject({
        assignmentId,
        approvals: [
          {
            questionId,
            submissionId,
            status: 'pending',
            nextStage: 'manager',
            actor: null,
          },
        ],
      });
    });

    it('rejects the legacy blanket send-back once per-answer receipts govern the assignment', async () => {
      const before = await pool.query(
        `SELECT
         (SELECT status FROM interview_assignments WHERE id=$1) assignment_status,
         (SELECT status FROM interview_sessions WHERE id=$2) session_status,
         (SELECT count(*)::int FROM interview_answer_history WHERE assignment_id=$1) history_count,
         (SELECT count(*)::int FROM interview_answer_decisions WHERE assignment_id=$1) decision_count`,
        [assignmentId, sessionId]
      );

      const response = await request(app)
        .post(`/api/v8/interview/assignments/${assignmentId}/send-back`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Blanket send-back must not bypass per-answer decisions' });

      expect(response.status, response.text).toBe(409);
      expect(response.body.code).toBe('INTERVIEW_ANSWER_DECISION_REQUIRED');

      const after = await pool.query(
        `SELECT
         (SELECT status FROM interview_assignments WHERE id=$1) assignment_status,
         (SELECT status FROM interview_sessions WHERE id=$2) session_status,
         (SELECT count(*)::int FROM interview_answer_history WHERE assignment_id=$1) history_count,
         (SELECT count(*)::int FROM interview_answer_decisions WHERE assignment_id=$1) decision_count`,
        [assignmentId, sessionId]
      );
      expect(after.rows[0]).toEqual(before.rows[0]);
    });

    it('applies a manager decision through ApiGateway and cold-reads the redacted projection', async () => {
      const revision = await pool.query(`SELECT updated_at FROM interview_questions WHERE id=$1`, [
        questionId,
      ]);
      const decision = await request(app)
        .post(`/api/v8/interview/assignments/${assignmentId}/answer-decisions`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          submissionId,
          clientRequestId: `iaa-gateway-manager-${tag}`,
          answers: [
            {
              questionId,
              expectedAnswerUpdatedAt: revision.rows[0].updated_at.toISOString(),
            },
          ],
          decision: 'approved',
        });
      expect(decision.status, decision.text).toBe(200);
      expect(decision.body.data).toMatchObject({
        assignmentId,
        submissionId,
        decisions: [{ questionId, stage: 'manager', decision: 'approved' }],
      });

      const persisted = await pool.query(
        `SELECT actor_type, actor_id, event_type
       FROM interview_answer_decisions
       WHERE organization_id=$1 AND assignment_id=$2
       ORDER BY ordinal, id`,
        [orgId, assignmentId]
      );
      expect(persisted.rows.map((row) => row.event_type)).toEqual([
        'submitted',
        'manager_approved',
      ]);
      expect(persisted.rows[1]).toMatchObject({ actor_type: 'human', actor_id: managerId });

      const respondentRead = await request(app)
        .get(`/api/v8/interview/assignments/${assignmentId}/answer-approvals`)
        .set('Authorization', `Bearer ${respondentToken}`);
      expect(respondentRead.status, respondentRead.text).toBe(200);
      expect(respondentRead.body.data.approvals[0]).toMatchObject({
        status: 'stages_complete',
        latestDecision: 'approved',
        actor: null,
      });
    });

    it('exposes the legacy empty projection unless both rollout gates are on', async () => {
      process.env.ENABLE_INTERVIEW_ANSWER_APPROVAL = 'false';
      const envOff = await request(app)
        .get(`/api/v8/interview/assignments/${assignmentId}/answer-approvals`)
        .set('Authorization', `Bearer ${respondentToken}`);
      expect(envOff.status, envOff.text).toBe(200);
      expect(envOff.body.data).toEqual({ assignmentId, approvals: [] });

      process.env.ENABLE_INTERVIEW_ANSWER_APPROVAL = 'true';
      await pool.query(
        `UPDATE organization_ai_policy SET policy=$2::jsonb WHERE organization_id=$1`,
        [
          orgId,
          JSON.stringify({
            interview: { answerApproval: { version: 1, enabled: false, mode: 'manager' } },
          }),
        ]
      );
      const organizationOff = await request(app)
        .get(`/api/v8/interview/assignments/${assignmentId}/answer-approvals`)
        .set('Authorization', `Bearer ${respondentToken}`);
      expect(organizationOff.status, organizationOff.text).toBe(200);
      expect(organizationOff.body.data).toEqual({ assignmentId, approvals: [] });

      await pool.query(
        `UPDATE organization_ai_policy SET policy=$2::jsonb WHERE organization_id=$1`,
        [
          orgId,
          JSON.stringify({
            interview: { answerApproval: { version: 1, enabled: true, mode: 'manager' } },
          }),
        ]
      );
    });
  }
);
