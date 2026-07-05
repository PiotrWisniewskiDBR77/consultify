/**
 * WorkbookGeneratorService — Phase 0 TEMPLATE-MATCH routing tests (mock-LLM).
 *
 * These tests do NOT touch a live LLM. The AIPipeline layer is fully mocked (same
 * pattern as workbookGeneratorRepairLoop.test.ts) so the whole pipeline runs
 * deterministically. They prove the ROUTING MECHANISM:
 *
 *   1. HIT  — when the classifier returns a known templateId, the service builds
 *             the workbook FROM THE TEMPLATE (buildFromTemplate is invoked) and
 *             SKIPS the free-form design (the GENERATION prompt is NEVER sent).
 *             This test is RED on the pre-Phase-0 code: buildFromTemplate was
 *             never wired into generate(), so the free-form GENERATION prompt was
 *             always sent and buildFromTemplate never called.
 *
 *   2. MISS — when the classifier returns templateId:null, the free-form flow runs
 *             (PLAN + GENERATION prompts are sent) exactly as before. No regression.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock AIPipeline BEFORE importing the service (constructed in a field initializer).
// ---------------------------------------------------------------------------

let processImpl: (req: any) => Promise<{ success: boolean; content: string }>;

vi.mock('../../ai/AIPipeline.js', () => ({
  AIPipeline: {
    getInstance: () => ({
      process: (req: any) => processImpl(req),
    }),
  },
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Wrap the REAL template registry so buildFromTemplate keeps its true behaviour
// (a math-certain schema) while remaining a spy we can assert on. A plain
// vi.spyOn on a namespace import does NOT intercept the service's own ESM
// live-binding, so we re-export a spied copy via vi.mock + importActual.
const buildFromTemplateSpy = vi.fn();
vi.mock('../templates/index.js', async () => {
  const actual = await vi.importActual<typeof import('../templates/index.js')>(
    '../templates/index.js'
  );
  buildFromTemplateSpy.mockImplementation(actual.buildFromTemplate);
  return { ...actual, buildFromTemplate: buildFromTemplateSpy };
});

// ---------------------------------------------------------------------------
// Prompt-routing helpers — identify which phase a mock call belongs to.
// ---------------------------------------------------------------------------

const isTemplateMatchPrompt = (sys: string): boolean =>
  sys.includes('routing classifier for a workbook');
const isPlanPrompt = (sys: string): boolean => sys.includes('PLAN the structure');
const isGeneratePrompt = (sys: string): boolean =>
  sys.includes('You receive a PLAN and must produce');
const isConfirmPrompt = (sys: string): boolean =>
  sys.includes('quality assurance reviewer for spreadsheet plans');
const isReviewPrompt = (sys: string): boolean => sys.includes('senior Excel quality reviewer');

// Benign ancillary responses for the free-form phases (only used in the MISS test).
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

/** A minimal CLEAN free-form schema (formula total → critic passes). */
const FREEFORM_SCHEMA = {
  title: 'Free-form Fixture',
  description: 'clean bespoke workbook',
  sheets: [
    {
      name: 'Budget',
      columns: [
        { key: 'item', header: 'Item', type: 'text' },
        { key: 'amount', header: 'Amount', type: 'currency', numberFormat: '#,##0' },
      ],
      rows: [
        { cells: { item: { value: 'Alpha' }, amount: { value: 100 } } },
        { cells: { item: { value: 'Beta' }, amount: { value: 200 } } },
        { cells: { item: { value: 'Total' }, amount: { formula: 'SUM(B2:B3)' } }, isSummary: true },
      ],
    },
  ],
};

const baseParams = {
  prompt: 'Make a tiny budget',
  userId: 'u1',
  organizationId: 'org1',
};

// ---------------------------------------------------------------------------

describe('WorkbookGeneratorService — Phase 0 template routing', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('HIT: routes a matching request to buildFromTemplate and SKIPS the free-form design', async () => {
    const calls: string[] = [];
    processImpl = async (req: any) => {
      const sys: string = req?.options?.systemInstruction ?? '';
      calls.push(sys);
      if (isTemplateMatchPrompt(sys)) {
        // Classifier picks the real registered template with sensible params.
        return {
          success: true,
          content: JSON.stringify({
            templateId: 'threeScenarioPnL',
            params: {
              companyName: 'Testco',
              startYear: 2026,
              baseRevenue: 1_000_000,
            },
          }),
        };
      }
      // ANY other phase being reached would mean the free-form flow ran — which it
      // must NOT on a template hit. Return junk so it would fail loudly if used.
      return { success: true, content: '{"unexpected":"free-form phase should not run"}' };
    };

    const { default: service } = await import('../WorkbookGeneratorService.js');
    const result = await service.generate({
      ...baseParams,
      prompt: 'Zrób model P&L 3 scenariusze Base/Bull/Bear na 3 lata dla firmy Testco',
    });

    // buildFromTemplate was invoked with the matched id (proves the template path).
    expect(buildFromTemplateSpy).toHaveBeenCalledTimes(1);
    expect(buildFromTemplateSpy.mock.calls[0][0]).toBe('threeScenarioPnL');

    // The free-form design prompts were NEVER sent (Phases 1–4 skipped).
    expect(calls.some(isTemplateMatchPrompt)).toBe(true);
    expect(calls.some(isPlanPrompt)).toBe(false);
    expect(calls.some(isGeneratePrompt)).toBe(false);
    expect(calls.some(isConfirmPrompt)).toBe(false);
    expect(calls.some(isReviewPrompt)).toBe(false);

    // pipelineLog records the template-match phase as ok.
    const tm = result.pipelineLog.find((p) => p.phase === 'template-match');
    expect(tm?.status).toBe('ok');
    expect(tm?.detail).toContain('threeScenarioPnL');

    // Output contract intact: non-empty buffer + a real schema from the template.
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.schema.metadata?.template).toBe('threeScenarioPnL');
    // Critic passed (template is math-certain) → qualityReport clean.
    expect(result.qualityReport.passed).toBe(true);
  });

  it('MISS: no template match → free-form flow runs (PLAN + GENERATE sent), no regression', async () => {
    const calls: string[] = [];
    processImpl = async (req: any) => {
      const sys: string = req?.options?.systemInstruction ?? '';
      calls.push(sys);
      if (isTemplateMatchPrompt(sys)) {
        return { success: true, content: JSON.stringify({ templateId: null, params: {} }) };
      }
      if (isPlanPrompt(sys)) return { success: true, content: PLAN_JSON };
      if (isConfirmPrompt(sys)) return { success: true, content: CONFIRM_JSON };
      if (isReviewPrompt(sys)) return { success: true, content: REVIEW_JSON };
      if (isGeneratePrompt(sys)) return { success: true, content: JSON.stringify(FREEFORM_SCHEMA) };
      return { success: true, content: '{}' };
    };

    const { default: service } = await import('../WorkbookGeneratorService.js');
    const result = await service.generate({ ...baseParams });

    // No template was built — free-form owns this request.
    expect(buildFromTemplateSpy).not.toHaveBeenCalled();

    // Free-form design prompts were sent (Phases 1 + 3 at least).
    expect(calls.some(isTemplateMatchPrompt)).toBe(true);
    expect(calls.some(isPlanPrompt)).toBe(true);
    expect(calls.some(isGeneratePrompt)).toBe(true);

    // template-match phase logged the miss, free-form produced a valid workbook.
    const tm = result.pipelineLog.find((p) => p.phase === 'template-match');
    expect(tm?.status).toBe('ok');
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.schema.title).toBe('Free-form Fixture');
  });
});
