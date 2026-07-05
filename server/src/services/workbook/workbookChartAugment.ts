/**
 * workbookChartAugment — bridges the workbook generator to the existing
 * chart rasterizer (documentChartRasterizer.ts / Chart.js-over-canvas) so
 * generated workbooks carry an illustrative PNG chart alongside the raw
 * numeric data, mounted via `Sheet.chartImages` (EQ-C, see WorkbookSchema.ts
 * / WorkbookBuilder.ts `emitChartImages`).
 *
 * Scope is intentionally narrow: ONE readable bar/line chart per sheet that
 * has plausible numeric data, built purely from `value` cells already present
 * (formula cells are skipped — this is an illustrative snapshot, not a live
 * mirror of the model). No LLM call, no new rasterizer — reuses
 * `renderChartBlockToPng` from documentStudio.
 *
 * FAIL-SOFT CONTRACT: any error (bad data shape, rasterizer throwing/
 * returning null, canvas unavailable on the host) must never surface — the
 * function always resolves with a schema (best case: with charts added,
 * worst case: the untouched input schema). Charts are a nice-to-have; the
 * workbook itself must always build.
 */

import { renderChartBlockToPng } from '../documentStudio/documentChartRasterizer.js';
import type { DocumentBlock } from '../documentStudio/documentStudioTypes.js';
import logger from '../../utils/Logger.js';
import type { Sheet, WorkbookSchema } from './WorkbookSchema.js';

const MAX_CATEGORIES = 12;
const CHART_WIDTH = 640;
const CHART_HEIGHT = 360;

/**
 * Column-index (0-based) → Excel column letter (A, B, ..., Z, AA, ...).
 */
function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters || 'A';
}

interface SheetSeries {
  labelColumnHeader: string;
  categories: string[];
  series: { label: string; values: number[] }[];
}

/**
 * Extracts a single illustrative chart series set from a sheet's raw `value`
 * cells (never `formula` cells — those are computed, not source data).
 * Returns `null` when the sheet doesn't look like it has plausible chartable
 * data (needs a label column + at least one numeric column with ≥2 rows of
 * finite values).
 */
function extractSheetSeries(sheet: Sheet): SheetSeries | null {
  if (!Array.isArray(sheet.columns) || sheet.columns.length < 2) return null;
  if (!Array.isArray(sheet.rows) || sheet.rows.length === 0) return null;

  const dataRows = sheet.rows.filter((r) => !r.isHeader && !r.isSummary);
  if (dataRows.length < 2) return null;

  // Label column: first column (by convention the row's name/category).
  const labelCol = sheet.columns[0];
  const numericCols = sheet.columns.slice(1).filter((col) => {
    // A column is "numeric" for our purposes if its declared type says so,
    // OR if the sampled cell values are plain numbers (no formula-only cols).
    if (col.type === 'number' || col.type === 'currency' || col.type === 'percent') return true;
    if (col.type) return false;
    return dataRows.some((r) => typeof r.cells?.[col.key]?.value === 'number');
  });
  if (numericCols.length === 0) return null;

  const categories: string[] = [];
  const seriesValues = new Map<string, number[]>();
  for (const col of numericCols) seriesValues.set(col.key, []);

  for (const row of dataRows) {
    if (categories.length >= MAX_CATEGORIES) break;
    const labelCell = row.cells?.[labelCol.key];
    // Skip rows whose label cell is itself a formula (rare, but keep it simple/safe).
    if (labelCell?.formula) continue;
    const label = labelCell?.value;
    if (label === undefined || label === null || label === '') continue;

    let rowHasNumeric = false;
    for (const col of numericCols) {
      const cell = row.cells?.[col.key];
      if (cell?.formula) continue; // illustrative only — skip computed cells
      const value = cell?.value;
      if (typeof value === 'number' && Number.isFinite(value)) {
        rowHasNumeric = true;
      }
    }
    if (!rowHasNumeric) continue;

    categories.push(String(label));
    for (const col of numericCols) {
      const cell = row.cells?.[col.key];
      const value = !cell?.formula && typeof cell?.value === 'number' && Number.isFinite(cell.value)
        ? cell.value
        : 0;
      seriesValues.get(col.key)!.push(value);
    }
  }

  if (categories.length < 2) return null;

  const series = numericCols
    .map((col) => ({ label: col.header || col.key, values: seriesValues.get(col.key) ?? [] }))
    .filter((s) => s.values.some((v) => v !== 0));
  if (series.length === 0) return null;

  return { labelColumnHeader: labelCol.header || labelCol.key, categories, series };
}

/**
 * Computes an anchor cell to the right of the sheet's data table so the
 * chart never overlaps existing content.
 */
function anchorRightOfData(sheet: Sheet): string {
  const columnCount = Math.max(sheet.columns.length, 1);
  const anchorColIndex = columnCount + 1; // one blank column gap
  return `${columnLetter(anchorColIndex)}2`;
}

async function renderSheetChart(
  sheetName: string,
  extracted: SheetSeries
): Promise<{ pngBase64: string } | null> {
  const chartKind = extracted.categories.length > 6 ? 'line' : 'bar';
  const block: DocumentBlock = {
    blockId: `workbook-chart-${sheetName}`,
    type: 'chart',
    content: {
      kind: chartKind,
      title: sheetName,
      categories: extracted.categories,
      xAxisLabel: extracted.labelColumnHeader,
      series: extracted.series,
    },
  };

  const png = await renderChartBlockToPng(block, { width: CHART_WIDTH, height: CHART_HEIGHT });
  if (!png || png.length === 0) return null;
  return { pngBase64: png.toString('base64') };
}

/**
 * Adds ONE illustrative PNG bar/line chart per sheet with plausible numeric
 * data to `sheet.chartImages`. Purely additive — never mutates existing
 * cells/columns/rows, never throws. Sheets that already carry chartImages,
 * or that have no chartable data, are left untouched.
 */
export async function augmentWorkbookWithCharts(schema: WorkbookSchema): Promise<WorkbookSchema> {
  try {
    if (!schema || !Array.isArray(schema.sheets) || schema.sheets.length === 0) return schema;

    let chartsAdded = 0;
    const sheets = await Promise.all(
      schema.sheets.map(async (sheet) => {
        try {
          if (Array.isArray(sheet.chartImages) && sheet.chartImages.length > 0) return sheet;
          const extracted = extractSheetSeries(sheet);
          if (!extracted) return sheet;

          const rendered = await renderSheetChart(sheet.name, extracted);
          if (!rendered) return sheet;

          chartsAdded += 1;
          return {
            ...sheet,
            chartImages: [
              ...(sheet.chartImages ?? []),
              {
                pngBase64: rendered.pngBase64,
                anchorCell: anchorRightOfData(sheet),
                width: CHART_WIDTH,
                height: CHART_HEIGHT,
              },
            ],
          };
        } catch (sheetErr) {
          logger.warn(
            `[workbookChartAugment] sheet "${sheet?.name ?? '?'}" chart generation failed, skipping`,
            sheetErr
          );
          return sheet;
        }
      })
    );

    if (chartsAdded === 0) return schema;
    return { ...schema, sheets };
  } catch (err) {
    logger.warn('[workbookChartAugment] augmentWorkbookWithCharts failed, returning schema unchanged', err);
    return schema;
  }
}
