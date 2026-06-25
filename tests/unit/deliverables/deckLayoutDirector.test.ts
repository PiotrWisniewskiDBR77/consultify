// @vitest-environment node
/**
 * Unit tests — presentationLayoutDirectorService (B1, W4 / series B)
 *
 * FT-1: ≥5 functional (tier branch, LLM happy-path, validation, post-processing,
 *       variety) + FT-8: ≥2 fail-open / contract (LLM throws, tier resolution).
 *
 * Mocks:
 *   - ai/llmService.js   → premium LLM path (no real AI stack)
 *   - utils/Logger.js    → silence telemetry
 *   - config/FeatureFlags.js (via premiumEnabled DI is unavailable here, so we
 *     drive the tier through `preferPremium` + the flag mock).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  UnifiedReportMeta,
  UnifiedSlide,
} from '../../../server/src/services/report/pptx/types.js';

// llmService.call mock — controlled per-test via `llmCall`.
const llmCall = vi.fn();
vi.mock('../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...args: any[]) => llmCall(...args) },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// FeatureFlags mock — `flag` controls ENABLE_DELIVERABLES_PREMIUM.
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

describe('presentationLayoutDirectorService (B1)', () => {
  let planDeckLayout: typeof import('../../../server/src/services/presentationLayoutDirectorService.js').planDeckLayout;

  beforeEach(async () => {
    vi.resetModules();
    llmCall.mockReset();
    flagState.premium = false;

    vi.mock('../../../server/src/services/ai/llmService.js', () => ({
      llmService: { call: (...args: any[]) => llmCall(...args) },
    }));
    vi.mock('../../../server/src/utils/Logger.js', () => ({
      default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    }));
    vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
      default: {
        get ENABLE_DELIVERABLES_PREMIUM() {
          return flagState.premium;
        },
      },
    }));

    const mod = await import(
      '../../../server/src/services/presentationLayoutDirectorService.js'
    );
    planDeckLayout = mod.planDeckLayout;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── FT-1.1 — STANDARD tier → deterministic, no LLM ──
  it('FT-1.1: STANDARD tier → fallbackUsed=true, all deterministic, LLM not called', async () => {
    flagState.premium = false;
    const slides = [mkSlide('cover'), mkSlide('key_messages'), mkSlide('next_steps')];

    const res = await planDeckLayout(slides, META, { orgId: 'org-1' });

    expect(res.tierUsed).toBe('STANDARD');
    expect(res.fallbackUsed).toBe(true);
    expect(res.plans).toHaveLength(3);
    expect(res.plans.every((p) => p.source === 'deterministic')).toBe(true);
    expect(res.plans.every((p) => p.paletteId === 'harvard')).toBe(true);
    expect(llmCall).not.toHaveBeenCalled();
  });

  // ── FT-1.2 — PREMIUM + valid LLM → source='llm', catalog intents ──
  it('FT-1.2: PREMIUM + valid LLM plan → source=llm, layoutIntent from catalog', async () => {
    flagState.premium = true;
    const slides = [mkSlide(), mkSlide(), mkSlide()];

    llmCall.mockResolvedValue({
      object: {
        plans: [
          { slideIndex: 0, layoutIntent: 'cover', paletteId: 'ocean', imageBrief: 'hero', reasoning: 'r0' },
          { slideIndex: 1, layoutIntent: 'comparison', paletteId: 'ocean', imageBrief: null, reasoning: 'r1' },
          { slideIndex: 2, layoutIntent: 'next_steps', paletteId: 'ocean', imageBrief: 'cta', reasoning: 'r2' },
        ],
      },
    });

    const res = await planDeckLayout(slides, META, { orgId: 'org-1', preferPremium: true });

    expect(res.tierUsed).toBe('PREMIUM');
    expect(res.fallbackUsed).toBe(false);
    expect(res.plans.map((p) => p.layoutIntent)).toEqual(['cover', 'comparison', 'next_steps']);
    expect(res.plans.every((p) => p.source === 'llm')).toBe(true);
    expect(res.plans.every((p) => p.paletteId === 'ocean')).toBe(true);
    expect(llmCall).toHaveBeenCalledTimes(1);
    // premium tier routed
    expect(llmCall.mock.calls[0][0].modelConfig).toEqual({ id: 'premium' });
  });

  // ── FT-1.3 — invalid layoutIntent → mapped to deterministic ──
  it('FT-1.3: invalid layoutIntent from LLM → patched deterministically (validation)', async () => {
    flagState.premium = true;
    const slides = [mkSlide('cover'), mkSlide('assessment')];

    llmCall.mockResolvedValue({
      object: {
        plans: [
          { slideIndex: 0, layoutIntent: 'cover', paletteId: 'slate', imageBrief: null, reasoning: 'ok' },
          { slideIndex: 1, layoutIntent: 'NOT_A_REAL_INTENT', paletteId: 'slate', imageBrief: null, reasoning: 'bad' },
        ],
      },
    });

    const res = await planDeckLayout(slides, META, { orgId: 'org-1', preferPremium: true });

    // invalid intent replaced by the slide's own valid intent ('assessment')
    expect(res.plans[1].layoutIntent).toBe('assessment');
    expect(res.plans[1].source).toBe('deterministic');
    // valid intent set stays catalog-valid
    expect(res.plans[0].layoutIntent).toBe('cover');
  });

  // ── FT-1.4 — post-processing: 3 identical in a row → middle changed ──
  it('FT-1.4: 3 consecutive identical layouts → middle one rewritten (no >2 run)', async () => {
    flagState.premium = true;
    const slides = [mkSlide(), mkSlide(), mkSlide(), mkSlide()];

    llmCall.mockResolvedValue({
      object: {
        plans: [
          { slideIndex: 0, layoutIntent: 'key_messages', paletteId: 'forest', imageBrief: null, reasoning: 'a' },
          { slideIndex: 1, layoutIntent: 'key_messages', paletteId: 'forest', imageBrief: null, reasoning: 'b' },
          { slideIndex: 2, layoutIntent: 'key_messages', paletteId: 'forest', imageBrief: null, reasoning: 'c' },
          { slideIndex: 3, layoutIntent: 'next_steps', paletteId: 'forest', imageBrief: null, reasoning: 'd' },
        ],
      },
    });

    const res = await planDeckLayout(slides, META, { orgId: 'org-1', preferPremium: true });

    const intents = res.plans.map((p) => p.layoutIntent);
    // no three-in-a-row identical anywhere
    for (let i = 2; i < intents.length; i++) {
      expect(intents[i] === intents[i - 1] && intents[i - 1] === intents[i - 2]).toBe(false);
    }
    // the middle of the original run got rewritten
    expect(intents[1]).not.toBe('key_messages');
  });

  // ── FT-1.5 — ≥8 slides → layout variety (not all identical) ──
  it('FT-1.5: ≥8 slides → layout variety enforced (not all identical)', async () => {
    flagState.premium = false; // deterministic path also must yield variety post-processing
    const slides = Array.from({ length: 9 }, (_, i) =>
      mkSlide(i === 0 ? 'cover' : i === 8 ? 'next_steps' : 'key_messages')
    );

    const res = await planDeckLayout(slides, META, { orgId: 'org-1' });

    expect(res.plans).toHaveLength(9);
    const intents = res.plans.map((p) => p.layoutIntent);
    const distinct = new Set(intents);
    // enforceMinDistinctLayouts raises variety to ≥ minDistinctLayouts (8 from defaults)
    // 9 slides, 7× key_messages middle → swapped to diverse pool intents
    expect(distinct.size).toBeGreaterThanOrEqual(8);
    // no >2 consecutive identical
    for (let i = 2; i < intents.length; i++) {
      expect(intents[i] === intents[i - 1] && intents[i - 1] === intents[i - 2]).toBe(false);
    }
  });

  // ── FT-1.6 — enforceMinDistinctLayouts: tiny deck stays capped at plan.length ──
  it('FT-1.6: 3-slide deck cannot have more distinct layouts than slides', async () => {
    flagState.premium = false;
    const slides = [mkSlide('cover'), mkSlide('key_messages'), mkSlide('next_steps')];

    const res = await planDeckLayout(slides, META, { orgId: 'org-1' });

    expect(res.plans).toHaveLength(3);
    const distinct = new Set(res.plans.map((p) => p.layoutIntent));
    // target = min(minDistinct=8, 3) = 3 → all 3 are distinct
    expect(distinct.size).toBe(3);
  });

  // ── FT-8.1 — LLM throws → fail-open, no throw, fallbackUsed ──
  it('FT-8.1: LLM throws → fallbackUsed=true, never throws (fail-open)', async () => {
    flagState.premium = true;
    const slides = [mkSlide('cover'), mkSlide('key_messages')];

    llmCall.mockRejectedValue(new Error('LLM down'));

    const res = await planDeckLayout(slides, META, { orgId: 'org-1', preferPremium: true });

    expect(res.tierUsed).toBe('PREMIUM');
    expect(res.fallbackUsed).toBe(true);
    expect(res.plans).toHaveLength(2);
    expect(res.plans.every((p) => p.source === 'deterministic')).toBe(true);
  });

  // ── FT-8.2 — preferPremium=false forces STANDARD regardless of flag ──
  it('FT-8.2: preferPremium=false → STANDARD even when premium flag is ON', async () => {
    flagState.premium = true; // flag on…
    const slides = [mkSlide('cover'), mkSlide('next_steps')];

    const res = await planDeckLayout(slides, META, {
      orgId: 'org-passed',
      preferPremium: false, // …but caller opts out
    });

    expect(res.tierUsed).toBe('STANDARD');
    expect(res.fallbackUsed).toBe(true);
    expect(llmCall).not.toHaveBeenCalled();
  });
});
