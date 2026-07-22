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
 */

export interface WorkbookGridSheet {
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

export function buildWorkbookGridSheets(sheets: unknown): WorkbookGridSheet[] {
  if (!Array.isArray(sheets)) return [];

  return (sheets as RawSheet[]).map((sheet) => {
    const cols = Array.isArray(sheet?.columns) ? sheet.columns : [];
    const headers = cols.map(
      (c, i) => c?.header?.trim() || c?.key?.trim() || `Col ${i + 1}`
    );

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

    return { columns: headers, rows };
  });
}
