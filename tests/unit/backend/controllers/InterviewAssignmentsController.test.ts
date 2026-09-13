/**
 * InterviewController - Assignment workflow unit tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockLockedAssignmentQuery = vi.fn();
const mockLlmCall = vi.fn();
const mockGetTableColumns = vi.fn();
const mockApplyAnswerDecision = vi.fn();
const mockReadAnswerApprovals = vi.fn();
const mockAssertReviewAccess = vi.fn();
const mockReviewAccess = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (sql: unknown, ...args: unknown[]) =>
    String(sql).includes('FROM interview_assignments a') && String(sql).includes('FOR UPDATE')
      ? mockLockedAssignmentQuery(sql, ...args)
      : mockQueryOne(sql, ...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  withPgTransaction: (fn: () => unknown) => fn(),
}));

vi.mock('../../../../server/src/utils/asyncHandler.js', () => ({
  asyncHandler: (fn: Function) => fn,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../../../server/src/services/ai/llmService.js', () => ({
  llmService: {
    resolveModelConfig: vi.fn().mockResolvedValue({
      id: 'test-interview-model',
      provider: 'test-provider',
    }),
    call: (...args: unknown[]) => mockLlmCall(...args),
  },
}));

vi.mock('../../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));

vi.mock('../../../../server/src/services/interview/interviewAnswerDecisionService.js', () => ({
  applyInterviewAnswerDecisionCommand: (...args: unknown[]) => mockApplyAnswerDecision(...args),
  readInterviewAnswerApprovalProjection: (...args: unknown[]) => mockReadAnswerApprovals(...args),
  InterviewAnswerDecisionCommandError: class InterviewAnswerDecisionCommandError extends Error {
    constructor(
      public readonly code: string,
      message: string
    ) {
      super(message);
    }
  },
}));

vi.mock('../../../../server/src/services/interviewAssignmentReviewAccess.js', () => ({
  assertInterviewAssignmentReviewAccess: (...args: unknown[]) => mockAssertReviewAccess(...args),
  interviewAssignmentReviewAccess: (...args: unknown[]) => mockReviewAccess(...args),
}));

vi.mock('uuid', () => ({
  v4: () => 'uuid-123',
}));

describe('InterviewController assignments', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryAll.mockReset();
    mockQueryOne.mockReset();
    mockQueryRun.mockReset();
    mockQueryRun.mockResolvedValue({ changes: 1 });
    mockLockedAssignmentQuery.mockReset().mockResolvedValue({ id: 'a1' });
    mockLlmCall.mockReset();
    mockGetTableColumns.mockReset();
    mockApplyAnswerDecision.mockReset().mockResolvedValue({
      commandId: 'command-submit',
      assignmentId: 'a1',
      sessionId: 's1',
      submissionId: 'uuid-123',
      policyMode: 'manager',
      policyVersion: 1,
      status: 'applied',
      observedAt: '2026-09-13T12:00:00.000Z',
      decisions: [],
      idempotentReplay: false,
    });
    mockReadAnswerApprovals.mockReset().mockResolvedValue([
      {
        questionId: 'q1',
        submissionId: 'submission-1',
        status: 'stages_complete',
      },
    ]);
    mockAssertReviewAccess.mockReset().mockResolvedValue({
      canReview: true,
      assignmentId: 'a1',
      sessionId: 's1',
      projectId: 'p1',
    });
    mockReviewAccess.mockReset().mockResolvedValue({
      canReview: true,
      assignmentId: 'a1',
      sessionId: 's1',
      projectId: 'p1',
    });
    mockGetTableColumns.mockResolvedValue(
      new Set([
        'ai_review_snapshot_json',
        'ai_reviewed_at',
        'review_decision_memory_json',
        'missing_items_json',
      ])
    );
    mockLlmCall.mockResolvedValue({
      object: {
        overallScore: 3.6,
        overallVerdict: 'ready_for_approval',
        recommendations: ['Add one example.'],
        questionEvaluations: [],
      },
    });

    mockReq = {
      user: {
        id: 'user-1',
        organizationId: 'org-1',
        role: 'USER',
      },
      params: {},
      query: {},
      body: {},
    };

    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  it('submitAssignment: <50% stays submitted and remains reviewable', async () => {
    mockReq.params.id = 'a1';
    mockQueryAll.mockResolvedValue([]);

    mockQueryOne
      // assignment
      .mockResolvedValueOnce({
        id: 'a1',
        organization_id: 'org-1',
        assignee_user_id: 'user-1',
        session_id: 's1',
        task_id: 't1',
        status: 'in_progress',
        created_by: 'user-2',
      })
      // sessionRow for completeness
      .mockResolvedValueOnce({
        id: 's1',
        organization_id: 'org-1',
        status: 'active',
      })
      // fresh session progress
      .mockResolvedValueOnce({
        answered_questions: 2,
        total_questions: 10,
      })
      // updated assignment
      .mockResolvedValueOnce({
        id: 'a1',
        status: 'submitted',
        session_id: 's1',
        created_by: 'user-2',
      })
      // updated session
      .mockResolvedValueOnce({
        id: 's1',
        status: 'submitted',
        assignment_id: 'a1',
        answered_questions: 2,
        total_questions: 10,
      });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    expect(mockQueryRun).toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        entersContext: false,
        completenessPercent: 20,
        aiReview: null,
      })
    );
    expect(mockLlmCall).not.toHaveBeenCalled();
  });

  it('submitAssignment: >=50% still stays submitted (approval is separate)', async () => {
    mockReq.params.id = 'a2';
    mockQueryAll.mockResolvedValue([]);

    mockQueryOne
      // assignment
      .mockResolvedValueOnce({
        id: 'a2',
        organization_id: 'org-1',
        assignee_user_id: 'user-1',
        session_id: 's2',
        task_id: 't2',
        status: 'in_progress',
        created_by: 'user-2',
      })
      // sessionRow for completeness
      .mockResolvedValueOnce({
        id: 's2',
        organization_id: 'org-1',
        status: 'active',
      })
      // fresh session progress
      .mockResolvedValueOnce({
        answered_questions: 5,
        total_questions: 10,
      })
      // updated assignment
      .mockResolvedValueOnce({
        id: 'a2',
        status: 'submitted',
        session_id: 's2',
        created_by: 'user-2',
      })
      // updated session
      .mockResolvedValueOnce({
        id: 's2',
        status: 'submitted',
        assignment_id: 'a2',
        answered_questions: 5,
        total_questions: 10,
      });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        entersContext: false,
        completenessPercent: 50,
        aiReview: null,
      })
    );
    expect(mockLlmCall).not.toHaveBeenCalled();
  });

  it('submitAssignment: treats re-submit of an already submitted assignment as idempotent', async () => {
    mockReq.params.id = 'a3';
    mockQueryAll.mockResolvedValue([]);

    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a3',
        organization_id: 'org-1',
        assignee_user_id: 'user-1',
        session_id: 's3',
        task_id: 't3',
        status: 'submitted',
        created_by: 'user-2',
      })
      .mockResolvedValueOnce({
        id: 's3',
        organization_id: 'org-1',
        status: 'submitted',
      })
      .mockResolvedValueOnce({
        answered_questions: 8,
        total_questions: 10,
      })
      .mockResolvedValueOnce({
        id: 'a3',
        status: 'submitted',
        session_id: 's3',
        created_by: 'user-2',
      })
      .mockResolvedValueOnce({
        id: 's3',
        status: 'submitted',
        assignment_id: 'a3',
        answered_questions: 8,
        total_questions: 10,
      });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    expect(mockRes.status).not.toHaveBeenCalledWith(409);
    expect(
      mockQueryRun.mock.calls.some((call) =>
        String(call[0]).includes('UPDATE interview_assignments')
      )
    ).toBe(false);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        entersContext: false,
        completenessPercent: 80,
        idempotentReplay: true,
        aiReview: null,
      })
    );
  });

  it('submitAssignment: does not authorize the creator when they are not the assignee or team lead', async () => {
    mockReq.params.id = 'a-created-only';
    mockReq.user.id = 'creator-1';
    mockQueryOne.mockResolvedValue(null);

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockApplyAnswerDecision).not.toHaveBeenCalled();
  });

  // L-07 / SPEC_13 §5.1 — hard submit floor (objective insufficiency).
  it('submitAssignment: HARD-BLOCKS (422) when a required question is unanswered, without flipping status', async () => {
    mockReq.params.id = 'a-block';
    // queryAll #1 = updateSessionProgress (progress rows); #2 = submit gate questions.
    mockQueryAll
      .mockResolvedValueOnce([{ category: 'general', status: 'not_started' }])
      .mockResolvedValueOnce([
        {
          id: 'q1',
          question_text: 'What is the core problem?',
          is_required: 1,
          status: 'not_started',
          answer_text: '',
        },
        {
          id: 'q2',
          question_text: 'Optional context?',
          is_required: 0,
          status: 'answered',
          answer_text: 'Some answer',
        },
      ]);

    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a-block',
        organization_id: 'org-1',
        assignee_user_id: 'user-1',
        session_id: 's-block',
        task_id: null,
        status: 'in_progress',
        created_by: 'user-2',
      })
      .mockResolvedValueOnce({ id: 's-block', organization_id: 'org-1', status: 'active' })
      .mockResolvedValueOnce({ answered_questions: 1, total_questions: 2 });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(422);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'OBJECTIVE_INSUFFICIENCY',
        messageKey: 'interview.workspace.cannotSubmitCompleteTheRequired',
        reason: 'required_missing',
        requiredMissingCount: 1,
        blockedItems: expect.arrayContaining([expect.objectContaining({ questionId: 'q1' })]),
      })
    );
    // The status must NOT have been flipped to submitted.
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          typeof call[0] === 'string' &&
          String(call[0]).includes('UPDATE interview_assignments') &&
          String(call[0]).includes('status = ?')
      )
    ).toBe(false);
  });

  it('submitAssignment: manager policy submits a weak answer without calling the LLM', async () => {
    mockReq.params.id = 'a-manager-weak';
    mockQueryAll
      .mockResolvedValueOnce([{ category: 'general', status: 'answered' }])
      .mockResolvedValueOnce([
        {
          id: 'q1',
          question_text: 'What is the core problem?',
          is_required: 0,
          status: 'answered',
          answer_text: 'idk',
        },
      ]);
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a-manager-weak',
        organization_id: 'org-1',
        assignee_user_id: 'user-1',
        session_id: 's-manager-weak',
        task_id: null,
        status: 'in_progress',
        created_by: 'user-2',
      })
      .mockResolvedValueOnce({ id: 's-manager-weak', organization_id: 'org-1', status: 'active' })
      .mockResolvedValueOnce({ answered_questions: 1, total_questions: 1 })
      .mockResolvedValueOnce({
        id: 'a-manager-weak',
        status: 'submitted',
        session_id: 's-manager-weak',
      })
      .mockResolvedValueOnce({ id: 's-manager-weak', status: 'submitted' });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    expect(mockRes.status).not.toHaveBeenCalledWith(422);
    expect(mockLlmCall).not.toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        aiReview: null,
        answerApproval: expect.objectContaining({ policyMode: 'manager' }),
      })
    );
  });

  // L-07 / SPEC_13 §5.1 — hard floor edge case (c):
  // A zero-question template/config session must NOT trap the respondent. The AI
  // floor only applies when there are questions; submit is allowed.
  it('submitAssignment: zero-question session is NOT trapped by the AI floor (allowed)', async () => {
    mockReq.params.id = 'a-empty';
    mockQueryAll
      // #1 updateSessionProgress
      .mockResolvedValueOnce([])
      // #2 submit gate questions — none
      .mockResolvedValueOnce([]);

    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a-empty',
        organization_id: 'org-1',
        assignee_user_id: 'user-1',
        session_id: 's-empty',
        task_id: null,
        status: 'in_progress',
        created_by: 'user-2',
      })
      .mockResolvedValueOnce({ id: 's-empty', organization_id: 'org-1', status: 'active' })
      .mockResolvedValueOnce({ answered_questions: 0, total_questions: 0 })
      // updated assignment
      .mockResolvedValueOnce({
        id: 'a-empty',
        status: 'submitted',
        session_id: 's-empty',
        created_by: 'user-2',
      })
      // updated session
      .mockResolvedValueOnce({ id: 's-empty', status: 'submitted', assignment_id: 'a-empty' });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    // Not blocked.
    expect(mockRes.status).not.toHaveBeenCalledWith(422);
    // Status flipped to submitted.
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          typeof call[0] === 'string' &&
          String(call[0]).includes('UPDATE interview_assignments') &&
          String(call[0]).includes('status = ?')
      )
    ).toBe(true);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ entersContext: false }));
  });

  // L-07 / SPEC_13 §5.1 — hard floor edge case (d):
  // All-sufficient → 200, status flips to submitted, AI score is persisted.
  it('submitAssignment: all-sufficient answers → 200, status flips, score persisted', async () => {
    mockReq.params.id = 'a-ok';
    // #48a — rubric-based mock: LLM only judges the 5 named criteria (0-4 each);
    // the aggregate score/verdict are computed deterministically by the
    // controller, not returned by the mock. 18/20 -> overallScore 4.6.
    mockLlmCall.mockResolvedValue({
      object: {
        recommendations: [],
        questionEvaluations: [
          {
            questionId: 'q1',
            rubric: [
              { criterion: 'concreteness', score: 4, justification: 'Specific detail.' },
              { criterion: 'evidence', score: 4, justification: 'Names a concrete example.' },
              { criterion: 'depth', score: 3, justification: 'Explains cause.' },
              { criterion: 'measurability', score: 3, justification: 'Gives a rough figure.' },
              { criterion: 'coherence', score: 4, justification: 'Directly on-topic.' },
            ],
            feedback: 'Good.',
          },
        ],
      },
    });
    mockQueryAll
      .mockResolvedValueOnce([{ category: 'general', status: 'answered' }])
      .mockResolvedValueOnce([
        {
          id: 'q1',
          question_text: 'What is the core problem?',
          is_required: 1,
          status: 'answered',
          answer_text: 'A thorough, specific, and actionable answer.',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'q1',
          question_text: 'What is the core problem?',
          is_required: 1,
          status: 'answered',
          answer_text: 'A thorough, specific, and actionable answer.',
        },
      ]);

    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a-ok',
        organization_id: 'org-1',
        assignee_user_id: 'user-1',
        session_id: 's-ok',
        task_id: null,
        status: 'in_progress',
        created_by: 'user-2',
      })
      .mockResolvedValueOnce({ id: 's-ok', organization_id: 'org-1', status: 'active' })
      .mockResolvedValueOnce({ answered_questions: 1, total_questions: 1 })
      .mockResolvedValueOnce({
        id: 'a-ok',
        status: 'submitted',
        session_id: 's-ok',
        created_by: 'user-2',
        ai_review_snapshot_json: JSON.stringify({
          overallScore: 4.2,
          overallVerdict: 'ready_for_approval',
          recommendations: [],
          weakAnswerMap: [],
          questionEvaluations: [],
        }),
      })
      .mockResolvedValueOnce({ id: 's-ok', status: 'submitted', assignment_id: 'a-ok' })
      .mockResolvedValueOnce({
        id: 'a-ok',
        status: 'submitted',
        session_id: 's-ok',
        ai_review_snapshot_json: null,
      })
      .mockResolvedValueOnce({ id: 's-ok', status: 'submitted', assignment_id: 'a-ok' });
    mockApplyAnswerDecision
      .mockResolvedValueOnce({
        commandId: 'submit-command',
        assignmentId: 'a-ok',
        sessionId: 's-ok',
        submissionId: 'uuid-123',
        policyMode: 'ai',
        policyVersion: 1,
        decisions: [{ questionId: 'q1', answerUpdatedAt: '2026-09-13T12:00:00.000Z' }],
      })
      .mockResolvedValue({ status: 'applied', decisions: [] });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    // Not blocked.
    expect(mockRes.status).not.toHaveBeenCalledWith(422);
    // Status flipped to submitted.
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          typeof call[0] === 'string' &&
          String(call[0]).includes('UPDATE interview_assignments') &&
          String(call[0]).includes('status = ?')
      )
    ).toBe(true);
    // AI score snapshot was persisted (separate UPDATE writing ai_review_snapshot_json
    // with a JSON payload carrying the score).
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          typeof call[0] === 'string' &&
          String(call[0]).includes('ai_review_snapshot_json = ?') &&
          Array.isArray(call[1]) &&
          call[1].some(
            (arg: unknown) => typeof arg === 'string' && arg.includes('"overallScore":4.6')
          )
      )
    ).toBe(true);
    // Response surfaces the AI review.
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        completenessPercent: 100,
        aiReview: expect.objectContaining({ overallVerdict: 'ready_for_approval' }),
      })
    );
  });

  it('submitAssignment: records mixed AI verdicts per answer and returns the assignment for revision', async () => {
    mockReq.params.id = 'a-mixed';
    const rubric = (scores: number[]) =>
      ['concreteness', 'evidence', 'depth', 'measurability', 'coherence'].map(
        (criterion, index) => ({
          criterion,
          score: scores[index],
          justification: `${criterion} evidence`,
        })
      );
    mockLlmCall.mockResolvedValue({
      object: {
        recommendations: ['Expand the second answer.'],
        questionEvaluations: [
          { questionId: 'q1', rubric: rubric([4, 4, 4, 4, 4]), feedback: 'Sufficient.' },
          {
            questionId: 'q2',
            rubric: rubric([2, 2, 2, 2, 2]),
            feedback: 'Add a concrete example.',
            fixType: 'make_specific',
          },
        ],
      },
    });
    mockQueryAll
      .mockResolvedValueOnce([
        { category: 'general', status: 'answered' },
        { category: 'general', status: 'answered' },
      ])
      .mockResolvedValueOnce([
        {
          id: 'q1',
          question_text: 'Question one',
          is_required: 1,
          status: 'answered',
          answer_text: 'Strong answer',
        },
        {
          id: 'q2',
          question_text: 'Question two',
          is_required: 1,
          status: 'answered',
          answer_text: 'Thin answer',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'q1',
          question_text: 'Question one',
          is_required: 1,
          status: 'answered',
          answer_text: 'Strong answer',
        },
        {
          id: 'q2',
          question_text: 'Question two',
          is_required: 1,
          status: 'answered',
          answer_text: 'Thin answer',
        },
      ]);
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a-mixed',
        organization_id: 'org-1',
        assignee_user_id: 'user-1',
        session_id: 's-mixed',
        task_id: null,
        status: 'in_progress',
        created_by: 'user-2',
      })
      .mockResolvedValueOnce({ id: 's-mixed', organization_id: 'org-1', status: 'active' })
      .mockResolvedValueOnce({ answered_questions: 2, total_questions: 2 })
      .mockResolvedValueOnce({ id: 'a-mixed', status: 'submitted', session_id: 's-mixed' })
      .mockResolvedValueOnce({ id: 's-mixed', status: 'submitted' })
      .mockResolvedValueOnce({ id: 'a-mixed', status: 'sent_back', session_id: 's-mixed' })
      .mockResolvedValueOnce({ id: 's-mixed', status: 'active' });
    mockApplyAnswerDecision
      .mockResolvedValueOnce({
        commandId: 'submit-command',
        assignmentId: 'a-mixed',
        sessionId: 's-mixed',
        submissionId: 'uuid-123',
        policyMode: 'two_stage',
        policyVersion: 1,
        decisions: [
          {
            questionId: 'q1',
            answerUpdatedAt: '2026-09-13T12:00:00.000Z',
          },
          {
            questionId: 'q2',
            answerUpdatedAt: '2026-09-13T12:01:00.000Z',
          },
        ],
      })
      .mockResolvedValue({ status: 'applied', decisions: [] });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    expect(mockApplyAnswerDecision).toHaveBeenCalledTimes(3);
    expect(mockLockedAssignmentQuery).toHaveBeenCalled();
    expect(
      mockLockedAssignmentQuery.mock.calls.every(([sql]) => String(sql).includes('FOR UPDATE OF a'))
    ).toBe(true);
    expect(mockApplyAnswerDecision).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        stage: 'ai',
        decision: 'approved',
        answers: [{ questionId: 'q1', expectedAnswerUpdatedAt: '2026-09-13T12:00:00.000Z' }],
        actor: { type: 'ai', id: expect.stringContaining('interview-rubric:') },
        metadata: expect.objectContaining({
          modelId: 'test-interview-model',
          providerId: 'test-provider',
        }),
      })
    );
    expect(mockApplyAnswerDecision).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        stage: 'ai',
        decision: 'sent_back',
        reason: 'Add a concrete example.',
        answers: [{ questionId: 'q2', expectedAnswerUpdatedAt: '2026-09-13T12:01:00.000Z' }],
      })
    );
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'sent_back'"),
      expect.any(Array)
    );
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ assignment: expect.objectContaining({ status: 'sent_back' }) })
    );
  });

  it('submitAssignment: does not expose transaction-local AI receipts when a later lifecycle transition rolls back', async () => {
    mockReq.params.id = 'a-ai-rollback';
    const rubric = (score: number) =>
      ['concreteness', 'evidence', 'depth', 'measurability', 'coherence'].map((criterion) => ({
        criterion,
        score,
        justification: `${criterion} evidence`,
      }));
    mockLlmCall.mockResolvedValue({
      object: {
        recommendations: [],
        questionEvaluations: [
          { questionId: 'q1', rubric: rubric(4), feedback: 'Sufficient.' },
          { questionId: 'q2', rubric: rubric(1), feedback: 'Revise this answer.' },
        ],
      },
    });
    const questions = [
      {
        id: 'q1',
        question_text: 'Question one',
        is_required: 1,
        status: 'answered',
        answer_text: 'Strong answer',
      },
      {
        id: 'q2',
        question_text: 'Question two',
        is_required: 1,
        status: 'answered',
        answer_text: 'Thin answer',
      },
    ];
    mockQueryAll
      .mockResolvedValueOnce([
        { category: 'general', status: 'answered' },
        { category: 'general', status: 'answered' },
      ])
      .mockResolvedValueOnce(questions)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(questions);
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a-ai-rollback',
        organization_id: 'org-1',
        assignee_user_id: 'user-1',
        session_id: 's-ai-rollback',
        task_id: null,
        status: 'in_progress',
        created_by: 'user-2',
      })
      .mockResolvedValueOnce({ id: 's-ai-rollback', organization_id: 'org-1', status: 'active' })
      .mockResolvedValueOnce({ answered_questions: 2, total_questions: 2 })
      .mockResolvedValueOnce({
        id: 'a-ai-rollback',
        status: 'submitted',
        session_id: 's-ai-rollback',
      })
      .mockResolvedValueOnce({ id: 's-ai-rollback', status: 'submitted' });
    mockApplyAnswerDecision
      .mockResolvedValueOnce({
        commandId: 'submit-command',
        assignmentId: 'a-ai-rollback',
        sessionId: 's-ai-rollback',
        submissionId: 'uuid-123',
        policyMode: 'two_stage',
        policyVersion: 1,
        decisions: [
          { questionId: 'q1', answerUpdatedAt: '2026-09-13T12:00:00.000Z' },
          { questionId: 'q2', answerUpdatedAt: '2026-09-13T12:01:00.000Z' },
        ],
      })
      .mockResolvedValue({ status: 'applied', decisions: [{ id: 'transaction-only' }] });
    mockQueryRun.mockImplementation(async (sql: unknown) => ({
      changes:
        String(sql).includes('UPDATE interview_assignments') &&
        String(sql).includes("status = 'sent_back'")
          ? 0
          : 1,
    }));

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    expect(mockApplyAnswerDecision).toHaveBeenCalledTimes(3);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        assignment: expect.objectContaining({ status: 'submitted' }),
        aiReview: null,
        aiAnswerApproval: [],
      })
    );
  });

  it('submitAssignment: leaves the AI stage pending when no exact AI result is available', async () => {
    mockReq.params.id = 'a-ai-unavailable';
    mockLlmCall.mockRejectedValue(new Error('provider unavailable'));
    mockQueryAll
      .mockResolvedValueOnce([{ category: 'general', status: 'answered' }])
      .mockResolvedValueOnce([
        {
          id: 'q1',
          question_text: 'Question one',
          is_required: 1,
          status: 'answered',
          answer_text: 'Answered',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'q1',
          question_text: 'Question one',
          is_required: 1,
          status: 'answered',
          answer_text: 'Answered',
        },
      ]);
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a-ai-unavailable',
        organization_id: 'org-1',
        assignee_user_id: 'user-1',
        session_id: 's-ai-unavailable',
        task_id: null,
        status: 'in_progress',
        created_by: 'user-2',
      })
      .mockResolvedValueOnce({
        id: 's-ai-unavailable',
        organization_id: 'org-1',
        status: 'active',
      })
      .mockResolvedValueOnce({ answered_questions: 1, total_questions: 1 })
      .mockResolvedValueOnce({
        id: 'a-ai-unavailable',
        status: 'submitted',
        session_id: 's-ai-unavailable',
      })
      .mockResolvedValueOnce({ id: 's-ai-unavailable', status: 'submitted' });
    mockApplyAnswerDecision.mockResolvedValueOnce({
      commandId: 'submit-command',
      assignmentId: 'a-ai-unavailable',
      sessionId: 's-ai-unavailable',
      submissionId: 'uuid-123',
      policyMode: 'ai',
      policyVersion: 1,
      decisions: [{ questionId: 'q1', answerUpdatedAt: '2026-09-13T12:00:00.000Z' }],
    });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    expect(mockApplyAnswerDecision).toHaveBeenCalledTimes(1);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ aiReview: null, aiAnswerApproval: [] })
    );
  });

  it.each([
    ['missing', []],
    [
      'foreign',
      [
        {
          questionId: 'q-foreign',
          rubric: [
            { criterion: 'concreteness', score: 4, justification: 'Specific.' },
            { criterion: 'evidence', score: 4, justification: 'Supported.' },
            { criterion: 'depth', score: 4, justification: 'Detailed.' },
            { criterion: 'measurability', score: 4, justification: 'Measured.' },
            { criterion: 'coherence', score: 4, justification: 'Coherent.' },
          ],
          feedback: 'Foreign result.',
        },
      ],
    ],
    [
      'duplicate',
      [
        {
          questionId: 'q1',
          rubric: [
            { criterion: 'concreteness', score: 4, justification: 'Specific.' },
            { criterion: 'evidence', score: 4, justification: 'Supported.' },
            { criterion: 'depth', score: 4, justification: 'Detailed.' },
            { criterion: 'measurability', score: 4, justification: 'Measured.' },
            { criterion: 'coherence', score: 4, justification: 'Coherent.' },
          ],
          feedback: 'First result.',
        },
        {
          questionId: 'q1',
          rubric: [
            { criterion: 'concreteness', score: 4, justification: 'Specific.' },
            { criterion: 'evidence', score: 4, justification: 'Supported.' },
            { criterion: 'depth', score: 4, justification: 'Detailed.' },
            { criterion: 'measurability', score: 4, justification: 'Measured.' },
            { criterion: 'coherence', score: 4, justification: 'Coherent.' },
          ],
          feedback: 'Duplicate result.',
        },
      ],
    ],
  ])(
    'submitAssignment: leaves %s provider question coverage pending without AI receipts',
    async (_case, questionEvaluations) => {
      mockReq.params.id = `a-ai-submit-coverage-${_case}`;
      mockLlmCall.mockResolvedValueOnce({ object: { recommendations: [], questionEvaluations } });
      const questions = [
        {
          id: 'q1',
          question_text: 'Question one',
          is_required: 1,
          status: 'answered',
          answer_text: 'Answer one',
        },
      ];
      mockQueryAll
        .mockResolvedValueOnce([{ category: 'general', status: 'answered' }])
        .mockResolvedValueOnce(questions)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(questions);
      mockQueryOne
        .mockResolvedValueOnce({
          id: `a-ai-submit-coverage-${_case}`,
          organization_id: 'org-1',
          assignee_user_id: 'user-1',
          session_id: `s-ai-submit-coverage-${_case}`,
          task_id: null,
          status: 'in_progress',
          created_by: 'user-2',
        })
        .mockResolvedValueOnce({
          id: `s-ai-submit-coverage-${_case}`,
          organization_id: 'org-1',
          status: 'active',
        })
        .mockResolvedValueOnce({ answered_questions: 1, total_questions: 1 })
        .mockResolvedValueOnce({
          id: `a-ai-submit-coverage-${_case}`,
          status: 'submitted',
          session_id: `s-ai-submit-coverage-${_case}`,
        })
        .mockResolvedValueOnce({
          id: `s-ai-submit-coverage-${_case}`,
          status: 'submitted',
        });
      mockApplyAnswerDecision.mockResolvedValueOnce({
        commandId: `submit-command-${_case}`,
        assignmentId: `a-ai-submit-coverage-${_case}`,
        sessionId: `s-ai-submit-coverage-${_case}`,
        submissionId: 'uuid-123',
        policyMode: 'ai',
        policyVersion: 1,
        decisions: [{ questionId: 'q1', answerUpdatedAt: '2026-09-13T12:00:00.000Z' }],
      });

      const { InterviewController } =
        await import('../../../../server/src/controllers/InterviewController.js');
      await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

      expect(mockApplyAnswerDecision).toHaveBeenCalledTimes(1);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ aiReview: null, aiAnswerApproval: [] })
      );
    }
  );

  // L-07 / SPEC_13 §5.1 — hard floor edge case (e):
  // AI eval failure (LLM throws) must NOT bypass the deterministic required-missing
  // floor; the block is still enforced (best-effort AI, deterministic gate).
  it('submitAssignment: required-missing floor still enforced when the AI eval throws', async () => {
    mockReq.params.id = 'a-ai-throw';
    mockLlmCall.mockRejectedValue(new Error('LLM provider unavailable'));
    mockQueryAll
      .mockResolvedValueOnce([{ category: 'general', status: 'not_started' }])
      .mockResolvedValueOnce([
        {
          id: 'q1',
          question_text: 'What is the core problem?',
          is_required: 1,
          status: 'not_started',
          answer_text: '',
        },
        // #48a — an answered question so the rubric LLM call actually happens
        // (unanswered questions are scored deterministically without calling the
        // LLM at all); this is what makes the LLM's rejection observable here.
        {
          id: 'q2',
          question_text: 'Optional context?',
          is_required: 0,
          status: 'answered',
          answer_text: 'Some answer',
        },
      ]);

    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a-ai-throw',
        organization_id: 'org-1',
        assignee_user_id: 'user-1',
        session_id: 's-ai-throw',
        task_id: null,
        status: 'in_progress',
        created_by: 'user-2',
      })
      .mockResolvedValueOnce({ id: 's-ai-throw', organization_id: 'org-1', status: 'active' })
      .mockResolvedValueOnce({ answered_questions: 0, total_questions: 1 });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(422);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'OBJECTIVE_INSUFFICIENCY',
        reason: 'required_missing',
        requiredMissingCount: 1,
        // AI signal is absent but must not crash or relax the floor.
        aiReview: null,
      })
    );
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          typeof call[0] === 'string' &&
          String(call[0]).includes('UPDATE interview_assignments') &&
          String(call[0]).includes('status = ?')
      )
    ).toBe(false);
  });

  it('submitAssignment: notification to the sender carries the AI quality score', async () => {
    mockReq.params.id = 'a-notify';
    // AI verdict ready_for_approval (>= floor) so submit proceeds.
    // #48a — rubric-based mock: 15/20 (3 on each of the 5 criteria) -> a
    // deterministic overallScore of exactly 4, matching the assertion below.
    mockLlmCall.mockResolvedValue({
      object: {
        recommendations: ['Tighten the second answer.'],
        questionEvaluations: [
          {
            questionId: 'q1',
            rubric: [
              { criterion: 'concreteness', score: 3, justification: 'Reasonably specific.' },
              { criterion: 'evidence', score: 3, justification: 'One supporting example.' },
              { criterion: 'depth', score: 3, justification: 'Some explanation of cause.' },
              { criterion: 'measurability', score: 3, justification: 'Rough figure given.' },
              { criterion: 'coherence', score: 3, justification: 'On-topic.' },
            ],
            feedback: 'Solid, could tighten.',
          },
        ],
      },
    });
    mockQueryAll
      .mockResolvedValueOnce([{ category: 'general', status: 'answered' }])
      .mockResolvedValueOnce([
        {
          id: 'q1',
          question_text: 'What is the core problem?',
          is_required: 1,
          status: 'answered',
          answer_text: 'A detailed and sufficient answer about the core problem.',
        },
      ]);

    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a-notify',
        organization_id: 'org-1',
        assignee_user_id: 'user-1',
        session_id: 's-notify',
        task_id: null,
        status: 'in_progress',
        created_by: 'manager-9',
      })
      .mockResolvedValueOnce({ id: 's-notify', organization_id: 'org-1', status: 'active' })
      .mockResolvedValueOnce({ answered_questions: 1, total_questions: 1 })
      .mockResolvedValueOnce({
        id: 'a-notify',
        status: 'submitted',
        session_id: 's-notify',
        created_by: 'manager-9',
        ai_review_snapshot_json: JSON.stringify({
          overallScore: 4,
          overallVerdict: 'ready_for_approval',
          recommendations: ['Tighten the second answer.'],
          weakAnswerMap: [],
          questionEvaluations: [],
        }),
      })
      .mockResolvedValueOnce({ id: 's-notify', status: 'submitted', assignment_id: 'a-notify' });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    // Not blocked.
    expect(mockRes.status).not.toHaveBeenCalledWith(422);
    // Status flipped to submitted.
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          typeof call[0] === 'string' &&
          String(call[0]).includes('UPDATE interview_assignments') &&
          String(call[0]).includes('status = ?')
      )
    ).toBe(true);
    // Response surfaces the persisted AI score.
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        aiReview: expect.objectContaining({ overallScore: 4 }),
      })
    );
  });

  it('sendBackAssignment: reopens assignment as in_progress with feedback', async () => {
    mockReadAnswerApprovals.mockResolvedValueOnce([]);
    mockReq.params.id = 'a4';
    mockReq.body = {
      reason: 'Add more detail',
      missingItems: [{ key: 'q1', label: 'Clarify answer' }],
    };
    mockReq.user.role = 'ADMIN';
    mockQueryAll.mockResolvedValue([]);

    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a4',
        organization_id: 'org-1',
        session_id: 's4',
        task_id: 't4',
        status: 'submitted',
        assignee_user_id: 'user-1',
      })
      .mockResolvedValueOnce({
        id: 's4',
        organization_id: 'org-1',
        owner_id: 'user-1',
        status: 'submitted',
      })
      .mockResolvedValueOnce({
        id: 'a4',
        organization_id: 'org-1',
        session_id: 's4',
        status: 'in_progress',
        sent_back_reason: 'Add more detail',
        missing_items_json: JSON.stringify([{ key: 'q1', label: 'Clarify answer' }]),
      })
      .mockResolvedValueOnce({
        id: 's4',
        organization_id: 'org-1',
        assignment_id: 'a4',
        status: 'active',
      });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.sendBackAssignment(mockReq, mockRes, mockNext);

    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining(`SET status = 'in_progress'`),
      expect.any(Array)
    );
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'in_progress',
        reviewDecisionMemory: expect.any(Array),
        assignment: expect.objectContaining({
          status: 'in_progress',
          reviewDecisionMemory: expect.any(Array),
        }),
        session: expect.objectContaining({
          id: 's4',
        }),
      })
    );
  });

  it('sendBackAssignment: refuses blanket send-back when per-answer approval receipts exist', async () => {
    mockReq.params.id = 'a-ledger';
    mockReq.body = { reason: 'Revise the answer' };
    mockReq.user.role = 'ADMIN';
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a-ledger',
        organization_id: 'org-1',
        session_id: 's-ledger',
        status: 'submitted',
      })
      .mockResolvedValueOnce({
        id: 's-ledger',
        organization_id: 'org-1',
        status: 'submitted',
      });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await expect(
      InterviewController.sendBackAssignment(mockReq, mockRes, mockNext)
    ).rejects.toMatchObject({ code: 'INTERVIEW_ANSWER_DECISION_REQUIRED', statusCode: 409 });
    expect(
      mockQueryRun.mock.calls.some(([sql]) => String(sql).includes("SET status = 'in_progress'"))
    ).toBe(false);
  });

  it('approveAssignment: stores manager vs AI decision memory', async () => {
    mockReq.params.id = 'a5';
    mockReq.user.role = 'ADMIN';
    mockQueryAll.mockResolvedValue([]);

    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a5',
        organization_id: 'org-1',
        session_id: 's5',
        task_id: 't5',
        status: 'submitted',
        assignee_user_id: 'user-1',
        ai_review_snapshot_json: JSON.stringify({
          overallScore: 2.8,
          overallVerdict: 'needs_improvement',
          recommendations: ['Add detail'],
          questionEvaluations: [],
          weakAnswerMap: [
            {
              key: 'ai_q1',
              label: 'Question 1',
              score: 2,
              verdict: 'needs_improvement',
              feedback: 'More detail',
              fixType: 'expand_answer',
              isRequired: true,
            },
          ],
        }),
        review_decision_memory_json: '[]',
      })
      .mockResolvedValueOnce({
        id: 's5',
        organization_id: 'org-1',
        answered_questions: 8,
        total_questions: 10,
        status: 'submitted',
      })
      .mockResolvedValueOnce({
        id: 'a5',
        organization_id: 'org-1',
        session_id: 's5',
        status: 'approved',
        review_decision_memory_json: JSON.stringify([
          {
            id: 'm1',
            action: 'approve',
            alignment: 'manager_overrode_ai_warning',
          },
        ]),
      })
      .mockResolvedValueOnce({
        id: 's5',
        organization_id: 'org-1',
        assignment_id: 'a5',
        status: 'completed',
        answered_questions: 8,
        total_questions: 10,
      });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.approveAssignment(mockReq, mockRes, mockNext);

    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining(`review_decision_memory_json = ?`),
      expect.any(Array)
    );
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        assignment: expect.objectContaining({
          status: 'approved',
          reviewDecisionMemory: expect.any(Array),
        }),
      })
    );
  });

  it('approveAssignment: blocks roll-up while any frozen per-answer stage is incomplete', async () => {
    mockReq.params.id = 'a-incomplete';
    mockReq.user.role = 'ADMIN';
    mockReadAnswerApprovals.mockResolvedValueOnce([
      { questionId: 'q1', submissionId: 'submission-1', status: 'pending' },
    ]);
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a-incomplete',
        organization_id: 'org-1',
        session_id: 's-incomplete',
        status: 'submitted',
        review_decision_memory_json: '[]',
      })
      .mockResolvedValueOnce({
        id: 's-incomplete',
        organization_id: 'org-1',
        status: 'submitted',
        answered_questions: 1,
        total_questions: 1,
      });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await expect(
      InterviewController.approveAssignment(mockReq, mockRes, mockNext)
    ).rejects.toMatchObject({ code: 'INTERVIEW_ANSWER_APPROVAL_INCOMPLETE', statusCode: 409 });
    expect(
      mockQueryRun.mock.calls.some(([sql]) => String(sql).includes("SET status = 'approved'"))
    ).toBe(false);
  });

  it('decideAnswerApprovals: rechecks manager authority under the same transaction', async () => {
    mockReq.params.id = 'a-review';
    mockReq.user.role = 'ADMIN';
    mockReq.body = {
      submissionId: 'submission-1',
      clientRequestId: 'request-manager-1',
      answers: [{ questionId: 'q1', expectedAnswerUpdatedAt: '2026-09-13T12:00:00.000Z' }],
      decision: 'approved',
    };
    mockAssertReviewAccess.mockResolvedValue({
      canReview: true,
      assignmentId: 'a-review',
      sessionId: 's-review',
      projectId: 'p-review',
    });
    mockApplyAnswerDecision.mockResolvedValueOnce({
      assignmentId: 'a-review',
      submissionId: 'submission-1',
      status: 'applied',
      decisions: [{ questionId: 'q1', decision: 'approved' }],
    });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.decideAnswerApprovals(mockReq, mockRes, mockNext);

    expect(mockAssertReviewAccess).toHaveBeenCalledTimes(2);
    expect(mockAssertReviewAccess).toHaveBeenNthCalledWith(2, mockReq.user, 'a-review', {
      lock: true,
      expectedSessionId: 's-review',
      expectedProjectId: 'p-review',
    });
    expect(mockApplyAnswerDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'manager',
        actor: { type: 'human', id: 'user-1' },
      })
    );
  });

  it('retryAiAnswerApprovals: returns 503 and preserves the pending stage when the provider is unavailable', async () => {
    mockReq.params.id = 'a-ai-retry';
    mockReq.body = { clientRequestId: 'retry-ai-1' };
    mockLlmCall.mockRejectedValueOnce(new Error('provider unavailable'));
    mockQueryOne.mockResolvedValueOnce({
      id: 'a-ai-retry',
      session_id: 's-ai-retry',
      status: 'submitted',
    });
    mockReadAnswerApprovals.mockResolvedValueOnce([
      {
        questionId: 'q1',
        submissionId: 'submission-ai-1',
        answerUpdatedAt: '2026-09-13T12:00:00.000Z',
        nextStage: 'ai',
      },
    ]);
    mockQueryAll.mockResolvedValueOnce([
      {
        id: 'q1',
        question_text: 'Question one',
        status: 'answered',
        answer_text: 'Answer one',
      },
    ]);

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.retryAiAnswerApprovals(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INTERVIEW_ANSWER_AI_UNAVAILABLE',
        messageKey: 'interview.workspace.aiAnswerReviewUnavailable',
      })
    );
    expect(mockApplyAnswerDecision).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', []],
    [
      'foreign',
      [
        {
          questionId: 'q-foreign',
          rubric: [
            { criterion: 'concreteness', score: 4, justification: 'Specific.' },
            { criterion: 'evidence', score: 4, justification: 'Supported.' },
            { criterion: 'depth', score: 4, justification: 'Detailed.' },
            { criterion: 'measurability', score: 4, justification: 'Measured.' },
            { criterion: 'coherence', score: 4, justification: 'Coherent.' },
          ],
          feedback: 'Foreign result.',
        },
      ],
    ],
    [
      'duplicate',
      [
        {
          questionId: 'q1',
          rubric: [
            { criterion: 'concreteness', score: 4, justification: 'Specific.' },
            { criterion: 'evidence', score: 4, justification: 'Supported.' },
            { criterion: 'depth', score: 4, justification: 'Detailed.' },
            { criterion: 'measurability', score: 4, justification: 'Measured.' },
            { criterion: 'coherence', score: 4, justification: 'Coherent.' },
          ],
          feedback: 'First result.',
        },
        {
          questionId: 'q1',
          rubric: [
            { criterion: 'concreteness', score: 4, justification: 'Specific.' },
            { criterion: 'evidence', score: 4, justification: 'Supported.' },
            { criterion: 'depth', score: 4, justification: 'Detailed.' },
            { criterion: 'measurability', score: 4, justification: 'Measured.' },
            { criterion: 'coherence', score: 4, justification: 'Coherent.' },
          ],
          feedback: 'Duplicate result.',
        },
      ],
    ],
  ])(
    'retryAiAnswerApprovals: rejects %s provider question coverage without receipts',
    async (_case, questionEvaluations) => {
      mockReq.params.id = 'a-ai-retry-coverage';
      mockReq.body = { clientRequestId: `retry-ai-coverage-${_case}` };
      mockLlmCall.mockResolvedValueOnce({ object: { recommendations: [], questionEvaluations } });
      mockQueryOne.mockResolvedValueOnce({
        id: 'a-ai-retry-coverage',
        session_id: 's-ai-retry-coverage',
        status: 'submitted',
      });
      mockReadAnswerApprovals.mockResolvedValueOnce([
        {
          questionId: 'q1',
          submissionId: 'submission-ai-coverage',
          answerUpdatedAt: '2026-09-13T12:00:00.000Z',
          nextStage: 'ai',
        },
      ]);
      mockQueryAll.mockResolvedValueOnce([
        {
          id: 'q1',
          question_text: 'Question one',
          status: 'answered',
          answer_text: 'Answer one',
        },
      ]);

      const { InterviewController } =
        await import('../../../../server/src/controllers/InterviewController.js');
      await InterviewController.retryAiAnswerApprovals(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INTERVIEW_ANSWER_AI_UNAVAILABLE',
          messageKey: 'interview.workspace.aiAnswerReviewUnavailable',
        })
      );
      expect(mockApplyAnswerDecision).not.toHaveBeenCalled();
    }
  );

  it('retryAiAnswerApprovals: applies an exact AI verdict with resolved model provenance', async () => {
    mockReq.params.id = 'a-ai-retry-ok';
    mockReq.body = { clientRequestId: 'retry-ai-ok-1' };
    mockLlmCall.mockResolvedValueOnce({
      object: {
        recommendations: [],
        questionEvaluations: [
          {
            questionId: 'q1',
            rubric: [
              { criterion: 'concreteness', score: 4, justification: 'Specific.' },
              { criterion: 'evidence', score: 4, justification: 'Supported.' },
              { criterion: 'depth', score: 4, justification: 'Detailed.' },
              { criterion: 'measurability', score: 4, justification: 'Measured.' },
              { criterion: 'coherence', score: 4, justification: 'Coherent.' },
            ],
            feedback: 'Sufficient.',
          },
        ],
      },
    });
    mockQueryOne.mockResolvedValueOnce({
      id: 'a-ai-retry-ok',
      session_id: 's-ai-retry-ok',
      status: 'submitted',
    });
    mockReadAnswerApprovals
      .mockResolvedValueOnce([
        {
          questionId: 'q1',
          submissionId: 'submission-ai-ok',
          answerUpdatedAt: '2026-09-13T12:00:00.000Z',
          nextStage: 'ai',
        },
      ])
      .mockResolvedValueOnce([
        {
          questionId: 'q1',
          submissionId: 'submission-ai-ok',
          nextStage: null,
          status: 'stages_complete',
        },
      ]);
    mockQueryAll.mockResolvedValueOnce([
      {
        id: 'q1',
        question_text: 'Question one',
        status: 'answered',
        answer_text: 'Answer one',
      },
    ]);
    mockApplyAnswerDecision.mockResolvedValueOnce({ status: 'applied', decisions: [] });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.retryAiAnswerApprovals(mockReq, mockRes, mockNext);

    expect(mockApplyAnswerDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'ai',
        decision: 'approved',
        actor: { type: 'ai', id: expect.stringContaining('interview-rubric:') },
        metadata: expect.objectContaining({
          modelId: 'test-interview-model',
          providerId: 'test-provider',
        }),
      })
    );
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        assignmentId: 'a-ai-retry-ok',
        approvals: [expect.objectContaining({ status: 'stages_complete' })],
      })
    );
  });

  it('getAnswerApprovals: redacts decision actor identity for the respondent', async () => {
    mockReq.params.id = 'a-own';
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a-own',
        assignee_user_id: 'user-1',
        created_by: 'manager-1',
        session_id: 's-own',
      })
      .mockResolvedValueOnce(null);
    mockReadAnswerApprovals.mockResolvedValueOnce([
      {
        questionId: 'q1',
        submissionId: 'submission-1',
        status: 'sent_back',
        actor: { type: 'human', id: 'manager-secret' },
      },
    ]);

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.getAnswerApprovals(mockReq, mockRes, mockNext);

    expect(mockAssertReviewAccess).not.toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith({
      assignmentId: 'a-own',
      approvals: [expect.objectContaining({ questionId: 'q1', actor: null })],
    });
  });

  it('getAnswerApprovals: requires review access for the assignment creator who is not a respondent', async () => {
    mockReq.params.id = 'a-created';
    mockReq.user.id = 'creator-1';
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'a-created',
        assignee_user_id: 'respondent-1',
        session_id: 's-created',
      })
      .mockResolvedValueOnce(null);
    mockAssertReviewAccess.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden'), {
        code: 'INTERVIEW_REVIEW_FORBIDDEN',
        statusCode: 403,
      })
    );

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await expect(
      InterviewController.getAnswerApprovals(mockReq, mockRes, mockNext)
    ).rejects.toMatchObject({ code: 'INTERVIEW_REVIEW_FORBIDDEN' });
    expect(mockReadAnswerApprovals).not.toHaveBeenCalled();
  });

  it.each(['submitted', 'completed'])(
    'updateQuestion: rejects edits when session is %s',
    async (sessionStatus) => {
      mockReq.params.questionId = 'q1';
      mockReq.body = {
        answerText: 'test',
        status: 'answered',
        expectedUpdatedAt: '2026-08-22T20:00:00.000Z',
      };

      mockQueryAll.mockResolvedValueOnce([]);
      mockQueryOne
        .mockResolvedValueOnce({ session_id: 's1' })
        .mockResolvedValueOnce({ assignment_id: null })
        .mockResolvedValueOnce({
          id: 's1',
          assignment_id: null,
          status: sessionStatus,
          owner_id: 'user-1',
        })
        .mockResolvedValueOnce({ session_id: 's1' });

      const { InterviewController } =
        await import('../../../../server/src/controllers/InterviewController.js');
      await InterviewController.updateQuestion(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Session is locked',
        code: 'INTERVIEW_SESSION_LOCKED',
      });
      expect(
        mockQueryRun.mock.calls.some(
          (call) =>
            typeof call[0] === 'string' &&
            String(call[0]).toLowerCase().includes('update interview_questions')
        )
      ).toBe(false);
    }
  );

  it('updateQuestion: blocks edits to an approved sibling while another answer is returned', async () => {
    mockReq.params.questionId = 'q-approved';
    mockReq.body = {
      answerText: 'Changed after approval',
      status: 'answered',
      expectedUpdatedAt: '2026-08-22T20:00:00.000Z',
    };
    mockQueryAll.mockResolvedValueOnce([
      { id: 'a-returned', session_id: 's-returned', status: 'sent_back' },
    ]);
    mockQueryOne
      .mockResolvedValueOnce({ session_id: 's-returned' })
      .mockResolvedValueOnce({ assignment_id: 'a-returned' })
      .mockResolvedValueOnce({
        id: 's-returned',
        assignment_id: 'a-returned',
        status: 'active',
        owner_id: 'user-1',
      })
      .mockResolvedValueOnce({ session_id: 's-returned' });
    mockReadAnswerApprovals.mockResolvedValueOnce([
      {
        questionId: 'q-returned',
        status: 'sent_back',
      },
      {
        questionId: 'q-approved',
        status: 'stages_complete',
      },
    ]);

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.updateQuestion(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(409);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERVIEW_ANSWER_REVISION_NOT_RETURNED' })
    );
    expect(
      mockQueryRun.mock.calls.some(([sql]) =>
        String(sql).toLowerCase().includes('update interview_questions')
      )
    ).toBe(false);
  });

  it('updateSession: allows status-only completion updates for ad-hoc sessions', async () => {
    mockReq.params.id = 's-ad-hoc';
    mockReq.body = { status: 'completed' };

    mockQueryOne
      // sessionCheck
      .mockResolvedValueOnce({
        id: 's-ad-hoc',
        assignment_id: null,
        status: 'active',
      })
      // updated session row
      .mockResolvedValueOnce({
        id: 's-ad-hoc',
        organization_id: 'org-1',
        project_id: null,
        owner_id: 'user-1',
        name: 'Ad-hoc interview',
        status: 'completed',
        assignment_id: null,
        progress_json: '{}',
        total_questions: 6,
        answered_questions: 6,
        summary_facts: '[]',
        summary_gaps: '[]',
        summary_constraints: '[]',
        summary_pain_points: '[]',
        runtime_mode_default: 'single_question',
        started_at: '2026-05-01T00:00:00.000Z',
        completed_at: '2026-05-01T00:10:00.000Z',
        last_activity_at: '2026-05-01T00:10:00.000Z',
      });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.updateSession(mockReq, mockRes, mockNext);

    expect(mockRes.status).not.toHaveBeenCalledWith(400);
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE interview_sessions SET'),
      expect.arrayContaining(['completed'])
    );
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 's-ad-hoc',
        status: 'completed',
      })
    );
  });
});
