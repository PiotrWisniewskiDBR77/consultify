import { beforeEach, describe, expect, it, vi } from 'vitest';

import RecommendationEngine from '../../server/src/ai/recommendationEngine.ts';

describe('RecommendationEngine - REAL_CODE', () => {
  beforeEach(() => {
    RecommendationEngine.clearCache();
    RecommendationEngine.setDependencies({ aiPipeline: { generateInitiatives: vi.fn() }, db: {} });
  });

  it('throws Invalid context for empty/invalid context object', async () => {
    await expect(RecommendationEngine.generateRecommendations({ type: 'invalid' })).rejects.toThrow(
      'Invalid context'
    );
  });

  it('maps deterministic signals to recommendations and prioritizes by impact/effort', async () => {
    const res = await RecommendationEngine.generateRecommendations([
      { type: 'STRONG_TEAM_MEMBER', entity_id: 'u1' },
      { type: 'BLOCKED_INITIATIVE', entity_id: 'i1', evidence: { stale_days: 10 } },
    ]);
    expect(res).toHaveLength(2);
    // blocked initiative is impact=high => should come first
    expect(res[0].signal_type).toBe('BLOCKED_INITIATIVE');
  });

  it('coalesces identical context calls via cache', async () => {
    const gen = vi.fn(async () => [{ id: 1 }]);
    RecommendationEngine.setDependencies({ aiPipeline: { generateInitiatives: gen }, db: {} });

    const ctx = { projectId: 'p1', data: { x: 1 }, userId: 'u1' };
    const [a, b] = await Promise.all([
      RecommendationEngine.generateRecommendations(ctx),
      RecommendationEngine.generateRecommendations(ctx),
    ]);
    expect(a).toEqual([{ id: 1 }]);
    expect(b).toEqual([{ id: 1 }]);
    expect(gen).toHaveBeenCalledTimes(1);
  });
});
