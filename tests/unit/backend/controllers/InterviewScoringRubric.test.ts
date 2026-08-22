/**
 * #48a — Interview answer scoring: objective rubric (Oxford style).
 *
 * Covers server/src/controllers/InterviewController.ts `evaluateSessionAnswers`
 * (the endpoint the `aiScore` column in InterviewHub.tsx reads via
 * assignment.aiReview.overallScore). The rubric itself — five named criteria,
 * each judged 0-4 by the LLM with a justification — is exposed on the
 * response as `rubricCriteria` so the scoring is never a black box.
 *
 * Key behaviors under test:
 *  - The rubric criteria are explicit, named, and returned with every response.
 *  - Per-question and session-level scores are computed deterministically in
 *    code from the rubric (the LLM never supplies a final score/verdict).
 *  - Unanswered questions are scored without an LLM call at all.
 *  - The LLM is called at low (near-zero) temperature for stability.
 *  - Required answers weigh more than optional ones in the session score.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...args: unknown[]) => mockLlmCall(...args) },
}));

vi.mock('../../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));

vi.mock('uuid', () => ({ v4: () => 'uuid-123' }));

const RUBRIC_KEYS = ['concreteness', 'evidence', 'depth', 'measurability', 'coherence'];

const rubricAt = (score: number) =>
  RUBRIC_KEYS.map((criterion) => ({ criterion, score, justification: `stub:${criterion}` }));

describe('InterviewController — objective scoring rubric (#48a)', () => {
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
      new Set(['ai_review_snapshot_json', 'ai_reviewed_at', 'review_decision_memory_json'])
    );

    mockReq = {
      user: { id: 'user-1', organizationId: 'org-1', role: 'USER' },
      params: { sessionId: 's1' },
      query: {},
      body: {},
    };
    mockRes = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    mockNext = vi.fn();
  });

  it('returns the explicit rubric criteria (jawna rubryka) with every response', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: 's1', organization_id: 'org-1', name: 'Session', owner_id: 'user-1' })
      // assignment lookup inside the persist branch — none found, skip persist.
      .mockResolvedValueOnce(null);
    mockQueryAll.mockResolvedValueOnce([
      {
        id: 'q1',
        question_text: 'What is the core problem?',
        is_required: 1,
        status: 'answered',
        answer_text: 'Our onboarding drop-off is 40% at step 3, per the March cohort data.',
      },
    ]);
    mockLlmCall.mockResolvedValue({
      object: {
        questionEvaluations: [{ questionId: 'q1', rubric: rubricAt(4), feedback: 'Strong.' }],
        recommendations: [],
      },
    });

    const { InterviewController } = await import(
      '../../../../server/src/controllers/InterviewController.js'
    );
    await InterviewController.evaluateSessionAnswers(mockReq, mockRes, mockNext);

    const response = mockRes.json.mock.calls[0][0];
    expect(response.rubricVersion).toBe('oxford-v1');
    expect(response.rubricCriteria.map((c: any) => c.key).sort()).toEqual(
      [...RUBRIC_KEYS].sort()
    );
    // Every criterion must carry a human-readable label + description — no
    // opaque codes, this is the "kryteria w kodzie, nie czarna skrzynka" bar.
    for (const criterion of response.rubricCriteria) {
      expect(typeof criterion.label).toBe('string');
      expect(criterion.label.length).toBeGreaterThan(0);
      expect(typeof criterion.description).toBe('string');
      expect(criterion.description.length).toBeGreaterThan(0);
      expect(criterion.maxScore).toBe(4);
    }
  });

  it('computes the per-question and session score deterministically from the rubric total (not an LLM-guessed number)', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: 's1', organization_id: 'org-1', name: 'Session', owner_id: 'user-1' })
      .mockResolvedValueOnce(null);
    mockQueryAll.mockResolvedValueOnce([
      {
        id: 'q1',
        question_text: 'What is the core problem?',
        is_required: 1,
        status: 'answered',
        answer_text: 'Onboarding drop-off is 40% at step 3 (March cohort, n=1,200).',
      },
    ]);
    // Deliberately include stray overallScore/overallVerdict fields the way a
    // sloppy LLM response might — they must be IGNORED; only the rubric drives
    // the number.
    mockLlmCall.mockResolvedValue({
      object: {
        overallScore: 1.1,
        overallVerdict: 'insufficient',
        questionEvaluations: [{ questionId: 'q1', rubric: rubricAt(4), feedback: 'Excellent.' }],
        recommendations: [],
      },
    });

    const { InterviewController } = await import(
      '../../../../server/src/controllers/InterviewController.js'
    );
    await InterviewController.evaluateSessionAnswers(mockReq, mockRes, mockNext);

    const response = mockRes.json.mock.calls[0][0];
    // 5 criteria x 4/4 = 20/20 -> mapped to the 1-5 scale: 5.0.
    expect(response.questionEvaluations[0].rubricTotal).toBe(20);
    expect(response.questionEvaluations[0].rubricMax).toBe(20);
    expect(response.questionEvaluations[0].score).toBe(5);
    expect(response.questionEvaluations[0].verdict).toBe('sufficient');
    expect(response.overallScore).toBe(5);
    expect(response.overallVerdict).toBe('ready_for_approval');
  });

  it('is reproducible: identical rubric input yields identical output on repeated calls', async () => {
    const buildMocks = () => {
      mockQueryOne
        .mockResolvedValueOnce({ id: 's1', organization_id: 'org-1', name: 'Session', owner_id: 'user-1' })
        .mockResolvedValueOnce(null);
      mockQueryAll.mockResolvedValueOnce([
        {
          id: 'q1',
          question_text: 'What is the core problem?',
          is_required: 1,
          status: 'answered',
          answer_text: 'We lose 12% of revenue to late shipments each quarter.',
        },
      ]);
      mockLlmCall.mockResolvedValue({
        object: {
          questionEvaluations: [{ questionId: 'q1', rubric: rubricAt(3), feedback: 'Good.' }],
          recommendations: ['Add a named source.'],
        },
      });
    };

    const { InterviewController } = await import(
      '../../../../server/src/controllers/InterviewController.js'
    );

    buildMocks();
    await InterviewController.evaluateSessionAnswers(mockReq, mockRes, mockNext);
    const first = mockRes.json.mock.calls[0][0];

    mockRes.json.mockClear();
    buildMocks();
    await InterviewController.evaluateSessionAnswers(mockReq, mockRes, mockNext);
    const second = mockRes.json.mock.calls[0][0];

    expect(second.overallScore).toBe(first.overallScore);
    expect(second.overallVerdict).toBe(first.overallVerdict);
    expect(second.questionEvaluations[0].score).toBe(first.questionEvaluations[0].score);
  });

  it('scores unanswered questions without ever calling the LLM', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: 's1', organization_id: 'org-1', name: 'Session', owner_id: 'user-1' })
      .mockResolvedValueOnce(null);
    mockQueryAll.mockResolvedValueOnce([
      {
        id: 'q1',
        question_text: 'What is the core problem?',
        is_required: 1,
        status: 'not_started',
        answer_text: '',
      },
    ]);

    const { InterviewController } = await import(
      '../../../../server/src/controllers/InterviewController.js'
    );
    await InterviewController.evaluateSessionAnswers(mockReq, mockRes, mockNext);

    expect(mockLlmCall).not.toHaveBeenCalled();
    const response = mockRes.json.mock.calls[0][0];
    expect(response.questionEvaluations[0].verdict).toBe('unanswered');
    expect(response.questionEvaluations[0].score).toBe(1);
    expect(response.questionEvaluations[0].rubricTotal).toBe(0);
    expect(response.overallVerdict).toBe('insufficient');
  });

  it('calls the LLM at low (near-deterministic) temperature', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: 's1', organization_id: 'org-1', name: 'Session', owner_id: 'user-1' })
      .mockResolvedValueOnce(null);
    mockQueryAll.mockResolvedValueOnce([
      {
        id: 'q1',
        question_text: 'What is the core problem?',
        is_required: 1,
        status: 'answered',
        answer_text: 'Some concrete answer with a number: 42%.',
      },
    ]);
    mockLlmCall.mockResolvedValue({
      object: {
        questionEvaluations: [{ questionId: 'q1', rubric: rubricAt(2), feedback: 'OK.' }],
        recommendations: [],
      },
    });

    const { InterviewController } = await import(
      '../../../../server/src/controllers/InterviewController.js'
    );
    await InterviewController.evaluateSessionAnswers(mockReq, mockRes, mockNext);

    expect(mockLlmCall).toHaveBeenCalledTimes(1);
    const callArgs = mockLlmCall.mock.calls[0][0];
    expect(callArgs.temperature).toBeLessThanOrEqual(0.2);
  });

  it('returns a canonical retryable 503 without fabricating or persisting an evaluation when the provider is unavailable', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 's1',
      organization_id: 'org-1',
      name: 'Session',
      owner_id: 'user-1',
    });
    mockQueryAll.mockResolvedValueOnce([
      {
        id: 'q1',
        question_text: 'What is the core problem?',
        is_required: 1,
        status: 'answered',
        answer_text: 'A persisted answer that must remain untouched.',
      },
    ]);
    mockLlmCall.mockRejectedValueOnce(Object.assign(new Error('provider unavailable'), {
      code: 'CIRCUIT_OPEN',
    }));

    const { InterviewController } = await import(
      '../../../../server/src/controllers/InterviewController.js'
    );
    await InterviewController.evaluateSessionAnswers(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'AI evaluation is temporarily unavailable',
      code: 'INTERVIEW_EVALUATION_UNAVAILABLE',
      retryable: true,
    });
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('weighs a required answer more heavily than an optional one in the session score', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: 's1', organization_id: 'org-1', name: 'Session', owner_id: 'user-1' })
      .mockResolvedValueOnce(null);
    mockQueryAll.mockResolvedValueOnce([
      {
        id: 'q1',
        question_text: 'Required question',
        is_required: 1,
        status: 'answered',
        answer_text: 'A mediocre answer.',
      },
      {
        id: 'q2',
        question_text: 'Optional question',
        is_required: 0,
        status: 'answered',
        answer_text: 'An excellent, thorough, well-evidenced answer.',
      },
    ]);
    mockLlmCall.mockResolvedValue({
      object: {
        questionEvaluations: [
          { questionId: 'q1', rubric: rubricAt(2), feedback: 'Thin.' }, // 10/20 -> 3.0, needs_improvement
          { questionId: 'q2', rubric: rubricAt(4), feedback: 'Great.' }, // 20/20 -> 5.0, sufficient
        ],
        recommendations: [],
      },
    });

    const { InterviewController } = await import(
      '../../../../server/src/controllers/InterviewController.js'
    );
    await InterviewController.evaluateSessionAnswers(mockReq, mockRes, mockNext);

    const response = mockRes.json.mock.calls[0][0];
    // Weighted average: (3.0*1.5 + 5.0*1) / (1.5 + 1) = 9.5 / 2.5 = 3.8
    expect(response.overallScore).toBe(3.8);
    expect(response.overallVerdict).toBe('ready_for_approval');
  });
});
