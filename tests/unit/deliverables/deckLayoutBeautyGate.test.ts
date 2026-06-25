// @vitest-environment node
/**
 * Unit tests — deckLayoutBeautyGate (F1.3)
 *
 * BG-1: scoreBeauty — diversity / balance / framing sub-scores
 * BG-2: applyDeckBeautyGate — pass on first attempt / regen on fail / max 2 regens
 */

import { describe, expect, it, vi } from 'vitest';

// Mock logger to avoid pulling the full logging stack
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  scoreBeauty,
  applyDeckBeautyGate,
  BEAUTY_THRESHOLD,
} from '../../../server/src/services/deliverables/deckLayoutBeautyGate.js';
import type { DeckLayoutDirectorResult, SlideLayoutPlan } from '../../../server/src/services/presentationLayoutDirectorService.js';

function mkPlan(intent: string, index: number = 0): SlideLayoutPlan {
  return {
    slideIndex: index,
    layoutIntent: intent as any,
    paletteId: 'harvard',
    imageBrief: null,
    reasoning: 'test',
    source: 'deterministic',
  };
}

function mkResult(plans: SlideLayoutPlan[]): DeckLayoutDirectorResult {
  return { plans, tierUsed: 'STANDARD', fallbackUsed: true };
}

// ── BG-1: scoreBeauty ─────────────────────────────────────────────────────

describe('scoreBeauty', () => {
  it('BG-1.1: perfect deck (diverse + balanced + good framing) scores ≥ threshold', () => {
    const plans = [
      mkPlan('cover', 0),
      mkPlan('key_messages', 1),
      mkPlan('single_insight', 2),
      mkPlan('comparison', 3),
      mkPlan('performance_overview', 4),
      mkPlan('recommendation_single', 5),
      mkPlan('root_cause', 6),
      mkPlan('assessment', 7),
      mkPlan('roadmap', 8),
      mkPlan('next_steps', 9),
    ];

    const score = scoreBeauty(plans);

    expect(score.framing).toBe(1);
    expect(score.diversity).toBeGreaterThanOrEqual(0.9);
    expect(score.overall).toBeGreaterThanOrEqual(BEAUTY_THRESHOLD);
    expect(score.passed).toBe(true);
    expect(score.issues).toHaveLength(0);
  });

  it('BG-1.2: all key_messages (no diversity) scores below threshold', () => {
    const plans = Array.from({ length: 9 }, (_, i) =>
      mkPlan(i === 0 ? 'cover' : i === 8 ? 'next_steps' : 'key_messages', i)
    );

    const score = scoreBeauty(plans);

    expect(score.diversity).toBeLessThan(0.7);
    expect(score.passed).toBe(false);
    expect(score.issues.some((i) => i.includes('diversity'))).toBe(true);
  });

  it('BG-1.3: good diversity but weak framing (no cover/no strong closer)', () => {
    const plans = [
      mkPlan('key_messages', 0), // not cover
      mkPlan('single_insight', 1),
      mkPlan('comparison', 2),
      mkPlan('performance_overview', 3),
      mkPlan('recommendation_single', 4),
      mkPlan('root_cause', 5),
      mkPlan('assessment', 6),
      mkPlan('roadmap', 7),
      mkPlan('key_messages', 8), // not a strong closer
    ];

    const score = scoreBeauty(plans);

    expect(score.framing).toBe(0);
    expect(score.issues.some((i) => i.includes('framing'))).toBe(true);
  });

  it('BG-1.4: 3-slide deck always passes framing if cover+closer present', () => {
    const plans = [mkPlan('cover', 0), mkPlan('key_messages', 1), mkPlan('next_steps', 2)];
    const score = scoreBeauty(plans);
    expect(score.framing).toBe(1);
  });
});

// ── BG-2: applyDeckBeautyGate ─────────────────────────────────────────────

describe('applyDeckBeautyGate', () => {
  it('BG-2.1: passes immediately when score ≥ threshold (no regen called)', async () => {
    const plans = [
      mkPlan('cover', 0),
      ...['key_messages', 'single_insight', 'comparison', 'performance_overview',
          'recommendation_single', 'root_cause', 'assessment', 'roadmap'].map((i, idx) => mkPlan(i, idx + 1)),
      mkPlan('next_steps', 9),
    ];
    const result = mkResult(plans);
    const planFn = vi.fn();

    const gate = await applyDeckBeautyGate(result, planFn);

    expect(gate.beautyScore.passed).toBe(true);
    expect(gate.regenCount).toBe(0);
    expect(planFn).not.toHaveBeenCalled();
  });

  it('BG-2.2: regens once when first attempt fails, returns better result', async () => {
    const badPlans = Array.from({ length: 9 }, (_, i) =>
      mkPlan(i === 0 ? 'cover' : i === 8 ? 'next_steps' : 'key_messages', i)
    );
    const goodPlans = [
      mkPlan('cover', 0),
      ...['key_messages', 'single_insight', 'comparison', 'performance_overview',
          'recommendation_single', 'root_cause', 'assessment', 'roadmap'].map((i, idx) => mkPlan(i, idx + 1)),
      mkPlan('next_steps', 9),
    ];

    const planFn = vi.fn().mockResolvedValue(mkResult(goodPlans));
    const gate = await applyDeckBeautyGate(mkResult(badPlans), planFn);

    expect(gate.regenCount).toBe(1);
    expect(gate.beautyScore.overall).toBeGreaterThanOrEqual(BEAUTY_THRESHOLD);
    expect(planFn).toHaveBeenCalledTimes(1);
  });

  it('BG-2.3: caps at MAX_REGENS=2 even if never passing', async () => {
    const badPlans = Array.from({ length: 9 }, (_, i) =>
      mkPlan(i === 0 ? 'cover' : i === 8 ? 'next_steps' : 'key_messages', i)
    );
    const planFn = vi.fn().mockResolvedValue(mkResult(badPlans));

    const gate = await applyDeckBeautyGate(mkResult(badPlans), planFn);

    expect(gate.regenCount).toBe(2);
    expect(planFn).toHaveBeenCalledTimes(2);
  });

  it('BG-2.4: regen throws → fail-open, returns best so far, no rethrow', async () => {
    const badPlans = Array.from({ length: 9 }, (_, i) =>
      mkPlan(i === 0 ? 'cover' : i === 8 ? 'next_steps' : 'key_messages', i)
    );
    const planFn = vi.fn().mockRejectedValue(new Error('LLM error'));

    await expect(applyDeckBeautyGate(mkResult(badPlans), planFn)).resolves.toMatchObject({
      regenCount: 1,
    });
  });
});
