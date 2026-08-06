// @vitest-environment node
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildWorkbookBuffer } from '../WorkbookBuilder.js';
import { critiqueWorkbook } from '../workbookQualityGate.js';
import { WorkbookSchemaValidator } from '../WorkbookSchema.js';
import { buildBenefitsRealizationSchema } from '../templates/benefitsRealization.js';
import { WORKBOOK_TEMPLATES } from '../templates/index.js';

describe('benefitsRealization premium workbook', () => {
  it('builds a three-layer, formula-driven board model without placeholders', async () => {
    const schema = buildBenefitsRealizationSchema({ programName: 'Northstar', currencyCode: 'EUR' });
    expect(() => WorkbookSchemaValidator.parse(schema)).not.toThrow();
    expect(schema.sheets.map((s) => s.name)).toEqual(['Executive Summary', 'Założenia', 'Korzyści']);
    expect(JSON.stringify(schema)).not.toMatch(/TBD|placeholder|lorem ipsum/i);
    expect(schema.sheets[2].rows.flatMap((r) => Object.values(r.cells)).filter((c) => c.formula).length).toBeGreaterThanOrEqual(12);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await buildWorkbookBuffer(schema)) as any);
    expect(workbook.getWorksheet('Executive Summary')?.getCell('B5').value).toMatchObject({ formula: expect.stringContaining('Korzyści') });
    expect(workbook.getWorksheet('Korzyści')?.getCell('C2').value).toMatchObject({ formula: expect.stringContaining('Założenia') });
    expect(workbook.getWorksheet('Założenia')?.getCell('B2').fill.type).toBe('pattern');
  });

  it('is discoverable and passes deterministic quality critique', () => {
    expect(WORKBOOK_TEMPLATES.benefitsRealization.title).toContain('Benefits Realization');
    const result = critiqueWorkbook(buildBenefitsRealizationSchema());
    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
