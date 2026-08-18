import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import {
  appendCfoDerivedMappingSuggestions,
  autoMapLines,
  extractFinancialLines,
  isStructuredStatementInput,
  locateStatementSections,
  runCfoAutoValidation,
} from '../financialStatementService.js';

function repositoryWorkbookText(): string {
  const workbook = XLSX.read(
    fs.readFileSync(path.resolve('tests/fixtures/finance/dbr77-financial-statements.xlsx')),
    { type: 'buffer', cellDates: true }
  );
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.['!ref']) continue;
    lines.push(`=== Sheet: ${sheetName} ===`);
    lines.push(
      ...XLSX.utils
        .sheet_to_csv(sheet, { FS: '\t', blankrows: false })
        .split('\n')
        .filter((line) => line.trim().length > 0)
    );
  }
  return lines.join('\n');
}

describe('structured multi-sheet statement section selection', () => {
  it('extracts plain-integer BS rows, preserves PPE, and derives FIXED_ASSETS with provenance', async () => {
    expect(isStructuredStatementInput('dbr77-financial-statements.xlsx')).toBe(true);
    expect(isStructuredStatementInput('board-report.pdf')).toBe(false);
    const text = repositoryWorkbookText();
    const sections = locateStatementSections(text, 'BS');

    expect(sections[0]?.text).toContain('=== Sheet: Balance Sheet ===');
    expect(sections[0]?.text).toContain('Property, Plant & Equipment');
    expect(sections[0]?.text).not.toContain('Revenue\t');
    expect(sections[0]?.text).not.toContain('Net Cash from Operating Activities');

    const extraction = extractFinancialLines(text, 'BS', { selectedPeriodLabel: 'FY2025' });
    expect(extraction.lines.map((line) => line.originalLabel)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Property, Plant & Equipment/i),
        expect.stringMatching(/Total Assets/i),
        expect.stringMatching(/Total Liabilities/i),
        expect.stringMatching(/Total Equity/i),
      ])
    );
    expect(extraction.lines.some((line) => /Revenue/i.test(line.originalLabel))).toBe(false);
    expect(extraction.lines.some((line) => /Net Cash from/i.test(line.originalLabel))).toBe(false);

    const mapped = await autoMapLines(extraction.lines, 'BS');
    const ppe = mapped.find((line) => /Property, Plant & Equipment/i.test(line.originalLabel));
    expect(ppe?.suggestedCanonicalId).toBe('fsl-bs-ppe');

    const cfo = runCfoAutoValidation(
      mapped.map((line) => ({
        canonicalLineId: line.suggestedCanonicalId || null,
        value: line.value,
        originalLabel: line.originalLabel,
        isNonFinancial: line.isNonFinancial,
        statementType: 'BS',
      })),
      {}
    );
    expect(cfo.derivedLines).toContainEqual(
      expect.objectContaining({
        canonicalLineId: 'fsl-bs-fixed',
        value: 9_500_000,
        originalLabel: '[CFO-derived] Total Assets − Current Assets',
      })
    );
    expect(cfo.repairs).toContainEqual(
      expect.objectContaining({
        action: 'derived',
        canonicalLineId: 'fsl-bs-fixed',
        reason: 'Total Assets − Current Assets',
        confidence: 0.85,
      })
    );
    const reviewable = appendCfoDerivedMappingSuggestions(mapped, {
      statementType: 'BS',
      periodLabel: 'FY2025',
      sourceFileName: 'dbr77-financial-statements.xlsx',
    });
    expect(reviewable).toContainEqual(
      expect.objectContaining({
        suggestedCanonicalId: 'fsl-bs-fixed',
        value: 9_500_000,
        mappingReason: 'cfo_derived',
      })
    );

    const withoutCurrentAssets = mapped.filter(
      (line) => line.suggestedCanonicalId !== 'fsl-bs-current-assets'
    );
    const malformed = runCfoAutoValidation(
      withoutCurrentAssets.map((line) => ({
        canonicalLineId: line.suggestedCanonicalId || null,
        value: line.value,
        originalLabel: line.originalLabel,
        isNonFinancial: line.isNonFinancial,
        statementType: 'BS',
      })),
      {}
    );
    expect(malformed.derivedLines.some((line) => line.canonicalLineId === 'fsl-bs-fixed')).toBe(
      false
    );
  });
});
