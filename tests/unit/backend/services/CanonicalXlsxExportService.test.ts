import { readFile } from 'node:fs/promises';
import path from 'node:path';

import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import {
  buildCanonicalXlsxBuffer,
  buildCanonicalWorkbookSchemaBuffer,
  CONSULTIFY_SUPPLIER_SCORECARD_PROFILE,
} from '../../../../server/src/services/export/CanonicalXlsxExportService.js';

const acceptedPath = path.resolve(
  'docs/program/TEMPLATE_1_BASES_20260916/fixtures/supplier-scorecard-accepted.xlsx'
);

const headers = [
  'Supplier',
  'Site',
  'Receipts Q2',
  'NC Q2',
  'NC rate Q2',
  'Receipts Q3',
  'NC Q3',
  'NC rate Q3',
  'Δ pp',
  'Trend',
  'Status',
];

describe('CanonicalXlsxExportService', () => {
  it('renders consultify-supplier-scorecard with accepted structural parity and field map', async () => {
    const accepted = new ExcelJS.Workbook();
    await accepted.xlsx.load(await readFile(acceptedPath));
    const acceptedData = accepted.worksheets[0];
    const columns = headers.map((header, index) => ({
      key: `c${index + 1}`,
      header,
      type: [2, 3, 5, 6].includes(index) ? 'number' : [4, 7].includes(index) ? 'percent' : 'text',
    }));
    const rows = Array.from({ length: 5 }, (_, rowIndex) =>
      Object.fromEntries(
        columns.map((column, columnIndex) => {
          const value = acceptedData.getCell(rowIndex + 7, columnIndex + 1).value;
          return [
            column.key,
            typeof value === 'object' && value && 'formula' in value
              ? { formula: `=${String(value.formula)}` }
              : { value },
          ];
        })
      )
    );

    const bytes = await buildCanonicalXlsxBuffer({
      title: 'Supplier Quality Scorecard',
      organizationName: 'Northwind Manufacturing Ltd.',
      source: 'Consultify → Materials → Sheets',
      generatedAt: '2026-09-16',
      profile: CONSULTIFY_SUPPLIER_SCORECARD_PROFILE,
      sheets: [{ name: 'Supplier scorecard', columns, rows }],
    });
    const generated = new ExcelJS.Workbook();
    await generated.xlsx.load(bytes);

    expect(generated.worksheets.map((sheet) => sheet.name)).toEqual([
      'Supplier scorecard',
      'Template fields',
    ]);
    const data = generated.getWorksheet('Supplier scorecard')!;
    expect(Array.from({ length: 11 }, (_, index) => data.getCell(6, index + 1).value)).toEqual(
      Array.from({ length: 11 }, (_, index) => acceptedData.getCell(6, index + 1).value)
    );
    expect(data.views[0]).toMatchObject({ state: 'frozen', xSplit: 2, ySplit: 6 });
    expect(data.getCell('C7').numFmt).toBe(acceptedData.getCell('C7').numFmt);
    expect(data.getCell('E7').numFmt).toBe(acceptedData.getCell('E7').numFmt);
    expect(data.getCell('I7').numFmt).toBe(acceptedData.getCell('I7').numFmt);
    for (const ref of ['E7', 'H7', 'I7', 'J7']) {
      expect(data.getCell(ref).type).toBe(ExcelJS.ValueType.Formula);
    }
    for (const ref of ['C12', 'D12', 'E12', 'F12', 'G12', 'H12', 'I12', 'J12']) {
      expect(data.getCell(ref).type).toBe(ExcelJS.ValueType.Formula);
    }
    expect(data.getCell('A14').value).toContain('Tolerance:');
    expect(data.getCell('A6').font.name).toBe('Arial');
    expect(data.headerFooter.oddHeader).toContain('Consultify');
    expect(data.headerFooter.oddHeader).toContain('Northwind Manufacturing Ltd.');
    expect(data.conditionalFormattings.length).toBeGreaterThanOrEqual(3);
    const stylesXml = await (await JSZip.loadAsync(bytes)).file('xl/styles.xml')!.async('string');
    expect(stylesXml).toContain('<bgColor rgb="FFFCE8E6"/>');
    expect(stylesXml).toContain('<bgColor rgb="FFE3F5E9"/>');
    expect(stylesXml).not.toContain('<fgColor rgb="FFFCE8E6"/>');
    const archive = await JSZip.loadAsync(bytes);
    const scorecardXml = await archive.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(scorecardXml).toContain(
      '<cfRule type="expression" dxfId="2" priority="1"><formula>NOT(ISERROR(SEARCH(&quot;Worsening&quot;,J7)))</formula></cfRule>'
    );
    expect(scorecardXml).toContain(
      '<cfRule type="expression" dxfId="3" priority="2"><formula>NOT(ISERROR(SEARCH(&quot;Improving&quot;,J7)))</formula></cfRule>'
    );

    const fieldMap = generated.getWorksheet('Template fields')!;
    expect(fieldMap.getCell('A1').value).toBe('Cell / range');
    expect(fieldMap.getCell('D9').value).toContain('trend colours');
    const styles = JSON.stringify(generated.model).toUpperCase();
    expect(styles).not.toContain('A50034');
  });

  it('keeps every generic source sheet and appends a formula-driven Summary', async () => {
    const bytes = await buildCanonicalXlsxBuffer({
      title: 'Capacity model',
      organizationName: 'Northwind',
      source: 'Consultify → Materials → Sheets',
      sheets: [
        {
          name: 'Demand',
          columns: [
            { key: 'role', header: 'Role', type: 'text' },
            { key: 'hours', header: 'Hours', type: 'number' },
          ],
          rows: [{ role: { value: 'Engineer' }, hours: { value: 120 } }],
        },
        {
          name: 'Supply',
          columns: [{ key: 'fte', header: 'FTE', type: 'number' }],
          rows: [{ fte: { value: 2 } }],
        },
      ],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Demand', 'Supply', 'Summary']);
    expect(workbook.getWorksheet('Summary')!.getCell('B4').type).toBe(ExcelJS.ValueType.Formula);
    expect(workbook.getWorksheet('Summary')!.getCell('B5').type).toBe(ExcelJS.ValueType.Formula);
  });

  it('only enables the scorecard profile explicitly and preserves supplied values otherwise', async () => {
    const columns = headers.map((header, index) => ({ key: `c${index}`, header, type: 'text' }));
    const row = Object.fromEntries(
      columns.map((column) => [column.key, { value: 'source value' }])
    );
    const bytes = await buildCanonicalXlsxBuffer({
      title: 'User table',
      organizationName: 'Northwind & Sons',
      source: 'Table & Studio',
      sheets: [{ name: 'User data', columns, rows: [row] }],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['User data', 'Summary']);
    expect(workbook.getWorksheet('User data')!.getCell('E2').value).toBe('source value');
    expect(workbook.getWorksheet('User data')!.headerFooter.oddHeader).toContain(
      'Northwind && Sons'
    );
  });

  it('keeps full WorkbookSchema features on the canonical Materials path', async () => {
    const bytes = await buildCanonicalWorkbookSchemaBuffer(
      {
        title: 'Full schema',
        sheets: [
          {
            name: 'Assumptions',
            isAssumptions: true,
            nameKeyColumn: 'key',
            nameValueColumn: 'value',
            columns: [
              { key: 'key', header: 'Driver' },
              {
                key: 'value',
                header: 'Value',
                type: 'number',
                validation: { type: 'whole', min: 0, max: 100 },
              },
            ],
            rows: [{ cells: { key: { value: 'Growth rate' }, value: { value: 12 } } }],
            merges: [{ start: 'A4', end: 'B4' }],
            conditionalFormatting: [
              {
                ref: 'B2:B2',
                rules: [
                  {
                    type: 'cellIs',
                    operator: 'greaterThan',
                    formulae: ['10'],
                    style: { bgColor: 'E3F5E9' },
                  },
                ],
              },
            ],
          },
        ],
      },
      { organizationName: 'Northwind', source: 'Materials' }
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    expect(workbook.getWorksheet('Info')).toBeDefined();
    const sheet = workbook.getWorksheet('Assumptions')!;
    expect(sheet.getCell('B2').dataValidation.type).toBe('whole');
    expect(sheet.getCell('A4').isMerged).toBe(true);
    expect(sheet.conditionalFormattings).toHaveLength(1);
    expect(JSON.stringify(workbook.definedNames.model)).toContain('Growth_rate');
  });
});
