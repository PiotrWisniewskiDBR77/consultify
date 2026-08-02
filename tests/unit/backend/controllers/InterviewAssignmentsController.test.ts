/**
 * InterviewController - Assignment workflow unit tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockLlmCall = vi.fn();
const mockGetTableColumns = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
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
  llmService: { call: (...args: unknown[]) => mockLlmCall(...args) },
}));

vi.mock('../../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
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
    mockLlmCall.mockReset();
    mockGetTableColumns.mockReset();
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
        aiReview: expect.objectContaining({
          overallVerdict: 'empty',
        }),
      })
    );
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
        aiReview: expect.objectContaining({
          overallVerdict: 'empty',
        }),
      })
    );
  });

  it('submitAssignment: allows re-submit from an already submitted assignment', async () => {
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
      mockQueryRun.mock.calls.some(
        (call) =>
          typeof call[0] === 'string' &&
          String(call[0]).includes('sent_back_at = NULL') &&
          String(call[0]).includes('sent_back_reason = NULL')
      )
    ).toBe(true);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        entersContext: false,
        completenessPercent: 80,
        aiReview: expect.objectContaining({
          overallVerdict: 'empty',
        }),
      })
    );
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

  // L-07 / SPEC_13 §5.1 — hard floor edge case (b):
  // AI verdict "insufficient" WITH questions present (none required-missing) → 422.
  it('submitAssignment: HARD-BLOCKS (422) when AI verdict is insufficient even with questions present', async () => {
    mockReq.params.id = 'a-ai-insuff';
    // AI returns an "insufficient" overall verdict with insufficient per-question
    // evaluations. No required question is missing — the block comes from the AI floor.
    mockLlmCall.mockResolvedValue({
      object: {
        overallScore: 1.4,
        overallVerdict: 'insufficient',
        recommendations: ['Provide concrete details.'],
        questionEvaluations: [
          {
            questionId: 'q1',
            score: 1,
            verdict: 'insufficient',
            feedback: 'Too vague.',
            fixType: 'make_specific',
          },
        ],
      },
    });
    mockQueryAll
      // #1 updateSessionProgress
      .mockResolvedValueOnce([{ category: 'general', status: 'answered' }])
      // #2 submit gate questions — answered but not required
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
        id: 'a-ai-insuff',
        organization_id: 'org-1',
        assignee_user_id: 'user-1',
        session_id: 's-ai-insuff',
        task_id: null,
        status: 'in_progress',
        created_by: 'user-2',
      })
      .mockResolvedValueOnce({ id: 's-ai-insuff', organization_id: 'org-1', status: 'active' })
      .mockResolvedValueOnce({ answered_questions: 1, total_questions: 1 });

    const { InterviewController } =
      await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(422);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'OBJECTIVE_INSUFFICIENCY',
        reason: 'ai_insufficient',
        requiredMissingCount: 0,
        blockedItems: expect.arrayContaining([expect.objectContaining({ questionId: 'q1' })]),
      })
    );
    // Status must NOT flip — draft stays editable.
    expect(
      mockQueryRun.mock.calls.some(
        (call) =>
          typeof call[0] === 'string' &&
          String(call[0]).includes('UPDATE interview_assignments') &&
          String(call[0]).includes('status = ?')
      )
    ).toBe(false);
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
      .mockResolvedValueOnce({ id: 's-ok', status: 'submitted', assignment_id: 'a-ok' });

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

  it.each(['submitted', 'completed'])(
    'updateQuestion: rejects edits when session is %s',
    async (sessionStatus) => {
      mockReq.params.questionId = 'q1';
      mockReq.body = { answerText: 'test', status: 'answered' };

      mockQueryOne.mockResolvedValueOnce({
        session_id: 's1',
        session_status: sessionStatus,
        owner_id: 'user-1',
      });

      const { InterviewController } =
        await import('../../../../server/src/controllers/InterviewController.js');
      await InterviewController.updateQuestion(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Session is locked' });
      expect(
        mockQueryRun.mock.calls.some(
          (call) =>
            typeof call[0] === 'string' &&
            String(call[0]).toLowerCase().includes('update interview_questions')
        )
      ).toBe(false);
    }
  );

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
