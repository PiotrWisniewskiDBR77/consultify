import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import type { Pool, PoolClient } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { mockLlmCall } = vi.hoisted(() => ({ mockLlmCall: vi.fn() }));

vi.mock('../../ai/ingestionPipeline.js', () => ({
  IngestionPipeline: class {},
  ingestInterviewTextArtifact: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../ai/llmService.js', () => ({
  llmService: {
    resolveModelConfig: vi.fn().mockResolvedValue({
      id: 'interview-race-model',
      provider: 'interview-race-provider',
    }),
    call: (...args: unknown[]) => mockLlmCall(...args),
  },
}));
vi.mock('../../notificationService.js', () => ({
  default: { send: vi.fn().mockResolvedValue('notification-mock') },
}));
vi.mock('../../organizationContext/OrganizationContextService.js', () => ({
  default: { recordInterviewEvidence: vi.fn(), recordInterviewAnswer: vi.fn() },
}));
vi.mock('../../pdfParserService.js', () => ({ default: {} }));
vi.mock('../../workflow/gatePolicy.js', () => ({
  evaluateGatePolicy: vi.fn().mockReturnValue({ allow: true }),
}));

import { applyInterviewAnswerDecisionCommand } from '../interviewAnswerDecisionService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)(
  'Interview answer evidence revision serialization — real PostgreSQL',
  () => {
    let app: Express;
    let pool: Pool;
    const tag = randomUUID();
    const orgId = `iaa-evidence-org-${tag}`;
    const userId = `iaa-evidence-user-${tag}`;

    async function createAssignmentFixture(label: string) {
      const sessionId = `iaa-evidence-session-${label}-${tag}`;
      const assignmentId = `iaa-evidence-assignment-${label}-${tag}`;
      const questionId = `iaa-evidence-question-${label}-${tag}`;
      await pool.query(
        `INSERT INTO interview_sessions (id, organization_id, name, owner_id, status)
       VALUES ($1,$2,$3,$4,'in_progress')`,
        [sessionId, orgId, `Evidence ${label}`, userId]
      );
      await pool.query(
        `INSERT INTO interview_assignments
         (id, organization_id, assignee_user_id, template_id, template_version, status, session_id)
       VALUES ($1,$2,$3,'template-evidence',1,'in_progress',$4)`,
        [assignmentId, orgId, userId, sessionId]
      );
      await pool.query(`UPDATE interview_sessions SET assignment_id=$1 WHERE id=$2`, [
        assignmentId,
        sessionId,
      ]);
      await pool.query(
        `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, answer_text,
          status, is_required, answer_type, answer_mode, answer_payload)
       VALUES ($1,$2,$3,'strategy',$4,$5,'answered',1,'open','text',$6::jsonb)`,
        [
          questionId,
          sessionId,
          orgId,
          `Question ${label}`,
          `Answer ${label}`,
          JSON.stringify({ label }),
        ]
      );
      return { sessionId, assignmentId, questionId };
    }

    async function waitForBlockedQuery(blockerPid: number, queryFragment: string): Promise<number> {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const result = await pool.query(
          `SELECT pid
           FROM pg_stat_activity
           WHERE datname=current_database()
             AND wait_event_type='Lock'
             AND $1 = ANY(pg_blocking_pids(pid))
             AND regexp_replace(query, '\\s+', ' ', 'g') ILIKE $2`,
          [blockerPid, `%${queryFragment}%`]
        );
        if (result.rowCount === 1) return Number(result.rows[0].pid);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error(`Timed out waiting for blocked query: ${queryFragment}`);
    }

    async function waitForAdditionalBlockedQuery(
      blockerPid: number,
      excludedPid: number
    ): Promise<string> {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const result = await pool.query(
          `SELECT regexp_replace(query, '\\s+', ' ', 'g') query
           FROM pg_stat_activity
           WHERE datname=current_database()
             AND wait_event_type='Lock'
             AND ($1 = ANY(pg_blocking_pids(pid)) OR $2 = ANY(pg_blocking_pids(pid)))
             AND pid <> $2`,
          [blockerPid, excludedPid]
        );
        const assignmentLock = result.rows.find((row) =>
          String(row.query).includes('FROM interview_assignments')
        );
        if (assignmentLock) return String(assignmentLock.query);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error('Timed out waiting for the second assignment-lock query');
    }

    async function lockAssignment(assignmentId: string): Promise<PoolClient> {
      const client = await pool.connect();
      await client.query('BEGIN');
      await client.query(`SELECT id FROM interview_assignments WHERE id=$1 FOR UPDATE`, [
        assignmentId,
      ]);
      return client;
    }

    beforeAll(async () => {
    process.env.ENABLE_INTERVIEW_ANSWER_APPROVAL = 'true';
      const { Pool: PgPool } = await import('pg');
      pool = new PgPool({ connectionString: CONNECTION_STRING });
      await pool.query(`INSERT INTO organizations (id, name) VALUES ($1,'IAA evidence race')`, [
        orgId,
      ]);
      await pool.query(
        `INSERT INTO users (id, organization_id, email, role)
       VALUES ($1,$2,$3,'ADMIN')`,
        [userId, orgId, `${userId}@example.invalid`]
      );
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1,$2,$3,'ADMIN','ACTIVE')`,
        [randomUUID(), orgId, userId]
      );
      await pool.query(
        `INSERT INTO organization_ai_policy (organization_id, policy)
       VALUES ($1,$2::jsonb)`,
        [orgId, JSON.stringify({ interview: { answerApproval: { version: 1, enabled: true, mode: 'manager' } } })]
      );
      const { InterviewController } = await import('../../../controllers/InterviewController.js');
      app = express();
      app.use(express.json());
      app.use((req: express.Request & { user?: unknown }, _res, next) => {
        req.user = { id: userId, organizationId: orgId, role: 'ADMIN' };
        next();
      });
      app.post('/sessions/:sessionId/evidence', (InterviewController as any).createEvidence);
      app.delete('/evidence/:evidenceId', (InterviewController as any).deleteEvidence);
      app.post('/assignments/:id/submit', (InterviewController as any).submitAssignment);
      app.post(
        '/assignments/:id/answer-decisions',
        (InterviewController as any).decideAnswerApprovals
      );
      app.patch('/questions/:questionId', (InterviewController as any).updateQuestion);
    }, 60_000);

    afterAll(async () => {
      if (!pool) return;
      await pool.query(`DELETE FROM interview_assignments WHERE organization_id=$1`, [orgId]);
      await pool.query(`DELETE FROM interview_questions WHERE organization_id=$1`, [orgId]);
      await pool.query(`DELETE FROM interview_sessions WHERE organization_id=$1`, [orgId]);
      await pool.query(`DELETE FROM organization_ai_policy WHERE organization_id=$1`, [orgId]);
      await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [orgId]);
      await pool.query(`DELETE FROM users WHERE organization_id=$1`, [orgId]);
      await pool.query(`DELETE FROM organizations WHERE id=$1`, [orgId]);
      const remaining = await pool.query(
        `SELECT
         (SELECT count(*)::int FROM interview_answer_decision_commands WHERE organization_id=$1) commands,
         (SELECT count(*)::int FROM interview_answer_decisions WHERE organization_id=$1) decisions,
         (SELECT count(*)::int FROM interview_evidence WHERE organization_id=$1) evidence,
         (SELECT count(*)::int FROM interview_assignments WHERE organization_id=$1) assignments,
         (SELECT count(*)::int FROM interview_questions WHERE organization_id=$1) questions,
         (SELECT count(*)::int FROM interview_sessions WHERE organization_id=$1) sessions,
         (SELECT count(*)::int FROM organization_ai_policy WHERE organization_id=$1) policies,
         (SELECT count(*)::int FROM organization_members WHERE organization_id=$1) memberships,
         (SELECT count(*)::int FROM users WHERE organization_id=$1) users,
         (SELECT count(*)::int FROM organizations WHERE id=$1) organizations`,
        [orgId]
      );
      expect(remaining.rows[0]).toEqual({
        commands: 0,
        decisions: 0,
        evidence: 0,
        assignments: 0,
        questions: 0,
        sessions: 0,
        policies: 0,
        memberships: 0,
        users: 0,
        organizations: 0,
      });
      await pool.end();
    });

    it('serializes an evidence create ahead of a manager decision and rejects the governed mutation without a write', async () => {
      const fixture = await createAssignmentFixture('create');
      const submissionId = `submission-create-${tag}`;
      await applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        ...fixture,
        submissionId,
        clientRequestId: `submit-create-${tag}`,
        commandType: 'submit',
        actor: { type: 'human', id: userId },
      });
      await pool.query(`UPDATE interview_assignments SET status='submitted' WHERE id=$1`, [
        fixture.assignmentId,
      ]);
      const revision = await pool.query(`SELECT updated_at FROM interview_questions WHERE id=$1`, [
        fixture.questionId,
      ]);
      const blocker = await lockAssignment(fixture.assignmentId);
      const create = request(app)
        .post(`/sessions/${fixture.sessionId}/evidence`)
        .send({
          questionId: fixture.questionId,
          evidenceType: 'note',
          title: 'Concurrent evidence',
          description: 'Created before the pending decision acquires the answer revision lock.',
          ingestToKnowledge: false,
        })
        .then((response) => response);
      const blockerPid = (blocker as PoolClient & { processID: number }).processID;
      const createPid = await waitForBlockedQuery(blockerPid, 'FROM interview_assignments');
      const decision = applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        ...fixture,
        submissionId,
        clientRequestId: `decide-create-${tag}`,
        commandType: 'decide',
        answers: [
          {
            questionId: fixture.questionId,
            expectedAnswerUpdatedAt: revision.rows[0].updated_at.toISOString(),
          },
        ],
        stage: 'manager',
        decision: 'approved',
        actor: { type: 'human', id: userId },
      });
      let blockerReleased = false;
      try {
        const decisionQuery = await waitForAdditionalBlockedQuery(blockerPid, createPid);
        expect(decisionQuery).toContain('FROM interview_assignments');
        await blocker.query('COMMIT');
        blocker.release();
        blockerReleased = true;
      } finally {
        if (!blockerReleased) {
          await blocker.query('ROLLBACK').catch(() => undefined);
          blocker.release();
        }
      }

      await expect(create).resolves.toMatchObject({
        status: 409,
        body: { code: 'INTERVIEW_ASSIGNMENT_LINK_INVALID' },
      });
      await expect(decision).resolves.toMatchObject({ status: 'applied' });
      const evidenceCount = await pool.query(
        `SELECT count(*)::int count FROM interview_evidence WHERE organization_id=$1 AND session_id=$2`,
        [orgId, fixture.sessionId]
      );
      expect(evidenceCount.rows[0].count).toBe(0);
    });

    it('serializes an evidence delete ahead of a manager decision and rejects the governed mutation without deleting', async () => {
      const fixture = await createAssignmentFixture('delete');
      const created = await request(app).post(`/sessions/${fixture.sessionId}/evidence`).send({
        questionId: fixture.questionId,
        evidenceType: 'note',
        title: 'Evidence to delete',
        description: 'Frozen into the submitted answer digest.',
        ingestToKnowledge: false,
      });
      expect(created.status).toBe(201);
      const evidenceId = String(created.body?.id ?? created.body?.evidence?.id);
      const submissionId = `submission-delete-${tag}`;
      await applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        ...fixture,
        submissionId,
        clientRequestId: `submit-delete-${tag}`,
        commandType: 'submit',
        actor: { type: 'human', id: userId },
      });
      await pool.query(`UPDATE interview_assignments SET status='submitted' WHERE id=$1`, [
        fixture.assignmentId,
      ]);
      const revision = await pool.query(`SELECT updated_at FROM interview_questions WHERE id=$1`, [
        fixture.questionId,
      ]);
      const blocker = await lockAssignment(fixture.assignmentId);
      const remove = request(app)
        .delete(`/evidence/${evidenceId}`)
        .then((response) => response);
      const blockerPid = (blocker as PoolClient & { processID: number }).processID;
      const removePid = await waitForBlockedQuery(blockerPid, 'FROM interview_assignments');
      const decision = applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        ...fixture,
        submissionId,
        clientRequestId: `decide-delete-${tag}`,
        commandType: 'decide',
        answers: [
          {
            questionId: fixture.questionId,
            expectedAnswerUpdatedAt: revision.rows[0].updated_at.toISOString(),
          },
        ],
        stage: 'manager',
        decision: 'approved',
        actor: { type: 'human', id: userId },
      });
      let blockerReleased = false;
      try {
        const decisionQuery = await waitForAdditionalBlockedQuery(blockerPid, removePid);
        expect(decisionQuery).toContain('FROM interview_assignments');
        await blocker.query('COMMIT');
        blocker.release();
        blockerReleased = true;
      } finally {
        if (!blockerReleased) {
          await blocker.query('ROLLBACK').catch(() => undefined);
          blocker.release();
        }
      }

      await expect(remove).resolves.toMatchObject({
        status: 409,
        body: { code: 'INTERVIEW_ASSIGNMENT_LINK_INVALID' },
      });
      await expect(decision).resolves.toMatchObject({ status: 'applied' });
      const evidenceCount = await pool.query(
        `SELECT count(*)::int count FROM interview_evidence WHERE organization_id=$1 AND id=$2`,
        [orgId, evidenceId]
      );
      expect(evidenceCount.rows[0].count).toBe(1);
    });

    it('rejects a material answer PATCH that was queued behind the actual submit transition', async () => {
      const fixture = await createAssignmentFixture('answer-patch');
      const before = await pool.query(
        `SELECT answer_text, updated_at FROM interview_questions WHERE id=$1`,
        [fixture.questionId]
      );
      const blocker = await lockAssignment(fixture.assignmentId);
      const submit = request(app)
        .post(`/assignments/${fixture.assignmentId}/submit`)
        .send({
          submissionId: `submission-answer-patch-${tag}`,
          clientRequestId: `submit-answer-patch-${tag}`,
        })
        .then((response) => response);
      const blockerPid = (blocker as PoolClient & { processID: number }).processID;
      let blockerReleased = false;
      let patchAnswer: Promise<request.Response> | null = null;
      try {
        const submitPid = await Promise.race([
          waitForBlockedQuery(blockerPid, 'FROM interview_assignments'),
          submit.then((response) => {
            throw new Error(
              `Submit settled before acquiring the assignment lock: ${response.status} ${JSON.stringify(response.body)}`
            );
          }),
        ]);
        patchAnswer = request(app)
          .patch(`/questions/${fixture.questionId}`)
          .send({
            answerText: 'A late answer that must not overwrite the submitted receipt',
            status: 'answered',
            expectedUpdatedAt: before.rows[0].updated_at.toISOString(),
          })
          .then((response) => response);
        const patchWaitQuery = await Promise.race([
          waitForAdditionalBlockedQuery(blockerPid, submitPid),
          patchAnswer.then((response) => {
            throw new Error(
              `PATCH settled before acquiring its assignment lock: ${response.status} ${JSON.stringify(response.body)}`
            );
          }),
        ]);
        expect(patchWaitQuery).toContain('FROM interview_assignments');
        expect(patchWaitQuery).toContain('FOR UPDATE');
        await blocker.query('COMMIT');
        blocker.release();
        blockerReleased = true;
      } finally {
        if (!blockerReleased) {
          await blocker.query('ROLLBACK').catch(() => undefined);
          blocker.release();
        }
      }

      await expect(submit).resolves.toMatchObject({ status: 200 });
      await expect(patchAnswer!).resolves.toMatchObject({
        status: 409,
        body: { code: 'INTERVIEW_SESSION_LOCKED' },
      });
      const after = await pool.query(
        `SELECT q.answer_text, q.updated_at, s.status session_status, a.status assignment_status
       FROM interview_questions q
       JOIN interview_sessions s ON s.id=q.session_id
       JOIN interview_assignments a ON a.session_id=s.id
       WHERE q.id=$1`,
        [fixture.questionId]
      );
      expect(after.rows[0]).toMatchObject({
        answer_text: before.rows[0].answer_text,
        session_status: 'submitted',
        assignment_status: 'submitted',
      });
      expect(after.rows[0].updated_at.toISOString()).toBe(before.rows[0].updated_at.toISOString());
    });

    it('serializes a manager decision ahead of an answer edit without deadlock', async () => {
      const fixture = await createAssignmentFixture('manager-answer-race');
      const submissionId = `submission-manager-answer-race-${tag}`;
      await applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        ...fixture,
        submissionId,
        clientRequestId: `submit-manager-answer-race-${tag}`,
        commandType: 'submit',
        actor: { type: 'human', id: userId },
      });
      await pool.query(`UPDATE interview_assignments SET status='submitted' WHERE id=$1`, [
        fixture.assignmentId,
      ]);
      const revision = await pool.query(`SELECT updated_at FROM interview_questions WHERE id=$1`, [
        fixture.questionId,
      ]);
      const blocker = await lockAssignment(fixture.assignmentId);
      const blockerPid = (blocker as PoolClient & { processID: number }).processID;
      const decision = request(app)
        .post(`/assignments/${fixture.assignmentId}/answer-decisions`)
        .send({
          submissionId,
          clientRequestId: `manager-answer-race-${tag}`,
          decision: 'approved',
          answers: [
            {
              questionId: fixture.questionId,
              expectedAnswerUpdatedAt: revision.rows[0].updated_at.toISOString(),
            },
          ],
        })
        .then((response) => response);
      const decisionPid = await waitForBlockedQuery(blockerPid, 'FROM interview_assignments');
      const answer = request(app)
        .patch(`/questions/${fixture.questionId}`)
        .send({
          answerText: 'This edit must lose to the manager decision',
          status: 'answered',
          expectedUpdatedAt: revision.rows[0].updated_at.toISOString(),
        })
        .then((response) => response);
      let blockerReleased = false;
      try {
        const answerQuery = await waitForAdditionalBlockedQuery(blockerPid, decisionPid);
        expect(answerQuery).toContain('FROM interview_assignments');
        await blocker.query('COMMIT');
        blocker.release();
        blockerReleased = true;
      } finally {
        if (!blockerReleased) {
          await blocker.query('ROLLBACK').catch(() => undefined);
          blocker.release();
        }
      }

      await expect(decision).resolves.toMatchObject({ status: 200 });
      await expect(answer).resolves.toMatchObject({
        status: 409,
        body: { code: 'INTERVIEW_ASSIGNMENT_LINK_INVALID' },
      });
    });

    it('serializes a permitted returned-answer edit ahead of a manager decision without deadlock', async () => {
      const fixture = await createAssignmentFixture('answer-manager-race');
      const submissionId = `submission-answer-manager-race-${tag}`;
      await applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        ...fixture,
        submissionId,
        clientRequestId: `submit-answer-manager-race-${tag}`,
        commandType: 'submit',
        actor: { type: 'human', id: userId },
      });
      await pool.query(`UPDATE interview_assignments SET status='submitted' WHERE id=$1`, [
        fixture.assignmentId,
      ]);
      await pool.query(`UPDATE interview_sessions SET status='submitted' WHERE id=$1`, [
        fixture.sessionId,
      ]);
      const revision = await pool.query(`SELECT updated_at FROM interview_questions WHERE id=$1`, [
        fixture.questionId,
      ]);
      const sentBack = await request(app)
        .post(`/assignments/${fixture.assignmentId}/answer-decisions`)
        .send({
          submissionId,
          clientRequestId: `manager-send-back-before-answer-race-${tag}`,
          decision: 'sent_back',
          reason: 'Revise this answer before another manager decision.',
          answers: [
            {
              questionId: fixture.questionId,
              expectedAnswerUpdatedAt: revision.rows[0].updated_at.toISOString(),
            },
          ],
        });
      expect(sentBack).toMatchObject({ status: 200 });

      const blocker = await lockAssignment(fixture.assignmentId);
      const blockerPid = (blocker as PoolClient & { processID: number }).processID;
      const answer = request(app)
        .patch(`/questions/${fixture.questionId}`)
        .send({
          answerText: 'Corrected answer wins the assignment lock first',
          status: 'answered',
          expectedUpdatedAt: revision.rows[0].updated_at.toISOString(),
        })
        .then((response) => response);
      const answerPid = await waitForBlockedQuery(blockerPid, 'FROM interview_assignments');
      const lateDecisionRequestId = `late-manager-after-answer-race-${tag}`;
      const decision = request(app)
        .post(`/assignments/${fixture.assignmentId}/answer-decisions`)
        .send({
          submissionId,
          clientRequestId: lateDecisionRequestId,
          decision: 'approved',
          answers: [
            {
              questionId: fixture.questionId,
              expectedAnswerUpdatedAt: revision.rows[0].updated_at.toISOString(),
            },
          ],
        })
        .then((response) => response);
      let blockerReleased = false;
      try {
        const decisionQuery = await Promise.race([
          waitForAdditionalBlockedQuery(blockerPid, answerPid),
          decision.then((response) => {
            throw new Error(
              `Manager decision settled before acquiring the assignment lock: ${response.status} ${JSON.stringify(response.body)}`
            );
          }),
        ]);
        expect(decisionQuery).toContain('FROM interview_assignments');
        await blocker.query('COMMIT');
        blocker.release();
        blockerReleased = true;
      } finally {
        if (!blockerReleased) {
          await blocker.query('ROLLBACK').catch(() => undefined);
          blocker.release();
        }
      }

      await expect(answer).resolves.toMatchObject({ status: 200 });
      await expect(decision).resolves.toMatchObject({
        status: 409,
        body: { code: 'ASSIGNMENT_STATE_INVALID' },
      });
      const readback = await pool.query(
        `SELECT
           q.answer_text,
           a.status assignment_status,
           s.status session_status,
           count(*) FILTER (WHERE d.event_type='manager_sent_back')::int sent_back_receipts,
           count(*) FILTER (WHERE d.event_type='manager_approved')::int approved_receipts,
           (SELECT count(*)::int
              FROM interview_answer_decision_commands late_command
             WHERE late_command.organization_id=$1
               AND late_command.assignment_id=$2
               AND late_command.client_request_id=$3) late_commands
         FROM interview_questions q
         JOIN interview_sessions s ON s.id=q.session_id
         JOIN interview_assignments a ON a.id=s.assignment_id
         LEFT JOIN interview_answer_decisions d
           ON d.organization_id=a.organization_id AND d.assignment_id=a.id
         WHERE a.organization_id=$1 AND a.id=$2 AND q.id=$4
         GROUP BY q.answer_text, a.status, s.status`,
        [orgId, fixture.assignmentId, lateDecisionRequestId, fixture.questionId]
      );
      expect(readback.rows[0]).toEqual({
        answer_text: 'Corrected answer wins the assignment lock first',
        assignment_status: 'sent_back',
        session_status: 'active',
        sent_back_receipts: 1,
        approved_receipts: 0,
        late_commands: 0,
      });
    });

    it('serializes a manager decision ahead of evidence creation without deadlock', async () => {
      const fixture = await createAssignmentFixture('manager-evidence-race');
      const submissionId = `submission-manager-evidence-race-${tag}`;
      await applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        ...fixture,
        submissionId,
        clientRequestId: `submit-manager-evidence-race-${tag}`,
        commandType: 'submit',
        actor: { type: 'human', id: userId },
      });
      await pool.query(`UPDATE interview_assignments SET status='submitted' WHERE id=$1`, [
        fixture.assignmentId,
      ]);
      const revision = await pool.query(`SELECT updated_at FROM interview_questions WHERE id=$1`, [
        fixture.questionId,
      ]);
      const blocker = await lockAssignment(fixture.assignmentId);
      const blockerPid = (blocker as PoolClient & { processID: number }).processID;
      const decision = request(app)
        .post(`/assignments/${fixture.assignmentId}/answer-decisions`)
        .send({
          submissionId,
          clientRequestId: `manager-evidence-race-${tag}`,
          decision: 'approved',
          answers: [
            {
              questionId: fixture.questionId,
              expectedAnswerUpdatedAt: revision.rows[0].updated_at.toISOString(),
            },
          ],
        })
        .then((response) => response);
      const decisionPid = await waitForBlockedQuery(blockerPid, 'FROM interview_assignments');
      const evidence = request(app)
        .post(`/sessions/${fixture.sessionId}/evidence`)
        .send({
          questionId: fixture.questionId,
          evidenceType: 'note',
          title: 'This evidence must lose to the manager decision',
          ingestToKnowledge: false,
        })
        .then((response) => response);
      let blockerReleased = false;
      try {
        const evidenceQuery = await Promise.race([
          waitForAdditionalBlockedQuery(blockerPid, decisionPid),
          evidence.then((response) => {
            throw new Error(
              `Evidence settled before acquiring the assignment lock: ${response.status} ${JSON.stringify(response.body)}`
            );
          }),
        ]);
        expect(evidenceQuery).toContain('FROM interview_assignments');
        await blocker.query('COMMIT');
        blocker.release();
        blockerReleased = true;
      } finally {
        if (!blockerReleased) {
          await blocker.query('ROLLBACK').catch(() => undefined);
          blocker.release();
        }
      }

      await expect(decision).resolves.toMatchObject({ status: 200 });
      await expect(evidence).resolves.toMatchObject({ status: 409 });
      const evidenceCount = await pool.query(
        `SELECT count(*)::int count FROM interview_evidence WHERE organization_id=$1 AND session_id=$2`,
        [orgId, fixture.sessionId]
      );
      expect(evidenceCount.rows[0].count).toBe(0);
    });

    it('rolls back all AI decision receipts and exposes none when the later lifecycle transition fails', async () => {
      const fixture = await createAssignmentFixture('ai-rollback');
      const secondQuestionId = `iaa-evidence-question-ai-rollback-second-${tag}`;
      const otherOrgId = `iaa-evidence-org-ai-rollback-${tag}`;
      await pool.query(`INSERT INTO organizations (id, name) VALUES ($1,'IAA AI rollback')`, [
        otherOrgId,
      ]);
      await pool.query(
        `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, answer_text,
          status, is_required, answer_type, answer_mode, answer_payload)
         VALUES ($1,$2,$3,'strategy','Second rollback question','Thin answer',
                 'answered',1,'open','text','{}'::jsonb)`,
        [secondQuestionId, fixture.sessionId, orgId]
      );
      await pool.query(
        `UPDATE organization_ai_policy
         SET policy=$2::jsonb
         WHERE organization_id=$1`,
        [orgId, JSON.stringify({ interview: { answerApproval: { version: 1, enabled: true, mode: 'ai' } } })]
      );
      const rubric = (score: number) =>
        ['concreteness', 'evidence', 'depth', 'measurability', 'coherence'].map((criterion) => ({
          criterion,
          score,
          justification: `${criterion} evidence`,
        }));
      mockLlmCall.mockImplementationOnce(async () => {
        await pool.query(`UPDATE interview_sessions SET organization_id=$1 WHERE id=$2`, [
          otherOrgId,
          fixture.sessionId,
        ]);
        return {
          object: {
            recommendations: [],
            questionEvaluations: [
              {
                questionId: fixture.questionId,
                rubric: rubric(4),
                feedback: 'Sufficient.',
              },
              {
                questionId: secondQuestionId,
                rubric: rubric(1),
                feedback: 'Revise this answer.',
              },
            ],
          },
        };
      });

      let response: request.Response;
      try {
        response = await request(app)
          .post(`/assignments/${fixture.assignmentId}/submit`)
          .send({
            submissionId: `submission-ai-rollback-${tag}`,
            clientRequestId: `submit-ai-rollback-${tag}`,
          });
      } finally {
        await pool.query(`UPDATE interview_sessions SET organization_id=$1 WHERE id=$2`, [
          orgId,
          fixture.sessionId,
        ]);
        await pool.query(
          `UPDATE organization_ai_policy
           SET policy=$2::jsonb
           WHERE organization_id=$1`,
          [
            orgId,
            JSON.stringify({ interview: { answerApproval: { version: 1, enabled: true, mode: 'manager' } } }),
          ]
        );
        await pool.query(`DELETE FROM organizations WHERE id=$1`, [otherOrgId]);
      }

      expect(response!).toMatchObject({
        status: 200,
        body: {
          aiReview: null,
          aiAnswerApproval: [],
          assignment: { status: 'submitted' },
        },
      });
      const persisted = await pool.query(
        `SELECT
           a.status assignment_status,
           a.ai_review_snapshot_json,
           s.status session_status,
           count(*) FILTER (WHERE d.event_type IN ('ai_approved','ai_sent_back'))::int ai_receipts
         FROM interview_assignments a
         JOIN interview_sessions s ON s.id=a.session_id
         LEFT JOIN interview_answer_decisions d
           ON d.organization_id=a.organization_id AND d.assignment_id=a.id
         WHERE a.organization_id=$1 AND a.id=$2
         GROUP BY a.status, a.ai_review_snapshot_json, s.status`,
        [orgId, fixture.assignmentId]
      );
      expect(persisted.rows[0]).toEqual({
        assignment_status: 'submitted',
        ai_review_snapshot_json: null,
        session_status: 'submitted',
        ai_receipts: 0,
      });
    });

    it('blocks answer and evidence mutation for an approved sibling in a reopened review cycle', async () => {
      const fixture = await createAssignmentFixture('approved-sibling');
      const returnedQuestionId = `iaa-evidence-question-returned-${tag}`;
      await pool.query(
        `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, answer_text,
          status, is_required, answer_type, answer_mode, answer_payload)
       VALUES ($1,$2,$3,'strategy','Returned question','Returned answer','answered',1,'open','text','{}'::jsonb)`,
        [returnedQuestionId, fixture.sessionId, orgId]
      );
      const submissionId = `submission-approved-sibling-${tag}`;
      const submitted = await applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        ...fixture,
        submissionId,
        clientRequestId: `submit-approved-sibling-${tag}`,
        commandType: 'submit',
        actor: { type: 'human', id: userId },
      });
      await pool.query(`UPDATE interview_assignments SET status='submitted' WHERE id=$1`, [
        fixture.assignmentId,
      ]);
      await pool.query(`UPDATE interview_sessions SET status='submitted' WHERE id=$1`, [
        fixture.sessionId,
      ]);
      const revisionByQuestion = new Map(
        submitted.decisions.map((decision) => [decision.questionId, decision.answerUpdatedAt])
      );
      await applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        ...fixture,
        submissionId,
        clientRequestId: `approve-sibling-${tag}`,
        commandType: 'decide',
        answers: [
          {
            questionId: fixture.questionId,
            expectedAnswerUpdatedAt: revisionByQuestion.get(fixture.questionId)!,
          },
        ],
        stage: 'manager',
        decision: 'approved',
        actor: { type: 'human', id: userId },
      });
      await applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        ...fixture,
        submissionId,
        clientRequestId: `return-sibling-${tag}`,
        commandType: 'decide',
        answers: [
          {
            questionId: returnedQuestionId,
            expectedAnswerUpdatedAt: revisionByQuestion.get(returnedQuestionId)!,
          },
        ],
        stage: 'manager',
        decision: 'sent_back',
        reason: 'Revise this answer',
        actor: { type: 'human', id: userId },
      });
      await pool.query(`UPDATE interview_assignments SET status='sent_back' WHERE id=$1`, [
        fixture.assignmentId,
      ]);
      await pool.query(`UPDATE interview_sessions SET status='active' WHERE id=$1`, [
        fixture.sessionId,
      ]);

      const patchAnswer = await request(app)
        .patch(`/questions/${fixture.questionId}`)
        .send({
          answerText: 'Mutation must be refused',
          status: 'answered',
          expectedUpdatedAt: revisionByQuestion.get(fixture.questionId),
        });
      const createEvidence = await request(app)
        .post(`/sessions/${fixture.sessionId}/evidence`)
        .send({
          questionId: fixture.questionId,
          evidenceType: 'note',
          title: 'Mutation must be refused',
          ingestToKnowledge: false,
        });

      expect(patchAnswer).toMatchObject({
        status: 409,
        body: { code: 'INTERVIEW_ANSWER_REVISION_NOT_RETURNED' },
      });
      expect(createEvidence).toMatchObject({
        status: 409,
        body: { code: 'INTERVIEW_ANSWER_REVISION_NOT_RETURNED' },
      });
      const unchanged = await pool.query(
        `SELECT answer_text FROM interview_questions WHERE id=$1`,
        [fixture.questionId]
      );
      expect(unchanged.rows[0].answer_text).toBe('Answer approved-sibling');
      const evidence = await pool.query(
        `SELECT count(*)::int count FROM interview_evidence
       WHERE organization_id=$1 AND question_id=$2`,
        [orgId, fixture.questionId]
      );
      expect(evidence.rows[0].count).toBe(0);
    });

    it('fails closed for governed null, broken reverse and multi-assignment session links', async () => {
      const submitGoverned = async (label: string) => {
        const fixture = await createAssignmentFixture(label);
        await applyInterviewAnswerDecisionCommand({
          organizationId: orgId,
          ...fixture,
          submissionId: `submission-${label}-${tag}`,
          clientRequestId: `submit-${label}-${tag}`,
          commandType: 'submit',
          actor: { type: 'human', id: userId },
        });
        await pool.query(`UPDATE interview_assignments SET status='sent_back' WHERE id=$1`, [
          fixture.assignmentId,
        ]);
        await pool.query(`UPDATE interview_sessions SET status='active' WHERE id=$1`, [
          fixture.sessionId,
        ]);
        return fixture;
      };
      const expectLinkRefusal = async (fixture: Awaited<ReturnType<typeof submitGoverned>>) => {
        const before = await pool.query(
          `SELECT answer_text, updated_at FROM interview_questions WHERE id=$1`,
          [fixture.questionId]
        );
        const response = await request(app).patch(`/questions/${fixture.questionId}`).send({
          answerText: 'This ambiguous revision must not persist',
          status: 'answered',
          expectedUpdatedAt: before.rows[0].updated_at.toISOString(),
        });
        expect(response).toMatchObject({
          status: 409,
          body: { code: 'INTERVIEW_ASSIGNMENT_LINK_INVALID' },
        });
        const after = await pool.query(
          `SELECT answer_text, updated_at FROM interview_questions WHERE id=$1`,
          [fixture.questionId]
        );
        expect(after.rows[0].answer_text).toBe(before.rows[0].answer_text);
        expect(after.rows[0].updated_at.toISOString()).toBe(
          before.rows[0].updated_at.toISOString()
        );
      };

      const nullLink = await submitGoverned('null-link');
      await pool.query(`UPDATE interview_sessions SET assignment_id=NULL WHERE id=$1`, [
        nullLink.sessionId,
      ]);
      await expectLinkRefusal(nullLink);

      const brokenReverse = await submitGoverned('broken-reverse');
      const unrelatedSessionId = `iaa-evidence-session-unrelated-${tag}`;
      await pool.query(
        `INSERT INTO interview_sessions (id, organization_id, name, owner_id, status)
         VALUES ($1,$2,'Unrelated assignment target',$3,'active')`,
        [unrelatedSessionId, orgId, userId]
      );
      await pool.query(`UPDATE interview_assignments SET session_id=$1 WHERE id=$2`, [
        unrelatedSessionId,
        brokenReverse.assignmentId,
      ]);
      await expectLinkRefusal(brokenReverse);

      const multi = await submitGoverned('multi-link');
      const siblingAssignmentId = `iaa-evidence-assignment-multi-sibling-${tag}`;
      await pool.query(
        `INSERT INTO interview_assignments
         (id, organization_id, assignee_user_id, template_id, template_version, status, session_id)
         VALUES ($1,$2,$3,'template-evidence',1,'in_progress',$4)`,
        [siblingAssignmentId, orgId, userId, multi.sessionId]
      );
      await applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        assignmentId: siblingAssignmentId,
        sessionId: multi.sessionId,
        submissionId: `submission-multi-sibling-${tag}`,
        clientRequestId: `submit-multi-sibling-${tag}`,
        commandType: 'submit',
        actor: { type: 'human', id: userId },
      });
      await pool.query(`UPDATE interview_assignments SET status='sent_back' WHERE id=$1`, [
        siblingAssignmentId,
      ]);
      await expectLinkRefusal(multi);
    });
  }
);
