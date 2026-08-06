import ExcelJS from 'exceljs';
import { Readable } from 'stream';

import type { CellStyle, WorkbookSchema } from './WorkbookSchema.js';

function argb(color: ExcelJS.Color | undefined): string | undefined {
  return color && 'argb' in color && color.argb ? color.argb.slice(-6) : undefined;
}

function importedStyle(cell: ExcelJS.Cell): CellStyle | undefined {
  const style: CellStyle = {
    bold: cell.font?.bold || undefined,
    italic: cell.font?.italic || undefined,
    underline: cell.font?.underline ? true : undefined,
    fontSize: cell.font?.size,
    fontColor: argb(cell.font?.color),
    bgColor: cell.fill?.type === 'pattern' ? argb(cell.fill.fgColor) : undefined,
    numberFormat: cell.numFmt || undefined,
    alignment: cell.alignment?.horizontal === 'center' || cell.alignment?.horizontal === 'right' ? cell.alignment.horizontal : cell.alignment?.horizontal === 'left' ? 'left' : undefined,
    wrapText: cell.alignment?.wrapText || undefined,
    border: cell.border && Object.values(cell.border).some(Boolean) ? 'thin' : undefined,
  };
  return Object.values(style).some((value) => value !== undefined) ? style : undefined;
}

function scalarValue(value: ExcelJS.CellValue): string | number | boolean | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'object' && 'text' in value) return String(value.text);
  if (typeof value === 'object' && 'result' in value) return scalarValue(value.result as ExcelJS.CellValue);
  return String(value);
}

export async function importWorkbookBuffer(buffer: Buffer, filename: string): Promise<WorkbookSchema> {
  const workbook = new ExcelJS.Workbook();
  if (filename.toLowerCase().endsWith('.csv')) await workbook.csv.read(Readable.from(buffer));
  else await workbook.xlsx.load(buffer as any);
  if (!workbook.worksheets.length) throw new Error('Imported file contains no worksheets');

  const sheets = workbook.worksheets.map((worksheet, sheetIndex) => {
    const maxColumn = Math.max(1, worksheet.columnCount);
    const headerRow = worksheet.getRow(1);
    const columns = Array.from({ length: maxColumn }, (_, index) => {
      const columnIndex = index + 1;
      const rawHeader = scalarValue(headerRow.getCell(columnIndex).value);
      return {
        key: `c${columnIndex}`,
        header: rawHeader == null || rawHeader === '' ? `Column ${columnIndex}` : String(rawHeader),
        width: worksheet.getColumn(columnIndex).width,
      };
    });
    const rows = [];
    for (let rowIndex = 2; rowIndex <= Math.max(2, worksheet.rowCount); rowIndex += 1) {
      const sourceRow = worksheet.getRow(rowIndex);
      const cells: Record<string, any> = {};
      columns.forEach((column, columnOffset) => {
        const sourceCell = sourceRow.getCell(columnOffset + 1);
        const value = sourceCell.value;
        const formula = value && typeof value === 'object' && 'formula' in value ? String(value.formula) : undefined;
        const comment = sourceCell.note ? (typeof sourceCell.note === 'string' ? sourceCell.note : sourceCell.note.texts.map((part) => part.text).join('')) : undefined;
        cells[column.key] = { value: formula ? scalarValue(value.result as ExcelJS.CellValue) : scalarValue(value), formula, style: importedStyle(sourceCell), comment };
      });
      rows.push({ cells, height: sourceRow.height });
    }
    return {
      name: worksheet.name || `Sheet ${sheetIndex + 1}`,
      columns,
      rows,
      freezeRow: worksheet.views[0]?.ySplit || undefined,
      freezeCol: worksheet.views[0]?.xSplit || undefined,
    };
  });
  return { title: filename.replace(/\.(xlsx|csv)$/i, ''), sheets };
}
