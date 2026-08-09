import { describe, expect, it } from 'vitest';

import type { FormulaSheet } from '@/utils/workbookFormulaEngine';

import { buildSpreadsheetReplacements, findSpreadsheetMatches } from '../spreadsheetFindReplace';

const sheets: FormulaSheet[] = [
  {
    name: 'KPI',
    columns: [{ key: 'metric', header: 'Metric' }, { key: 'value', header: 'Value' }],
    rows: [
      { cells: { metric: { value: 'Conversion rate' }, value: { formula: 'Data!B2*100' } } },
      { cells: { metric: { value: 'conversion baseline' }, value: { value: 18.4 } } },
    ],
  },
  {
    name: 'Data',
    columns: [{ key: 'label', header: 'Label' }, { key: 'raw', header: 'Raw' }],
    rows: [{ cells: { label: { value: 'Conversion source' }, raw: { value: 0.184 } } }],
  },
];

describe('spreadsheetFindReplace', () => {
  it('finds values across the workbook case-insensitively', () => {
    const matches = findSpreadsheetMatches(sheets, 'conversion', {
      scope: 'workbook',
      activeSheetIndex: 0,
      searchIn: 'values',
    });
    expect(matches.map(({ sheetIndex, rowIndex, colIndex }) => [sheetIndex, rowIndex, colIndex])).toEqual([
      [0, 0, 0], [0, 1, 0], [1, 0, 0],
    ]);
  });

  it('can restrict search to the active sheet and exact whole-cell matches', () => {
    expect(findSpreadsheetMatches(sheets, 'conversion baseline', {
      scope: 'sheet',
      activeSheetIndex: 0,
      wholeCell: true,
    })).toHaveLength(1);
    expect(findSpreadsheetMatches(sheets, 'Conversion source', {
      scope: 'sheet',
      activeSheetIndex: 0,
      wholeCell: true,
    })).toHaveLength(0);
  });

  it('searches and replaces raw formulas without treating their result as text', () => {
    const replacements = buildSpreadsheetReplacements(sheets, 'Data!B2', 'Data!C2', {
      scope: 'workbook',
      activeSheetIndex: 0,
      searchIn: 'formulas',
      matchCase: true,
    });
    expect(replacements).toEqual([
      { sheetIndex: 0, rowIndex: 0, columnKey: 'value', formula: 'Data!C2*100' },
    ]);
  });

  it('builds one replacement payload per matching cell', () => {
    expect(buildSpreadsheetReplacements(sheets, 'conversion', 'activation', {
      scope: 'workbook',
      activeSheetIndex: 0,
      searchIn: 'values',
    })).toEqual([
      { sheetIndex: 0, rowIndex: 0, columnKey: 'metric', value: 'activation rate' },
      { sheetIndex: 0, rowIndex: 1, columnKey: 'metric', value: 'activation baseline' },
      { sheetIndex: 1, rowIndex: 0, columnKey: 'label', value: 'activation source' },
    ]);
  });
});
