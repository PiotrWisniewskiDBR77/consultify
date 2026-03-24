/**
 * InterviewController - Assignment workflow unit tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();

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
  llmService: { call: vi.fn() },
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

  it('submitAssignment: <50% stays submitted and locks session', async () => {
    mockReq.params.id = 'a1';

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
        answered_questions: 2,
        total_questions: 10,
      })
      // updated assignment
      .mockResolvedValueOnce({ id: 'a1', status: 'submitted', session_id: 's1', created_by: 'user-2' })
      // updated session
      .mockResolvedValueOnce({ id: 's1', status: 'submitted', assignment_id: 'a1' });

    const { InterviewController } = await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    expect(mockQueryRun).toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        entersContext: false,
        completenessPercent: 20,
      })
    );
  });

  it('submitAssignment: >=50% still stays submitted (approval is separate)', async () => {
    mockReq.params.id = 'a2';

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
        answered_questions: 5,
        total_questions: 10,
      })
      // updated assignment
      .mockResolvedValueOnce({ id: 'a2', status: 'submitted', session_id: 's2', created_by: 'user-2' })
      // updated session
      .mockResolvedValueOnce({ id: 's2', status: 'submitted', assignment_id: 'a2' });

    const { InterviewController } = await import('../../../../server/src/controllers/InterviewController.js');
    await InterviewController.submitAssignment(mockReq, mockRes, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        entersContext: false,
        completenessPercent: 50,
      })
    );
  });

  it('updateQuestion: rejects edits when session is locked', async () => {
    mockReq.params.questionId = 'q1';
    mockReq.body = { answerText: 'test', status: 'answered' };

    mockQueryOne.mockResolvedValueOnce({
      session_id: 's1',
      session_status: 'submitted',
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
});

