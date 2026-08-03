/**
 * workbookCsvExport — MAT-006 (2026-08-02).
 *
 * Single-sheet CSV export for `GET /api/workbook/:id/export/csv`. Deliberately
 * NOT a new export format invention — it is the plain-text, one-sheet-at-a-time
 * counterpart of the existing `.xlsx` export (`GET /:id/download`), built from
 * the exact same `WorkbookSchema` the XLSX builder reads.
 *
 * Explicit, stated contract (task requirement — must be visible in the API
 * response/contract, not only in docs):
 *   - covers exactly ONE sheet (selected by `sheetIndex`, default 0);
 *   - UTF-8 encoded, RFC 4180 quoting (comma/quote/CRLF-safe, `"` doubled);
 *   - formulas are NOT computed/evaluated for CSV — a formula cell is
 *     exported as its inert source-expression TEXT (never live/executable —
 *     see the injection note below), not a calculated value. Open the XLSX
 *     export for live formulas and computed results.
 *   - styling/formatting/merges/multiple sheets are NOT preserved (XLSX-only).
 * The route surfaces this same contract via response headers
 * (`X-Consultify-Csv-Scope`, `X-Consultify-Csv-Limitation`) so a caller never
 * has to consult documentation to learn the scope of the file it just
 * downloaded.
 *
 * Formula/CSV injection: every field — whether it came from `cell.value` or
 * `cell.formula` — goes through `sanitizeSpreadsheetCellText` before being
 * quoted, so a literal data string (or formula source) starting with
 * `= + - @` can never auto-execute when the CSV is re-opened in a
 * spreadsheet application.
 */

import { sanitizeSpreadsheetCellText } from './workbookExportSanitizer.js';
import type { WorkbookSchema } from './WorkbookSchema.js';

export class WorkbookCsvExportError extends Error {
  code: 'SHEET_INDEX_OUT_OF_RANGE' | 'NO_SHEETS';
  constructor(code: WorkbookCsvExportError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'WorkbookCsvExportError';
  }
}

/** RFC 4180 field quoting — quotes whenever the field contains a comma,
 * double-quote, CR, or LF; internal double-quotes are doubled. */
function csvField(raw: string): string {
  const needsQuoting = /[",\r\n]/.test(raw);
  const escaped = raw.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

function cellDisplayText(cell: { value?: unknown; formula?: string } | undefined): string {
  if (!cell) return '';
  if (typeof cell.formula === 'string' && cell.formula.trim()) {
    // Inert source expression — CSV cannot carry live formulas. Sanitized
    // the same as a plain data value so it can never be interpreted as an
    // executable formula/DDE command by whatever re-opens this CSV.
    return String(sanitizeSpreadsheetCellText(cell.formula));
  }
  if (cell.value === undefined || cell.value === null) return '';
  return String(sanitizeSpreadsheetCellText(cell.value));
}

export interface WorkbookCsvResult {
  csv: string;
  sheetName: string;
  sheetIndex: number;
  totalSheets: number;
  rowCount: number;
  columnCount: number;
}

/** Builds a UTF-8 CSV (with BOM, for reliable Excel auto-detection) for ONE
 * sheet of a WorkbookSchema. Throws WorkbookCsvExportError on an invalid
 * sheetIndex or an empty workbook. */
export function buildWorkbookCsv(schema: WorkbookSchema, sheetIndex = 0): WorkbookCsvResult {
  const sheets = Array.isArray(schema?.sheets) ? schema.sheets : [];
  if (sheets.length === 0) {
    throw new WorkbookCsvExportError('NO_SHEETS', 'Workbook has no sheets');
  }
  if (!Number.isInteger(sheetIndex) || sheetIndex < 0 || sheetIndex >= sheets.length) {
    throw new WorkbookCsvExportError(
      'SHEET_INDEX_OUT_OF_RANGE',
      `sheetIndex ${sheetIndex} out of range (workbook has ${sheets.length} sheet(s))`
    );
  }

  const sheet = sheets[sheetIndex];
  const columns = Array.isArray(sheet.columns) ? sheet.columns : [];
  const rows = Array.isArray(sheet.rows) ? sheet.rows : [];

  const lines: string[] = [];
  lines.push(columns.map((c) => csvField(c.header ?? c.key ?? '')).join(','));
  for (const row of rows) {
    const cells = row?.cells || {};
    lines.push(columns.map((c) => csvField(cellDisplayText(cells[c.key]))).join(','));
  }

  // UTF-8 BOM so Excel (Windows) auto-detects the encoding instead of
  // guessing a locale codepage — required for the "UTF-8" contract item.
  const BOM = '﻿';
  return {
    csv: BOM + lines.join('\r\n') + '\r\n',
    sheetName: sheet.name || `Sheet${sheetIndex + 1}`,
    sheetIndex,
    totalSheets: sheets.length,
    rowCount: rows.length,
    columnCount: columns.length,
  };
}
