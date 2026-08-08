import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { importWorkbookBuffer } from '../workbookImport.js';

describe('workbookImport', () => {
  it('parses XLSX values, formulas, dimensions, styles and comments into canonical schema', async () => {
    const source = new ExcelJS.Workbook();
    const sheet = source.addWorksheet('Plan', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [{ header: 'Amount', key: 'amount', width: 24 }];
    const row = sheet.addRow([20]);
    row.height = 30;
    const valueCell = sheet.getCell('A2');
    valueCell.font = { bold: true, italic: true };
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    valueCell.note = 'Reviewed';
    sheet.getCell('A3').value = { formula: 'A2*2', result: 40 };
    const buffer = Buffer.from(await source.xlsx.writeBuffer());

    const result = await importWorkbookBuffer(buffer, 'plan.xlsx');
    expect(result.title).toBe('plan');
    expect(result.sheets[0]).toMatchObject({ name: 'Plan', freezeRow: 1 });
    expect(result.sheets[0].columns[0]).toMatchObject({ header: 'Amount', width: 24 });
    expect(result.sheets[0].rows[0]).toMatchObject({
      height: 30,
      cells: { c1: { value: 20, comment: 'Reviewed', style: { bold: true, italic: true, bgColor: 'FFF2CC' } } },
    });
    expect(result.sheets[0].rows[1].cells.c1).toMatchObject({ formula: 'A2*2', value: 40 });
  });

  it('parses CSV with the first row as headers', async () => {
    const result = await importWorkbookBuffer(Buffer.from('Name,Value\nAlpha,42\n'), 'data.csv');
    expect(result.sheets[0].columns.map((column) => column.header)).toEqual(['Name', 'Value']);
    expect(result.sheets[0].rows[0].cells).toMatchObject({ c1: { value: 'Alpha' }, c2: { value: 42 } });
  });
});
