import { beforeEach, describe, expect, it, vi } from 'vitest';

type DecisionRow = {
  id: string;
  assignment_id: string;
  question_id: string;
  submission_id: string;
  answer_updated_at: unknown;
  answer_digest: string;
  ordinal: number;
  event_type: string;
  stage: 'ai' | 'manager' | null;
  decision: 'approved' | 'sent_back' | null;
  policy_mode: 'ai' | 'manager' | 'two_stage';
  policy_version: number;
  policy_snapshot_json: unknown;
  assignment_sequence: number;
};

const question = (id: string, minute: number, required = true) => ({
  id,
  session_id: 'session-1',
  question_text: `Question ${id}`,
  answer_type: 'open',
  answer_text: `Answer ${id}`,
  answer_mode: 'text',
  answer_payload: JSON.stringify({ value: `Answer ${id}` }),
  context_note: null,
  voice_transcript: null,
  voice_transcript_status: 'none',
  voice_audio_evidence_id: null,
  answer_knowledge_doc_id: null,
  context_note_knowledge_doc_id: null,
  status: 'answered',
  confidence_score: 80,
  answered_by: 'user-1',
  answered_at: new Date(`2026-09-13T12:0${minute}:00.000Z`),
  updated_at: new Date(`2026-09-13T12:0${minute}:00.000Z`),
  is_required: required ? 1 : 0,
});

const database = vi.hoisted(() => ({
  assignment: {
    id: 'assignment-1',
    session_id: 'session-1',
    status: 'in_progress',
    template_id: 'template-1',
    template_version: 4,
  } as Record<string, unknown> | null,
  policy: {
    interview: { answerApproval: { version: 1, enabled: true, mode: 'manager' } },
  } as unknown,
  questions: [] as Array<Record<string, unknown> & { id: string; updated_at: Date }>,
  evidence: [] as Array<Record<string, unknown> & { id: string; question_id: string }>,
  decisions: [] as DecisionRow[],
  commands: new Map<
    string,
    {
      id: string;
      assignmentId: string;
      assignment_sequence: number;
      request_fingerprint: string;
      response_json: unknown;
    }
  >(),
  commandInsertRace: null as null | 'same' | 'different',
}));

const mocks = vi.hoisted(() => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  queryRun: vi.fn(),
  withPgTransaction: vi.fn(async (callback: () => Promise<unknown>) => callback()),
}));

vi.mock('../../../utils/queryHelpers.js', () => mocks);

import {
  applyInterviewAnswerDecisionCommand,
  type ApplyInterviewAnswerDecisionCommandInput,
  readInterviewAnswerApprovalProjection,
} from '../interviewAnswerDecisionService.js';

const submissionInput = (
  overrides: Partial<ApplyInterviewAnswerDecisionCommandInput> = {}
): ApplyInterviewAnswerDecisionCommandInput =>
  ({
    organizationId: 'org-1',
    assignmentId: 'assignment-1',
    sessionId: 'session-1',
    submissionId: 'submission-1',
    clientRequestId: 'request-submit-1',
    commandType: 'submit',
    actor: { type: 'human', id: 'user-1' },
    ...overrides,
  }) as ApplyInterviewAnswerDecisionCommandInput;

const decisionInput = (
  questionIds: string[],
  overrides: Partial<ApplyInterviewAnswerDecisionCommandInput> = {}
): ApplyInterviewAnswerDecisionCommandInput =>
  ({
    organizationId: 'org-1',
    assignmentId: 'assignment-1',
    sessionId: 'session-1',
    submissionId: 'submission-1',
    clientRequestId: `request-decide-${questionIds.join('-')}`,
    commandType: 'decide',
    answers: questionIds.map((questionId) => {
      const row = database.questions.find((candidate) => candidate.id === questionId);
      return {
        questionId,
        expectedAnswerUpdatedAt: row?.updated_at.toISOString() ?? '',
      };
    }),
    stage: 'manager',
    decision: 'approved',
    actor: { type: 'human', id: 'manager-1' },
    ...overrides,
  }) as ApplyInterviewAnswerDecisionCommandInput;

async function submit(policyMode: 'ai' | 'manager' | 'two_stage' = 'manager') {
  database.policy = {
    interview: { answerApproval: { version: 1, enabled: true, mode: policyMode } },
  };
  const response = await applyInterviewAnswerDecisionCommand(submissionInput());
  if (database.assignment) database.assignment.status = 'submitted';
  return response;
}

describe('Interview answer decision service', () => {
  beforeEach(() => {
    process.env.ENABLE_INTERVIEW_ANSWER_APPROVAL = 'true';
    database.assignment = {
      id: 'assignment-1',
      session_id: 'session-1',
      status: 'in_progress',
      template_id: 'template-1',
      template_version: 4,
    };
    database.policy = {
      interview: { answerApproval: { version: 1, enabled: true, mode: 'manager' } },
    };
    database.questions = [question('question-a', 0), question('question-b', 1)];
    database.evidence = [];
    database.decisions = [];
    database.commands.clear();
    database.commandInsertRace = null;
    mocks.queryOne.mockReset().mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM interview_answer_decision_commands')) {
        if (sql.includes('MAX(assignment_sequence)')) {
          return {
            max_sequence: Math.max(
              0,
              ...[...database.commands.values()]
                .filter((row) => row.assignmentId === params[1])
                .map((row) => row.assignment_sequence)
            ),
          };
        }
        return database.commands.get(`${params[0]}:${params[1]}`) ?? null;
      }
      if (sql.includes('FROM interview_assignments')) return database.assignment;
      if (sql.includes('FROM organization_ai_policy')) return { policy: database.policy };
      throw new Error(`Unexpected queryOne: ${sql}`);
    });
    mocks.queryAll.mockReset().mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM interview_questions')) {
        const requested = params.length > 2 ? new Set(params.slice(2)) : null;
        return database.questions
          .filter((row) =>
            requested
              ? requested.has(row.id)
              : Number(row.is_required) === 1 ||
                (row.status === 'answered' && String(row.answer_text ?? '').trim().length > 0)
          )
          .sort((left, right) => left.id.localeCompare(right.id));
      }
      if (sql.includes('FROM interview_evidence')) {
        const requested = new Set(params.slice(2));
        return database.evidence
          .filter((row) => requested.has(row.question_id))
          .sort((left, right) => left.id.localeCompare(right.id));
      }
      if (sql.includes('FROM interview_answer_decisions')) {
        if (sql.includes('assignment_id = ?')) {
          return database.decisions
            .filter((row) => row.assignment_id === params[1])
            .sort((left, right) => left.ordinal - right.ordinal || left.id.localeCompare(right.id));
        }
        return database.decisions
          .filter((row) => row.submission_id === params[1])
          .sort((left, right) => left.ordinal - right.ordinal || left.id.localeCompare(right.id));
      }
      throw new Error(`Unexpected queryAll: ${sql}`);
    });
    mocks.queryRun.mockReset().mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('INSERT INTO interview_answer_decision_commands')) {
        database.commands.set(`${params[0]}:${params[7]}`, {
          id: String(params[1]),
          assignmentId: String(params[2]),
          assignment_sequence: Number(params[3]),
          request_fingerprint:
            database.commandInsertRace === 'different'
              ? 'different-fingerprint'
              : String(params[8]),
          response_json: JSON.parse(String(params[11])),
        });
        if (database.commandInsertRace) {
          throw Object.assign(new Error('duplicate command request'), {
            code: '23505',
            constraint: 'uq_interview_answer_decision_commands_request',
          });
        }
      }
      if (sql.includes('INSERT INTO interview_answer_decisions')) {
        const command = [...database.commands.values()].find((row) => row.id === params[2]);
        database.decisions.push({
          id: String(params[1]),
          assignment_id: String(params[3]),
          question_id: String(params[5]),
          submission_id: String(params[6]),
          answer_updated_at: params[7],
          answer_digest: String(params[8]),
          ordinal: Number(params[10]),
          event_type: String(params[11]),
          stage: params[12] as 'ai' | 'manager' | null,
          decision: params[13] as 'approved' | 'sent_back' | null,
          policy_mode: params[15] as 'ai' | 'manager' | 'two_stage',
          policy_version: Number(params[16]),
          policy_snapshot_json: JSON.parse(String(params[17])),
          assignment_sequence: command?.assignment_sequence ?? 0,
        });
      }
      return { changes: 1 };
    });
    mocks.withPgTransaction.mockClear();
  });

  it('requires both the environment and organization gates before any approval write', async () => {
    delete process.env.ENABLE_INTERVIEW_ANSWER_APPROVAL;
    await expect(applyInterviewAnswerDecisionCommand(submissionInput())).rejects.toMatchObject({
      code: 'FEATURE_DISABLED',
    });
    expect(mocks.queryRun).not.toHaveBeenCalled();

    process.env.ENABLE_INTERVIEW_ANSWER_APPROVAL = 'true';
    database.policy = {
      interview: { answerApproval: { version: 1, enabled: false, mode: 'manager' } },
    };
    await expect(applyInterviewAnswerDecisionCommand(submissionInput())).rejects.toMatchObject({
      code: 'FEATURE_DISABLED',
    });
    expect(database.commands).toHaveLength(0);
    expect(database.decisions).toHaveLength(0);
  });

  it('derives a complete answered denominator and records stable ordinals without SELECT star', async () => {
    database.questions.push({
      ...question('optional-unanswered', 2, false),
      status: 'not_started',
      answer_text: '',
    });
    const response = await applyInterviewAnswerDecisionCommand(submissionInput());

    expect(response.decisions.map(({ questionId, ordinal }) => ({ questionId, ordinal }))).toEqual([
      { questionId: 'question-a', ordinal: 1 },
      { questionId: 'question-b', ordinal: 2 },
    ]);
    expect(mocks.withPgTransaction).toHaveBeenCalledTimes(1);
    expect(
      mocks.queryAll.mock.calls.find(([sql]) =>
        String(sql).includes('FROM interview_questions')
      )?.[0]
    ).not.toContain('SELECT *');
  });

  it('blocks a required unanswered question before parent or decision receipts', async () => {
    database.questions[0] = { ...database.questions[0], status: 'not_started', answer_text: '' };

    await expect(applyInterviewAnswerDecisionCommand(submissionInput())).rejects.toMatchObject({
      code: 'COMMAND_INVALID',
    });
    expect(mocks.queryRun).not.toHaveBeenCalled();
  });

  it('freezes evidence and template provenance in the exact answer digest', async () => {
    database.evidence.push({
      id: 'evidence-1',
      question_id: 'question-a',
      evidence_type: 'link',
      evidence_role: 'supporting',
      title: 'Source',
      description: null,
      file_name: null,
      file_size: null,
      file_type: null,
      url: 'https://example.test/source',
      transcript_text: null,
      ingest_to_knowledge: 1,
      knowledge_document_id: 'knowledge-1',
      uploaded_by: 'user-1',
      created_at: new Date('2026-09-13T11:00:00.000Z'),
    });
    await applyInterviewAnswerDecisionCommand(submissionInput());

    const inserted = mocks.queryRun.mock.calls.find(
      ([sql, params]) =>
        String(sql).includes('INSERT INTO interview_answer_decisions') &&
        (params as unknown[])[5] === 'question-a'
    );
    const snapshot = JSON.parse(String((inserted?.[1] as unknown[])?.[9]));
    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      templateId: 'template-1',
      templateVersion: 4,
      evidence: [{ id: 'evidence-1', knowledgeDocumentId: 'knowledge-1' }],
    });
  });

  it('replays the whole strict parent response and rejects changed fingerprints', async () => {
    const first = await applyInterviewAnswerDecisionCommand(submissionInput());
    const writes = mocks.queryRun.mock.calls.length;
    await expect(applyInterviewAnswerDecisionCommand(submissionInput())).resolves.toEqual({
      ...first,
      idempotentReplay: true,
    });
    expect(mocks.queryRun).toHaveBeenCalledTimes(writes);
    await expect(
      applyInterviewAnswerDecisionCommand({
        ...submissionInput(),
        actor: { type: 'human', id: 'other-user' },
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });

    database.assignment = null;
    await expect(applyInterviewAnswerDecisionCommand(submissionInput())).rejects.toMatchObject({
      code: 'ASSIGNMENT_NOT_FOUND',
    });
  });

  it('rejects malformed stored replay payloads with a named error after a request race', async () => {
    database.commandInsertRace = 'same';
    mocks.queryRun.mockImplementationOnce(async (_sql: string, params: unknown[]) => {
      database.commands.set(`${params[0]}:${params[7]}`, {
        id: String(params[1]),
        assignmentId: String(params[2]),
        assignment_sequence: Number(params[3]),
        request_fingerprint: String(params[8]),
        response_json: '{',
      });
      throw Object.assign(new Error('race'), {
        code: '23505',
        constraint: 'uq_interview_answer_decision_commands_request',
      });
    });
    await expect(applyInterviewAnswerDecisionCommand(submissionInput())).rejects.toMatchObject({
      code: 'COMMAND_INVALID',
    });
  });

  it('refuses decisions without an exact submitted receipt and revision', async () => {
    if (database.assignment) database.assignment.status = 'submitted';
    await expect(
      applyInterviewAnswerDecisionCommand(decisionInput(['question-a']))
    ).rejects.toMatchObject({ code: 'SUBMISSION_NOT_FOUND' });

    if (database.assignment) database.assignment.status = 'in_progress';
    await submit();
    database.questions[0] = {
      ...database.questions[0],
      answer_text: 'Edited answer',
      updated_at: new Date('2026-09-13T12:05:00.000Z'),
    };
    await expect(
      applyInterviewAnswerDecisionCommand(
        decisionInput(['question-a'], { clientRequestId: 'request-stale-revision' })
      )
    ).rejects.toMatchObject({ code: 'ANSWER_REVISION_CONFLICT' });
  });

  it('uses the frozen submission policy after organization policy changes', async () => {
    await submit('two_stage');
    database.policy = { interview: { answerApproval: { version: 1, enabled: true, mode: 'manager' } } };

    await expect(
      applyInterviewAnswerDecisionCommand(
        decisionInput(['question-a'], {
          clientRequestId: 'request-ai',
          stage: 'ai',
          actor: { type: 'ai', id: 'model-run-1' },
          metadata: {
            modelId: 'model-1',
            providerId: 'test-provider',
            promptVersion: 'p1',
            score: 0.9,
          },
        })
      )
    ).resolves.toMatchObject({ policyMode: 'two_stage', policyVersion: 1 });
  });

  it('keeps stage progress isolated for each question in one submission', async () => {
    await submit('two_stage');
    const submittedQ1 = database.decisions.find(
      (row) => row.question_id === 'question-a' && row.event_type === 'submitted'
    );
    expect(submittedQ1).toBeDefined();
    if (!submittedQ1) throw new Error('missing submitted question fixture');
    database.decisions.push(
      {
        ...submittedQ1,
        id: 'q1-ai',
        ordinal: 3,
        event_type: 'ai_approved',
        stage: 'ai',
        decision: 'approved',
      },
      {
        ...submittedQ1,
        id: 'q1-manager',
        ordinal: 4,
        event_type: 'manager_approved',
        stage: 'manager',
        decision: 'approved',
      }
    );

    await expect(
      applyInterviewAnswerDecisionCommand(
        decisionInput(['question-b'], {
          clientRequestId: 'request-q2-ai',
          stage: 'ai',
          actor: { type: 'ai', id: 'model-run-2' },
          metadata: { modelId: 'model-2', providerId: 'test-provider', promptVersion: 'p1' },
        })
      )
    ).resolves.toMatchObject({
      decisions: [{ questionId: 'question-b', stage: 'ai', ordinal: 5 }],
    });
  });

  it('requires edit and a new submission after sent back', async () => {
    await submit('manager');
    await applyInterviewAnswerDecisionCommand(
      decisionInput(['question-a'], {
        clientRequestId: 'request-send-back',
        decision: 'sent_back',
        reason: 'Add evidence',
      })
    );
    await expect(
      applyInterviewAnswerDecisionCommand(
        decisionInput(['question-a'], { clientRequestId: 'request-same-revision' })
      )
    ).rejects.toMatchObject({ code: 'SUBMISSION_SENT_BACK' });

    database.questions[0] = {
      ...database.questions[0],
      answer_text: 'Edited with evidence',
      updated_at: new Date('2026-09-13T12:06:00.000Z'),
    };
    if (database.assignment) database.assignment.status = 'sent_back';
    await applyInterviewAnswerDecisionCommand(
      submissionInput({ submissionId: 'submission-2', clientRequestId: 'request-submit-2' })
    );
    if (database.assignment) database.assignment.status = 'submitted';
    await expect(
      applyInterviewAnswerDecisionCommand(
        decisionInput(['question-a'], {
          submissionId: 'submission-2',
          clientRequestId: 'request-revised-answer',
        })
      )
    ).resolves.toMatchObject({ submissionId: 'submission-2' });
  });

  it('resubmits only a changed returned answer and preserves an unchanged completed answer', async () => {
    await submit('manager');
    await applyInterviewAnswerDecisionCommand(
      decisionInput(['question-a'], {
        clientRequestId: 'request-return-a',
        decision: 'sent_back',
        reason: 'Add a concrete example',
      })
    );
    await applyInterviewAnswerDecisionCommand(
      decisionInput(['question-b'], { clientRequestId: 'request-approve-b' })
    );
    const completedB = await readInterviewAnswerApprovalProjection({
      organizationId: 'org-1',
      assignmentId: 'assignment-1',
    });
    expect(completedB.find((row) => row.questionId === 'question-b')).toMatchObject({
      submissionId: 'submission-1',
      status: 'stages_complete',
    });

    database.questions[0] = {
      ...database.questions[0],
      answer_text: 'Answer question-a with a concrete example',
      updated_at: new Date('2026-09-13T12:08:00.000Z'),
    };
    if (database.assignment) database.assignment.status = 'sent_back';
    const resubmitted = await applyInterviewAnswerDecisionCommand(
      submissionInput({ submissionId: 'submission-2', clientRequestId: 'request-resubmit-a' })
    );
    expect(resubmitted.decisions.map((row) => row.questionId)).toEqual(['question-a']);

    const projection = await readInterviewAnswerApprovalProjection({
      organizationId: 'org-1',
      assignmentId: 'assignment-1',
    });
    expect(projection).toEqual([
      expect.objectContaining({
        questionId: 'question-a',
        submissionId: 'submission-2',
        status: 'pending',
      }),
      expect.objectContaining({
        questionId: 'question-b',
        submissionId: 'submission-1',
        status: 'stages_complete',
      }),
    ]);
  });

  it('fails closed for actor-stage mismatches, missing AI provenance and malformed answer payload', async () => {
    await expect(
      applyInterviewAnswerDecisionCommand(
        submissionInput({ actor: { type: 'system', id: 'scheduler' } })
      )
    ).rejects.toMatchObject({ code: 'COMMAND_INVALID' });
    expect(mocks.queryRun).not.toHaveBeenCalled();

    await submit('two_stage');
    await expect(
      applyInterviewAnswerDecisionCommand(
        decisionInput(['question-a'], {
          clientRequestId: 'request-ai-human',
          stage: 'ai',
          actor: { type: 'human', id: 'manager-1' },
          metadata: { modelId: 'model', providerId: 'test-provider', promptVersion: 'p1' },
        })
      )
    ).rejects.toMatchObject({ code: 'COMMAND_INVALID' });
    await expect(
      applyInterviewAnswerDecisionCommand(
        decisionInput(['question-a'], {
          clientRequestId: 'request-ai-no-provenance',
          stage: 'ai',
          actor: { type: 'ai', id: 'model-run' },
        })
      )
    ).rejects.toMatchObject({ code: 'COMMAND_INVALID' });
    await expect(
      applyInterviewAnswerDecisionCommand(
        decisionInput(['question-a'], {
          clientRequestId: 'request-manager-ai',
          actor: { type: 'ai', id: 'model-run' },
        })
      )
    ).rejects.toMatchObject({ code: 'COMMAND_INVALID' });

    database.decisions = [];
    database.commands.clear();
    if (database.assignment) database.assignment.status = 'in_progress';
    database.questions[0] = { ...database.questions[0], answer_payload: '{' };
    await expect(
      applyInterviewAnswerDecisionCommand(
        submissionInput({ submissionId: 'malformed', clientRequestId: 'request-malformed' })
      )
    ).rejects.toMatchObject({ code: 'COMMAND_INVALID' });
    expect(database.commands.size).toBe(0);
  });

  it('rejects manager-before-AI, duplicate submission IDs and cross-assignment reuse', async () => {
    await submit('two_stage');
    await expect(
      applyInterviewAnswerDecisionCommand(
        decisionInput(['question-a'], { clientRequestId: 'request-manager-early' })
      )
    ).rejects.toMatchObject({ code: 'STAGE_ORDER_INVALID' });
    if (database.assignment) database.assignment.status = 'sent_back';
    await expect(
      applyInterviewAnswerDecisionCommand(
        submissionInput({ clientRequestId: 'request-duplicate-submission' })
      )
    ).rejects.toMatchObject({ code: 'SUBMISSION_CONFLICT' });
    const firstDecision = database.decisions[0];
    expect(firstDecision).toBeDefined();
    if (!firstDecision) throw new Error('missing decision fixture');
    firstDecision.assignment_id = 'assignment-other';
    if (database.assignment) database.assignment.status = 'submitted';
    await expect(
      applyInterviewAnswerDecisionCommand(
        decisionInput(['question-a'], { clientRequestId: 'request-cross-assignment' })
      )
    ).rejects.toMatchObject({ code: 'SUBMISSION_CONFLICT' });
  });

  it('fails closed for unsupported policy, invalid metadata and tenant-missing assignment', async () => {
    database.policy = { interview: { answerApproval: { version: 2, mode: 'ai' } } };
    await expect(applyInterviewAnswerDecisionCommand(submissionInput())).rejects.toMatchObject({
      code: 'POLICY_UNSUPPORTED',
    });
    await expect(
      applyInterviewAnswerDecisionCommand(
        submissionInput({ metadata: { modelId: 'x'.repeat(201) } })
      )
    ).rejects.toMatchObject({ code: 'COMMAND_INVALID' });
    database.assignment = null;
    await expect(applyInterviewAnswerDecisionCommand(submissionInput())).rejects.toMatchObject({
      code: 'ASSIGNMENT_NOT_FOUND',
    });
  });

  it('maps concurrent same-key races across assignment locks to replay or named conflict', async () => {
    database.commandInsertRace = 'same';
    await expect(applyInterviewAnswerDecisionCommand(submissionInput())).resolves.toMatchObject({
      idempotentReplay: true,
    });

    database.commands.clear();
    database.commandInsertRace = 'different';
    database.assignment = {
      id: 'assignment-2',
      session_id: 'session-1',
      status: 'in_progress',
      template_id: 'template-1',
      template_version: 4,
    };
    await expect(
      applyInterviewAnswerDecisionCommand(
        submissionInput({ assignmentId: 'assignment-2', clientRequestId: 'same-client-request' })
      )
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('projects only the latest submitted revision without exposing answer snapshots', async () => {
    await submit('manager');
    await applyInterviewAnswerDecisionCommand(decisionInput(['question-a']));

    const projection = await readInterviewAnswerApprovalProjection({
      organizationId: 'org-1',
      assignmentId: 'assignment-1',
    });
    expect(projection).toEqual([
      expect.objectContaining({
        questionId: 'question-a',
        submissionId: 'submission-1',
        status: 'stages_complete',
        nextStage: null,
        latestDecision: 'approved',
      }),
      expect.objectContaining({
        questionId: 'question-b',
        submissionId: 'submission-1',
        status: 'pending',
        nextStage: 'manager',
      }),
    ]);
    const projectionSql = mocks.queryAll.mock.calls.find(([sql]) =>
      String(sql).includes('assignment_id = ?')
    )?.[0];
    expect(projectionSql).not.toContain('answer_snapshot_json');

    await applyInterviewAnswerDecisionCommand(
      decisionInput(['question-b'], {
        clientRequestId: 'request-return-b',
        decision: 'sent_back',
        reason: 'Clarify the result',
      })
    );
    database.questions[1] = {
      ...database.questions[1],
      answer_text: `${String(database.questions[1]?.answer_text)} revised`,
      updated_at: new Date('2026-09-13T12:11:00.000Z'),
    };
    if (database.assignment) database.assignment.status = 'sent_back';
    await applyInterviewAnswerDecisionCommand(
      submissionInput({ submissionId: 'submission-2', clientRequestId: 'request-submit-2' })
    );
    const superseding = await readInterviewAnswerApprovalProjection({
      organizationId: 'org-1',
      assignmentId: 'assignment-1',
    });
    expect(superseding).toEqual([
      expect.objectContaining({
        questionId: 'question-a',
        submissionId: 'submission-1',
        status: 'stages_complete',
        nextStage: null,
      }),
      expect.objectContaining({
        questionId: 'question-b',
        submissionId: 'submission-2',
        status: 'pending',
        nextStage: 'manager',
      }),
    ]);
  });
});
