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
    const schema = buildBenefitsRealizationSchema({ programName: 'Northstar', currencyCode: 'EUR' });
    expect(() => WorkbookSchemaValidator.parse(schema)).not.toThrow();
    expect(schema.sheets.map((s) => s.name)).toEqual([
      'Executive Summary', 'Assumptions', 'Benefits Register', 'Scenario Model', 'Monthly Tracking',
    ]);
    expect(JSON.stringify(schema)).not.toMatch(/TBD|placeholder|lorem ipsum/i);
    const formulas = schema.sheets.flatMap((s) => s.rows).flatMap((r) => Object.values(r.cells)).filter((c) => c.formula);
    expect(formulas.length).toBeGreaterThanOrEqual(70);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await buildWorkbookBuffer(schema)) as any);
    expect(workbook.getWorksheet('Executive Summary')?.getCell('B5').value).toMatchObject({ formula: expect.stringContaining('Benefits Register') });
    expect(workbook.getWorksheet('Benefits Register')?.getCell('C2').value).toMatchObject({ formula: expect.stringContaining('Assumptions') });
    expect(workbook.getWorksheet('Assumptions')?.getCell('B2').fill.type).toBe('pattern');
    expect(workbook.getWorksheet('Assumptions')?.getCell('D3').value).toBe('CRM + revenue ledger');
    expect(workbook.getWorksheet('Scenario Model')?.getCell('B2').value).toMatchObject({ formula: "'Assumptions'!B8" });
    expect(workbook.getWorksheet('Scenario Model')?.getCell('C3').value).toMatchObject({ formula: expect.stringContaining('Benefits Register') });
    expect(workbook.getWorksheet('Monthly Tracking')?.getCell('E13').value).toMatchObject({ formula: 'SUM($C$2:C13)' });
  });

  it('is discoverable and passes deterministic quality critique', () => {
    expect(WORKBOOK_TEMPLATES.benefitsRealization.title).toContain('Benefits Realization');
    const result = critiqueWorkbook(buildBenefitsRealizationSchema());
    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
