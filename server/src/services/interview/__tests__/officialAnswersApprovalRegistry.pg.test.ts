import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  applyInterviewAnswerDecisionCommand,
  readInterviewAnswerApprovalProjection,
} from '../interviewAnswerDecisionService.js';

/**
 * IS-3b v2 (Wpis 122/123 pkt 2, DEC-510/U-08) — „OFFICIAL ANSWERS" = rejestr
 * zatwierdzeń, NIE liczba odpowiedzi.
 *
 * Test na REALNYM PostgreSQL dowodzi, że projekcja rejestru
 * (`readInterviewAnswerApprovalProjection`) rozjeżdża się z licznikiem odpowiedzi
 * `interview_questions.status='answered'`: sesja z 8 odpowiedzianymi pytaniami,
 * 6 zatwierdzonymi i 2 `sent_back` daje 6 — dokładnie warunek CTO „6 zatwierdzonych
 * i 8 odpowiedzi → 6". Frontowy licznik musi czytać rejestr (latestDecision),
 * a nie `includedAnswerCount` (odpowiedziane=8), inaczej zawyża o 2.
 *
 * SEMANTYKA (zmierzona, `interviewAnswerDecisionService.ts:1046-1077`): oficjalna
 * = `latestDecision === 'approved'` (ai_approved LUB manager_approved, bez
 * późniejszego sent_back); `sent_back` i `pending` (null) NIE liczą się.
 */
const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

const ANSWERED_TOTAL = 8;
const APPROVED_TOTAL = 6;

describe.skipIf(!REAL_DB)('Official answers = approval registry (real PostgreSQL)', () => {
  let pool: Pool;
  const tag = randomUUID();
  const orgId = `oa-org-${tag}`;
  const userId = `oa-user-${tag}`;
  const sessionId = `oa-session-${tag}`;
  const assignmentId = `oa-assignment-${tag}`;
  const submissionId = `oa-submission-${tag}`;
  const questionIds = Array.from(
    { length: ANSWERED_TOTAL },
    (_, index) => `oa-question-${index}-${tag}`
  );

  beforeAll(async () => {
    process.env.ENABLE_INTERVIEW_ANSWER_APPROVAL = 'true';
    const { Pool: PgPool } = await import('pg');
    pool = new PgPool({ connectionString: CONNECTION_STRING });
    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, 'OA realpg')`, [orgId]);
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role)
       VALUES ($1, $2, $3, 'MEMBER')`,
      [userId, orgId, `${userId}@example.invalid`]
    );
    // Jednoetapowa polityka AI: pojedyncza decyzja `ai` domyka etap, więc
    // `latestDecision` od razu odbija zatwierdzenie / odesłanie.
    await pool.query(
      `INSERT INTO organization_ai_policy (organization_id, policy)
       VALUES ($1, $2::jsonb)`,
      [
        orgId,
        JSON.stringify({
          interview: { answerApproval: { version: 1, enabled: true, mode: 'ai' } },
        }),
      ]
    );
    await pool.query(
      `INSERT INTO interview_sessions (id, organization_id, name, owner_id, status)
       VALUES ($1, $2, 'OA session', $3, 'in_progress')`,
      [sessionId, orgId, userId]
    );
    await pool.query(
      `INSERT INTO interview_assignments
         (id, organization_id, assignee_user_id, template_id, template_version, status, session_id)
       VALUES ($1, $2, $3, 'template-oa', 1, 'in_progress', $4)`,
      [assignmentId, orgId, userId, sessionId]
    );
    for (const [index, id] of questionIds.entries()) {
      await pool.query(
        `INSERT INTO interview_questions
           (id, session_id, organization_id, category, question_text, answer_text,
            status, is_required, answer_type, answer_mode, answer_payload)
         VALUES ($1, $2, $3, 'strategy', $4, $5, 'answered', 1, 'open', 'text', $6)`,
        [id, sessionId, orgId, `Question ${index}`, `Answer ${index}`, JSON.stringify({ text: `Answer ${index}` })]
      );
    }
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM interview_answer_decisions WHERE organization_id = $1`, [orgId]);
    await pool.query(`DELETE FROM interview_answer_decision_commands WHERE organization_id = $1`, [
      orgId,
    ]);
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

  it('counts 6 approved of 8 answered — the registry diverges from the answered count', async () => {
    // 1. Submit zamraża mianownik: wszystkie 8 wymagających/odpowiedzianych pytań.
    const submit = await applyInterviewAnswerDecisionCommand({
      organizationId: orgId,
      assignmentId,
      sessionId,
      submissionId,
      clientRequestId: `oa-submit-${tag}`,
      commandType: 'submit',
      actor: { type: 'human', id: userId },
    });
    expect(submit.decisions.map(({ questionId }) => questionId).sort()).toEqual(
      [...questionIds].sort()
    );

    // Decide wymaga stanu `submitted`.
    await pool.query(`UPDATE interview_assignments SET status='submitted' WHERE id=$1`, [
      assignmentId,
    ]);

    const revisions = await pool.query(
      `SELECT id, updated_at FROM interview_questions WHERE session_id=$1 ORDER BY id`,
      [sessionId]
    );
    const revisionById = new Map(
      revisions.rows.map((row) => [row.id, row.updated_at.toISOString()] as const)
    );

    // 2. Sześć zatwierdzeń AI + dwa odesłania AI (per pytanie, z proweniencją modelu).
    for (const [index, questionId] of questionIds.entries()) {
      const decision = index < APPROVED_TOTAL ? 'approved' : 'sent_back';
      await applyInterviewAnswerDecisionCommand({
        organizationId: orgId,
        assignmentId,
        sessionId,
        submissionId,
        clientRequestId: `oa-decide-${index}-${tag}`,
        commandType: 'decide',
        answers: [
          { questionId, expectedAnswerUpdatedAt: revisionById.get(questionId) as string },
        ],
        stage: 'ai',
        decision,
        reason: decision === 'sent_back' ? 'Add evidence' : null,
        actor: { type: 'ai', id: `model-run-${tag}` },
        metadata: {
          modelId: 'test-model',
          providerId: 'test-provider',
          promptVersion: 'p1',
          score: decision === 'approved' ? 0.9 : 0.2,
        },
      });
    }

    // 3. Rejestr: dokładnie 6 `latestDecision === 'approved'`, 2 `sent_back`.
    const projection = await readInterviewAnswerApprovalProjection({
      organizationId: orgId,
      assignmentId,
    });
    expect(projection).toHaveLength(ANSWERED_TOTAL);
    const approvedCount = projection.filter((row) => row.latestDecision === 'approved').length;
    const sentBackCount = projection.filter((row) => row.latestDecision === 'sent_back').length;
    expect(approvedCount).toBe(APPROVED_TOTAL);
    expect(sentBackCount).toBe(ANSWERED_TOTAL - APPROVED_TOTAL);

    // 4. Rozdźwięk z licznikiem odpowiedzi: `answered` dalej = 8 (sent_back NIE
    //    zmienia interview_questions.status). Czytanie `includedAnswerCount`
    //    (odpowiedziane) dałoby 8 — mutacja „wróć do includedAnswerCount" → RED.
    const answered = await pool.query(
      `SELECT count(*)::int AS answered FROM interview_questions
       WHERE session_id=$1 AND status='answered'`,
      [sessionId]
    );
    expect(answered.rows[0].answered).toBe(ANSWERED_TOTAL);
    expect(answered.rows[0].answered).not.toBe(approvedCount);
  });
});
