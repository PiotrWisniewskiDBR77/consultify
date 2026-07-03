import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GateType } from '../../../server/src/constants/initiativeStatuses.js';

// ── Mocks ────────────────────────────────────────────────────────────────────
// DB layer used by the service to fetch the initiative row.
const mockQueryOne = vi.fn();
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryAll: vi.fn(),
  queryRun: vi.fn(),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// The EXISTING adversarial reviewer (default-exported singleton).
const mockReviewSectionContent = vi.fn();
vi.mock('../../../server/src/services/initiativeGenerationService.js', () => ({
  default: {
    reviewSectionContent: (...args: unknown[]) => mockReviewSectionContent(...args),
  },
}));

// Per-org threshold resolver.
const mockGetGateAiThreshold = vi.fn();
vi.mock('../../../server/src/services/initiative/initiativeGateAiConfig.js', () => ({
  getGateAiThreshold: (...args: unknown[]) => mockGetGateAiThreshold(...args),
}));

import {
  getGateReadiness,
  clearGateReadinessCache,
} from '../../../server/src/services/initiative/gateAiReadinessService.js';

const ORG = 'org-1';
const INIT = 'init-1';

function review(score: number, extra: Record<string, unknown> = {}) {
  return {
    score,
    verdict: score >= 90 ? 'PASS' : 'FAIL',
    failedValidators: [],
    qualityGaps: [],
    fixes: [],
    sectionKey: 'x',
    model: 'test',
    degraded: false,
    ...extra,
  };
}

describe('gateAiReadinessService.getGateReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearGateReadinessCache();
    mockGetGateAiThreshold.mockResolvedValue(75);
    mockQueryOne.mockResolvedValue({
      id: INIT,
      organization_id: ORG,
      summary: 'A solid overview narrative',
      problem_statement: 'A well-stated problem',
    });
    mockReviewSectionContent.mockResolvedValue(review(90));
  });

  it('non-AI gate → trivially ready (score 100, no reviewer/DB calls)', async () => {
    const res = await getGateReadiness(INIT, GateType.SEND_BACK, ORG);
    expect(res).toEqual({ score: 100, threshold: 75, verdict: 'ready', gaps: [], fixes: [] });
    expect(mockReviewSectionContent).not.toHaveBeenCalled();
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it('all sections pass → verdict ready, no gaps', async () => {
    mockReviewSectionContent.mockResolvedValue(review(88));
    const res = await getGateReadiness(INIT, GateType.SUBMIT_FOR_REVIEW, ORG);
    expect(res).not.toBeNull();
    expect(res!.verdict).toBe('ready');
    expect(res!.score).toBe(88);
    expect(res!.gaps).toEqual([]);
    // SUBMIT_FOR_REVIEW requires overview + problemDefinition → 2 reviews.
    expect(mockReviewSectionContent).toHaveBeenCalledTimes(2);
  });

  it('one section below threshold → verdict below + that section in gaps + fixes deduped', async () => {
    mockReviewSectionContent.mockImplementation((sectionKey: string) => {
      if (sectionKey === 'problemDefinition') {
        return Promise.resolve(
          review(40, {
            qualityGaps: ['no metrics'],
            failedValidators: ['problem_quantified'],
            fixes: ['Quantify the problem', 'Quantify the problem'],
          })
        );
      }
      return Promise.resolve(review(95));
    });

    const res = await getGateReadiness(INIT, GateType.SUBMIT_FOR_REVIEW, ORG);
    expect(res).not.toBeNull();
    expect(res!.verdict).toBe('below');
    // rollup = round((95 + 40) / 2) = 68 < 75
    expect(res!.score).toBe(68);
    expect(res!.gaps).toHaveLength(1);
    expect(res!.gaps[0].section).toBe('problemDefinition');
    expect(res!.gaps[0].score).toBe(40);
    expect(res!.gaps[0].issues).toEqual(expect.arrayContaining(['no metrics', 'problem_quantified']));
    // fixes deduped across gaps
    expect(res!.fixes).toEqual(['Quantify the problem']);
  });

  it('reviewer throws → returns null (fail-open)', async () => {
    mockReviewSectionContent.mockRejectedValue(new Error('LLM down'));
    const res = await getGateReadiness(INIT, GateType.SUBMIT_FOR_REVIEW, ORG);
    expect(res).toBeNull();
  });

  it('threshold respected: same scores flip verdict when threshold raised', async () => {
    mockReviewSectionContent.mockResolvedValue(review(80));

    mockGetGateAiThreshold.mockResolvedValue(75);
    const ready = await getGateReadiness(INIT, GateType.SUBMIT_FOR_REVIEW, ORG);
    expect(ready!.verdict).toBe('ready');
    expect(ready!.threshold).toBe(75);

    clearGateReadinessCache();
    mockGetGateAiThreshold.mockResolvedValue(85);
    const below = await getGateReadiness(INIT, GateType.SUBMIT_FOR_REVIEW, ORG);
    expect(below!.verdict).toBe('below');
    expect(below!.threshold).toBe(85);
    expect(below!.gaps.map((g) => g.section).sort()).toEqual(['overview', 'problemDefinition']);
  });

  it('missing initiative row → null (fail-open, no soft-block on cross-org)', async () => {
    mockQueryOne.mockResolvedValue(null);
    const res = await getGateReadiness(INIT, GateType.SUBMIT_FOR_REVIEW, ORG);
    expect(res).toBeNull();
  });
});
