/**
 * Contract tests for financialStatementService (9037 lines)
 *
 * These tests verify the public API contract of the service without
 * testing internal implementation. They serve as a safety net for
 * the planned refactoring (splitting into read/write/analysis modules).
 *
 * Coverage:
 *   1. Pure functions (detectStatementType, detectContainedStatementTypes, validateStatement)
 *   2. resolveDuplicateSuggestedMappings
 *   3. classifyStatementDocument
 */

import { describe, expect, it } from 'vitest';

import {
  detectContainedStatementTypes,
  detectStatementType,
  extractFinancialLines,
  clampStatementConfidence,
  locateStatementSections,
  resolveDuplicateSuggestedMappings,
  validateStatement,
} from '../financialStatementService.js';

describe('statement confidence boundary', () => {
  it('clamps every finite or malformed input to a probability', () => {
    expect(clampStatementConfidence(-0.3)).toBe(0);
    expect(clampStatementConfidence(0.73)).toBe(0.73);
    expect(clampStatementConfidence(90)).toBe(1);
    expect(clampStatementConfidence(Number.NaN)).toBe(0);
  });
});

describe('financialStatementService — contract tests', () => {
  it('never promotes Polish comma-separated footnote references to statement values', () => {
    const text = [
      'Skonsolidowany rachunek zysków i strat',
      'w tysiącach PLN',
      'Nota 2025 2024',
      'Przychody ze sprzedaży 10,13 3 233 2 980',
      'Koszt własny sprzedaży 15,34 (1 900) (1 700)',
      'Zysk operacyjny 17,34 1 333 1 280',
      'Zysk netto 20,34 900 850',
      ...Array.from({ length: 20 }, (_, index) => `Pozycja operacyjna ${index} ${100 + index} ${90 + index}`),
    ].join('\n');
    const result = extractFinancialLines(text, 'P&L', {
      selectedPeriodLabel: '2025',
      comparisonPeriodLabel: '2024',
    });
    expect(result.lines.find((line) => line.originalLabel.startsWith('Przychody'))?.value).toBe(3233);
    expect(result.lines.map((line) => line.value)).not.toEqual(
      expect.arrayContaining([10.13, 15.34, 17.34, 20.34])
    );
    expect(detectStatementType(text).scaling).toBe('thousands');
  });

  it('preserves a genuine one-period comma decimal in its value column', () => {
    const text = [
      'Skonsolidowany rachunek zysków i strat',
      '2025',
      'Marża brutto 10,13',
      ...Array.from({ length: 20 }, (_, index) => `Wskaźnik operacyjny ${index} ${100 + index}`),
    ].join('\n');
    const result = extractFinancialLines(text, 'P&L', {
      selectedPeriodLabel: '2025',
    });
    const margin = result.lines.find((line) => line.originalLabel.startsWith('Marża brutto'));
    expect(margin?.value).toBe(10.13);
  });

  it('treats an inline-period compound note coordinate as a note and keeps the later value', () => {
    const text = [
      'Skonsolidowane sprawozdanie z sytuacji finansowej',
      'Nota \t31.12.2025 \t31.12.2024',
      'Akcje własne \t23,24 \t(22 424) \t-',
      ...Array.from({ length: 20 }, (_, index) => `Pozycja bilansowa ${index} \t${100 + index} \t${90 + index}`),
    ].join('\n');
    const result = extractFinancialLines(text, 'BS', {
      selectedPeriodLabel: '2025',
      comparisonPeriodLabel: '2024',
    });
    const treasuryShares = result.lines.find((line) => line.originalLabel.startsWith('Akcje własne'));
    expect(treasuryShares?.value).toBe(-22424);
    expect(treasuryShares?.numericTokens).toEqual(
      expect.arrayContaining([expect.objectContaining({ raw: '23,24', tokenType: 'note_ref' })])
    );
  });
  it('recognizes a Polish cash-flow heading split across PDF lines', () => {
    const text = [
      'Skonsolidowane sprawozdanie z przepływów',
      'pieniężnych',
      '01.01.2025 – 31.12.2025  01.01.2024 – 31.12.2024',
      'DZIAŁALNOŚĆ OPERACYJNA',
      ...Array.from({ length: 16 }, (_, index) =>
        `Korekta przepływów operacyjnych ${index + 1} ${100_000 + index} ${90_000 + index}`
      ),
      'Przepływy pieniężne netto z działalności operacyjnej 590 880 521 297',
      'Przepływy pieniężne netto z działalności inwestycyjnej (474 582) (470 547)',
      'Przepływy pieniężne netto z działalności finansowej (127 069) (103 918)',
    ].join('\n');
    const section = locateStatementSections(text, 'CF')[0];
    expect(section.statementType).toBe('CF');
    expect(section.confidence).toBeGreaterThanOrEqual(0.5);
    expect(section.text).toContain('DZIAŁALNOŚĆ OPERACYJNA');
  });

  describe('detectStatementType', () => {
    it('detects a P&L statement from Polish text', () => {
      const result = detectStatementType(
        'Rachunek zysków i strat za okres od 01.01.2024 do 31.12.2024 w tys. PLN'
      );
      expect(result.statementType).toBe('P&L');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.currency).toBe('PLN');
    });

    it('detects a Balance Sheet from English text', () => {
      const result = detectStatementType(
        'Balance Sheet as of December 31, 2024. Total Assets, Current Liabilities, Equity.'
      );
      expect(result.statementType).toBe('BS');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('detects a Cash Flow statement', () => {
      const result = detectStatementType(
        'Cash Flow Statement. Operating activities, investing activities, financing activities.'
      );
      expect(result.statementType).toBe('CF');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('returns UNKNOWN for unrecognizable text', () => {
      const result = detectStatementType('random lorem ipsum text without financial keywords');
      expect(result.statementType).toBe('UNKNOWN');
      expect(result.confidence).toBe(0);
    });

    it('returns structured result with all expected fields', () => {
      const result = detectStatementType('Income statement for 2024 in EUR thousands');
      expect(result).toHaveProperty('statementType');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('currency');
      expect(result).toHaveProperty('scaling');
      expect(result).toHaveProperty('language');
      expect(result).toHaveProperty('containedStatementTypes');
      expect(result).toHaveProperty('containsMultipleStatements');
    });

    it('handles empty string without throwing', () => {
      const result = detectStatementType('');
      expect(result.statementType).toBe('UNKNOWN');
    });
  });

  describe('detectContainedStatementTypes', () => {
    it('detects multiple statement types in a combined document', () => {
      const text = `
        Income Statement for year ended Dec 31, 2024.
        Revenue, Cost of Sales, Net Profit.
        Balance Sheet as of Dec 31, 2024.
        Total Assets, Liabilities, Equity.
      `;
      const types = detectContainedStatementTypes(text);
      expect(types).toContain('P&L');
      expect(types).toContain('BS');
    });

    it('returns empty array for non-financial text', () => {
      const types = detectContainedStatementTypes('just some regular text');
      expect(types).toEqual([]);
    });

    it('handles null/undefined gracefully', () => {
      const types = detectContainedStatementTypes(null as any);
      expect(Array.isArray(types)).toBe(true);
    });
  });

  describe('validateStatement', () => {
    it('returns pass for valid BS equation (assets = liabilities + equity)', () => {
      const lines = [
        { canonicalLineId: 'fsl-bs-total-assets', value: 1000 },
        { canonicalLineId: 'fsl-bs-total-liabilities', value: 600 },
        { canonicalLineId: 'fsl-bs-equity', value: 400 },
      ];
      const result = validateStatement(lines, 'BS');
      expect(result.status).not.toBe('needs_review');
      const eqMsg = result.messages.find((m) => m.code === 'BS_EQUATION_OK');
      expect(eqMsg).toBeDefined();
    });

    it('flags BS equation mismatch', () => {
      const lines = [
        { canonicalLineId: 'fsl-bs-total-assets', value: 1000 },
        { canonicalLineId: 'fsl-bs-total-liabilities', value: 600 },
        { canonicalLineId: 'fsl-bs-equity', value: 200 },
      ];
      const result = validateStatement(lines, 'BS');
      const errMsg = result.messages.find((m) => m.code === 'BS_EQUATION_MISMATCH');
      expect(errMsg).toBeDefined();
      expect(errMsg?.type).toBe('error');
    });

    it('warns on duplicate canonical line mappings', () => {
      const lines = [
        { canonicalLineId: 'fsl-pl-revenue', value: 500 },
        { canonicalLineId: 'fsl-pl-revenue', value: 300 },
      ];
      const result = validateStatement(lines, 'P&L');
      const dupMsg = result.messages.find((m) => m.code === 'DUPLICATE_CANONICAL_LINES');
      expect(dupMsg).toBeDefined();
      expect(dupMsg?.type).toBe('warning');
    });

    it('does not treat the same canonical line in different periods as a duplicate', () => {
      const result = validateStatement(
        [
          { canonicalLineId: 'fsl-pl-revenue', value: 500, periodLabel: '2026' },
          { canonicalLineId: 'fsl-pl-revenue', value: 300, periodLabel: '2025' },
        ],
        'P&L'
      );

      expect(result.messages.find((message) => message.code === 'DUPLICATE_CANONICAL_LINES')).toBe(
        undefined
      );
    });

    it('excludes non-financial lines from validation', () => {
      const lines = [
        { canonicalLineId: 'fsl-bs-total-assets', value: 1000 },
        { canonicalLineId: 'fsl-bs-total-liabilities', value: 600 },
        { canonicalLineId: 'fsl-bs-equity', value: 400 },
        { canonicalLineId: 'fsl-bs-total-assets', value: 9999, isNonFinancial: true },
      ];
      const result = validateStatement(lines, 'BS');
      const eqMsg = result.messages.find((m) => m.code === 'BS_EQUATION_OK');
      expect(eqMsg).toBeDefined();
    });

    it('handles empty lines array without throwing', () => {
      const result = validateStatement([], 'P&L');
      expect(['pass', 'warnings', 'needs_review']).toContain(result.status);
      expect(Array.isArray(result.messages)).toBe(true);
    });
  });

  describe('extractFinancialLines', () => {
    it('parses comma-only UK thousands as whole report units', () => {
      const text = Array.from({ length: 25 }, (_, index) =>
        index === 8
          ? 'Group balance sheet'
          : index === 9
            ? '28 February 2026 22 February 2025'
            : index === 10
              ? 'Property, plant and equipment 17,728 17,262'
              : `filler ${index}`
      ).join('\n');

      const result = extractFinancialLines(text, 'BS', {
        selectedPeriodLabel: '2026',
        comparisonPeriodLabel: '2025',
      });
      const row = result.lines.find((line) =>
        line.originalLabel.includes('Property, plant and equipment')
      );

      expect(row?.value).toBe(17728);
      expect(row?.comparisonValue).toBe(17262);
    });

    it('bounds a selected P&L to its section in a multi-statement report', () => {
      const text = [
        'Skonsolidowany rachunek zysków i strat',
        'Nota 2025 2024',
        'Przychody ze sprzedaży 1 866 989 798 372',
        'Zysk netto 18 455 000 400 000',
        ...Array.from({ length: 20 }, (_, i) => `wiersz pomocniczy ${i}`),
        'Skonsolidowane sprawozdanie z sytuacji finansowej',
        'Nota 31.12.2025 31.12.2024',
        'AKTYWA RAZEM 3 503 320 3 026 438',
        'Kapitał własny 2 900 000 2 700 000',
      ].join('\n');

      const result = extractFinancialLines(text, 'P&L', {
        selectedPeriodLabel: '2025',
        comparisonPeriodLabel: '2024',
      });

      expect(result.lines.some((line) => /Przychody ze sprzedaży/.test(line.originalLabel))).toBe(
        true
      );
      expect(result.lines.some((line) => /AKTYWA RAZEM/i.test(line.originalLabel))).toBe(false);
    });

    it('keeps P&L, balance sheet, and cash flow selections in their own sections', () => {
      const spacer = Array.from({ length: 12 }, (_, index) => `wiersz ${index}`);
      const text = [
        'Skonsolidowany rachunek zysków i strat',
        'Nota 2025 2024',
        'Przychody ze sprzedaży 1 866 989 798 372',
        'Zysk netto 18 455 000 400 000',
        ...spacer,
        'Skonsolidowane sprawozdanie z sytuacji finansowej',
        'Nota 31.12.2025 31.12.2024',
        'AKTYWA RAZEM 3 503 320 3 026 438',
        'Kapitał własny 2 900 000 2 700 000',
        ...spacer,
        'Skonsolidowane sprawozdanie z przepływów pieniężnych',
        'Nota 2025 2024',
        'Przepływy pieniężne netto z działalności operacyjnej 120 000 110 000',
        'Środki pieniężne na koniec okresu 90 000 80 000',
        ...spacer,
      ].join('\n');

      const selected = (['P&L', 'BS', 'CF'] as const).map((type) =>
        extractFinancialLines(text, type, {
          selectedPeriodLabel: '2025',
          comparisonPeriodLabel: '2024',
        })
      );

      expect(selected[0].lines.some((line) => /Przychody/.test(line.originalLabel))).toBe(true);
      expect(selected[0].lines.some((line) => /AKTYWA|Przepływy/.test(line.originalLabel))).toBe(
        false
      );
      expect(selected[1].lines.some((line) => /AKTYWA/.test(line.originalLabel))).toBe(true);
      expect(selected[1].lines.some((line) => /Przychody|Przepływy/.test(line.originalLabel))).toBe(
        false
      );
      expect(selected[2].lines.some((line) => /Przepływy/.test(line.originalLabel))).toBe(true);
      expect(selected[2].lines.some((line) => /Przychody|AKTYWA/.test(line.originalLabel))).toBe(
        false
      );
    });

    it('keeps a leading note reference out of two small period values', () => {
      const text = [
        'Skonsolidowany rachunek zysków i strat',
        'Nota 2025 2024',
        'Przychody ze sprzedaży usług 1 5 10',
        ...Array.from({ length: 20 }, (_, i) => `wiersz pomocniczy ${i}`),
      ].join('\n');
      const result = extractFinancialLines(text, 'P&L', {
        selectedPeriodLabel: '2025',
        comparisonPeriodLabel: '2024',
      });
      const row = result.lines.find((line) =>
        /Przychody ze sprzedaży usług/.test(line.originalLabel)
      );

      expect(row?.value).toBe(5);
      expect(row?.comparisonValue).toBe(10);
      expect(row?.selectedNumericToken?.raw).toBe('5');
    });

    it('detects Polish thousands declared beside a later statement section', () => {
      const text = [
        ...Array.from({ length: 400 }, (_, i) => `strona tytułowa i spis treści ${i}`),
        'Skonsolidowany rachunek zysków i strat (dane w tys. zł)',
        'Przychody ze sprzedaży 2025 866 989 2024 798 372',
      ].join('\n');

      expect(detectStatementType(text).scaling).toBe('thousands');
    });
  });

  describe('extractFinancialLines PDF lineage', () => {
    it('preserves the pdf-parse page marker on extracted rows', () => {
      const pageSeven = extractFinancialLines(
        ['Income Statement 2025 2024', '-- 6 of 40 --', 'Revenue 1,200 1,000'].join('\n'),
        'P&L',
        { selectedPeriodLabel: '2025', comparisonPeriodLabel: '2024' }
      );
      const pageEight = extractFinancialLines(
        ['Income Statement 2025 2024', '-- 7 of 40 --', 'Revenue 1,200 1,000'].join('\n'),
        'P&L',
        { selectedPeriodLabel: '2025', comparisonPeriodLabel: '2024' }
      );

      expect(pageSeven.lines[0]?.sourcePage).toBe(7);
      expect(pageEight.lines[0]?.sourcePage).toBe(8);
    });
  });

  describe('resolveDuplicateSuggestedMappings', () => {
    it('keeps the best candidate and clears duplicates', () => {
      const lines = [
        {
          originalLabel: 'Revenue',
          suggestedCanonicalId: 'fsl-pl-revenue',
          confidence: 0.9,
          sourceRow: 1,
          mappingCandidates: [{ canonicalLineId: 'fsl-pl-revenue', score: 95, selected: true }],
        },
        {
          originalLabel: 'Total Revenue',
          suggestedCanonicalId: 'fsl-pl-revenue',
          confidence: 0.7,
          sourceRow: 2,
          mappingCandidates: [{ canonicalLineId: 'fsl-pl-revenue', score: 80, selected: true }],
        },
      ] as any[];

      const result = resolveDuplicateSuggestedMappings(lines);
      expect(result).toHaveLength(2);

      const withMapping = result.filter((l: any) => l.suggestedCanonicalId === 'fsl-pl-revenue');
      expect(withMapping).toHaveLength(1);

      const cleared = result.filter((l: any) => l.mappingReason === 'duplicate_candidate_conflict');
      expect(cleared).toHaveLength(1);
    });

    it('returns unchanged lines when no duplicates', () => {
      const lines = [
        {
          originalLabel: 'Revenue',
          suggestedCanonicalId: 'fsl-pl-revenue',
          confidence: 0.9,
          mappingCandidates: [],
        },
        {
          originalLabel: 'COGS',
          suggestedCanonicalId: 'fsl-pl-cogs',
          confidence: 0.8,
          mappingCandidates: [],
        },
      ] as any[];

      const result = resolveDuplicateSuggestedMappings(lines);
      expect(result[0].suggestedCanonicalId).toBe('fsl-pl-revenue');
      expect(result[1].suggestedCanonicalId).toBe('fsl-pl-cogs');
    });

    it('does not mutate the original array', () => {
      const original = [
        {
          originalLabel: 'A',
          suggestedCanonicalId: 'x',
          confidence: 0.5,
          mappingCandidates: [{ score: 50, selected: true }],
        },
        {
          originalLabel: 'B',
          suggestedCanonicalId: 'x',
          confidence: 0.9,
          mappingCandidates: [{ score: 90, selected: true }],
        },
      ] as any[];

      resolveDuplicateSuggestedMappings(original);
      expect(original[0].suggestedCanonicalId).toBe('x');
      expect(original[1].suggestedCanonicalId).toBe('x');
    });
  });
});
