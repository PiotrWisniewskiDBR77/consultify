/**
 * Adversarial reviewer (CARD_CONTENT_FORMULA §B4/§B6) — deterministic structure
 * tests. The LLM is mocked so assertions are stable; we verify the scoring
 * CONTRACT shape, the §B4 PASS threshold enforcement, JSON-parse tolerance, and
 * the LLM-free / unparseable degraded fallbacks.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLlmCall = vi.fn();

// The service resolves the LLM via `mod.llmService || mod.default`; export both
// so we control whether an LLM is "configured".
let llmConfigured = true;
vi.mock('../ai/llmService.js', () => ({
  get llmService() {
    return llmConfigured ? { call: (...a: unknown[]) => mockLlmCall(...a) } : null;
  },
  get default() {
    return llmConfigured ? { call: (...a: unknown[]) => mockLlmCall(...a) } : null;
  },
}));

// Section-type lookups touch the DB; the reviewer path does NOT use them, but
// keep the import graph clean for the generate path tests if added later.
vi.mock('../initiativeSectionTypeService.js', () => ({
  default: {
    getSectionTypeByKey: vi.fn(),
    getAllSectionTypes: vi.fn(),
  },
}));

import service, {
  __resetLlmInstanceForTests,
  REVIEW_PASS_THRESHOLD,
  type SectionReviewResult,
} from '../initiativeGenerationService.js';

// The service memoizes its resolved LLM instance; clear it between cases so the
// `llmConfigured` toggle (configured vs not) actually takes effect.
function resetLlmCache() {
  __resetLlmInstanceForTests();
}

const GOOD_CONTENT =
  'Jeśli wdrożymy SLA i triage S/M/L, to mediana lead-time spadnie do <=5 dni w 6 mies., bo każde zapytanie wejdzie w mierzony przepływ. KPI: OTIF baseline do ustalenia -> cel 90%, kierunek wzrost, jednostka %. Założenie: 5-10% sprzedazy blokowane przez waskie gardlo, ROI ~5x.';

describe('reviewSectionContent — contract shape', () => {
  beforeEach(() => {
    mockLlmCall.mockReset();
    llmConfigured = true;
    resetLlmCache();
  });

  it('returns the full scoring contract from a clean LLM verdict', async () => {
    mockLlmCall.mockResolvedValue({
      content: JSON.stringify({
        score: 94,
        verdict: 'PASS',
        failedValidators: [],
        qualityGaps: [],
        fixes: [],
      }),
      model: 'claude-premium',
    });

    const r = (await service.reviewSectionContent('kpis', GOOD_CONTENT, {
      language: 'pl',
    })) as SectionReviewResult;

    expect(r).toMatchObject({
      sectionKey: 'kpis',
      verdict: 'PASS',
      degraded: false,
    });
    expect(typeof r.score).toBe('number');
    expect(Array.isArray(r.failedValidators)).toBe(true);
    expect(Array.isArray(r.qualityGaps)).toBe(true);
    expect(Array.isArray(r.fixes)).toBe(true);
    expect(r.model).toBe('claude-premium');
  });

  it('downgrades a PASS verdict to FAIL when score is below the §B4 threshold', async () => {
    mockLlmCall.mockResolvedValue({
      content: JSON.stringify({
        score: REVIEW_PASS_THRESHOLD - 5, // model says PASS but score too low
        verdict: 'PASS',
        failedValidators: ['kpi_baseline_target'],
        qualityGaps: ['KPI bez baseline'],
        fixes: ['Dodaj baseline'],
      }),
      model: 'claude-premium',
    });

    const r = await service.reviewSectionContent('kpis', GOOD_CONTENT, { language: 'pl' });

    expect(r.verdict).toBe('FAIL');
    expect(r.score).toBe(REVIEW_PASS_THRESHOLD - 5);
    expect(r.failedValidators).toContain('kpi_baseline_target');
  });

  it('clamps out-of-range scores into 0..100', async () => {
    mockLlmCall.mockResolvedValue({
      content: JSON.stringify({ score: 250, verdict: 'PASS', failedValidators: [] }),
      model: 'm',
    });
    const r = await service.reviewSectionContent('overview', GOOD_CONTENT, { language: 'pl' });
    expect(r.score).toBe(100);
  });

  it('tolerates markdown-fenced JSON from the model', async () => {
    mockLlmCall.mockResolvedValue({
      content: '```json\n{"score": 40, "verdict": "FAIL", "qualityGaps": ["filler"]}\n```',
      model: 'm',
    });
    const r = await service.reviewSectionContent('scope', 'krótka treść', { language: 'pl' });
    expect(r.degraded).toBe(false);
    expect(r.verdict).toBe('FAIL');
    expect(r.score).toBe(40);
    expect(r.qualityGaps).toContain('filler');
  });

  it('degrades to the heuristic when the model output is unparseable', async () => {
    mockLlmCall.mockResolvedValue({ content: 'I cannot produce JSON, sorry.', model: 'm' });
    const r = await service.reviewSectionContent('kpis', GOOD_CONTENT, { language: 'pl' });
    expect(r.degraded).toBe(true);
    expect(r.model).toContain('heuristic');
    // Heuristic never asserts a confident PASS.
    expect(r.verdict).toBe('FAIL');
    expect(r.score).toBeLessThan(REVIEW_PASS_THRESHOLD);
  });

  it('degrades to the heuristic on LLM error and never throws', async () => {
    mockLlmCall.mockRejectedValue(new Error('provider down'));
    const r = await service.reviewSectionContent('financial-analysis', GOOD_CONTENT, {
      language: 'pl',
    });
    expect(r.degraded).toBe(true);
    expect(r.verdict).toBe('FAIL');
  });
});

describe('heuristic fallback (no LLM configured)', () => {
  beforeEach(() => {
    mockLlmCall.mockReset();
    llmConfigured = false;
    resetLlmCache();
  });

  it('hard-FAILs empty/near-empty content with content_len', async () => {
    const r = await service.reviewSectionContent('overview', 'za krótko', { language: 'pl' });
    expect(r.degraded).toBe(true);
    expect(r.score).toBe(0);
    expect(r.verdict).toBe('FAIL');
    expect(r.failedValidators).toContain('content_len');
  });

  it('flags filler/placeholder content via no_filler', async () => {
    const filler =
      'TODO: wpisz tutaj treść inicjatywy. Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim.';
    const r = await service.reviewSectionContent('overview', filler, { language: 'pl' });
    expect(r.failedValidators).toContain('no_filler');
    expect(r.verdict).toBe('FAIL');
  });

  it('flags missing sizing in financial sections via sizing_present', async () => {
    const noNumbers =
      'Ta inicjatywa przyniesie znaczne korzyści finansowe dla organizacji w wielu obszarach działania operacyjnego oraz strategicznego, poprawiając ogólną kondycję firmy i jej pozycję rynkową w dłuższej perspektywie czasowej.';
    const r = await service.reviewSectionContent('financial-analysis', noNumbers, {
      language: 'pl',
    });
    expect(r.failedValidators).toContain('sizing_present');
  });

  it('caps heuristic score strictly below the PASS threshold even for rich content', async () => {
    const r = await service.reviewSectionContent('kpis', GOOD_CONTENT, { language: 'pl' });
    expect(r.degraded).toBe(true);
    expect(r.score).toBeLessThan(REVIEW_PASS_THRESHOLD);
    expect(r.verdict).toBe('FAIL');
  });
});
