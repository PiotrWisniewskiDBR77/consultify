/**
 * RC-00 regression gate on REAL extracted data.
 *
 * Source of truth: docs/validation/finance-v3/generated/STATEMENT_IMPORT_SAMPLE_AUDIT_2026-03-15.json
 * — the committed audit of a real extraction run over 9 real filings (Apator x4, KGHM, BMW, bp,
 * Coca-Cola, Tesla). Every number below comes from that file; nothing is invented.
 *
 * The RC-00 detector (REAL_COMPANY_PROOF_report.md §RC-00) is the share of extracted values that
 * carry a fractional part. Real statement subtotals at millions/thousands scale are integers, so a
 * fractional part is the fingerprint of a separator read in the wrong role — the digit sequence
 * survives and only the magnitude drops, by exactly 1000x.
 *
 * RECONSTRUCTION (the audit stores parsed values, not source tokens):
 * a value that the old parser produced from `<1-3 digits><separator><3 digits>` is recovered
 * exactly by `Math.abs(v).toFixed(3)` — the three grouped digits are still there, JS only dropped
 * trailing zeros when stringifying (122.07 -> "122.070" -> "122,070"). The separator is the one the
 * issuer prints: comma for the English filings, dot for BMW. Integer values had no separator and
 * are replayed verbatim. For the rare token that had TWO grouping separators the reconstruction
 * recovers the first group only; that lower-bounds the digit count and does not affect the
 * fractional-part metric, which is what this gate measures.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { extractFinancialLines } from '../../financialStatementService.js';
import { type NumberNotation, parseStatementNumber } from '../numberNotation.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..', '..');
const AUDIT_PATH = path.join(
  REPO_ROOT,
  'docs/validation/finance-v3/generated/STATEMENT_IMPORT_SAMPLE_AUDIT_2026-03-15.json'
);

interface AuditLine {
  label: string;
  canonicalId: string;
  value: number;
}
interface AuditTarget {
  statementType: string;
  topMappedLines: AuditLine[];
}
interface AuditDoc {
  label: string;
  currency: string;
  scaling: string;
  targets: AuditTarget[];
}

const auditDocs: AuditDoc[] = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
const docByLabel = (label: string): AuditDoc => {
  const doc = auditDocs.find((d) => d.label === label);
  if (!doc) throw new Error(`audit document not found: ${label}`);
  return doc;
};

const hasFraction = (v: number): boolean => Math.abs(v % 1) > 1e-9;

/** Separator the issuer prints, and therefore the notation its document resolves to. */
const CORPUS: Array<{
  label: string;
  notation: Exclude<NumberNotation, 'unknown'>;
  /** Fractional-value share recorded in REAL_COMPANY_PROOF_report.md §RC-00, in percent. */
  reportedBrokenPct: number;
}> = [
  { label: 'Tesla 10-K 2024', notation: 'en', reportedBrokenPct: 74.4 },
  { label: 'Coca-Cola 10-K 2025', notation: 'en', reportedBrokenPct: 71.4 },
  { label: 'bp Annual Report 2025', notation: 'en', reportedBrokenPct: 48.3 },
  { label: 'BMW Group Financial Statements 2024', notation: 'eu', reportedBrokenPct: 46.2 },
  { label: 'KGHM SRR 2024', notation: 'eu', reportedBrokenPct: 2.4 },
  { label: 'Apator SA Raport R 2024', notation: 'eu', reportedBrokenPct: 0.0 },
  { label: 'Grupa Apator Raport RS 2023', notation: 'eu', reportedBrokenPct: 0.0 },
  { label: 'Grupa Apator Raport RS 2024', notation: 'eu', reportedBrokenPct: 0.0 },
  { label: 'Raport skonsolidowany Apator', notation: 'eu', reportedBrokenPct: 0.0 },
];

/** The share of extracted values that carry a fractional part, as the RC-00 detector defines it. */
const fractionalPct = (values: number[]): number =>
  values.length === 0 ? 0 : Math.round((values.filter(hasFraction).length / values.length) * 1000) / 10;

const allValues = (doc: AuditDoc): number[] =>
  doc.targets.flatMap((t) => t.topMappedLines.map((l) => l.value));

/** Recover the source token the extractor saw, per the RECONSTRUCTION note above. */
const sourceToken = (value: number, notation: NumberNotation): string => {
  const sep = notation === 'en' ? ',' : '.';
  const sign = value < 0 ? '-' : '';
  return hasFraction(value)
    ? `${sign}${Math.abs(value).toFixed(3).replace('.', sep)}`
    : `${sign}${Math.abs(value)}`;
};

describe('RC-00 regression — real extraction audit, 9 real filings', () => {
  it.each(CORPUS)(
    '$label: fractional-value share drops to <5% (was $reportedBrokenPct%)',
    ({ label, notation, reportedBrokenPct }) => {
      const doc = docByLabel(label);
      const before = allValues(doc);
      expect(before.length).toBeGreaterThan(0);

      // The audit reproduces the figure published in REAL_COMPANY_PROOF_report.md §RC-00.
      expect(fractionalPct(before)).toBeCloseTo(reportedBrokenPct, 1);

      const after = before.map((v) => {
        const parsed = parseStatementNumber(sourceToken(v, notation), notation);
        expect(parsed.value).not.toBeNull();
        expect(parsed.ambiguous).toBe(false);
        return parsed.value as number;
      });

      expect(fractionalPct(after)).toBeLessThan(5);
    }
  );

  it('restores the exact figures RC-00 names as broken', () => {
    // Tesla 10-K 2024, USD millions: total assets stored as 122.07, filing reports 122,070.
    const tesla = docByLabel('Tesla 10-K 2024');
    const teslaAssets = allValues(tesla);
    const storedTotalAssets = tesla.targets
      .flatMap((t) => t.topMappedLines)
      .find((l) => l.canonicalId === 'fsl-bs-total-assets');
    expect(storedTotalAssets?.value).toBe(122.07);
    expect(parseStatementNumber(sourceToken(122.07, 'en'), 'en').value).toBe(122070);
    expect(teslaAssets.length).toBeGreaterThan(0);

    // Coca-Cola: stored 100.549 -> 100,549.
    expect(parseStatementNumber(sourceToken(100.549, 'en'), 'en').value).toBe(100549);
    // BMW: stored 267.732 -> 267.732 (European grouping).
    expect(parseStatementNumber(sourceToken(267.732, 'eu'), 'eu').value).toBe(267732);
    // bp: stored 26.574 -> 26,574.
    expect(parseStatementNumber(sourceToken(26.574, 'en'), 'en').value).toBe(26574);
  });

  it('leaves the Polish corpus, which was never broken, untouched', () => {
    for (const label of [
      'Apator SA Raport R 2024',
      'Grupa Apator Raport RS 2023',
      'Grupa Apator Raport RS 2024',
      'Raport skonsolidowany Apator',
    ]) {
      const values = allValues(docByLabel(label));
      const after = values.map((v) => parseStatementNumber(sourceToken(v, 'eu'), 'eu').value);
      expect(after).toEqual(values.map((v) => v));
      expect(fractionalPct(after as number[])).toBe(0);
    }
  });
});

/**
 * End-to-end through the real import path. The source PDFs are not in the repo, so each document
 * is replayed from the audit's own labels and reconstructed tokens (two identical period columns,
 * which is the shape the column selector expects). Notation is NOT passed in — extractFinancialLines
 * has to resolve it from the document text, which is the behaviour under test.
 */
describe('RC-00 regression — extractFinancialLines resolves notation per document', () => {
  const replayDocument = (label: string, sep: ',' | '.', header: string[]) => {
    const doc = docByLabel(label);
    const target = doc.targets.find((t) => t.statementType === 'BS') ?? doc.targets[0];
    const rows = target.topMappedLines.map((line) => {
      const cleanLabel = line.label
        .replace(/\s+20\d{2}$/, '')
        .replace(/\s+\$$/, '')
        .trim();
      const token = hasFraction(line.value)
        ? Math.abs(line.value).toFixed(3).replace('.', sep)
        : String(Math.abs(line.value));
      return `${cleanLabel} ${token} ${token}`;
    });
    return [...header, ...rows].join('\n');
  };

  it('reads Tesla (English notation) as whole units', () => {
    const text = replayDocument('Tesla 10-K 2024', ',', [
      'Consolidated Balance Sheets',
      '(in millions, except per share data)',
      'December 31, 2024',
    ]);
    const result = extractFinancialLines(text, 'BS');

    expect(result.numberNotation?.notation).toBe('en');
    expect(result.numberNotation?.confidence).toBe('high');
    expect(result.ambiguousSeparatorCount).toBe(0);
    expect(result.lines.length).toBeGreaterThanOrEqual(20);
    expect(fractionalPct(result.lines.map((l) => l.value))).toBeLessThan(5);

    const totalAssets = result.lines.find((l) => /^Total assets/i.test(l.originalLabel));
    expect(totalAssets?.value).toBe(122070);
    expect(totalAssets?.separatorAmbiguous).toBeUndefined();
  });

  it('reads Coca-Cola (English notation) as whole units', () => {
    const text = replayDocument('Coca-Cola 10-K 2025', ',', [
      'CONSOLIDATED BALANCE SHEETS',
      '(In millions except par value)',
      'December 31, 2025',
    ]);
    const result = extractFinancialLines(text, 'BS');

    expect(result.numberNotation?.notation).toBe('en');
    expect(result.lines.length).toBeGreaterThanOrEqual(20);
    expect(fractionalPct(result.lines.map((l) => l.value))).toBeLessThan(5);
    expect(
      result.lines.find((l) => /^Total assets/i.test(l.originalLabel))?.value
    ).toBe(100549);
  });

  it('reads BMW (European notation) as whole units', () => {
    const text = replayDocument('BMW Group Financial Statements 2024', '.', [
      'Konzernbilanz',
      'in Mio. EUR',
      '31.12.2024',
    ]);
    const result = extractFinancialLines(text, 'BS');

    expect(result.numberNotation?.notation).toBe('eu');
    expect(result.numberNotation?.confidence).toBe('high');
    expect(result.lines.length).toBeGreaterThanOrEqual(3);
    expect(fractionalPct(result.lines.map((l) => l.value))).toBeLessThan(5);
  });
});
