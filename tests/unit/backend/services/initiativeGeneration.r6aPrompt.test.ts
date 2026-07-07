/**
 * r6a — jakość generacji promptów (defekty sędziego BCG).
 *
 * Blokuje regresję czterech reguł doktryny wstrzykiwanych do promptów
 * initiativeGenerationService, wykrytych przez panel sceptyków:
 *   #1 jawny POLICZONY ROI + budżet jako jedna kwota PLN,
 *   #2 daty/terminy planów tylko w PRZYSZŁOŚCI (dynamiczny rok),
 *   #3 spójność liczb — jedna wartość na metrykę w całej karcie,
 *   #4 grounding kotwic rynkowych — zakaz fabrykowania źródeł ("według Gartnera").
 *
 * Testy sprawdzają OBECNOŚĆ instrukcji w promptach (system + guidance + fallback +
 * recenzent), a dla reguły czasu — dynamiczne wstrzyknięcie roku przez
 * buildTemporalRule. Bez sieci/DB: LLM/section-type/DB są zamockowane, a część
 * asercji działa na czystych, eksportowanych funkcjach.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLlmCall = vi.fn();
vi.mock('../../../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...args: unknown[]) => mockLlmCall(...args) },
  default: { call: (...args: unknown[]) => mockLlmCall(...args) },
}));

const mockGetSectionTypeByKey = vi.fn();
vi.mock('../../../../server/src/services/initiativeSectionTypeService.js', () => ({
  default: {
    getSectionTypeByKey: (...args: unknown[]) => mockGetSectionTypeByKey(...args),
    getAllSectionTypes: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({}),
}));

const IMPORT_PATH = '../../../../server/src/services/initiativeGenerationService.js';
const GENERIC_TEMPLATE =
  'Generate the {{language}} content for the section of initiative {{initiativeName}}. Return valid JSON only.';

describe('initiativeGenerationService — r6a prompt quality rules (BCG defects)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSectionTypeByKey.mockResolvedValue({
      key: 'financialImpact',
      name: 'Financial Impact',
      aiPromptTemplate: GENERIC_TEMPLATE,
    });
  });

  // -- DEFEKT #2: dynamiczna reguła czasu (przyszłe daty) ---------------------
  it('buildTemporalRule injects the CURRENT year and bans past plan dates (PL + EN)', async () => {
    const mod = await import(IMPORT_PATH);
    const fixedNow = new Date('2027-05-10T00:00:00Z');

    const pl = mod.buildTemporalRule(true, fixedNow);
    expect(pl).toContain('2027'); // dynamiczny rok, nie hardcode
    expect(pl).toContain('PRZYSZŁOŚCI');
    expect(pl).toMatch(/ZAKAZ|zakaz/);

    const en = mod.buildTemporalRule(false, fixedNow);
    expect(en).toContain('2027');
    expect(en).toContain('FUTURE');
    expect(en).toMatch(/past/i);
  });

  it('generateSectionContent system prompt carries the temporal + consistency + grounding rules', async () => {
    const mod = await import(IMPORT_PATH);
    mod.__resetLlmInstanceForTests();
    const service = mod.default;

    mockLlmCall.mockResolvedValue({ content: '{}', model: 'test-premium' });

    await service.generateSectionContent(
      'financialImpact',
      { initiativeName: 'Init X', language: 'pl' },
      'org-1'
    );

    const callArg = mockLlmCall.mock.calls[0][0] as any;
    const sys = String(callArg.systemPrompt || '');
    const currentYear = String(new Date().getFullYear());

    // #2 future dates (dynamic year present)
    expect(sys).toContain('REGUŁA CZASU');
    expect(sys).toContain(currentYear);
    // #3 number consistency
    expect(sys).toContain('SPÓJNOŚĆ LICZB');
    // #4 market grounding (no fabricated attribution)
    expect(sys).toContain('KOTWICE RYNKOWE');
    expect(sys).toContain('Gartner');
    // #1 computed ROI is in the initiative doctrine block
    expect(sys).toContain('ROI POLICZONY');
  });

  // -- DEFEKT #1: financialImpact — policzony ROI + jedna kwota budżetu -------
  it('financialImpact guidance forces a COMPUTED expectedRoi and a single-amount budget', async () => {
    const mod = await import(IMPORT_PATH);
    mod.__resetLlmInstanceForTests();
    const service = mod.default;

    mockLlmCall.mockResolvedValue({ content: '{}', model: 'm' });

    await service.generateSectionContent(
      'financialImpact',
      { initiativeName: 'Init X', language: 'pl' },
      'org-1'
    );

    const callArg = mockLlmCall.mock.calls[0][0] as any;
    const userPrompt = String(callArg.messages?.[0]?.content || '');

    expect(userPrompt).toContain('ROI POLICZONY');
    expect(userPrompt).toContain('expectedRoi');
    expect(userPrompt).toContain('payback');
    expect(userPrompt).toContain('estimatedBudget');
  });

  it('financialImpact CORE fallback prompt demands computed ROI + explicit budget when DB template is NULL', async () => {
    // Section-type row with NULL template → service must use the built-in fallback.
    mockGetSectionTypeByKey.mockResolvedValue({
      key: 'financialImpact',
      name: 'Financial Impact',
      aiPromptTemplate: null,
    });

    const mod = await import(IMPORT_PATH);
    mod.__resetLlmInstanceForTests();
    const service = mod.default;

    mockLlmCall.mockResolvedValue({ content: '{}', model: 'm' });

    await service.generateSectionContent(
      'financialImpact',
      { initiativeName: 'Init X', language: 'en' },
      'org-1'
    );

    const callArg = mockLlmCall.mock.calls[0][0] as any;
    const userPrompt = String(callArg.messages?.[0]?.content || '');

    // Fallback JSON schema now mandates a COMPUTED ROI and one-amount budget.
    expect(userPrompt).toMatch(/COMPUTED|COMPUTE/);
    expect(userPrompt).toContain('expectedRoi');
    expect(userPrompt).toContain('estimatedBudget');
    // consistency rule echoed in fallback
    expect(userPrompt).toMatch(/ONE value per metric|EXACTLY ONE/);
  });

  // -- Recenzent (adversarial) zna nowe walidatory ---------------------------
  it('reviewSectionContent prompt lists the new r6a validators (PL)', async () => {
    const mod = await import(IMPORT_PATH);
    mod.__resetLlmInstanceForTests();
    const service = mod.default;

    mockLlmCall.mockResolvedValue({
      content: JSON.stringify({ score: 50, verdict: 'FAIL', failedValidators: [], qualityGaps: [], fixes: [] }),
      model: 'rev',
    });

    await service.reviewSectionContent('financialImpact', 'jakaś treść do oceny '.repeat(5), {
      language: 'pl',
    });

    const callArg = mockLlmCall.mock.calls[0][0] as any;
    const sys = String(callArg.systemPrompt || '');
    expect(sys).toContain('roi_computed');
    expect(sys).toContain('number_consistency');
    expect(sys).toContain('future_dates');
    expect(sys).toContain('market_grounding');
  });

  it('reviewSectionContent prompt lists the new r6a validators (EN)', async () => {
    const mod = await import(IMPORT_PATH);
    mod.__resetLlmInstanceForTests();
    const service = mod.default;

    mockLlmCall.mockResolvedValue({
      content: JSON.stringify({ score: 50, verdict: 'FAIL', failedValidators: [], qualityGaps: [], fixes: [] }),
      model: 'rev',
    });

    await service.reviewSectionContent('financialImpact', 'some content to review '.repeat(5), {
      language: 'en',
    });

    const callArg = mockLlmCall.mock.calls[0][0] as any;
    const sys = String(callArg.systemPrompt || '');
    expect(sys).toContain('roi_computed');
    expect(sys).toContain('number_consistency');
    expect(sys).toContain('future_dates');
    expect(sys).toContain('market_grounding');
  });
});
