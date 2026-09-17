import ExcelJS from 'exceljs';

import { buildWorkbookBuffer } from '../workbook/WorkbookBuilder.js';
import { sanitizeSpreadsheetCellText } from '../workbook/workbookExportSanitizer.js';
import type { WorkbookSchema } from '../workbook/WorkbookSchema.js';
import { CONSULTIFY_SUPPLIER_SCORECARD_PROFILE } from './XlsxExportProfile.js';

export { CONSULTIFY_SUPPLIER_SCORECARD_PROFILE } from './XlsxExportProfile.js';

// Arial is the accepted workbook's portable face and remains available when
// newer Microsoft-only Aptos fonts are not installed (for example LibreOffice).
const FONT = 'Arial';
const COLORS = {
  navy: 'FF1B2A41',
  slate: 'FF46556B',
  ink: 'FF101828',
  muted: 'FF667085',
  accent: 'FF2563EB',
  accentSoft: 'FFDBE7FF',
  rule: 'FFD8DEE8',
  zebra: 'FFF1F4F8',
  white: 'FFFFFFFF',
  ok: 'FF15803D',
  okSoft: 'FFE3F5E9',
  critical: 'FFB42318',
  criticalSoft: 'FFFCE8E6',
} as const;

const SCORECARD_HEADERS = [
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
] as const;

type ExportCell = { value?: unknown; formula?: string; numberFormat?: string };
type ExportColumn = {
  key: string;
  header: string;
  width?: number;
  type?: string;
  numberFormat?: string;
};
type ExportSheet = { name: string; columns: ExportColumn[]; rows: Record<string, ExportCell>[] };

export interface CanonicalXlsxInput {
  title: string;
  organizationName: string;
  source: string;
  generatedAt?: string;
  profile?: typeof CONSULTIFY_SUPPLIER_SCORECARD_PROFILE;
  sheets: ExportSheet[];
}

function argbFont(color: string = COLORS.ink, bold = false, size = 10): Partial<ExcelJS.Font> {
  return { name: FONT, size, bold, color: { argb: color } };
}

function solid(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

/** Excel stores differential solid fills in bgColor. LibreOffice discards a
 * dxf that uses the normal-cell fgColor representation. */
function differentialSolid(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', bgColor: { argb } };
}

function thinBorder(color: string = COLORS.rule): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: color } };
  return { top: side, left: side, bottom: side, right: side };
}

function safeSheetName(value: string, used: Set<string>): string {
  const base =
    (value || 'Data')
      .replace(/[\\/*?:[\]]/g, ' ')
      .trim()
      .slice(0, 31) || 'Data';
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate.toLowerCase()) || candidate.toLowerCase() === 'summary') {
    candidate = `${base.slice(0, 27)} ${suffix++}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function columnLetter(index: number): string {
  let value = index;
  let out = '';
  while (value > 0) {
    value -= 1;
    out = String.fromCharCode(65 + (value % 26)) + out;
    value = Math.floor(value / 26);
  }
  return out;
}

function normalized(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function isDuplicateHeaderRow(sheet: ExportSheet, row: Record<string, ExportCell>): boolean {
  return sheet.columns.every(
    (column) => normalized(row[column.key]?.value) === normalized(column.header)
  );
}

function formulaValue(formula: string): ExcelJS.CellFormulaValue {
  return { formula: formula.replace(/^=/, '') };
}

function plainCellValue(value: unknown): string | number | boolean {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return sanitizeSpreadsheetCellText(value) as string | number | boolean;
  }
  return JSON.stringify(value);
}

function writeCell(cell: ExcelJS.Cell, source: ExportCell | undefined, column: ExportColumn): void {
  if (!source) return;
  if (source.formula) {
    cell.value = formulaValue(source.formula);
  } else if (source.value !== undefined && source.value !== null) {
    if (['number', 'currency', 'percent', 'rating'].includes(column.type || '')) {
      const numeric = typeof source.value === 'number' ? source.value : Number(source.value);
      cell.value = Number.isFinite(numeric) ? numeric : plainCellValue(source.value);
    } else if (column.type === 'boolean') {
      cell.value = source.value === true || source.value === 'true';
    } else {
      cell.value = plainCellValue(source.value);
    }
  }
  cell.numFmt =
    source.numberFormat ||
    column.numberFormat ||
    (column.type === 'percent'
      ? '0.0%'
      : column.type === 'currency'
        ? '#,##0.00;[Red](#,##0.00);-'
        : ['number', 'rating'].includes(column.type || '')
          ? '#,##0.##'
          : 'General');
}

function setPrintAndBrand(
  worksheet: ExcelJS.Worksheet,
  organizationName: string,
  source: string
): void {
  const headerText = (value: string) => value.replace(/&/g, '&&');
  worksheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
  worksheet.headerFooter.oddHeader = `&L&9Consultify&R&9${headerText(organizationName)}`;
  worksheet.headerFooter.oddFooter = `&L&9${headerText(source)} · Confidential&R&9Page &P of &N`;
}

function displayedLength(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const text = String(value);
  return Math.max(...text.split(/\r?\n/).map((line) => line.length), 0);
}

function addGenericSheet(
  workbook: ExcelJS.Workbook,
  input: CanonicalXlsxInput,
  sheet: ExportSheet,
  name: string
): { name: string; numericColumns: number[]; lastDataRow: number } {
  const worksheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  });
  setPrintAndBrand(worksheet, input.organizationName, input.source);
  worksheet.columns = sheet.columns.map((column) => {
    const contentWidth = sheet.rows.reduce(
      (max, row) => Math.max(max, displayedLength(row[column.key]?.value)),
      column.header.length
    );
    return {
      key: column.key,
      header: column.header,
      width: column.width ?? Math.min(40, Math.max(12, contentWidth + 3)),
    };
  });
  const header = worksheet.getRow(1);
  header.height = 30;
  header.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = argbFont(COLORS.white, true);
    cell.fill = solid(COLORS.navy);
    cell.border = thinBorder(COLORS.navy);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  for (const [rowIndex, sourceRow] of sheet.rows.entries()) {
    const row = worksheet.getRow(rowIndex + 2);
    for (const [columnIndex, column] of sheet.columns.entries()) {
      const cell = row.getCell(columnIndex + 1);
      writeCell(cell, sourceRow[column.key], column);
      cell.font = argbFont();
      cell.fill = solid(rowIndex % 2 === 1 ? COLORS.zebra : COLORS.white);
      cell.border = thinBorder();
      cell.alignment = {
        vertical: 'middle',
        horizontal: ['number', 'currency', 'percent', 'rating'].includes(column.type || '')
          ? 'right'
          : 'left',
      };
    }
    row.height = 21;
  }
  const lastDataRow = Math.max(2, sheet.rows.length + 1);
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: lastDataRow, column: sheet.columns.length },
  };
  worksheet.pageSetup.printTitlesRow = '1:1';
  return {
    name,
    numericColumns: sheet.columns
      .map((column, index) => ({ column, index: index + 1 }))
      .filter(({ column }) =>
        ['number', 'currency', 'percent', 'rating'].includes(column.type || '')
      )
      .map(({ index }) => index),
    lastDataRow,
  };
}

function addScorecardDataSheet(
  workbook: ExcelJS.Workbook,
  input: CanonicalXlsxInput,
  sheet: ExportSheet
): { name: string; firstDataRow: number; lastDataRow: number } {
  const worksheet = workbook.addWorksheet('Supplier scorecard', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 6, showGridLines: false }],
  });
  setPrintAndBrand(worksheet, input.organizationName, input.source);
  worksheet.columns = [30, 14, 12, 10, 13, 12, 10, 13, 12, 14, 32].map((width) => ({ width }));
  worksheet.mergeCells('A1:K1');
  worksheet.getCell('A1').value = input.title || 'Supplier Quality Scorecard';
  worksheet.getCell('A1').font = argbFont(COLORS.navy, true, 16);
  worksheet.mergeCells('A2:K2');
  worksheet.getCell('A2').value = 'Goods-in nonconformances · Q2 to Q3';
  worksheet.getCell('A2').font = argbFont(COLORS.slate, false, 10.5);
  worksheet.mergeCells('A3:K3');
  worksheet.getCell('A3').value =
    `${input.organizationName}  ·  ${input.source}  ·  Generated ${input.generatedAt || new Date().toISOString().slice(0, 10)}  ·  Confidential`;
  worksheet.getCell('A3').font = argbFont(COLORS.muted, false, 9);
  for (let column = 1; column <= 11; column += 1) {
    worksheet.getRow(4).getCell(column).border = {
      bottom: { style: 'medium', color: { argb: COLORS.accent } },
    };
  }
  const header = worksheet.getRow(6);
  SCORECARD_HEADERS.forEach((value, index) => {
    const cell = header.getCell(index + 1);
    cell.value = value;
    cell.font = argbFont(COLORS.white, true);
    cell.fill = solid(COLORS.navy);
    cell.border = thinBorder(COLORS.navy);
    cell.alignment = {
      vertical: 'middle',
      horizontal: index < 2 || index === 10 ? 'left' : 'center',
      wrapText: true,
    };
  });
  header.height = 30;

  const rows = sheet.rows.filter((row) => !isDuplicateHeaderRow(sheet, row));
  const firstDataRow = 7;
  rows.forEach((sourceRow, index) => {
    const excelRowNumber = firstDataRow + index;
    const row = worksheet.getRow(excelRowNumber);
    sheet.columns.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      const sourceCell = sourceRow[column.key];
      if ([4, 7, 8, 9].includes(columnIndex)) {
        const formulas: Record<number, string> = {
          4: `IF(C${excelRowNumber}=0,"",D${excelRowNumber}/C${excelRowNumber})`,
          7: `IF(F${excelRowNumber}=0,"",G${excelRowNumber}/F${excelRowNumber})`,
          8: `IF(OR(C${excelRowNumber}=0,F${excelRowNumber}=0),"",ROUND((H${excelRowNumber}-E${excelRowNumber})*100,1))`,
          9: `IF(I${excelRowNumber}="","",IF(I${excelRowNumber}>0.3,"Worsening",IF(I${excelRowNumber}<-0.3,"Improving","Stable")))`,
        };
        cell.value = formulaValue(formulas[columnIndex]);
      } else {
        writeCell(cell, sourceCell, column);
      }
      cell.font = argbFont(columnIndex === 0 ? COLORS.navy : COLORS.ink, columnIndex === 0);
      cell.fill = solid(index % 2 === 1 ? COLORS.zebra : COLORS.white);
      cell.border = thinBorder();
      cell.alignment = {
        vertical: 'middle',
        horizontal: columnIndex < 2 || columnIndex === 10 ? 'left' : 'center',
      };
    });
    [3, 4, 6, 7].forEach((column) => (row.getCell(column).numFmt = '#,##0'));
    [5, 8].forEach((column) => (row.getCell(column).numFmt = '0.0%'));
    row.getCell(9).numFmt = '+0.0;-0.0;0.0';
    row.height = 21;
  });
  const lastDataRow = Math.max(firstDataRow, firstDataRow + rows.length - 1);
  const totalRowNumber = lastDataRow + 1;
  const totalRow = worksheet.getRow(totalRowNumber);
  totalRow.getCell(1).value = 'Total';
  totalRow.getCell(2).value = 'All sites';
  totalRow.getCell(3).value = formulaValue(`SUM(C${firstDataRow}:C${lastDataRow})`);
  totalRow.getCell(4).value = formulaValue(`SUM(D${firstDataRow}:D${lastDataRow})`);
  totalRow.getCell(5).value = formulaValue(`D${totalRowNumber}/C${totalRowNumber}`);
  totalRow.getCell(6).value = formulaValue(`SUM(F${firstDataRow}:F${lastDataRow})`);
  totalRow.getCell(7).value = formulaValue(`SUM(G${firstDataRow}:G${lastDataRow})`);
  totalRow.getCell(8).value = formulaValue(`G${totalRowNumber}/F${totalRowNumber}`);
  totalRow.getCell(9).value = formulaValue(`ROUND((H${totalRowNumber}-E${totalRowNumber})*100,1)`);
  totalRow.getCell(10).value = formulaValue(
    `IF(I${totalRowNumber}>0.3,"Worsening",IF(I${totalRowNumber}<-0.3,"Improving","Stable"))`
  );
  totalRow.getCell(11).value = formulaValue(
    `COUNTA(A${firstDataRow}:A${lastDataRow})&" suppliers"`
  );
  totalRow.eachCell({ includeEmpty: true }, (cell, columnIndex) => {
    cell.font = argbFont(COLORS.navy, true);
    cell.fill = solid(COLORS.accentSoft);
    cell.border = {
      ...thinBorder(),
      top: { style: 'medium', color: { argb: COLORS.navy } },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: columnIndex <= 2 || columnIndex === 11 ? 'left' : 'center',
    };
  });
  [3, 4, 6, 7].forEach((column) => (totalRow.getCell(column).numFmt = '#,##0'));
  [5, 8].forEach((column) => (totalRow.getCell(column).numFmt = '0.0%'));
  totalRow.getCell(9).numFmt = '+0.0;-0.0;0.0';
  totalRow.height = 23;

  const legendRow = totalRowNumber + 2;
  worksheet.mergeCells(`A${legendRow}:K${legendRow}`);
  worksheet.getCell(`A${legendRow}`).value =
    'Tolerance: NC rate above 3.0% triggers enhanced surveillance. Δ pp above +0.3 marks a worsening supplier. NC rate and Δ are formulas, not pasted values.';
  worksheet.getCell(`A${legendRow}`).font = {
    ...argbFont(COLORS.muted, false, 9),
    italic: true,
  };

  worksheet.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: totalRowNumber, column: 11 },
  };
  worksheet.pageSetup.printTitlesRow = '6:6';
  worksheet.addConditionalFormatting({
    ref: `H${firstDataRow}:H${lastDataRow}`,
    rules: [
      {
        type: 'cellIs',
        operator: 'greaterThan',
        formulae: ['0.03'],
        priority: 1,
        style: { font: { bold: true, color: { argb: COLORS.critical } } },
      },
      {
        type: 'expression',
        formulae: [`H${firstDataRow}<=0.02`],
        priority: 2,
        style: { font: { color: { argb: COLORS.ok } } },
      },
    ],
  });
  worksheet.addConditionalFormatting({
    ref: `J${firstDataRow}:J${totalRowNumber}`,
    rules: [
      {
        type: 'expression',
        formulae: [`NOT(ISERROR(SEARCH("Worsening",J${firstDataRow})))`],
        priority: 1,
        style: {
          font: { bold: true, color: { argb: COLORS.critical } },
          fill: differentialSolid(COLORS.criticalSoft),
        },
      },
      {
        type: 'expression',
        formulae: [`NOT(ISERROR(SEARCH("Improving",J${firstDataRow})))`],
        priority: 2,
        style: {
          font: { bold: true, color: { argb: COLORS.ok } },
          fill: differentialSolid(COLORS.okSoft),
        },
      },
    ],
  });
  worksheet.addConditionalFormatting({
    ref: `I${firstDataRow}:I${lastDataRow}`,
    rules: [
      {
        type: 'cellIs',
        operator: 'greaterThan',
        formulae: ['0.3'],
        priority: 1,
        style: { font: { bold: true, color: { argb: COLORS.critical } } },
      },
      {
        type: 'cellIs',
        operator: 'lessThan',
        formulae: ['-0.3'],
        priority: 2,
        style: { font: { bold: true, color: { argb: COLORS.ok } } },
      },
    ],
  });
  return { name: 'Supplier scorecard', firstDataRow, lastDataRow };
}

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  input: CanonicalXlsxInput,
  data: { name: string; firstDataRow: number; lastDataRow: number },
  scorecard: boolean,
  numericColumns: number[] = []
): void {
  const worksheet = workbook.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
  });
  setPrintAndBrand(worksheet, input.organizationName, input.source);
  worksheet.columns = [{ width: 30 }, { width: 24 }, { width: 20 }];
  worksheet.mergeCells('A1:C1');
  worksheet.getCell('A1').value = `${input.title} — Summary`;
  worksheet.getCell('A1').font = argbFont(COLORS.navy, true, 16);
  worksheet.getRow(3).values = ['Metric', 'Value', 'Source'];
  worksheet.getRow(3).eachCell((cell) => {
    cell.font = argbFont(COLORS.white, true);
    cell.fill = solid(COLORS.navy);
    cell.border = thinBorder(COLORS.navy);
  });
  const quoted = `'${data.name.replace(/'/g, "''")}'`;
  const metrics = scorecard
    ? [
        ['Suppliers', `COUNTA(${quoted}!A${data.firstDataRow}:A${data.lastDataRow})`, 'Data!A'],
        ['Receipts Q2', `SUM(${quoted}!C${data.firstDataRow}:C${data.lastDataRow})`, 'Data!C'],
        [
          'NC rate Q2',
          `SUM(${quoted}!D${data.firstDataRow}:D${data.lastDataRow})/SUM(${quoted}!C${data.firstDataRow}:C${data.lastDataRow})`,
          'Data!C:D',
        ],
        ['Receipts Q3', `SUM(${quoted}!F${data.firstDataRow}:F${data.lastDataRow})`, 'Data!F'],
        [
          'NC rate Q3',
          `SUM(${quoted}!G${data.firstDataRow}:G${data.lastDataRow})/SUM(${quoted}!F${data.firstDataRow}:F${data.lastDataRow})`,
          'Data!F:G',
        ],
        [
          'Worsening suppliers',
          `COUNTIF(${quoted}!J${data.firstDataRow}:J${data.lastDataRow},"Worsening")`,
          'Data!J',
        ],
      ]
    : [
        ['Rows', `COUNTA(${quoted}!A${data.firstDataRow}:A${data.lastDataRow})`, `${data.name}!A`],
        ...numericColumns.map((column) => [
          `Total ${columnLetter(column)}`,
          `SUM(${quoted}!${columnLetter(column)}${data.firstDataRow}:${columnLetter(column)}${data.lastDataRow})`,
          `${data.name}!${columnLetter(column)}`,
        ]),
      ];
  metrics.forEach(([label, formula, source], index) => {
    const row = worksheet.getRow(index + 4);
    row.getCell(1).value = label;
    row.getCell(2).value = formulaValue(formula);
    row.getCell(3).value = source;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = argbFont();
      cell.fill = solid(index % 2 === 1 ? COLORS.zebra : COLORS.white);
      cell.border = thinBorder();
    });
    if (scorecard && [2, 4].includes(index)) row.getCell(2).numFmt = '0.0%';
    else row.getCell(2).numFmt = '#,##0.##';
  });
}

function addScorecardFieldMapSheet(workbook: ExcelJS.Workbook, input: CanonicalXlsxInput): void {
  const worksheet = workbook.addWorksheet('Template fields', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  });
  setPrintAndBrand(worksheet, input.organizationName, input.source);
  worksheet.columns = [20, 22, 16, 46].map((width) => ({ width }));
  const rows = [
    ['Cell / range', 'What it is', 'Owner', 'Bound to'],
    ['A1', 'Template field', 'Template', 'Fixed title of the template'],
    ['A2', 'Generator content', 'Generator', 'Reporting period selected at generation'],
    ['A3', 'Template field', 'Template', 'Org name · source path · date · confidentiality label'],
    ['A6:K6', 'Template field', 'Template', 'Column set, labels, widths, freeze, autofilter'],
    [
      'A7:D11, F7:G11, K7:K11',
      'Generator content',
      'Generator',
      'Supplier register + goods-in nonconformance records',
    ],
    [
      'E, H, I, J columns',
      'Template formula',
      'Template',
      'NC rate, Δ pp and trend label — computed, never pasted',
    ],
    ['Row 12', 'Template formula', 'Template', 'SUM + weighted NC rate (not average of averages)'],
    [
      'Conditional formats',
      'Template rule',
      'Template',
      'Tolerance 3.0% · Δ ±0.3 pp · trend colours',
    ],
  ];
  rows.forEach((values, rowIndex) => {
    const row = worksheet.getRow(rowIndex + 1);
    row.values = values;
    row.height = rowIndex === 0 ? 24 : 20;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = argbFont(rowIndex === 0 ? COLORS.white : COLORS.ink, rowIndex === 0);
      cell.fill = solid(
        rowIndex === 0 ? COLORS.navy : rowIndex % 2 === 0 ? COLORS.zebra : COLORS.white
      );
      cell.border = thinBorder();
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  });
}

export async function buildCanonicalXlsxBuffer(input: CanonicalXlsxInput): Promise<Buffer> {
  if (input.sheets.length === 0) throw new Error('XLSX_SHEETS_REQUIRED');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Consultify';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const scorecard = input.profile === CONSULTIFY_SUPPLIER_SCORECARD_PROFILE;
  if (scorecard) {
    addScorecardDataSheet(workbook, input, input.sheets[0]);
    addScorecardFieldMapSheet(workbook, input);
  } else {
    const used = new Set<string>();
    const rendered = input.sheets.map((sheet, index) =>
      addGenericSheet(
        workbook,
        input,
        sheet,
        safeSheetName(sheet.name || (index === 0 ? 'Data' : `Sheet ${index + 1}`), used)
      )
    );
    addSummarySheet(
      workbook,
      input,
      { name: rendered[0].name, firstDataRow: 2, lastDataRow: rendered[0].lastDataRow },
      false,
      rendered[0].numericColumns
    );
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Canonical full-schema path used by every Materials create/download route.
 * It intentionally delegates the schema materialisation to WorkbookBuilder:
 * that renderer owns merges, validations, conditional formatting, Info and
 * named ranges, none of which can survive a lossy rows/columns adapter. */
export async function buildCanonicalWorkbookSchemaBuffer(
  schema: WorkbookSchema,
  meta: { organizationName?: string; source?: string; generatedAt?: string } = {}
): Promise<Buffer> {
  return buildWorkbookBuffer(schema, { applyConsultantStyling: true, meta });
}
