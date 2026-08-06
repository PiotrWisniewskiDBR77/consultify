/**
 * workbookGridPreview — unit tests.
 *
 * Sheet-name regression (2026-07-23, workstream Excel): `buildWorkbookGridSheets`
 * used to read `sheet.name` off the raw WorkbookSchema but never carried it
 * into the output shape, so every consumer that renders per-sheet tabs
 * (ExceleParametricTemplates' inline build-result grid) had nothing but the
 * array index to label a tab with and fell back to "Sheet 1"/"Sheet 2"
 * instead of the real names ("Założenia", "Podsumowanie", "Przepływy"…).
 */

import { describe, expect, it } from 'vitest';

import { buildWorkbookGridSheets, isFormulaDisplayValue, isNegativeVarianceCell } from '../workbookGridPreview';

describe('buildWorkbookGridSheets', () => {
  it('carries the real sheet name through for each sheet', () => {
    const result = buildWorkbookGridSheets([
      { name: 'Założenia', columns: [{ key: 'a', header: 'A' }], rows: [] },
      { name: 'Podsumowanie', columns: [{ key: 'b', header: 'B' }], rows: [] },
      { name: 'Przepływy', columns: [{ key: 'c', header: 'C' }], rows: [] },
    ]);

    expect(result.map((s) => s.name)).toEqual(['Założenia', 'Podsumowanie', 'Przepływy']);
  });

  it('falls back to "Sheet <n>" (1-based) only when the schema omits a name', () => {
    const result = buildWorkbookGridSheets([
      { columns: [{ key: 'a', header: 'A' }], rows: [] },
      { name: '', columns: [{ key: 'b', header: 'B' }], rows: [] },
      { name: 'Realna nazwa', columns: [{ key: 'c', header: 'C' }], rows: [] },
    ]);

    expect(result.map((s) => s.name)).toEqual(['Sheet 1', 'Sheet 2', 'Realna nazwa']);
  });

  it('trims whitespace-only names down to the fallback', () => {
    const result = buildWorkbookGridSheets([{ name: '   ', columns: [], rows: [] }]);

    expect(result[0].name).toBe('Sheet 1');
  });

  it('returns [] for a non-array input without throwing', () => {
    expect(buildWorkbookGridSheets(undefined)).toEqual([]);
    expect(buildWorkbookGridSheets(null)).toEqual([]);
  });

  it('still builds columns/rows/formula-prefixing alongside the name (no regression)', () => {
    const result = buildWorkbookGridSheets([
      {
        name: 'Założenia',
        columns: [
          { key: 'label', header: 'Pozycja' },
          { key: 'y1', header: 'Rok 1' },
        ],
        rows: [
          {
            cells: {
              label: { value: 'Przychód' },
              y1: { formula: 'SUM(A1:A2)' },
            },
          },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Założenia');
    expect(result[0].columns).toEqual(['Pozycja', 'Rok 1']);
    expect(result[0].rows[0]['Pozycja']).toBe('Przychód');
    expect(isFormulaDisplayValue(result[0].rows[0]['Rok 1'])).toBe(true);
    expect(result[0].rows[0]['Rok 1']).toBe('=SUM(A1:A2)');
  });
});

describe('semantic workbook preview styles', () => {
  it('marks only negative variance values in tracking-like sheets', () => {
    expect(isNegativeVarianceCell('Monthly Tracking', 'Variance', -54_843.75)).toBe(true);
    expect(isNegativeVarianceCell('Monthly Tracking', 'Variance', '-54 843,75')).toBe(true);
    expect(isNegativeVarianceCell('Monthly Tracking', 'Variance', 10)).toBe(false);
    expect(isNegativeVarianceCell('Executive Summary', 'Wartość', -1)).toBe(false);
    expect(isNegativeVarianceCell('Monthly Tracking', 'Variance', '=C2-B2')).toBe(false);
  });
});
