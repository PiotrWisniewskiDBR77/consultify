import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  applyInterviewAnswerDecisionCommand,
  InterviewAnswerDecisionCommandError,
  readInterviewAnswerApprovalProjection,
} from '../interviewAnswerDecisionService.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)('Interview answer decisions — real PostgreSQL', () => {
  let pool: Pool;
  const tag = randomUUID();
  const orgId = `iaa-org-${tag}`;
  const userId = `iaa-user-${tag}`;
  const sessionId = `iaa-session-${tag}`;
  const assignmentId = `iaa-assignment-${tag}`;
  const questionA = `iaa-question-a-${tag}`;
  const questionB = `iaa-question-b-${tag}`;
  const optionalQuestion = `iaa-question-optional-${tag}`;
  const submissionId = `iaa-submission-${tag}`;

  beforeAll(async () => {
    const { Pool: PgPool } = await import('pg');
    pool = new PgPool({ connectionString: CONNECTION_STRING });
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, 'IAA realpg')`, [orgId]);
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role)
       VALUES ($1, $2, $3, 'MEMBER')`,
      [userId, orgId, `${userId}@example.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_ai_policy (organization_id, policy)
       VALUES ($1, $2::jsonb)`,
      [orgId, JSON.stringify({ interview: { answerApproval: { version: 1, mode: 'two_stage' } } })]
    );
    await pool.query(
      `INSERT INTO interview_sessions (id, organization_id, name, owner_id, status)
       VALUES ($1, $2, 'IAA session', $3, 'in_progress')`,
      [sessionId, orgId, userId]
    );
    await pool.query(
      `INSERT INTO interview_assignments
         (id, organization_id, assignee_user_id, template_id, template_version, status, session_id)
       VALUES ($1, $2, $3, 'template-realpg', 3, 'in_progress', $4)`,
      [assignmentId, orgId, userId, sessionId]
    );
    for (const [id, text, required, status] of [
      [questionA, 'Alpha', 1, 'answered'],
      [questionB, 'Beta', 1, 'answered'],
      [optionalQuestion, '', 0, 'not_started'],
    ] as const) {
      await pool.query(
        `INSERT INTO interview_questions
           (id, session_id, organization_id, category, question_text, answer_text,
            status, is_required, answer_type, answer_mode, answer_payload)
         VALUES ($1, $2, $3, 'strategy', $4, $5, $6, $7, 'open', 'text', $8)`,
        [id, sessionId, orgId, `Question ${id}`, text, status, required, JSON.stringify({ text })]
      );
    }
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM interview_assignments WHERE organization_id = $1`, [orgId]);
    await pool.query(`DELETE FROM interview_questions WHERE organization_id = $1`, [orgId]);
    await pool.query(`DELETE FROM interview_sessions WHERE organization_id = $1`, [orgId]);
    await pool.query(`DELETE FROM organization_ai_policy WHERE organization_id = $1`, [orgId]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    const remaining = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM interview_answer_decision_commands WHERE organization_id=$1) commands,
         (SELECT count(*)::int FROM interview_answer_decisions WHERE organization_id=$1) decisions,
         (SELECT count(*)::int FROM interview_assignments WHERE organization_id=$1) assignments,
         (SELECT count(*)::int FROM interview_sessions WHERE organization_id=$1) sessions,
         (SELECT count(*)::int FROM interview_questions WHERE organization_id=$1) questions`,
      [orgId]
    );
    expect(remaining.rows[0]).toEqual({
      commands: 0,
      decisions: 0,
      assignments: 0,
      sessions: 0,
      questions: 0,
    });
    await pool.end();
  });

  it('submits the exact server denominator, cold-replays it and omits optional unanswered questions', async () => {
    const input = {
      organizationId: orgId,
      assignmentId,
      sessionId,
      submissionId,
      clientRequestId: `iaa-submit-request-${tag}`,
      commandType: 'submit' as const,
      actor: { type: 'human' as const, id: userId },
    };
    const first = await applyInterviewAnswerDecisionCommand(input);
    expect(first.decisions.map(({ questionId }) => questionId)).toEqual([questionA, questionB]);

    const { Pool: FreshPool } = await import('pg');
    const coldPool = new FreshPool({ connectionString: CONNECTION_STRING });
    try {
      const persisted = await coldPool.query(
        `SELECT expected_answer_count, response_json
         FROM interview_answer_decision_commands
         WHERE organization_id=$1 AND client_request_id=$2`,
        [orgId, input.clientRequestId]
      );
      expect(persisted.rows[0].expected_answer_count).toBe(2);
      expect(persisted.rows[0].response_json.decisions).toHaveLength(2);
    } finally {
      await coldPool.end();
    }
    await expect(applyInterviewAnswerDecisionCommand(input)).resolves.toEqual({
      ...first,
      idempotentReplay: true,
    });
    await pool.query(`UPDATE interview_assignments SET status='submitted' WHERE id=$1`, [
      assignmentId,
    ]);
  });

  it('uses frozen policy per answer and keeps one question decision isolated from the other', async () => {
    await pool.query(
      `UPDATE organization_ai_policy
       SET policy=$2::jsonb WHERE organization_id=$1`,
      [orgId, JSON.stringify({ interview: { answerApproval: { version: 1, mode: 'manager' } } })]
    );
    const revision = await pool.query(
      `SELECT id, updated_at FROM interview_questions WHERE id IN ($1,$2) ORDER BY id`,
      [questionA, questionB]
    );
    const first = revision.rows[0];
    await applyInterviewAnswerDecisionCommand({
      organizationId: orgId,
      assignmentId,
      sessionId,
      submissionId,
      clientRequestId: `iaa-ai-request-${tag}`,
      commandType: 'decide',
      answers: [{ questionId: first.id, expectedAnswerUpdatedAt: first.updated_at.toISOString() }],
      stage: 'ai',
      decision: 'approved',
      actor: { type: 'ai', id: `model-run-${tag}` },
      metadata: {
        modelId: 'test-model',
        providerId: 'test-provider',
        promptVersion: 'p1',
        score: 0.8,
      },
    });
    const projection = await readInterviewAnswerApprovalProjection({
      organizationId: orgId,
      assignmentId,
    });
    expect(projection.find((row) => row.questionId === first.id)).toMatchObject({
      policyMode: 'two_stage',
      status: 'pending',
      nextStage: 'manager',
    });
    expect(projection.find((row) => row.questionId !== first.id)).toMatchObject({
      policyMode: 'two_stage',
      status: 'pending',
      nextStage: 'ai',
    });
  });

  it('rejects actor-stage mismatches without appending a parent command or receipt', async () => {
    const before = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM interview_answer_decision_commands WHERE organization_id=$1) commands,
         (SELECT count(*)::int FROM interview_answer_decisions WHERE organization_id=$1) decisions`,
      [orgId]
    );
    const revisions = await pool.query(
      `SELECT id, updated_at FROM interview_questions WHERE id IN ($1,$2) ORDER BY id`,
      [questionA, questionB]
    );
    await expect(
      applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        assignmentId,
        sessionId,
        submissionId,
        clientRequestId: `iaa-manager-ai-actor-${tag}`,
        commandType: 'decide',
        answers: [
          {
            questionId: revisions.rows[0].id,
            expectedAnswerUpdatedAt: revisions.rows[0].updated_at.toISOString(),
          },
        ],
        stage: 'manager',
        decision: 'approved',
        actor: { type: 'ai', id: `model-run-${tag}` },
      })
    ).rejects.toMatchObject({ code: 'COMMAND_INVALID' });
    await expect(
      applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        assignmentId,
        sessionId,
        submissionId,
        clientRequestId: `iaa-ai-no-provenance-${tag}`,
        commandType: 'decide',
        answers: [
          {
            questionId: revisions.rows[1].id,
            expectedAnswerUpdatedAt: revisions.rows[1].updated_at.toISOString(),
          },
        ],
        stage: 'ai',
        decision: 'approved',
        actor: { type: 'ai', id: `model-run-${tag}` },
      })
    ).rejects.toMatchObject({ code: 'COMMAND_INVALID' });
    const after = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM interview_answer_decision_commands WHERE organization_id=$1) commands,
         (SELECT count(*)::int FROM interview_answer_decisions WHERE organization_id=$1) decisions`,
      [orgId]
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('resubmits only the changed returned answer and preserves the completed sibling projection', async () => {
    const revisions = await pool.query(
      `SELECT id, updated_at FROM interview_questions WHERE id IN ($1,$2) ORDER BY id`,
      [questionA, questionB]
    );
    await applyInterviewAnswerDecisionCommand({
      organizationId: orgId,
      assignmentId,
      sessionId,
      submissionId,
      clientRequestId: `iaa-manager-approve-a-${tag}`,
      commandType: 'decide',
      answers: [
        {
          questionId: revisions.rows[0].id,
          expectedAnswerUpdatedAt: revisions.rows[0].updated_at.toISOString(),
        },
      ],
      stage: 'manager',
      decision: 'approved',
      actor: { type: 'human', id: userId },
    });
    await applyInterviewAnswerDecisionCommand({
      organizationId: orgId,
      assignmentId,
      sessionId,
      submissionId,
      clientRequestId: `iaa-ai-return-b-${tag}`,
      commandType: 'decide',
      answers: [
        {
          questionId: revisions.rows[1].id,
          expectedAnswerUpdatedAt: revisions.rows[1].updated_at.toISOString(),
        },
      ],
      stage: 'ai',
      decision: 'sent_back',
      reason: 'Add evidence',
      actor: { type: 'ai', id: `model-run-${tag}` },
      metadata: {
        modelId: 'test-model',
        modelVersion: '1',
        providerId: 'test-provider',
        promptVersion: 'p1',
      },
    });
    await pool.query(`UPDATE interview_assignments SET status='sent_back' WHERE id=$1`, [
      assignmentId,
    ]);
    await pool.query(
      `UPDATE interview_questions
       SET answer_text='Beta revised with evidence', updated_at=CURRENT_TIMESTAMP
       WHERE id=$1`,
      [questionB]
    );
    const resubmissionId = `iaa-resubmission-${tag}`;
    const resubmission = await applyInterviewAnswerDecisionCommand({
      organizationId: orgId,
      assignmentId,
      sessionId,
      submissionId: resubmissionId,
      clientRequestId: `iaa-resubmit-request-${tag}`,
      commandType: 'submit',
      actor: { type: 'human', id: userId },
    });
    expect(resubmission.decisions.map(({ questionId }) => questionId)).toEqual([questionB]);
    const projection = await readInterviewAnswerApprovalProjection({
      organizationId: orgId,
      assignmentId,
    });
    expect(projection.find((row) => row.questionId === questionA)).toMatchObject({
      submissionId,
      status: 'stages_complete',
    });
    expect(projection.find((row) => row.questionId === questionB)).toMatchObject({
      submissionId: resubmissionId,
      status: 'pending',
      nextStage: 'manager',
    });
    await pool.query(`UPDATE interview_assignments SET status='submitted' WHERE id=$1`, [
      assignmentId,
    ]);
  });

  it('rolls back a wrong-stage decision without appending a parent command or receipt', async () => {
    const before = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM interview_answer_decision_commands WHERE organization_id=$1) commands,
         (SELECT count(*)::int FROM interview_answer_decisions WHERE organization_id=$1) decisions`,
      [orgId]
    );
    const revision = await pool.query(`SELECT updated_at FROM interview_questions WHERE id=$1`, [
      questionA,
    ]);
    await expect(
      applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        assignmentId,
        sessionId,
        submissionId,
        clientRequestId: `iaa-invalid-stage-${tag}`,
        commandType: 'decide',
        answers: [
          {
            questionId: questionA,
            expectedAnswerUpdatedAt: revision.rows[0].updated_at.toISOString(),
          },
        ],
        stage: 'manager',
        decision: 'approved',
        actor: { type: 'human', id: userId },
      })
    ).rejects.toMatchObject({ code: 'STAGE_ORDER_INVALID' });
    const after = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM interview_answer_decision_commands WHERE organization_id=$1) commands,
         (SELECT count(*)::int FROM interview_answer_decisions WHERE organization_id=$1) decisions`,
      [orgId]
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('maps one concurrent client key across different assignment locks and cascades permanent delete', async () => {
    const session2 = `iaa-session-race-${tag}`;
    const assignment2 = `iaa-assignment-race-${tag}`;
    const question2 = `iaa-question-race-${tag}`;
    await pool.query(
      `INSERT INTO interview_sessions (id, organization_id, name, owner_id, status)
       VALUES ($1,$2,'Race session',$3,'in_progress')`,
      [session2, orgId, userId]
    );
    await pool.query(
      `INSERT INTO interview_assignments
         (id, organization_id, assignee_user_id, template_id, template_version, status, session_id)
       VALUES ($1,$2,$3,'template-realpg',3,'in_progress',$4)`,
      [assignment2, orgId, userId, session2]
    );
    await pool.query(
      `INSERT INTO interview_questions
         (id, session_id, organization_id, category, question_text, answer_text, status, is_required)
       VALUES ($1,$2,$3,'strategy','Race question','Race answer','answered',1)`,
      [question2, session2, orgId]
    );
    await pool.query(`UPDATE interview_assignments SET status='in_progress' WHERE id=$1`, [
      assignmentId,
    ]);
    const sharedRequest = `iaa-shared-request-${tag}`;
    const outcomes = await Promise.allSettled([
      applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        assignmentId,
        sessionId,
        submissionId: `iaa-race-a-${tag}`,
        clientRequestId: sharedRequest,
        commandType: 'submit',
        actor: { type: 'human', id: userId },
      }),
      applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        assignmentId: assignment2,
        sessionId: session2,
        submissionId: `iaa-race-b-${tag}`,
        clientRequestId: sharedRequest,
        commandType: 'submit',
        actor: { type: 'human', id: userId },
      }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const loser = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(loser).toMatchObject({
      reason: expect.objectContaining({
        code: 'IDEMPOTENCY_CONFLICT',
      }) as InterviewAnswerDecisionCommandError,
    });

    await pool.query(`DELETE FROM interview_assignments WHERE id=$1`, [assignment2]);
    const deleted = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM interview_answer_decision_commands WHERE assignment_id=$1) commands,
         (SELECT count(*)::int FROM interview_answer_decisions WHERE assignment_id=$1) decisions`,
      [assignment2]
    );
    expect(deleted.rows[0]).toEqual({ commands: 0, decisions: 0 });
    await pool.query(`DELETE FROM interview_questions WHERE id=$1`, [question2]);
    await pool.query(`DELETE FROM interview_sessions WHERE id=$1`, [session2]);
  });
});
