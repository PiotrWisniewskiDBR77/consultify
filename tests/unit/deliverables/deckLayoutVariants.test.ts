// @vitest-environment node
/**
 * Unit tests — presentationLayoutVariantsService (B2, W4 / seria B)
 *
 * FT-1: ≥5 funkcyjne (tier branch, distinct palettes, slide count, remix happy-path,
 *       quality gate dystynktnych palet) + FT-2: ≥1 integracja z B1
 *       (STANDARD przechodzi przez planDeckLayout) + FT-8: ≥2 fail-open
 *       (LLM throws, brak instrukcji w remixie).
 *
 * Mocks:
 *   - ai/llmService.js  → kontrolowany per-test
 *   - utils/Logger.js   → silence
 *   - FeatureFlags.js   → premiumEnabled przez `flagState.premium`
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  UnifiedReportMeta,
  UnifiedSlide,
} from '../../../server/src/services/report/pptx/types.js';
import type { SlideLayoutPlan } from '../../../server/src/services/presentationLayoutDirectorService.js';

const llmCall = vi.fn();
vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...args: any[]) => llmCall(...args) },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const flagState = { premium: false };
vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  default: {
    get ENABLE_DELIVERABLES_PREMIUM() {
      return flagState.premium;
    },
  },
}));

const META: UnifiedReportMeta = {
  client: 'ACME',
  project: 'Diagnostic',
  date: '2026-06-21',
  author: 'DBR77',
  confidentiality: 'confidential',
  language: 'en',
};

function mkSlide(intent?: any, key_message = 'msg'): UnifiedSlide {
  return {
    intent,
    key_message,
    content: { type: intent ?? 'key_messages', title: 'X' } as any,
  };
}

const SLIDES: UnifiedSlide[] = [
  mkSlide('cover', 'Welcome'),
  mkSlide('key_messages', 'KM1'),
  mkSlide('comparison', 'A vs B'),
  mkSlide('next_steps', 'NS'),
];

describe('presentationLayoutVariantsService (B2)', () => {
  let generateDeckVariants: typeof import('../../../server/src/services/presentationLayoutVariantsService.js').generateDeckVariants;
  let remixDeckLayout: typeof import('../../../server/src/services/presentationLayoutVariantsService.js').remixDeckLayout;

  beforeEach(async () => {
    vi.resetModules();
    llmCall.mockReset();
    flagState.premium = false;
    const mod = await import(
      '../../../server/src/services/presentationLayoutVariantsService.js'
    );
    generateDeckVariants = mod.generateDeckVariants;
    remixDeckLayout = mod.remixDeckLayout;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────
  // generateDeckVariants
  // ──────────────────────────────────────────────────────────────

  it('FT-1/1: STANDARD tier → ONE deterministic variant (no LLM)', async () => {
    flagState.premium = false;
    const result = await generateDeckVariants(SLIDES, META, {
      orgId: 'org-1',
      preferPremium: true,
    });

    expect(result.tierUsed).toBe('STANDARD');
    expect(result.fallbackUsed).toBe(true);
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].plans).toHaveLength(SLIDES.length);
    expect(llmCall).not.toHaveBeenCalled();
  });

  it('FT-1/2: PREMIUM + LLM happy-path → 3 variants with DISTINCT palettes', async () => {
    flagState.premium = true;
    llmCall.mockResolvedValueOnce({
      object: {
        variants: [
          {
            paletteId: 'harvard',
            plans: SLIDES.map((_, i) => ({
              slideIndex: i,
              layoutIntent: i === 0 ? 'cover' : 'key_messages',
              paletteId: 'harvard',
              imageBrief: null,
              reasoning: 'classic',
            })),
          },
          {
            paletteId: 'ocean',
            plans: SLIDES.map((_, i) => ({
              slideIndex: i,
              layoutIntent: i === 0 ? 'cover' : 'comparison',
              paletteId: 'ocean',
              imageBrief: 'sea',
              reasoning: 'cool',
            })),
          },
          {
            paletteId: 'ember',
            plans: SLIDES.map((_, i) => ({
              slideIndex: i,
              layoutIntent: i === 0 ? 'cover' : 'single_insight',
              paletteId: 'ember',
              imageBrief: 'warm',
              reasoning: 'warm',
            })),
          },
        ],
      },
    });

    const result = await generateDeckVariants(SLIDES, META, {
      orgId: 'org-1',
      preferPremium: true,
    });

    expect(result.tierUsed).toBe('PREMIUM');
    expect(result.fallbackUsed).toBe(false);
    expect(result.variants).toHaveLength(3);

    // Quality gate: distinct palettes.
    const palettes = result.variants.map((v) => v.plans[0].paletteId);
    expect(new Set(palettes).size).toBe(3);
    expect(palettes).toEqual(['harvard', 'ocean', 'ember']);

    // Slide count preserved per variant.
    for (const v of result.variants) {
      expect(v.plans).toHaveLength(SLIDES.length);
      // Single palette enforced.
      const paletteSet = new Set(v.plans.map((p) => p.paletteId));
      expect(paletteSet.size).toBe(1);
    }
  });

  it('FT-1/3: duplicate palettes in LLM output → deduplicated (only first kept)', async () => {
    flagState.premium = true;
    llmCall.mockResolvedValueOnce({
      object: {
        variants: [
          {
            paletteId: 'harvard',
            plans: SLIDES.map((_, i) => ({
              slideIndex: i,
              layoutIntent: 'key_messages',
              paletteId: 'harvard',
              imageBrief: null,
              reasoning: 'a',
            })),
          },
          {
            paletteId: 'harvard', // duplicate — should be dropped
            plans: SLIDES.map((_, i) => ({
              slideIndex: i,
              layoutIntent: 'comparison',
              paletteId: 'harvard',
              imageBrief: null,
              reasoning: 'b',
            })),
          },
          {
            paletteId: 'ocean',
            plans: SLIDES.map((_, i) => ({
              slideIndex: i,
              layoutIntent: 'single_insight',
              paletteId: 'ocean',
              imageBrief: null,
              reasoning: 'c',
            })),
          },
        ],
      },
    });

    const result = await generateDeckVariants(SLIDES, META, {
      orgId: 'org-1',
      preferPremium: true,
    });

    expect(result.variants).toHaveLength(2); // duplicate dropped
    const palettes = result.variants.map((v) => v.plans[0].paletteId);
    expect(palettes).toEqual(['harvard', 'ocean']);
  });

  it('FT-1/4: quality-gate — <2 distinct palettes (count≥2) → fail-open to 1 deterministic variant', async () => {
    flagState.premium = true;
    llmCall.mockResolvedValueOnce({
      object: {
        variants: [
          {
            paletteId: 'harvard',
            plans: SLIDES.map((_, i) => ({
              slideIndex: i,
              layoutIntent: 'key_messages',
              paletteId: 'harvard',
              imageBrief: null,
              reasoning: 'only one',
            })),
          },
          {
            paletteId: 'harvard', // identical — dedupe leaves 1
            plans: SLIDES.map((_, i) => ({
              slideIndex: i,
              layoutIntent: 'comparison',
              paletteId: 'harvard',
              imageBrief: null,
              reasoning: 'dup',
            })),
          },
        ],
      },
    });

    const result = await generateDeckVariants(SLIDES, META, {
      orgId: 'org-1',
      preferPremium: true,
      count: 3,
    });

    expect(result.tierUsed).toBe('PREMIUM');
    expect(result.fallbackUsed).toBe(true);
    expect(result.variants).toHaveLength(1);
  });

  it('FT-2/5: STANDARD path delegates to B1 planDeckLayout (deterministic plan shape)', async () => {
    flagState.premium = false;
    const result = await generateDeckVariants(SLIDES, META, { orgId: 'org-1' });

    // B1 deterministic: cover→key_messages…→next_steps with harvard palette.
    const v = result.variants[0];
    expect(v.plans[0].layoutIntent).toBe('cover');
    expect(v.plans.at(-1)!.layoutIntent).toBe('next_steps');
    expect(v.plans.every((p) => p.paletteId === 'harvard')).toBe(true);
  });

  it('FT-8/6: LLM throws → fail-open, returns 1 deterministic variant (no throw)', async () => {
    flagState.premium = true;
    llmCall.mockRejectedValueOnce(new Error('LLM rate limit'));

    const result = await generateDeckVariants(SLIDES, META, {
      orgId: 'org-1',
      preferPremium: true,
    });

    expect(result.tierUsed).toBe('PREMIUM');
    expect(result.fallbackUsed).toBe(true);
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].plans).toHaveLength(SLIDES.length);
  });

  // ──────────────────────────────────────────────────────────────
  // remixDeckLayout
  // ──────────────────────────────────────────────────────────────

  it('FT-1/7: PREMIUM remix happy-path → returns new plan with same slide count', async () => {
    flagState.premium = true;
    const currentPlans: SlideLayoutPlan[] = SLIDES.map((_, i) => ({
      slideIndex: i,
      layoutIntent: 'key_messages',
      paletteId: 'harvard',
      imageBrief: null,
      reasoning: 'current',
      source: 'deterministic',
    }));

    llmCall.mockResolvedValueOnce({
      object: {
        plans: SLIDES.map((_, i) => ({
          slideIndex: i,
          layoutIntent: i === 0 ? 'cover' : 'single_insight',
          paletteId: 'ocean',
          imageBrief: 'visual',
          reasoning: 'more visual',
        })),
      },
    });

    const result = await remixDeckLayout(SLIDES, META, currentPlans, {
      orgId: 'org-1',
      preferPremium: true,
      instruction: 'more visual, use ocean palette',
    });

    expect(result.tierUsed).toBe('PREMIUM');
    expect(result.fallbackUsed).toBe(false);
    expect(result.plans).toHaveLength(SLIDES.length);
    expect(result.plans.every((p) => p.paletteId === 'ocean')).toBe(true);
    expect(result.plans[1].layoutIntent).toBe('single_insight');
  });

  it('FT-8/8: empty instruction → STANDARD-shape pass-through (currentPlans unchanged, no LLM)', async () => {
    flagState.premium = true;
    const currentPlans: SlideLayoutPlan[] = SLIDES.map((_, i) => ({
      slideIndex: i,
      layoutIntent: 'comparison',
      paletteId: 'midnight',
      imageBrief: null,
      reasoning: 'keep me',
      source: 'llm',
    }));

    const result = await remixDeckLayout(SLIDES, META, currentPlans, {
      orgId: 'org-1',
      preferPremium: true,
      instruction: '   ',
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.plans).toEqual(currentPlans);
    expect(llmCall).not.toHaveBeenCalled();
  });

  it('FT-8/9: STANDARD tier → remix is a no-op (returns currentPlans, no LLM)', async () => {
    flagState.premium = false;
    const currentPlans: SlideLayoutPlan[] = SLIDES.map((_, i) => ({
      slideIndex: i,
      layoutIntent: 'key_messages',
      paletteId: 'harvard',
      imageBrief: null,
      reasoning: 'current',
      source: 'deterministic',
    }));

    const result = await remixDeckLayout(SLIDES, META, currentPlans, {
      orgId: 'org-1',
      preferPremium: true,
      instruction: 'make it pop',
    });

    expect(result.tierUsed).toBe('STANDARD');
    expect(result.fallbackUsed).toBe(true);
    expect(result.plans).toEqual(currentPlans);
    expect(llmCall).not.toHaveBeenCalled();
  });

  it('FT-8/10: remix LLM throws → fail-open, returns currentPlans unchanged', async () => {
    flagState.premium = true;
    const currentPlans: SlideLayoutPlan[] = SLIDES.map((_, i) => ({
      slideIndex: i,
      layoutIntent: 'key_messages',
      paletteId: 'harvard',
      imageBrief: null,
      reasoning: 'current',
      source: 'deterministic',
    }));

    llmCall.mockRejectedValueOnce(new Error('LLM down'));

    const result = await remixDeckLayout(SLIDES, META, currentPlans, {
      orgId: 'org-1',
      preferPremium: true,
      instruction: 'use teal',
    });

    expect(result.tierUsed).toBe('PREMIUM');
    expect(result.fallbackUsed).toBe(true);
    expect(result.plans).toEqual(currentPlans);
  });
});
