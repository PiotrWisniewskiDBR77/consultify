import { describe, expect, it, vi } from 'vitest';

import WorkbookGeneratorService from '../WorkbookGeneratorService.js';
import { WorkbookSchemaValidator } from '../WorkbookSchema.js';
import { buildDeterministicInitiativeBudgetFromPrompt } from '../deterministicInitiativeBudget.js';

const PROMPT =
  'Teresa, utwórz od zera bez użycia template\'u skoroszyt „Initiative Budget — Teresa — E2E-20260806” dla 12-miesięcznego budżetu inicjatywy. ' +
  'Użyj dokładnie jawnych założeń: budżet całkowity 1 200 000 EUR; plan miesięczny 100 000 EUR od stycznia do grudnia; ' +
  'faktyczne koszty: 90000, 95000, 102000, 98000, 110000, 105000, 97000, 101000, 99000, 108000, 104000, 106000 EUR. ' +
  'Zbuduj minimum 3 arkusze: Inputs, Monthly Budget, Summary. Dodaj formuły variance = plan minus actual, cumulative plan, cumulative actual oraz utilization %.';

describe('deterministic initiative budget', () => {
  it('builds the exact three-sheet, formula-driven budget requested by Teresa', () => {
    const schema = buildDeterministicInitiativeBudgetFromPrompt(PROMPT);
    expect(schema).not.toBeNull();
    expect(WorkbookSchemaValidator.safeParse(schema).success).toBe(true);
    expect(schema?.sheets.map((sheet) => sheet.name)).toEqual([
      'Inputs',
      'Monthly Budget',
      'Summary',
    ]);
    expect(schema?.sheets[0].rows[0].cells.value.value).toBe(1_200_000);
    expect(schema?.sheets[0].rows.slice(2).map((row) => row.cells.value.value)).toEqual([
      90000, 95000, 102000, 98000, 110000, 105000,
      97000, 101000, 99000, 108000, 104000, 106000,
    ]);
    expect(schema?.sheets[1].rows).toHaveLength(12);
    expect(schema?.sheets[1].rows[0].cells.variance.formula).toBe('B2-C2');
    expect(schema?.sheets[1].rows[11].cells.cumulativePlan.formula).toBe('SUM($B$2:B13)');
    expect(schema?.sheets[1].rows[11].cells.cumulativeActual.formula).toBe('SUM($C$2:C13)');
    expect(schema?.sheets[1].rows[11].cells.utilization.formula).toBe('IF(E13=0,0,F13/E13)');
  });

  it('fails closed to the general pipeline when twelve actual values are absent', () => {
    expect(
      buildDeterministicInitiativeBudgetFromPrompt(
        'Create an initiative budget for 12 months with a monthly plan of 100000 EUR.'
      )
    ).toBeNull();
  });

  it('generates locally without making any external LLM call', async () => {
    const llmSpy = vi.fn(async () => {
      throw new Error('external model must not be called');
    });
    (WorkbookGeneratorService as any).callLLM = llmSpy;

    const result = await WorkbookGeneratorService.generate({
      prompt: PROMPT,
      userId: 'user-test',
      organizationId: 'org-test',
      language: 'pl-PL',
    });

    expect(llmSpy).not.toHaveBeenCalled();
    expect(result.schema.sheets).toHaveLength(3);
    expect(result.buffer.length).toBeGreaterThan(1_000);
    expect(result.qualityReport).toMatchObject({ passed: true, score: 100, issues: [] });
    expect(result.pipelineLog.map((entry) => entry.phase)).toContain('deterministic_plan');
    expect(result.pipelineLog.find((entry) => entry.phase === 'review')?.status).toBe('skipped');
  });
});
