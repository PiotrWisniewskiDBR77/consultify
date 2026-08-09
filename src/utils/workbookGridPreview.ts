/**
 * workbookGridPreview — maps a WorkbookSchema-shaped sheet list (arkusze →
 * wiersze → komórki z wartością i formułą, server/src/services/workbook/WorkbookSchema.ts)
 * into the flat `{ columns, rows }` shape KimiWorkspaceShell's xlsx grid renders
 * (ArtifactPreview.perSheetData).
 *
 * B3 fix (2026-07-22, workstream Excel): before this, the excele preview only
 * ever showed sheet name/columnCount/rowCount — never an actual cell — because
 * nothing built the grid shape from the real schema (GET /api/workbook/:id/schema).
 * A formula cell is shown as the string "=<formula>" so it reads as a formula in
 * the grid without any extra column-typing on the render side.
 *
 * Sheet-name fix (2026-07-23, workstream Excel): the mapper used to read
 * `sheet.name` off the raw schema but never carried it into the output shape
 * — `WorkbookGridSheet` had no `name` field — so every consumer that renders
 * per-sheet tabs off this function's output (ExceleParametricTemplates' inline
 * build-result grid) had nothing but the array index to label a tab with and
 * fell back to "Sheet 1"/"Sheet 2". Now `name` is carried through (with a
 * "Sheet <n>" fallback only if the schema itself omits it) so real sheet
 * names ("Założenia", "Podsumowanie", "Przepływy"…) reach the tab UI.
 */

export interface WorkbookGridSheet {
  /** Real sheet name from WorkbookSchema (e.g. "Założenia", "Podsumowanie").
   *  Falls back to "Sheet <n>" (1-based) only when the schema is missing a
   *  name — callers (ExceleParametricTemplates, KimiWorkspaceShell) render
   *  this directly as the tab label instead of a generic "Sheet N". */
  name: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

interface RawCell {
  value?: string | number | boolean | null;
  formula?: string;
}

interface RawColumn {
  key?: string;
  header?: string;
}

interface RawRow {
  cells?: Record<string, RawCell | undefined>;
}

interface RawSheet {
  name?: string;
  columns?: RawColumn[];
  rows?: RawRow[];
}

/** Cell display strings that carry a formula are prefixed with "=" — callers
 *  (KimiWorkspaceShell) key off this prefix to render it in monospace. */
export function isFormulaDisplayValue(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('=');
}

/** Semantic preview fallback for workbook CF. Native XLSX conditional formatting
 * remains authoritative; this keeps critical negative variances visible in the
 * HTML preview where ExcelJS CF rules are otherwise not evaluated. */
export function isNegativeVarianceCell(sheetName: string, column: string, value: unknown): boolean {
  if (!/variance|odchylenie/i.test(column) || !/tracking|budget|variance/i.test(sheetName)) return false;
  if (typeof value === 'number') return value < 0;
  if (typeof value !== 'string' || value.startsWith('=')) return false;
  const parsed = Number(value.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) && parsed < 0;
}

export function buildWorkbookGridSheets(sheets: unknown): WorkbookGridSheet[] {
  if (!Array.isArray(sheets)) return [];

  return (sheets as RawSheet[]).map((sheet, sheetIndex) => {
    const name = sheet?.name?.trim() || `Sheet ${sheetIndex + 1}`;
    const cols = Array.isArray(sheet?.columns) ? sheet.columns : [];
    const headers = cols.map((c, i) => c?.header?.trim() || c?.key?.trim() || `Col ${i + 1}`);

    const rows = Array.isArray(sheet?.rows)
      ? sheet.rows.map((row) => {
          const cellsByKey = row?.cells || {};
          const out: Record<string, unknown> = {};
          cols.forEach((c, i) => {
            const header = headers[i];
            const cell = c?.key ? cellsByKey[c.key] : undefined;
            if (!cell) {
              out[header] = '';
              return;
            }
            if (typeof cell.formula === 'string' && cell.formula.trim()) {
              out[header] = `=${cell.formula.trim()}`;
            } else if (cell.value !== undefined && cell.value !== null) {
              out[header] = cell.value;
            } else {
              out[header] = '';
            }
          });
          return out;
        })
      : [];

    return { name, columns: headers, rows };
  });
}
