/**
 * WorkbookBuilder — materializes a WorkbookSchema into a real .xlsx buffer via ExcelJS.
 *
 * Supports: multi-sheet, Excel formulas, rich formatting, freeze panes,
 * merged cells, alternating row colors, number formats, column widths.
 */

import ExcelJS from 'exceljs';

import logger from '../../utils/Logger.js';
import { createP23Error, type P23ClassifiedError } from '../v8/exceleCanon.js';
import type { CellStyle, WorkbookSchema } from './WorkbookSchema.js';

// ---------------------------------------------------------------------------
// Style mapping
// ---------------------------------------------------------------------------

function mapAlignment(align?: string): Partial<ExcelJS.Alignment> {
  const result: Partial<ExcelJS.Alignment> = { vertical: 'middle' };
  if (align === 'center') result.horizontal = 'center';
  else if (align === 'right') result.horizontal = 'right';
  else result.horizontal = 'left';
  return result;
}

function hexToArgb(hex?: string): string | undefined {
  if (!hex) return undefined;
  const clean = hex.replace('#', '');
  if (clean.length === 6) return `FF${clean.toUpperCase()}`;
  if (clean.length === 8) return clean.toUpperCase();
  return undefined;
}

function mapBorder(style?: string): Partial<ExcelJS.Borders> | undefined {
  if (!style || style === 'none') return undefined;
  const s = style as ExcelJS.BorderStyle;
  return {
    top: { style: s },
    bottom: { style: s },
    left: { style: s },
    right: { style: s },
  };
}

function applyStyle(cell: ExcelJS.Cell, style?: CellStyle): void {
  if (!style) return;

  const font: Partial<ExcelJS.Font> = {};
  if (style.bold) font.bold = true;
  if (style.italic) font.italic = true;
  if (style.fontSize) font.size = style.fontSize;
  if (style.fontColor) font.color = { argb: hexToArgb(style.fontColor) };
  if (Object.keys(font).length > 0) cell.font = { ...cell.font, ...font };

  if (style.bgColor) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(style.bgColor) },
    };
  }

  if (style.alignment || style.wrapText) {
    cell.alignment = {
      ...mapAlignment(style.alignment),
      wrapText: style.wrapText ?? false,
    };
  }

  if (style.numberFormat) {
    cell.numFmt = style.numberFormat;
  }

  const border = mapBorder(style.border);
  if (border) cell.border = border;
}

// ---------------------------------------------------------------------------
// Number format defaults by column type
// ---------------------------------------------------------------------------

const TYPE_FORMATS: Record<string, string> = {
  currency: '#,##0.00',
  percent: '0.00%',
  number: '#,##0.##',
  date: 'YYYY-MM-DD',
};

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildWorkbookBuffer(schema: WorkbookSchema): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = schema.author || 'Consultify';
  wb.created = new Date();

  for (const sheetDef of schema.sheets) {
    const ws = wb.addWorksheet(sheetDef.name, {
      views: [
        {
          state: 'frozen',
          xSplit: sheetDef.freezeCol ?? 0,
          ySplit: sheetDef.freezeRow ?? 1,
        },
      ],
      properties: {
        showGridLines: sheetDef.showGridLines !== false,
        tabColor: sheetDef.tabColor ? { argb: hexToArgb(sheetDef.tabColor) } : undefined,
      },
    });

    // Column definitions
    ws.columns = sheetDef.columns.map((col) => ({
      key: col.key,
      header: col.header,
      width: col.width ?? 16,
    }));

    // Style header row
    const headerRow = ws.getRow(1);
    const defaultHeaderStyle: CellStyle = sheetDef.headerStyle ?? {
      bold: true,
      fontColor: 'FFFFFF',
      bgColor: '4472C4',
      alignment: 'center',
      border: 'thin',
    };
    headerRow.eachCell((cell) => applyStyle(cell, defaultHeaderStyle));
    headerRow.height = 24;

    // Data rows
    for (let rowIdx = 0; rowIdx < sheetDef.rows.length; rowIdx++) {
      const rowDef = sheetDef.rows[rowIdx];
      const excelRow = ws.getRow(rowIdx + 2); // +2 because row 1 is header

      for (const col of sheetDef.columns) {
        const cellDef = rowDef.cells[col.key];
        if (!cellDef) continue;

        const cell = excelRow.getCell(col.key);

        if (cellDef.formula) {
          cell.value = { formula: cellDef.formula } as ExcelJS.CellFormulaValue;
        } else if (cellDef.value !== undefined && cellDef.value !== null) {
          if (col.type === 'number' || col.type === 'currency' || col.type === 'percent') {
            const num =
              typeof cellDef.value === 'number' ? cellDef.value : parseFloat(String(cellDef.value));
            cell.value = isNaN(num) ? cellDef.value : num;
          } else if (col.type === 'boolean') {
            cell.value = cellDef.value === true || cellDef.value === 'true';
          } else {
            cell.value = cellDef.value;
          }
        }

        // Number format: cell-level > column-level > type default
        const numFmt =
          cellDef.style?.numberFormat ||
          col.numberFormat ||
          (col.type ? TYPE_FORMATS[col.type] : undefined);
        if (numFmt) cell.numFmt = numFmt;

        // Cell style
        applyStyle(cell, cellDef.style);

        // Column-level style (if no cell style)
        if (!cellDef.style && col.style) {
          applyStyle(cell, col.style);
        }

        if (cellDef.comment) {
          cell.note = cellDef.comment;
        }
      }

      // Row-level style
      if (rowDef.style) {
        excelRow.eachCell((cell) => applyStyle(cell, rowDef.style));
      }
      if (rowDef.height) excelRow.height = rowDef.height;

      // Summary row styling
      if (rowDef.isSummary) {
        excelRow.eachCell((cell) => {
          applyStyle(cell, { bold: true, border: 'medium', bgColor: 'E2EFDA' });
        });
      }

      // Alternating row colors
      if (sheetDef.alternateRowColor && rowIdx % 2 === 1 && !rowDef.isHeader && !rowDef.isSummary) {
        excelRow.eachCell((cell) => {
          if (!cell.fill || (cell.fill as any).pattern === 'none') {
            applyStyle(cell, { bgColor: sheetDef.alternateRowColor });
          }
        });
      }

      excelRow.commit();
    }

    // Merged cells
    if (sheetDef.merges) {
      for (const merge of sheetDef.merges) {
        try {
          ws.mergeCells(merge.start, merge.end);
        } catch (e) {
          logger.warn(`[WorkbookBuilder] Merge failed: ${merge.start}:${merge.end}`, e);
        }
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateWorkbookSchema(schema: WorkbookSchema): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!schema.sheets || schema.sheets.length === 0) {
    errors.push('Workbook must have at least one sheet');
  }

  const sheetNames = new Set<string>();
  for (const sheet of schema.sheets) {
    if (sheetNames.has(sheet.name)) {
      errors.push(`Duplicate sheet name: "${sheet.name}"`);
    }
    sheetNames.add(sheet.name);

    if (sheet.name.length > 31) {
      errors.push(`Sheet name too long (max 31): "${sheet.name}"`);
    }

    if (!sheet.columns || sheet.columns.length === 0) {
      errors.push(`Sheet "${sheet.name}" has no columns`);
    }

    const colKeys = new Set<string>();
    for (const col of sheet.columns) {
      if (colKeys.has(col.key)) {
        errors.push(`Duplicate column key "${col.key}" in sheet "${sheet.name}"`);
      }
      colKeys.add(col.key);
    }

    for (let i = 0; i < sheet.rows.length; i++) {
      const row = sheet.rows[i];
      for (const key of Object.keys(row.cells)) {
        if (!colKeys.has(key)) {
          errors.push(`Row ${i} in "${sheet.name}" references unknown column "${key}"`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// §7.1 — Classified error helpers (P23 canon integration)
// ---------------------------------------------------------------------------

export function classifyBuildError(error: unknown): P23ClassifiedError {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('circular') || msg.includes('cycle')) {
    return createP23Error('formula_cycle_detected', msg);
  }
  if (msg.includes('formula') || msg.includes('#DIV') || msg.includes('#REF')) {
    return createP23Error('formula_error', msg);
  }
  if (msg.includes('merge') || msg.includes('column') || msg.includes('schema')) {
    return createP23Error('validation_failed', msg);
  }
  return createP23Error('export_failed', msg);
}

export type { P23ClassifiedError } from '../v8/exceleCanon.js';
