import type { FormulaSheet } from '@/utils/workbookFormulaEngine';

export interface SpreadsheetFindOptions {
  scope: 'sheet' | 'workbook';
  activeSheetIndex: number;
  matchCase?: boolean;
  wholeCell?: boolean;
  searchIn?: 'values' | 'formulas' | 'all';
}

export interface SpreadsheetFindMatch {
  sheetIndex: number;
  rowIndex: number;
  colIndex: number;
  columnKey: string;
  text: string;
  source: 'value' | 'formula';
}

export interface SpreadsheetReplacement {
  sheetIndex: number;
  rowIndex: number;
  columnKey: string;
  value?: string | number | boolean | null;
  formula?: string;
}

const textForValue = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value);

const matchesQuery = (
  candidate: string,
  query: string,
  matchCase: boolean,
  wholeCell: boolean
): boolean => {
  const haystack = matchCase ? candidate : candidate.toLocaleLowerCase();
  const needle = matchCase ? query : query.toLocaleLowerCase();
  return wholeCell ? haystack === needle : haystack.includes(needle);
};

export function findSpreadsheetMatches(
  sheets: FormulaSheet[],
  query: string,
  options: SpreadsheetFindOptions
): SpreadsheetFindMatch[] {
  if (!query) return [];
  const sheetIndexes = options.scope === 'sheet'
    ? [options.activeSheetIndex]
    : sheets.map((_, index) => index);
  const searchIn = options.searchIn ?? 'all';
  const matches: SpreadsheetFindMatch[] = [];

  for (const sheetIndex of sheetIndexes) {
    const sheet = sheets[sheetIndex];
    if (!sheet) continue;
    sheet.rows?.forEach((row, rowIndex) => {
      sheet.columns?.forEach((column, colIndex) => {
        const cell = row.cells?.[column.key];
        if (!cell) return;
        const candidates: Array<{ source: 'value' | 'formula'; text: string }> = [];
        if (searchIn !== 'formulas') candidates.push({ source: 'value', text: textForValue(cell.value) });
        if (searchIn !== 'values' && cell.formula) {
          candidates.push({ source: 'formula', text: `=${cell.formula.replace(/^=/, '')}` });
        }
        const hit = candidates.find((candidate) =>
          matchesQuery(candidate.text, query, Boolean(options.matchCase), Boolean(options.wholeCell))
        );
        if (hit) {
          matches.push({ sheetIndex, rowIndex, colIndex, columnKey: column.key, ...hit });
        }
      });
    });
  }
  return matches;
}

const replaceText = (
  candidate: string,
  query: string,
  replacement: string,
  matchCase: boolean,
  wholeCell: boolean
): string => {
  if (wholeCell) return matchesQuery(candidate, query, matchCase, true) ? replacement : candidate;
  if (matchCase) return candidate.split(query).join(replacement);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return candidate.replace(new RegExp(escaped, 'gi'), replacement);
};

export function buildSpreadsheetReplacements(
  sheets: FormulaSheet[],
  query: string,
  replacement: string,
  options: SpreadsheetFindOptions
): SpreadsheetReplacement[] {
  return findSpreadsheetMatches(sheets, query, options).map((match) => {
    const next = replaceText(
      match.text,
      query,
      replacement,
      Boolean(options.matchCase),
      Boolean(options.wholeCell)
    );
    if (match.source === 'formula') {
      return {
        sheetIndex: match.sheetIndex,
        rowIndex: match.rowIndex,
        columnKey: match.columnKey,
        formula: next.replace(/^=/, ''),
      };
    }
    return {
      sheetIndex: match.sheetIndex,
      rowIndex: match.rowIndex,
      columnKey: match.columnKey,
      value: next,
    };
  });
}
