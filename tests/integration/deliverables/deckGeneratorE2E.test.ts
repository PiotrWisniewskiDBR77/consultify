// @vitest-environment node
/**
 * deckGeneratorE2E — przepuszcza WSZYSTKIE 30 deck-scenariuszy przez PRAWDZIWY
 * `planDeckLayout` (B1) z mock-LLM zwracającym plan danego scenariusza, a potem
 * scoruje WYNIK B1 (po post-processingu).
 *
 * Cel: weryfikacja że post-processing B1 (normalizeFields + enforceSinglePalette
 * + enforceNoTripleRun + mapowanie source) NIE DEGRADUJE dobrego planu LLM.
 *
 * To różni się od fullCatalog.test.ts:
 *   - fullCatalog scoruje mockPass BEZPOŚREDNIO (testuje scoring + satisfiability)
 *   - tutaj mockPass.plans → mock LLM → planDeckLayout → scoring (testuje B1 path)
 *
 * Gdyby B1 post-processing łamał kryteria (np przepalette'ował slajdy, przepisał
 * layout w niewłaściwym miejscu), ten test złapie regresję na żywym kodzie B1.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DECK_SCENARIOS } from './catalog/decks.js';
import { scoreDeck } from './scoring/deckScoring.js';

const llmCall = vi.fn();
vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...args: any[]) => llmCall(...args) },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const flagState = { premium: true };
vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  default: {
    get ENABLE_DELIVERABLES_PREMIUM() {
      return flagState.premium;
    },
  },
}));

describe('B1 deck generator E2E — 30 scenariuszy przez planDeckLayout', () => {
  let planDeckLayout: typeof import('../../../server/src/services/presentationLayoutDirectorService.js').planDeckLayout;

  beforeEach(async () => {
    vi.resetModules();
    llmCall.mockReset();
    flagState.premium = true;
    const mod = await import(
      '../../../server/src/services/presentationLayoutDirectorService.js'
    );
    planDeckLayout = mod.planDeckLayout;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('post-processing B1 nie degraduje żadnego z 30 dobrych planów', async () => {
    const failures: string[] = [];

    for (const entry of DECK_SCENARIOS) {
      const plans = entry.mockPass.plans;
      // Mock LLM zwraca plan scenariusza jako "raw" odpowiedź structured.
      llmCall.mockReset();
      llmCall.mockResolvedValueOnce({
        object: {
          plans: plans.map((p) => ({
            slideIndex: p.slideIndex,
            layoutIntent: p.layoutIntent,
            paletteId: p.paletteId,
            imageBrief: p.imageBrief,
            reasoning: p.reasoning,
          })),
        },
      });

      const slides = plans.map(() => ({ content: {} as any }) as any);
      const result = await planDeckLayout(
        slides,
        { language: 'PL' } as any,
        { orgId: 'org-e2e', preferPremium: true }
      );

      const report = scoreDeck(result, entry.criteria);
      if (!report.passed) {
        failures.push(
          `${entry.meta.id}: ${report.failures
            .map((f) => `${f.criterion}[exp ${f.expected}, got ${f.got}]`)
            .join('; ')}`
        );
      }
    }

    expect(failures, `\nB1 post-processing degraded:\n${failures.join('\n')}`).toEqual([]);
  });

  it('STANDARD tier (flaga OFF) → deterministic fallback, NIE woła LLM', async () => {
    flagState.premium = false;
    const slides = Array.from({ length: 5 }, () => ({ content: {} as any }) as any);
    const result = await planDeckLayout(
      slides,
      { language: 'PL' } as any,
      { orgId: 'org-e2e' } // brak preferPremium
    );

    expect(result.tierUsed).toBe('STANDARD');
    expect(result.fallbackUsed).toBe(true);
    expect(llmCall).not.toHaveBeenCalled();
    // Deterministic: cover→...→next_steps, single palette
    expect(result.plans[0].layoutIntent).toBe('cover');
    expect(result.plans.at(-1)!.layoutIntent).toBe('next_steps');
    expect(new Set(result.plans.map((p) => p.paletteId)).size).toBe(1);
  });
});
