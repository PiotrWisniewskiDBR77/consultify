// @vitest-environment node
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildWorkbookBuffer } from '../WorkbookBuilder.js';
import { critiqueWorkbook } from '../workbookQualityGate.js';
import { WorkbookSchemaValidator } from '../WorkbookSchema.js';
import { buildBenefitsRealizationSchema } from '../templates/benefitsRealization.js';
import { WORKBOOK_TEMPLATES } from '../templates/index.js';

describe('benefitsRealization premium workbook', () => {
  it('builds a five-layer, formula-driven board model without placeholders', async () => {
    const schema = buildBenefitsRealizationSchema({ programName: 'Northstar', currencyCode: 'EUR', investment: 2_400_000, implementationCost: 300_000 });
    expect(() => WorkbookSchemaValidator.parse(schema)).not.toThrow();
    expect(schema.sheets.map((s) => s.name)).toEqual([
      'Executive Summary', 'Assumptions', 'Benefits Register', 'Scenario Model', 'Monthly Tracking',
    ]);
    expect(JSON.stringify(schema)).not.toMatch(/TBD|placeholder|lorem ipsum/i);
    const formulas = schema.sheets.flatMap((s) => s.rows).flatMap((r) => Object.values(r.cells)).filter((c) => c.formula);
    expect(formulas.length).toBeGreaterThanOrEqual(70);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await buildWorkbookBuffer(schema)) as any);
    expect(workbook.getWorksheet('Executive Summary')?.getCell('B2').value).toMatchObject({ formula: "'Assumptions'!B4" });
    expect(workbook.getWorksheet('Executive Summary')?.getCell('B5').value).toMatchObject({ formula: expect.stringContaining("'Assumptions'!B4") });
    expect(workbook.getWorksheet('Benefits Register')?.getCell('C2').value).toMatchObject({ formula: expect.stringContaining('Assumptions') });
    expect(workbook.getWorksheet('Assumptions')?.getCell('B2').fill.type).toBe('pattern');
    expect(workbook.getWorksheet('Assumptions')?.getCell('B3').value).toBe(300_000);
    expect(workbook.getWorksheet('Assumptions')?.getCell('B4').value).toMatchObject({ formula: 'SUM(B2:B3)' });
    expect(workbook.getWorksheet('Assumptions')?.getCell('D5').value).toBe('CRM + revenue ledger');
    expect(workbook.getWorksheet('Scenario Model')?.getCell('B2').value).toMatchObject({ formula: "'Assumptions'!B10" });
    expect(workbook.getWorksheet('Scenario Model')?.getCell('C3').value).toMatchObject({ formula: expect.stringContaining('Benefits Register') });
    expect(workbook.getWorksheet('Monthly Tracking')?.getCell('E13').value).toMatchObject({ formula: 'SUM($C$2:C13)' });
    expect(workbook.getWorksheet('Monthly Tracking')?.getCell('D2').font.color?.argb).toBe('FFC2415D');
    expect(workbook.getWorksheet('Monthly Tracking')?.conditionalFormattings[0].ref).toBe('D2:D13');
  });

  it('is discoverable and passes deterministic quality critique', () => {
    expect(WORKBOOK_TEMPLATES.benefitsRealization.title).toContain('Benefits Realization');
    const result = critiqueWorkbook(buildBenefitsRealizationSchema());
    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
