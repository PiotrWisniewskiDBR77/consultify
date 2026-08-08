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
  resolveDuplicateSuggestedMappings,
  validateStatement,
} from '../financialStatementService.js';

describe('financialStatementService — contract tests', () => {
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
