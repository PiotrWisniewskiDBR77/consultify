/**
 * M13 #16 — "AI-fill per section to McKinsey formula standard".
 *
 * Locks the formula-injection + adversarial-review contract of
 * initiativeGenerationService (the deterministic, mockable core):
 *
 *  1. generateSectionContent injects the CARD_CONTENT_FORMULA doctrine
 *     (DOCTRINE_SYSTEM_PROMPT / _EN) as the system prompt AND appends the
 *     per-section SECTION_FORMULA_GUIDANCE into the user prompt, regardless of
 *     the (generic) DB-seeded template.
 *  2. reviewSectionContent maps score→verdict per §B4 (PASS only when score ≥ 90),
 *     returns failedValidators/qualityGaps/fixes, and its heuristic fallback
 *     (no LLM) is conservative — it NEVER returns PASS on empty/thin content.
 *
 * No real network / DB: the LLM client, the section-type service, and the DB
 * are all vi.mock'd. Pattern modeled on initiativeGovernanceService.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- LLM client mock (the dynamic import target) -----------------------------
// `call` is a spy we drive per-test. `llmService` is the named export the
// service reads (`mod.llmService || mod.default`).
const mockLlmCall = vi.fn();
vi.mock('../../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...args: unknown[]) => mockLlmCall(...args) },
  default: { call: (...args: unknown[]) => mockLlmCall(...args) },
}));

// --- Section-type service mock (default export) ------------------------------
// Returns a deliberately GENERIC template so the test proves the doctrine is
// injected at the service layer, not sourced from the DB seed.
const mockGetSectionTypeByKey = vi.fn();
vi.mock('../../../../server/src/services/initiativeSectionTypeService.js', () => ({
  default: {
    getSectionTypeByKey: (...args: unknown[]) => mockGetSectionTypeByKey(...args),
    getAllSectionTypes: vi.fn().mockResolvedValue([]),
  },
}));

// --- DB mock (constructor + enrichContext) -----------------------------------
// We pass contexts WITHOUT initiativeId so enrichContext returns early; the db
// is only needed so the constructor does not throw.
vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({}),
}));

const IMPORT_PATH = '../../../../server/src/services/initiativeGenerationService.js';

const GENERIC_TEMPLATE =
  'Generate the {{language}} content for the section of initiative {{initiativeName}}.';

describe('initiativeGenerationService — formula injection + review verdict (M13 #16)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSectionTypeByKey.mockResolvedValue({
      key: 'kpis',
      name: 'KPIs',
      aiPromptTemplate: GENERIC_TEMPLATE,
    });
  });

  it('generateSectionContent injects the formula doctrine system prompt + per-section guidance', async () => {
    const mod = await import(IMPORT_PATH);
    mod.__resetLlmInstanceForTests();
    const service = mod.default;

    mockLlmCall.mockResolvedValue({
      content: 'KPI 1: konwersja baseline 12% → cel 18% (wzrost, %). KPI 2 primary ...',
      usage: { totalTokens: 123 },
      model: 'test-premium',
    });

    const result = await service.generateSectionContent(
      'kpis',
      { initiativeName: 'Init X', language: 'pl' },
      'org-1'
    );

    expect(result.content).toContain('KPI 1');
    expect(result.model).toBe('test-premium');

    // The generate call must have happened exactly through the mocked LLM.
    expect(mockLlmCall).toHaveBeenCalledTimes(1);
    const callArg = mockLlmCall.mock.calls[0][0] as any;

    // (a) DOCTRINE system prompt is injected (PL doctrine for a PL card).
    expect(callArg.systemPrompt).toContain('McKinsey');
    expect(callArg.systemPrompt).toContain('CARD_CONTENT_FORMULA');
    expect(callArg.systemPrompt).toContain('ANSWER-FIRST');

    // (b) Per-section SECTION_FORMULA_GUIDANCE for 'kpis' is appended to the
    //     user prompt — proving doctrine survives a generic DB template.
    const userPrompt = String(callArg.messages?.[0]?.content || '');
    expect(userPrompt).toContain('KANON JAKOŚCI');
    expect(userPrompt).toContain('baseline→target'); // kpis guidance signature
    expect(userPrompt).toContain('primary');
    // The generic template itself was still interpolated.
    expect(userPrompt).toContain('Init X');
  });

  it('uses the English doctrine system prompt for an English card', async () => {
    mockGetSectionTypeByKey.mockResolvedValue({
      key: 'problemDefinition',
      name: 'Problem',
      aiPromptTemplate: GENERIC_TEMPLATE,
    });

    const mod = await import(IMPORT_PATH);
    mod.__resetLlmInstanceForTests();
    const service = mod.default;

    mockLlmCall.mockResolvedValue({ content: 'Root cause analysis...', model: 'm' });

    await service.generateSectionContent(
      'problemDefinition',
      { initiativeName: 'Init Y', language: 'en' },
      'org-1'
    );

    const callArg = mockLlmCall.mock.calls[0][0] as any;
    expect(callArg.systemPrompt).toContain('McKinsey-grade consulting partner');
    expect(callArg.systemPrompt).toContain('ABSOLUTE RULES');
  });

  it('generateSectionContent with withReview attaches an advisory review verdict', async () => {
    const mod = await import(IMPORT_PATH);
    mod.__resetLlmInstanceForTests();
    const service = mod.default;

    // First call = generation; second call = adversarial review (returns FAIL JSON).
    mockLlmCall
      .mockResolvedValueOnce({ content: 'thin draft', model: 'gen' })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          score: 40,
          verdict: 'FAIL',
          failedValidators: ['kpi_baseline_target'],
          qualityGaps: ['Brak baseline→target.'],
          fixes: ['Dodaj baseline→target + jednostkę.'],
        }),
        model: 'rev',
      });

    const result = await service.generateSectionContent(
      'kpis',
      { initiativeName: 'Init X', language: 'pl' },
      'org-1',
      { withReview: true }
    );

    expect(result.review).toBeDefined();
    expect(result.review.verdict).toBe('FAIL');
    expect(result.review.score).toBe(40);
    expect(result.review.failedValidators).toContain('kpi_baseline_target');
    expect(result.review.qualityGaps.length).toBeGreaterThan(0);
    expect(mockLlmCall).toHaveBeenCalledTimes(2);
  });

  it('reviewSectionContent: PASS only when the LLM score is >= 90 (§B4 threshold)', async () => {
    const mod = await import(IMPORT_PATH);
    mod.__resetLlmInstanceForTests();
    const service = mod.default;

    expect(mod.REVIEW_PASS_THRESHOLD).toBe(90);

    // Score 95 + verdict PASS → honoured as PASS.
    mockLlmCall.mockResolvedValueOnce({
      content: JSON.stringify({
        score: 95,
        verdict: 'PASS',
        failedValidators: [],
        qualityGaps: [],
        fixes: [],
      }),
      model: 'rev',
    });
    const good = await service.reviewSectionContent('kpis', 'solid grounded content '.repeat(10), {
      language: 'pl',
    });
    expect(good.verdict).toBe('PASS');
    expect(good.score).toBe(95);
    expect(good.degraded).toBe(false);

    // Score 88 BUT verdict PASS from the model → forced to FAIL (below threshold).
    mockLlmCall.mockResolvedValueOnce({
      content: JSON.stringify({
        score: 88,
        verdict: 'PASS',
        failedValidators: [],
        qualityGaps: [],
        fixes: [],
      }),
      model: 'rev',
    });
    const borderline = await service.reviewSectionContent(
      'kpis',
      'borderline content '.repeat(10),
      { language: 'pl' }
    );
    expect(borderline.score).toBe(88);
    expect(borderline.verdict).toBe('FAIL');
  });

  it('reviewSectionContent heuristic fallback (no LLM) returns FAIL + qualityGaps for thin content, never PASS', async () => {
    // Make the dynamic import resolve to a module with NO usable client so the
    // service takes the deterministic heuristic path.
    vi.resetModules();
    vi.doMock('../../../../server/src/services/ai/llmService.js', () => ({
      llmService: null,
      default: null,
    }));
    vi.doMock('../../../../server/src/services/initiativeSectionTypeService.js', () => ({
      default: {
        getSectionTypeByKey: mockGetSectionTypeByKey,
        getAllSectionTypes: vi.fn().mockResolvedValue([]),
      },
    }));
    vi.doMock('../../../../server/src/database/Database.js', () => ({
      getDatabase: () => ({}),
    }));

    const mod = await import(IMPORT_PATH);
    mod.__resetLlmInstanceForTests();
    const service = mod.default;

    // Empty content → hard FAIL, score 0.
    const empty = await service.reviewSectionContent('kpis', '   ', { language: 'pl' });
    expect(empty.verdict).toBe('FAIL');
    expect(empty.score).toBe(0);
    expect(empty.degraded).toBe(true);
    expect(empty.qualityGaps.length).toBeGreaterThan(0);
    expect(empty.failedValidators).toContain('content_len');

    // Thin-but-non-empty content → still FAIL, never PASS, capped below threshold.
    const thin = await service.reviewSectionContent(
      'kpis',
      'To jest krótka treść bez konkretnych mierzalnych wskaźników ani liczb i bez prawdziwego ugruntowania w danych.',
      { language: 'pl' }
    );
    expect(thin.verdict).toBe('FAIL');
    expect(thin.degraded).toBe(true);
    expect(thin.score).toBeLessThan(mod.REVIEW_PASS_THRESHOLD);
    expect(thin.qualityGaps.length).toBeGreaterThan(0);

    vi.resetModules();
  });
});
