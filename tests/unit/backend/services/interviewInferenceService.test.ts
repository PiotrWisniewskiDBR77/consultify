/**
 * interviewInferenceService — S4 conversational/structured inference unit tests
 * (L-03 / SPEC_13 §F EPIK 4 · M10 Wywiad).
 *
 * Covers the conversational-mode inference path that the f2 evidence flagged as the
 * weakest-tested S4 surface: insight extraction (scoring), evidence gating, and
 * persistence + run lifecycle. The LLM and DB are mocked so the test exercises the
 * service's own logic (evidence selection, INSERT shape, run status transitions)
 * deterministically, with no network or DB dependency.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
const mockLlmCall = vi.fn();
const mockBuildResolvedContext = vi.fn();
const mockLogger = { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() };

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({ default: mockLogger }));

vi.mock('../../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...args: unknown[]) => mockLlmCall(...args) },
}));

vi.mock(
  '../../../../server/src/services/organizationContext/OrganizationContextService.js',
  () => ({
    default: {
      buildResolvedContext: (...args: unknown[]) => mockBuildResolvedContext(...args),
    },
  })
);

vi.mock('uuid', () => {
  let n = 0;
  return { v4: () => `uuid-${++n}` };
});

const ORG = 'org-1';

describe('interviewInferenceService (S4 inference)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockReset();
    mockDbGet.mockReset();
    mockDbRun.mockReset();
    mockLlmCall.mockReset();
    mockBuildResolvedContext.mockReset();
    mockDbRun.mockResolvedValue(undefined);
    mockBuildResolvedContext.mockResolvedValue({ profile: { companyName: 'Org' } });
  });

  it('startInferenceRun: inserts a running run scoped to the org and returns its id', async () => {
    const { startInferenceRun } = await import(
      '../../../../server/src/services/interviewInferenceService.js'
    );
    const id = await startInferenceRun(ORG, 'proj-1', ['s1', 's2'], 'user-1');

    expect(typeof id).toBe('string');
    const insertCall = mockDbRun.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO interview_inference_runs')
    );
    expect(insertCall).toBeTruthy();
    const params = insertCall![1] as unknown[];
    expect(params).toContain(ORG);
    expect(params).toContain('proj-1');
    // session_ids persisted as a JSON array.
    expect(params.some((p) => typeof p === 'string' && p.includes('"s1"') && p.includes('"s2"'))).toBe(
      true
    );
  });

  it('executeInference: extracts insights from high-confidence evidence and persists each + completes the run', async () => {
    // Run lookup (org-scoped).
    mockDbGet.mockResolvedValueOnce({
      id: 'run-1',
      organization_id: ORG,
      session_ids: JSON.stringify(['s1']),
    });
    // Answered questions: q1 is high-confidence primary evidence, q2 is a gap.
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'q1',
        session_id: 's1',
        category: 'risk',
        question_text: 'What is the biggest delivery risk?',
        answer_text: 'Vendor lead time is unpredictable.',
        confidence_score: 4,
        status: 'answered',
      },
      {
        id: 'q2',
        session_id: 's1',
        category: 'gap',
        question_text: 'How is throughput measured?',
        answer_text: 'Not sure yet.',
        confidence_score: 1,
        status: 'needs_follow_up',
      },
    ]);

    mockLlmCall.mockResolvedValue({
      object: {
        insights: [
          {
            category: 'risk',
            statement: 'Unpredictable vendor lead time threatens delivery commitments.',
            whyItMatters: 'Schedule slippage cascades to client SLAs.',
            recommendation: 'Introduce a buffer + dual sourcing.',
            confidenceScore: 4,
            evidence: [{ sessionId: 's1', questionId: 'q1', excerpt: 'Vendor lead time is unpredictable.' }],
            assumptions: ['Current single-vendor setup persists.'],
            unknowns: ['Actual variance in lead time.'],
            counterpoints: ['Lead time may stabilize post-contract.'],
          },
        ],
      },
      usage: { totalTokens: 1234 },
    });

    const { executeInference } = await import(
      '../../../../server/src/services/interviewInferenceService.js'
    );
    await executeInference(ORG, 'run-1');

    // The LLM prompt should carry the high-confidence answer as primary evidence
    // and the needs_follow_up item as a gap.
    const llmArgs = mockLlmCall.mock.calls[0][0] as any;
    const userPrompt = String(llmArgs.messages[0].content);
    expect(userPrompt).toContain('Vendor lead time is unpredictable.');
    expect(userPrompt).toContain('How is throughput measured?');

    // Insight persisted with category + confidence + run linkage.
    const insightInsert = mockDbRun.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO interview_insights')
    );
    expect(insightInsert).toBeTruthy();
    const insightParams = insightInsert![1] as unknown[];
    expect(insightParams).toContain(ORG);
    expect(insightParams).toContain('risk');
    expect(insightParams).toContain(4); // confidenceScore
    expect(insightParams).toContain('run-1'); // inference_run_id

    // Run marked completed with the insight count + tokens.
    const completeUpdate = mockDbRun.mock.calls.find(
      (c) =>
        typeof c[0] === 'string' &&
        c[0].includes('UPDATE interview_inference_runs') &&
        c[0].includes("status = 'completed'")
    );
    expect(completeUpdate).toBeTruthy();
    const completeParams = completeUpdate![1] as unknown[];
    expect(completeParams[0]).toBe(1); // insights_count
    expect(completeParams[1]).toBe(1234); // tokens_used
  });

  it('executeInference: marks the run failed (not thrown) when there are zero sessions', async () => {
    mockDbGet.mockResolvedValueOnce({
      id: 'run-empty',
      organization_id: ORG,
      session_ids: JSON.stringify([]),
    });

    const { executeInference } = await import(
      '../../../../server/src/services/interviewInferenceService.js'
    );
    await expect(executeInference(ORG, 'run-empty')).resolves.toBeUndefined();

    const failUpdate = mockDbRun.mock.calls.find(
      (c) =>
        typeof c[0] === 'string' &&
        c[0].includes('UPDATE interview_inference_runs') &&
        c[0].includes("status = 'failed'")
    );
    expect(failUpdate).toBeTruthy();
    expect(String((failUpdate![1] as unknown[])[0])).toContain('No session IDs');
    // No insight rows written.
    expect(
      mockDbRun.mock.calls.some(
        (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO interview_insights')
      )
    ).toBe(false);
  });

  it('executeInference: marks the run failed when the LLM call throws', async () => {
    mockDbGet.mockResolvedValueOnce({
      id: 'run-llm-fail',
      organization_id: ORG,
      session_ids: JSON.stringify(['s1']),
    });
    mockDbAll.mockResolvedValueOnce([
      {
        id: 'q1',
        session_id: 's1',
        category: 'risk',
        question_text: 'Q?',
        answer_text: 'A.',
        confidence_score: 4,
        status: 'answered',
      },
    ]);
    mockLlmCall.mockRejectedValue(new Error('LLM provider down'));

    const { executeInference } = await import(
      '../../../../server/src/services/interviewInferenceService.js'
    );
    await expect(executeInference(ORG, 'run-llm-fail')).resolves.toBeUndefined();

    const failUpdate = mockDbRun.mock.calls.find(
      (c) =>
        typeof c[0] === 'string' &&
        c[0].includes('UPDATE interview_inference_runs') &&
        c[0].includes("status = 'failed'")
    );
    expect(failUpdate).toBeTruthy();
    expect(String((failUpdate![1] as unknown[])[0])).toContain('LLM provider down');
  });

  it('executeInference: returns early (no writes) when the run is not found / cross-org', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    const { executeInference } = await import(
      '../../../../server/src/services/interviewInferenceService.js'
    );
    await executeInference(ORG, 'missing-run');

    expect(mockDbRun).not.toHaveBeenCalled();
    expect(mockLlmCall).not.toHaveBeenCalled();
  });

  it('getInferenceRun: returns null for a cross-org / missing run id', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const { getInferenceRun } = await import(
      '../../../../server/src/services/interviewInferenceService.js'
    );
    expect(await getInferenceRun(ORG, 'nope')).toBeNull();
  });
});
