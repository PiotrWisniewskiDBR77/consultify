// @vitest-environment node
/**
 * STEP 1b — data path (server): planDeckVisualsTiered carries B1's per-slide
 * composition onto the persisted slide so it survives into `unifiedJson` and
 * reaches the FE renderer.
 *
 * Proves:
 *   - PREMIUM + LLM-composed slide → slide.composition === plan.composition.
 *   - a plan whose source is 'deterministic' (or has no composition) → slide
 *     carries NO composition (field omitted).
 *   - STANDARD tier → deterministic path, slides carry NO composition
 *     (byte-identical back-compat; planDeckLayout is never called).
 *
 * Mocks:
 *   - deliverableGenerationTier.resolveDeliverableTier → drive PREMIUM/STANDARD.
 *   - presentationLayoutDirectorService.planDeckLayout → controlled plans.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  UnifiedReportMeta,
  UnifiedSlide,
} from '../../../server/src/services/report/pptx/types.js';

const tierState = { tier: 'PREMIUM' as 'PREMIUM' | 'STANDARD' };
const planState = { plans: [] as any[], calls: 0 };

vi.mock('../../../server/src/services/deliverableGenerationTier.js', () => ({
  resolveDeliverableTier: () => tierState.tier,
}));

vi.mock('../../../server/src/services/presentationLayoutDirectorService.js', () => ({
  planDeckLayout: async () => {
    planState.calls++;
    return { plans: planState.plans, tierUsed: 'PREMIUM', fallbackUsed: false };
  },
}));

const META: UnifiedReportMeta = {
  client: 'ACME',
  project: 'Diagnosis',
  date: '2026-07-04',
  author: 'Tester',
  confidentiality: 'internal',
  language: 'en',
  template: 'corporate',
};

function slide(intent: UnifiedSlide['intent'], title: string): UnifiedSlide {
  return {
    intent,
    key_message: `km-${title}`,
    content: { type: intent, title } as any,
  };
}

async function run(slides: UnifiedSlide[]) {
  const { planDeckVisualsTiered } = await import(
    '../../../server/src/services/presentationVisualDirectorService.js'
  );
  return planDeckVisualsTiered({
    slides,
    meta: META,
    deckTitle: 'Deck',
    audience: 'executive',
    goal: 'inform',
    settings: { enabled: true, priority: 'quality', imageDensity: 'medium' },
    orgId: 'org-1',
    preferPremium: true,
  });
}

beforeEach(() => {
  tierState.tier = 'PREMIUM';
  planState.plans = [];
  planState.calls = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('STEP 1b — planDeckVisualsTiered carries composition (PREMIUM)', () => {
  it('carries composition onto an LLM-composed slide', async () => {
    const comp = {
      layoutVariantId: 'kpi_grid_2x2',
      emphasis: 'data',
      regions: [{ area: 'left', blockTypes: ['kpi_widget'] }],
    };
    planState.plans = [
      { slideIndex: 0, layoutIntent: 'performance_overview', source: 'llm', composition: comp },
    ];
    const res = await run([slide('performance_overview', 'A')]);
    expect(res.tierUsed).toBe('PREMIUM');
    expect(res.slides[0].composition).toEqual(comp);
  });

  it('does NOT carry composition for a deterministic-source plan', async () => {
    planState.plans = [
      {
        slideIndex: 0,
        layoutIntent: 'key_messages',
        source: 'deterministic',
        composition: { layoutVariantId: 'stacked' },
      },
    ];
    const res = await run([slide('key_messages', 'B')]);
    expect(res.slides[0].composition).toBeUndefined();
  });

  it('does NOT carry composition when the plan has none', async () => {
    planState.plans = [
      { slideIndex: 0, layoutIntent: 'key_messages', source: 'llm', composition: null },
    ];
    const res = await run([slide('key_messages', 'C')]);
    expect(res.slides[0].composition).toBeUndefined();
  });
});

describe('STEP 1b — STANDARD tier back-compat (no composition, no B1 call)', () => {
  it('leaves slides free of composition and never calls planDeckLayout', async () => {
    tierState.tier = 'STANDARD';
    planState.plans = [
      { slideIndex: 0, layoutIntent: 'key_messages', source: 'llm', composition: { layoutVariantId: 'stacked' } },
    ];
    const res = await run([slide('key_messages', 'D')]);
    expect(res.tierUsed).toBe('STANDARD');
    expect(res.slides[0].composition).toBeUndefined();
    expect(planState.calls).toBe(0);
  });
});
