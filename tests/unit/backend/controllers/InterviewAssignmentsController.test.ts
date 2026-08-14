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
      new Set(['ai_review_snapshot_json', 'ai_reviewed_at', 'review_decision_memory_json', 'missing_items_json'])
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

  it('getAssignment: direct respondent can read own assignment without manager permission', async () => {
    mockReq.params.id = 'a-own';
    mockQueryOne.mockResolvedValueOnce({
      id: 'a-own',
      organization_id: 'org-1',
      assignee_user_id: 'user-1',
      template_id: 'tpl-1',
      template_name: 'CEPD interview',
      status: 'in_progress',
      answered_questions: 0,
      total_questions: 24,
      is_team_assignment: 0,
      created_by: 'admin-1',
    });

    const { InterviewController } = await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.getAssignment(mockReq, mockRes, mockNext);

    expect(mockRes.status).not.toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'a-own',
        assignee: expect.objectContaining({ id: 'user-1' }),
      })
    );
  });

  it('getAssignment: unrelated respondent is denied', async () => {
    mockReq.params.id = 'a-other';
    mockQueryOne.mockResolvedValueOnce({
      id: 'a-other',
      organization_id: 'org-1',
      assignee_user_id: 'user-2',
      status: 'assigned',
      is_team_assignment: 0,
      created_by: 'admin-1',
    });
    mockGetTableColumns.mockResolvedValueOnce(new Set());

    const { InterviewController } = await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.getAssignment(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Forbidden' });
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

    const { InterviewController } = await import('../../../../server/src/controllers/InterviewController.js');
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

    const { InterviewController } = await import('../../../../server/src/controllers/InterviewController.js');
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

    const { InterviewController } = await import('../../../../server/src/controllers/InterviewController.js');
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

  it('sendBackAssignment: reopens assignment as in_progress with feedback', async () => {
    mockReq.params.id = 'a4';
    mockReq.body = { reason: 'Add more detail', missingItems: [{ key: 'q1', label: 'Clarify answer' }] };
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

    const { InterviewController } = await import('../../../../server/src/controllers/InterviewController.js');
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
          weakAnswerMap: [{ key: 'ai_q1', label: 'Question 1', score: 2, verdict: 'needs_improvement', feedback: 'More detail', fixType: 'expand_answer', isRequired: true }],
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

    const { InterviewController } = await import('../../../../server/src/controllers/InterviewController.js');
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

  it('updateQuestion: rejects edits only when session is completed', async () => {
    mockReq.params.questionId = 'q1';
    mockReq.body = { answerText: 'test', status: 'answered' };

    mockQueryOne.mockResolvedValueOnce({
      session_id: 's1',
      session_status: 'completed',
      owner_id: 'user-1',
    });

    const { InterviewController } = await import('../../../../server/src/controllers/InterviewController.js');
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

    const { InterviewController } = await import('../../../../server/src/controllers/InterviewController.js');
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
