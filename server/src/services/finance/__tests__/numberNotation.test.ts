/**
 * RC-00 — locale-aware number notation.
 *
 * Every string in the "real filing strings" block is the notation actually used by the issuer
 * in the document named next to it; the expected value is the figure that filing reports.
 * Evidence: docs/validation/finance-v3/generated/gate-d/REAL_COMPANY_PROOF_report.md §RC-00.
 */

import { describe, expect, it } from 'vitest';

import {
  detectNumberNotation,
  type NumberNotation,
  parseStatementNumber,
} from '../numberNotation.js';

const value = (raw: string, notation: NumberNotation = 'unknown') =>
  parseStatementNumber(raw, notation).value;

describe('parseStatementNumber — real filing strings', () => {
  it('reads English thousands separators as grouping (Tesla / Coca-Cola / bp)', () => {
    // Tesla 10-K 2024, USD millions. RC-00 stored 122.07 for this row.
    expect(value('122,070', 'en')).toBe(122070);
    expect(value('16,139', 'en')).toBe(16139);
    expect(value('12,017', 'en')).toBe(12017);
    expect(value('58,360', 'en')).toBe(58360);
    // Coca-Cola 10-K 2025, USD millions. RC-00 stored 100.549.
    expect(value('100,549', 'en')).toBe(100549);
    expect(value('10,828', 'en')).toBe(10828);
    // bp Annual Report / Form 20-F 2025. RC-00 stored 26.574.
    expect(value('26,574', 'en')).toBe(26574);
    // Tesco £m, the case that commit e2e8f3e97f already covered — must stay fixed.
    expect(value('5,092', 'en')).toBe(5092);
  });

  it('reads European thousands separators as grouping (BMW)', () => {
    // BMW Group Financial Statements 2024, EUR millions. RC-00 stored 267.732.
    expect(value('267.732', 'eu')).toBe(267732);
    expect(value('36.752', 'eu')).toBe(36752);
    expect(value('250.238', 'eu')).toBe(250238);
  });

  it('reads Polish space grouping (Apator)', () => {
    // Grupa Apator RS 2024, PLN thousands — the corpus that was never broken.
    expect(value('1 227 799', 'eu')).toBe(1227799);
    expect(value('1 227 799', 'en')).toBe(1227799);
    expect(value('466 231', 'eu')).toBe(466231);
    // Non-breaking and narrow no-break spaces occur in PDF text layers.
    expect(value('1 227 799', 'eu')).toBe(1227799);
    expect(value('1 227 799', 'eu')).toBe(1227799);
  });

  it('reads fully-qualified mixed-separator figures without needing the notation', () => {
    expect(value('1.227.799,50', 'unknown')).toBe(1227799.5);
    expect(value('1,227,799.50', 'unknown')).toBe(1227799.5);
    expect(value('1.234,56', 'en')).toBe(1234.56); // structure beats a wrong notation
    expect(value('1,234.56', 'eu')).toBe(1234.56);
  });

  it('treats repeated separators as grouping regardless of notation', () => {
    expect(value('1,227,799', 'unknown')).toBe(1227799);
    expect(value('1.227.799', 'unknown')).toBe(1227799);
  });

  it('keeps genuine decimals decimal', () => {
    expect(value('0,5', 'eu')).toBe(0.5);
    expect(value('0.5', 'en')).toBe(0.5);
    expect(value('12,34', 'eu')).toBe(12.34);
    expect(value('12.34', 'en')).toBe(12.34);
    // A tail that is not three digits can never be a thousands group.
    expect(value('1,5', 'en')).toBe(1.5);
    expect(value('1.5', 'eu')).toBe(1.5);
    // A head longer than three digits cannot be the first group of a grouped number.
    expect(value('12345,678', 'en')).toBe(12345.678);
  });

  it('handles accounting negatives and trailing punctuation', () => {
    expect(value('(2,384)', 'en')).toBe(-2384);
    expect(value('-2,384', 'en')).toBe(-2384);
    expect(value('2.384-', 'eu')).toBe(-2384);
    expect(value('(1 227 799)', 'eu')).toBe(-1227799);
    expect(value('122,070.', 'en')).toBe(122070);
  });

  it('is the 1000x bug: the same string under the wrong notation', () => {
    // This is exactly what RC-00 recorded — kept as an executable statement of the defect.
    expect(value('122,070', 'eu')).toBe(122.07);
    expect(value('122,070', 'en')).toBe(122070);
    expect(value('267.732', 'en')).toBe(267.732);
    expect(value('267.732', 'eu')).toBe(267732);
  });

  it('never silently guesses an ambiguous shape', () => {
    const ambiguous = parseStatementNumber('1,234', 'unknown');
    expect(ambiguous.ambiguous).toBe(true);
    expect(ambiguous.reason).toBe('AMBIGUOUS_SEPARATOR_NO_DOCUMENT_NOTATION');

    const alsoAmbiguous = parseStatementNumber('267.732', 'unknown');
    expect(alsoAmbiguous.ambiguous).toBe(true);

    // Resolved notation removes the ambiguity entirely.
    expect(parseStatementNumber('1,234', 'en').ambiguous).toBe(false);
    expect(parseStatementNumber('1,234', 'eu').ambiguous).toBe(false);
    expect(parseStatementNumber('1,234', 'eu').value).toBe(1.234);

    // Unambiguous shapes are never flagged.
    expect(parseStatementNumber('1,227,799', 'unknown').ambiguous).toBe(false);
    expect(parseStatementNumber('1 227 799', 'unknown').ambiguous).toBe(false);
    expect(parseStatementNumber('1.227.799,50', 'unknown').ambiguous).toBe(false);
  });

  it('rejects non-numbers instead of coercing them', () => {
    expect(value('', 'en')).toBeNull();
    expect(value('n/a', 'en')).toBeNull();
    expect(value('—', 'en')).toBeNull();
  });
});

describe('detectNumberNotation — document-level resolution', () => {
  it('resolves English from an unambiguous shape in the document', () => {
    const profile = detectNumberNotation(
      'Consolidated Balance Sheets (in millions)\nTotal assets 122,070 106,618\nEPS 1,234.56\n'
    );
    expect(profile.notation).toBe('en');
    expect(profile.confidence).toBe('high');
    expect(profile.source).toBe('document_evidence');
  });

  it('resolves European from an unambiguous shape in the document', () => {
    const profile = detectNumberNotation(
      'Konzernbilanz in Mio. EUR\nSumme Vermögenswerte 1.267.732\nQuote 12,5\n'
    );
    expect(profile.notation).toBe('eu');
    expect(profile.confidence).toBe('high');
    expect(profile.source).toBe('document_evidence');
  });

  it('does not mistake dotted dates for European grouping', () => {
    // "31.12.2024" is stripped before counting; without that it reads as a 1.234-style group.
    const profile = detectNumberNotation(
      'Balance sheet\n31.12.2024 31.12.2023\nTotal assets 122,070 106,618\n'
    );
    expect(profile.notation).toBe('en');
    expect(profile.evidence.euGrouping).toBe(0);
  });

  it('does not mistake "December 31, 2024" for a European decimal', () => {
    const profile = detectNumberNotation(
      'Consolidated Balance Sheets\nDecember 31, 2024 December 31, 2023\nTotal assets 122,070\n'
    );
    expect(profile.notation).toBe('en');
  });

  it('falls back to the document language when the text has no decisive shape', () => {
    expect(detectNumberNotation('Aktywa razem 500', { language: 'pl' }).notation).toBe('eu');
    expect(detectNumberNotation('Total assets 500', { language: 'en' }).notation).toBe('en');
    expect(detectNumberNotation('Summe 500', { language: 'de' }).notation).toBe('eu');
    expect(detectNumberNotation('Total 500', { language: 'pl' }).source).toBe('language_hint');
  });

  it('falls back to the reporting currency after the language', () => {
    const profile = detectNumberNotation('Total 500', { language: null, currency: 'PLN' });
    expect(profile.notation).toBe('eu');
    expect(profile.source).toBe('currency_hint');
    expect(detectNumberNotation('Total 500', { currency: 'USD' }).notation).toBe('en');
    // EUR is deliberately not a signal: Ireland reports in English notation, Germany does not.
    expect(detectNumberNotation('Total 500', { currency: 'EUR' }).notation).toBe('unknown');
  });

  it('returns unknown rather than guessing when nothing is decisive', () => {
    const profile = detectNumberNotation('Row A 500\nRow B 600\n');
    expect(profile.notation).toBe('unknown');
    expect(profile.source).toBe('none');
  });

  it('refuses to commit when the document mixes both notations evenly', () => {
    const profile = detectNumberNotation('a 1,234.56 b 1.234,56');
    expect(profile.notation).toBe('unknown');
  });
});
