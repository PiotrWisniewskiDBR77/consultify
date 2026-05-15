import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLlmCall = vi.fn();
const mockGetManagerProblems = vi.fn();

vi.mock('../../ai/llmService.js', () => ({
  default: {
    call: (...args: unknown[]) => mockLlmCall(...args),
  },
}));

vi.mock('../managerProblemsService.js', () => ({
  getManagerProblems: (...args: unknown[]) => mockGetManagerProblems(...args),
}));

import { getAiManageAll, getAiRecommendation, getAiTriage } from '../managerAiService.js';

const ORG = 'org-test-001';
const LANE = 'action-queue';

const sampleProblem = {
  id: 'p1',
  severity: 'warning' as const,
  problemType: 'OVERDUE_TASK',
  title: 'Late delivery',
  rootCause: 'Slipped dates',
  sourceEntityType: 'TASK' as const,
  sourceEntityId: 't-1',
  sourceEntityName: 'Integration work',
  ownerId: 'u-pm',
  ownerName: 'PM',
  daysOverdue: 4,
  impactCount: 1,
  affectedEntities: [{ id: 'i-1', name: 'Initiative A', type: 'INITIATIVE' as const }],
  actions: [{ id: 'reassign', label: 'Reassign' }],
  meta: {},
};

describe('managerAiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAiRecommendation merges LLM output with problemId', async () => {
    mockGetManagerProblems.mockResolvedValue([sampleProblem]);
    mockLlmCall.mockResolvedValue({
      object: {
        diagnosis: 'Test',
        recommendation: 'Do X',
        steps: [
          {
            order: 1,
            action: 'Fix',
            owner: 'PM',
            timeframe: '1d',
            outcome: 'Fixed',
          },
        ],
        confidence: 85,
        reasoning: 'Because',
        alternativeApproach: 'Or Y',
      },
    });

    const result = await getAiRecommendation(ORG, LANE, 'p1');

    expect(result.problemId).toBe('p1');
    expect(result.diagnosis).toBe('Test');
    expect(result.recommendation).toBe('Do X');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].action).toBe('Fix');
    expect(mockGetManagerProblems).toHaveBeenCalledWith(ORG, LANE, undefined);
    expect(mockLlmCall).toHaveBeenCalled();
  });

  it('getAiTriage returns clusters and executiveSummary', async () => {
    mockGetManagerProblems.mockResolvedValue([sampleProblem]);
    mockLlmCall.mockResolvedValue({
      object: {
        clusters: [
          {
            theme: 'Delays',
            severity: 'critical',
            problemIds: ['p1'],
            summary: 'Many delays',
            suggestedAction: 'Replan',
          },
        ],
        topPriority: ['p1'],
        executiveSummary: 'Critical delays',
      },
    });

    const result = await getAiTriage(ORG, LANE);

    expect(result.clusters).toHaveLength(1);
    expect(result.executiveSummary).toBe('Critical delays');
    expect(result.clusters[0].problemIds).toContain('p1');
  });

  it('getAiManageAll returns executiveSummary and clusters with laneId', async () => {
    mockGetManagerProblems.mockResolvedValue([sampleProblem]);
    mockLlmCall.mockResolvedValue({
      object: {
        executiveSummary: 'Plan',
        clusters: [
          {
            theme: 'Overload',
            severity: 'warning',
            diagnosis: 'Too much work',
            steps: [
              {
                order: 1,
                action: 'Distribute',
                owner: 'PM',
                timeframe: '1w',
                outcome: 'Balanced',
              },
            ],
            affectedProblemIds: ['p1'],
          },
        ],
        quickWins: ['Reassign task-1'],
        escalationNeeded: [],
      },
    });

    const result = await getAiManageAll(ORG, LANE);

    expect(result.laneId).toBe(LANE);
    expect(result.executiveSummary).toBe('Plan');
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].affectedProblemIds).toContain('p1');
  });
});
