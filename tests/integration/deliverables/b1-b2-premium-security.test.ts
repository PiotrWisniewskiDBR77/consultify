// @vitest-environment node
/**
 * B1 + B2 — FT-8: Security / quality-gate tests (12 tests)
 *
 * B1 (presentationLayoutDirectorService — planDeckLayout):
 *   8.1 Standard-tier org → falls back to deterministic (no AI call)
 *   8.2 Premium-tier org → AI is called (verified via mock)
 *   8.3 Cross-org: org B's orgId cannot use org A's premium credit → STANDARD
 *   8.4 Invalid orgId (empty string) → deterministic fallback, no crash
 *   8.5 AI error → graceful deterministic fallback (no throw, fallbackUsed=true)
 *   8.6 Quality gate: layout not in LAYOUT_REGISTRY → rejected, fallback applied
 *
 * B2 (presentationLayoutVariantsService — generateDeckVariants / remixDeckLayout):
 *   8.7  Standard tier → exactly 1 deterministic variant (not 3 AI variants)
 *   8.8  Premium tier → up to 3 AI-generated variants with distinct palettes
 *   8.9  Palette dedup: all 3 variants have DIFFERENT palette names
 *   8.10 Quality gate: variant with palette not in CURATED_COLOR_SETS → excluded
 *   8.11 AI error during variant generation → at least 1 deterministic variant, no throw
 *   8.12 remixDeckLayout: instruction respected → new layout has been processed by LLM
 *
 * Architecture:
 *   - Pure service-layer (no HTTP, no live DB).
 *   - `ai/llmService` and `utils/Logger` are mocked globally so the AI stack is
 *     never touched; tier is controlled via `FeatureFlags.ENABLE_DELIVERABLES_PREMIUM`
 *     mock and / or `preferPremium` per-call override.
 *   - `vi.resetModules()` in `beforeEach` ensures each test re-imports the modules
 *     fresh so mock state is isolated.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  UnifiedReportMeta,
  UnifiedSlide,
} from '../../../server/src/services/report/pptx/types.js';
import type { SlideLayoutPlan } from '../../../server/src/services/presentationLayoutDirectorService.js';

// ──────────────────────────────────────────────────────────────
// Module-level mocks (hoisted before any imports)
// ──────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────

const META: UnifiedReportMeta = {
  client: 'SecureClient',
  project: 'Security Audit',
  date: '2026-06-24',
  author: 'DBR77',
  confidentiality: 'confidential',
  language: 'en',
};

function mkSlide(intent?: any, title = 'Slide'): UnifiedSlide {
  return {
    intent,
    key_message: 'test msg',
    content: { type: intent ?? 'key_messages', title } as any,
  };
}

const SLIDES_3: UnifiedSlide[] = [
  mkSlide('cover', 'Cover'),
  mkSlide('key_messages', 'Body'),
  mkSlide('next_steps', 'NS'),
];

const SLIDES_4: UnifiedSlide[] = [
  mkSlide('cover', 'Cover'),
  mkSlide('comparison', 'Compare'),
  mkSlide('single_insight', 'Insight'),
  mkSlide('next_steps', 'End'),
];

/** Build a minimal valid LLM variant response with distinct palettes. */
function mkLlmVariantsResponse(
  palettes: string[],
  slides: UnifiedSlide[],
  intent: string = 'key_messages'
) {
  return {
    object: {
      variants: palettes.map((pal) => ({
        paletteId: pal,
        plans: slides.map((_, i) => ({
          slideIndex: i,
          layoutIntent: i === 0 ? 'cover' : intent,
          paletteId: pal,
          imageBrief: null,
          reasoning: `variant-${pal}`,
        })),
      })),
    },
  };
}

/** Build a valid LLM plans response for planDeckLayout. */
function mkLlmPlansResponse(slides: UnifiedSlide[], paletteId = 'ocean') {
  return {
    object: {
      plans: slides.map((_, i) => ({
        slideIndex: i,
        layoutIntent: i === 0 ? 'cover' : i === slides.length - 1 ? 'next_steps' : 'comparison',
        paletteId,
        imageBrief: null,
        reasoning: 'llm plan',
      })),
    },
  };
}

// ──────────────────────────────────────────────────────────────
// B1 — planDeckLayout security tests
// ──────────────────────────────────────────────────────────────

describe('B1 (planDeckLayout) — FT-8 security / quality-gate', () => {
  let planDeckLayout: typeof import('../../../server/src/services/presentationLayoutDirectorService.js').planDeckLayout;
  let LAYOUT_INTENT_CATALOG: typeof import('../../../server/src/services/presentationLayoutDirectorService.js').LAYOUT_INTENT_CATALOG;
  let PALETTE_CATALOG: typeof import('../../../server/src/services/presentationLayoutDirectorService.js').PALETTE_CATALOG;

  beforeEach(async () => {
    vi.resetModules();
    llmCall.mockReset();
    flagState.premium = false;

    const mod = await import(
      '../../../server/src/services/presentationLayoutDirectorService.js'
    );
    planDeckLayout = mod.planDeckLayout;
    LAYOUT_INTENT_CATALOG = mod.LAYOUT_INTENT_CATALOG;
    PALETTE_CATALOG = mod.PALETTE_CATALOG;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── FT-8.1 ──────────────────────────────────────────────────
  it('FT-8.1: Standard-tier org → deterministic fallback, LLM never called', async () => {
    flagState.premium = false;

    const res = await planDeckLayout(SLIDES_3, META, {
      orgId: 'org-standard',
      // no preferPremium override
    });

    expect(res.tierUsed).toBe('STANDARD');
    expect(res.fallbackUsed).toBe(true);
    expect(res.plans.every((p) => p.source === 'deterministic')).toBe(true);
    expect(llmCall).not.toHaveBeenCalled();
  });

  // ── FT-8.2 ──────────────────────────────────────────────────
  it('FT-8.2: Premium-tier org → AI is called and result honoured', async () => {
    flagState.premium = true;
    llmCall.mockResolvedValue(mkLlmPlansResponse(SLIDES_3, 'slate'));

    const res = await planDeckLayout(SLIDES_3, META, {
      orgId: 'org-premium',
      preferPremium: true,
    });

    expect(res.tierUsed).toBe('PREMIUM');
    expect(llmCall).toHaveBeenCalledTimes(1);
    // At least some slides carry LLM source.
    expect(res.plans.some((p) => p.source === 'llm')).toBe(true);
    // Palette honoured.
    expect(res.plans.every((p) => p.paletteId === 'slate')).toBe(true);
  });

  // ── FT-8.3 ──────────────────────────────────────────────────
  it('FT-8.3: Cross-org: org B cannot inherit org A premium credit — premium flag OFF → STANDARD', async () => {
    // Org A has premium enabled; we model "org B" as the caller with the flag OFF.
    flagState.premium = false; // org B is on STANDARD

    const res = await planDeckLayout(SLIDES_3, META, {
      orgId: 'org-b-attacker',
      // No preferPremium — should not inherit premium from "org-a"
    });

    expect(res.tierUsed).toBe('STANDARD');
    expect(res.fallbackUsed).toBe(true);
    expect(llmCall).not.toHaveBeenCalled();
    // All plans are deterministic — no AI credit leaked.
    expect(res.plans.every((p) => p.source === 'deterministic')).toBe(true);
  });

  // ── FT-8.4 ──────────────────────────────────────────────────
  it('FT-8.4: Invalid orgId (empty string) → deterministic fallback, no crash', async () => {
    flagState.premium = false;

    const res = await planDeckLayout(SLIDES_3, META, {
      orgId: '',
    });

    // Must not throw; must return a coherent deterministic plan.
    expect(res).toBeDefined();
    expect(res.plans).toHaveLength(SLIDES_3.length);
    expect(res.plans.every((p) => p.source === 'deterministic')).toBe(true);
    expect(llmCall).not.toHaveBeenCalled();
  });

  // ── FT-8.5 ──────────────────────────────────────────────────
  it('FT-8.5: AI error → graceful deterministic fallback, never throws', async () => {
    flagState.premium = true;
    llmCall.mockRejectedValue(new Error('OpenAI 500'));

    // Must NOT throw.
    const res = await planDeckLayout(SLIDES_3, META, {
      orgId: 'org-premium',
      preferPremium: true,
    });

    expect(res.tierUsed).toBe('PREMIUM');
    expect(res.fallbackUsed).toBe(true);
    expect(res.plans).toHaveLength(SLIDES_3.length);
    expect(res.plans.every((p) => p.source === 'deterministic')).toBe(true);
  });

  // ── FT-8.6 ──────────────────────────────────────────────────
  it('FT-8.6: LLM returns layout not in LAYOUT_REGISTRY → invalid slide patched to deterministic', async () => {
    flagState.premium = true;

    llmCall.mockResolvedValue({
      object: {
        plans: [
          // Slide 0: valid
          { slideIndex: 0, layoutIntent: 'cover', paletteId: 'ocean', imageBrief: null, reasoning: 'ok' },
          // Slide 1: UNKNOWN layout — security gate must reject it
          { slideIndex: 1, layoutIntent: 'HACKED_LAYOUT_XSS', paletteId: 'ocean', imageBrief: null, reasoning: 'bad' },
          // Slide 2: valid
          { slideIndex: 2, layoutIntent: 'next_steps', paletteId: 'ocean', imageBrief: null, reasoning: 'ok' },
        ],
      },
    });

    const res = await planDeckLayout(SLIDES_3, META, {
      orgId: 'org-premium',
      preferPremium: true,
    });

    // Slide 1 had an invalid layout → source becomes 'deterministic' (patched).
    expect(res.plans[1].source).toBe('deterministic');
    // The patched intent must still be a valid catalog member.
    expect(LAYOUT_INTENT_CATALOG).toContain(res.plans[1].layoutIntent);
    // Valid slides keep their LLM result.
    expect(res.plans[0].layoutIntent).toBe('cover');
    expect(res.plans[2].layoutIntent).toBe('next_steps');
    // Palette not leaked / corrupted.
    expect(PALETTE_CATALOG).toContain(res.plans[1].paletteId);
  });
});

// ──────────────────────────────────────────────────────────────
// B2 — generateDeckVariants + remixDeckLayout security tests
// ──────────────────────────────────────────────────────────────

describe('B2 (generateDeckVariants + remixDeckLayout) — FT-8 security / quality-gate', () => {
  let generateDeckVariants: typeof import('../../../server/src/services/presentationLayoutVariantsService.js').generateDeckVariants;
  let remixDeckLayout: typeof import('../../../server/src/services/presentationLayoutVariantsService.js').remixDeckLayout;
  let PALETTE_CATALOG: typeof import('../../../server/src/services/presentationLayoutDirectorService.js').PALETTE_CATALOG;

  beforeEach(async () => {
    vi.resetModules();
    llmCall.mockReset();
    flagState.premium = false;

    const varMod = await import(
      '../../../server/src/services/presentationLayoutVariantsService.js'
    );
    generateDeckVariants = varMod.generateDeckVariants;
    remixDeckLayout = varMod.remixDeckLayout;

    const dirMod = await import(
      '../../../server/src/services/presentationLayoutDirectorService.js'
    );
    PALETTE_CATALOG = dirMod.PALETTE_CATALOG;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── FT-8.7 ──────────────────────────────────────────────────
  it('FT-8.7: Standard tier → exactly 1 deterministic variant (not 3 AI variants)', async () => {
    flagState.premium = false;

    const res = await generateDeckVariants(SLIDES_4, META, {
      orgId: 'org-standard',
      count: 3, // requested 3, but STANDARD caps to 1
    });

    expect(res.tierUsed).toBe('STANDARD');
    expect(res.fallbackUsed).toBe(true);
    expect(res.variants).toHaveLength(1);
    expect(res.variants[0].plans).toHaveLength(SLIDES_4.length);
    expect(res.variants[0].plans.every((p) => p.source === 'deterministic')).toBe(true);
    expect(llmCall).not.toHaveBeenCalled();
  });

  // ── FT-8.8 ──────────────────────────────────────────────────
  it('FT-8.8: Premium tier → up to 3 AI-generated variants returned', async () => {
    flagState.premium = true;
    llmCall.mockResolvedValue(
      mkLlmVariantsResponse(['harvard', 'ocean', 'ember'], SLIDES_4)
    );

    const res = await generateDeckVariants(SLIDES_4, META, {
      orgId: 'org-premium',
      preferPremium: true,
      count: 3,
    });

    expect(res.tierUsed).toBe('PREMIUM');
    expect(res.fallbackUsed).toBe(false);
    expect(res.variants).toHaveLength(3);
    for (const v of res.variants) {
      expect(v.plans).toHaveLength(SLIDES_4.length);
    }
    expect(llmCall).toHaveBeenCalledTimes(1);
  });

  // ── FT-8.9 ──────────────────────────────────────────────────
  it('FT-8.9: Palette dedup — 3 variants all have DIFFERENT palette names', async () => {
    flagState.premium = true;
    llmCall.mockResolvedValue(
      mkLlmVariantsResponse(['midnight', 'slate', 'forest'], SLIDES_4)
    );

    const res = await generateDeckVariants(SLIDES_4, META, {
      orgId: 'org-premium',
      preferPremium: true,
      count: 3,
    });

    const palettes = res.variants.map((v) => v.plans[0].paletteId);
    // All must be distinct (B2 dedup guarantee).
    expect(new Set(palettes).size).toBe(palettes.length);
    // All must be from the valid catalog.
    for (const pal of palettes) {
      expect(PALETTE_CATALOG).toContain(pal);
    }
  });

  // ── FT-8.10 ─────────────────────────────────────────────────
  it('FT-8.10: Quality gate — variant with palette not in CURATED_COLOR_SETS → excluded from output', async () => {
    flagState.premium = true;

    // Second variant has an invalid palette — quality gate must exclude it.
    llmCall.mockResolvedValue({
      object: {
        variants: [
          {
            paletteId: 'ocean',
            plans: SLIDES_3.map((_, i) => ({
              slideIndex: i,
              layoutIntent: i === 0 ? 'cover' : 'key_messages',
              paletteId: 'ocean',
              imageBrief: null,
              reasoning: 'ok',
            })),
          },
          {
            // Not in PALETTE_CATALOG → must be excluded.
            paletteId: 'MALICIOUS_PALETTE',
            plans: SLIDES_3.map((_, i) => ({
              slideIndex: i,
              layoutIntent: 'comparison',
              paletteId: 'MALICIOUS_PALETTE',
              imageBrief: null,
              reasoning: 'injected',
            })),
          },
          {
            paletteId: 'ember',
            plans: SLIDES_3.map((_, i) => ({
              slideIndex: i,
              layoutIntent: i === 0 ? 'cover' : 'single_insight',
              paletteId: 'ember',
              imageBrief: null,
              reasoning: 'warm',
            })),
          },
        ],
      },
    });

    const res = await generateDeckVariants(SLIDES_3, META, {
      orgId: 'org-premium',
      preferPremium: true,
      count: 3,
    });

    // 'MALICIOUS_PALETTE' variant must have been stripped.
    const palettes = res.variants.map((v) => v.plans[0].paletteId);
    expect(palettes).not.toContain('MALICIOUS_PALETTE');
    // Only 2 valid-palette variants remain.
    expect(res.variants).toHaveLength(2);
    for (const pal of palettes) {
      expect(PALETTE_CATALOG).toContain(pal);
    }
  });

  // ── FT-8.11 ─────────────────────────────────────────────────
  it('FT-8.11: AI error during variant generation → at least 1 deterministic variant, no throw', async () => {
    flagState.premium = true;
    llmCall.mockRejectedValue(new Error('timeout'));

    // Must not throw — call once and capture.
    const res = await generateDeckVariants(SLIDES_4, META, {
      orgId: 'org-premium',
      preferPremium: true,
      count: 3,
    });

    expect(res.tierUsed).toBe('PREMIUM');
    expect(res.fallbackUsed).toBe(true);
    expect(res.variants.length).toBeGreaterThanOrEqual(1);
    // Fallback variant must have correct slide count.
    expect(res.variants[0].plans).toHaveLength(SLIDES_4.length);
  });

  // ── FT-8.12 ─────────────────────────────────────────────────
  it('FT-8.12: remixDeckLayout — instruction respected → LLM called, new plan reflects instruction', async () => {
    flagState.premium = true;

    const currentPlans: SlideLayoutPlan[] = SLIDES_3.map((_, i) => ({
      slideIndex: i,
      layoutIntent: 'key_messages',
      paletteId: 'harvard',
      imageBrief: null,
      reasoning: 'original',
      source: 'deterministic',
    }));

    // LLM returns a new plan that reflects the "use teal, more visual" instruction.
    llmCall.mockResolvedValue({
      object: {
        plans: SLIDES_3.map((_, i) => ({
          slideIndex: i,
          layoutIntent: i === 0 ? 'cover' : 'single_insight',
          paletteId: 'teal',
          imageBrief: 'modern visual hero',
          reasoning: 'more visual, teal applied per instruction',
        })),
      },
    });

    const res = await remixDeckLayout(SLIDES_3, META, currentPlans, {
      orgId: 'org-premium',
      preferPremium: true,
      instruction: 'use teal palette, more visual slides',
    });

    expect(res.tierUsed).toBe('PREMIUM');
    expect(res.fallbackUsed).toBe(false);
    expect(res.plans).toHaveLength(SLIDES_3.length);
    // LLM was called.
    expect(llmCall).toHaveBeenCalledTimes(1);
    // The LLM call's user prompt must contain the instruction string.
    const callArgs = llmCall.mock.calls[0][0];
    const userPromptContainsInstruction =
      typeof callArgs?.messages?.[0]?.content === 'string' &&
      callArgs.messages[0].content.includes('use teal palette');
    expect(userPromptContainsInstruction).toBe(true);
    // Palette switched from harvard → teal.
    expect(res.plans.every((p) => p.paletteId === 'teal')).toBe(true);
    // Layout changed from key_messages → single_insight (except cover).
    expect(res.plans[1].layoutIntent).toBe('single_insight');
  });
});
