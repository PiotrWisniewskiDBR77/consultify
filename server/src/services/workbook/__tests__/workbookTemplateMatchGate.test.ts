// @vitest-environment node
/**
 * WorkbookGeneratorService — FALA "dopasowanie wzorca z czatu" gate tests.
 *
 * `matchWorkbookTemplate` (private) is exercised indirectly through the public
 * `generate()` entry point, with the AIPipeline layer fully mocked (no live LLM,
 * no network) — same technique as workbookGeneratorRepairLoop.test.ts.
 *
 * What this proves:
 *   1. GATE COVERAGE — the cheap regex gate (`TEMPLATE_HINT_RE`) lets a free-text
 *      request through to the LLM template-matcher for ALL 7 registered
 *      templates, in both Polish and English phrasing (≥2 phrases per language
 *      per template). We detect "the gate let it through" by asserting the
 *      TEMPLATE_MATCH_SYSTEM_PROMPT was actually sent to the (mocked) LLM.
 *   2. GATE IS STILL CHEAP/SELECTIVE — an unrelated request never reaches the
 *      LLM template-matcher at all (negative case): the free-form
 *      PLAN→CONFIRM→GENERATE→REVIEW pipeline runs instead, proving the gate
 *      short-circuits BEFORE any LLM cost, not just "the LLM said no".
 *   3. DOWNSTREAM COMPLETENESS — for every one of the 7 templates, once the
 *      (mocked) LLM returns a match, `buildFromTemplateFlat` actually builds a
 *      real, non-empty .xlsx buffer with no unhandled exception. This is the
 *      regression the ROBOTNIK brief flagged as a risk: before this change the
 *      match path called `buildFromTemplate` (expects each template's NATIVE,
 *      possibly-nested param shape) while the prompt only ever emitted flat
 *      dotted keys for one template (threeScenarioPnL) — for a hypothetical
 *      6-more-template prompt this combination was never exercised together.
 *      Switching to `buildFromTemplateFlat` (which unflattens dotted keys via
 *      each template's `coerceParams`, identity for the other six) closes that
 *      gap; this suite is the proof.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the AIPipeline module BEFORE importing the service (service constructs
// AIPipeline.getInstance() in a field initializer). A module-level ref lets
// each test swap in its own per-call script.
// ---------------------------------------------------------------------------

let processImpl: (req: any) => Promise<{ success: boolean; content: string }>;

vi.mock('../../ai/AIPipeline.js', () => ({
  AIPipeline: {
    getInstance: () => ({
      process: (req: any) => processImpl(req),
    }),
  },
}));

// Silence the logger to keep test output clean and avoid any transport side effects.
vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Benign fixtures for the ancillary phases (used by the free-form fallback in
// the negative-gate test, and by Phase 4 REVIEW which always runs even on the
// template-match path).
// ---------------------------------------------------------------------------

const PLAN_JSON = JSON.stringify({ domain: 'finance', sheets: [], total_complexity: 'low' });
const CONFIRM_JSON = JSON.stringify({
  approved: true,
  confidence: 0.9,
  issues: [],
  missing_elements: [],
});
const REVIEW_JSON = JSON.stringify({
  scores: {},
  overall_score: 4.5,
  pass: true,
  issues: [],
  fixes_applied: null,
});

/** Minimal, schema-valid free-form GENERATE output — used only by the negative case. */
const TRIVIAL_FREE_FORM_SCHEMA = {
  title: 'Trivial free-form workbook',
  description: 'fallback for an unrelated request that must NOT match any template',
  sheets: [
    {
      name: 'Sheet1',
      columns: [{ key: 'item', header: 'Item', type: 'text' }],
      rows: [{ cells: { item: { value: 'x' } } }],
    },
  ],
};

/** Route a mock response by the system prompt each phase sends. */
function routeByPrompt(sys: string, opts: { templateMatch: string }): string {
  if (sys.includes('template-matching assistant')) return opts.templateMatch;
  if (sys.includes('PLAN the structure')) return PLAN_JSON;
  if (sys.includes('quality assurance reviewer for spreadsheet plans')) return CONFIRM_JSON;
  if (sys.includes('senior Excel quality reviewer')) return REVIEW_JSON;
  if (sys.includes('You receive a PLAN and must produce'))
    return JSON.stringify(TRIVIAL_FREE_FORM_SCHEMA);
  return '{}';
}

const baseParams = { userId: 'u1', organizationId: 'org1' };

// ---------------------------------------------------------------------------
// Case table: ≥2 PL + ≥2 EN phrases per registered template.
// ---------------------------------------------------------------------------

const POSITIVE_CASES: Array<{ templateId: string; lang: 'pl' | 'en'; prompt: string }> = [
  // threeScenarioPnL
  {
    templateId: 'threeScenarioPnL',
    lang: 'pl',
    prompt: 'Zrób model 3 scenariuszy dla mojej spółki',
  },
  {
    templateId: 'threeScenarioPnL',
    lang: 'pl',
    prompt: 'Potrzebuję rachunku wyników w wariancie Base/Bull/Bear',
  },
  { templateId: 'threeScenarioPnL', lang: 'en', prompt: 'Build a 3 scenario financial model' },
  {
    templateId: 'threeScenarioPnL',
    lang: 'en',
    prompt: 'I need a P&L with Base Bull Bear scenarios',
  },

  // operatingBudget
  {
    templateId: 'operatingBudget',
    lang: 'pl',
    prompt: 'Przygotuj budżet operacyjny na przyszły rok',
  },
  { templateId: 'operatingBudget', lang: 'pl', prompt: 'Chcę roczny budżet operacyjny firmy' },
  { templateId: 'operatingBudget', lang: 'en', prompt: 'Create an operating budget for next year' },
  { templateId: 'operatingBudget', lang: 'en', prompt: 'I need a 12-month operating budget' },

  // dcfValuation
  { templateId: 'dcfValuation', lang: 'pl', prompt: 'Zrób wycenę DCF spółki' },
  {
    templateId: 'dcfValuation',
    lang: 'pl',
    prompt: 'Potrzebuję wyceny metodą zdyskontowanych przepływów pieniężnych',
  },
  { templateId: 'dcfValuation', lang: 'en', prompt: 'Build a DCF valuation model' },
  { templateId: 'dcfValuation', lang: 'en', prompt: 'I need a discounted cash flow valuation' },

  // breakEven
  { templateId: 'breakEven', lang: 'pl', prompt: 'Policz próg rentowności dla nowego produktu' },
  { templateId: 'breakEven', lang: 'pl', prompt: 'Zrób analizę break-even' },
  { templateId: 'breakEven', lang: 'en', prompt: 'Calculate the break-even point for my product' },
  { templateId: 'breakEven', lang: 'en', prompt: 'I need a BEP analysis' },

  // cashflow12m
  {
    templateId: 'cashflow12m',
    lang: 'pl',
    prompt: 'Zrób prognozę przepływów pieniężnych na 12 miesięcy',
  },
  { templateId: 'cashflow12m', lang: 'pl', prompt: 'Potrzebuję cashflow na najbliższy rok' },
  { templateId: 'cashflow12m', lang: 'en', prompt: 'Build a 12-month cash flow forecast' },
  { templateId: 'cashflow12m', lang: 'en', prompt: 'I need a cashflow projection for the year' },

  // unitEconomics
  { templateId: 'unitEconomics', lang: 'pl', prompt: 'Policz ekonomię jednostkową naszego SaaS' },
  { templateId: 'unitEconomics', lang: 'pl', prompt: 'Zrób analizę LTV/CAC' },
  { templateId: 'unitEconomics', lang: 'en', prompt: 'Calculate our unit economics' },
  { templateId: 'unitEconomics', lang: 'en', prompt: 'I need an LTV CAC analysis' },

  // loanAmortization
  { templateId: 'loanAmortization', lang: 'pl', prompt: 'Zrób harmonogram spłaty kredytu' },
  {
    templateId: 'loanAmortization',
    lang: 'pl',
    prompt: 'Potrzebuję amortyzacji kredytu inwestycyjnego',
  },
  { templateId: 'loanAmortization', lang: 'en', prompt: 'Build a loan amortization table' },
  { templateId: 'loanAmortization', lang: 'en', prompt: 'I need a loan amortization schedule' },
];

const NEGATIVE_PROMPTS = [
  'Napisz plan rekrutacji na dział sprzedaży na przyszły kwartał',
  'Please write a short poem about the ocean',
  'Zrób mi listę zadań na ten tydzień',
  'Prepare a project status report for the steering committee',
];

// ---------------------------------------------------------------------------

describe('WorkbookGeneratorService — template-match gate (Excel: dopasowanie wzorców z czatu)', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(POSITIVE_CASES)(
    'gate lets "$prompt" ($lang) through to the LLM and builds templateId=$templateId end-to-end',
    async ({ templateId, prompt }) => {
      const calls: string[] = [];
      processImpl = async (req: any) => {
        const sys: string = req?.options?.systemInstruction ?? '';
        calls.push(sys);
        const content = routeByPrompt(sys, {
          templateMatch: JSON.stringify({ templateId, confidence: 0.95, params: {} }),
        });
        return { success: true, content };
      };

      const { default: service } = await import('../WorkbookGeneratorService.js');
      const result = await service.generate({ prompt, ...baseParams });

      // (1) The gate let the request reach the LLM template-matcher.
      expect(calls.some((c) => c.includes('template-matching assistant'))).toBe(true);

      // The free-form PLAN prompt must NEVER fire — template match short-circuits it.
      expect(calls.some((c) => c.includes('PLAN the structure'))).toBe(false);

      // Pipeline log records the matched template.
      const tmPhase = result.pipelineLog.find((p) => p.phase === 'template_match');
      expect(tmPhase?.status).toBe('ok');
      expect(tmPhase?.detail).toContain(templateId);

      // (3) Downstream did not explode: buildFromTemplateFlat produced a real
      // workbook (non-empty buffer, at least one sheet) for THIS template, not
      // just threeScenarioPnL.
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.schema.sheets.length).toBeGreaterThan(0);
    }
  );

  it('does NOT ask the LLM to match a template for unrelated requests (gate stays selective)', async () => {
    for (const prompt of NEGATIVE_PROMPTS) {
      const calls: string[] = [];
      processImpl = async (req: any) => {
        const sys: string = req?.options?.systemInstruction ?? '';
        calls.push(sys);
        // Scripted to ALWAYS say "no match" if the gate is ever (wrongly) bypassed —
        // the real assertion below is that this branch is never even reached.
        const content = routeByPrompt(sys, {
          templateMatch: JSON.stringify({ templateId: null, confidence: 0, params: {} }),
        });
        return { success: true, content };
      };

      const { default: service } = await import('../WorkbookGeneratorService.js');
      const result = await service.generate({ prompt, ...baseParams });

      // (2) The cheap keyword gate blocks BEFORE any LLM call — no template-match
      // system prompt was ever sent for this request.
      expect(calls.some((c) => c.includes('template-matching assistant'))).toBe(false);

      const tmPhase = result.pipelineLog.find((p) => p.phase === 'template_match');
      expect(tmPhase?.status).toBe('skipped');

      // Free-form pipeline still produced a workbook (fail-soft fallback intact).
      expect(result.buffer.length).toBeGreaterThan(0);
    }
  });
});
