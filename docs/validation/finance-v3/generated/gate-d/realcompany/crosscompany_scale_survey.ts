#!/usr/bin/env tsx
/**
 * Cross-company scale/currency survey over EVERY real company whose extraction evidence exists in
 * this repo. DB-free: reads only the committed extraction audit
 * `docs/validation/finance-v3/generated/STATEMENT_IMPORT_SAMPLE_AUDIT_2026-03-15.json`.
 *
 * Purpose: handoff section 13 names CD Projekt, Apator, Tesco and Tesla as the real-data proof set.
 * This survey establishes, verifiably, WHICH of them (and which other real issuers) actually have
 * data in the repo, what currency/scale the extractor declared for each, and whether the declared
 * currency is plausible for the issuer. No numbers are invented.
 */
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const AUDIT = path.resolve(HERE, '..', '..', 'STATEMENT_IMPORT_SAMPLE_AUDIT_2026-03-15.json');

interface Line { canonicalId: string; label: string; value: number }
interface Target { statementType: string; selectedPeriodLabel: string | null; comparisonPeriodLabel: string | null; extractedLineCount: number; mappedLineCount: number; coveragePct: number; readinessStatus: string; readinessScore: number; warnings: string[]; topMappedLines: Line[] }
interface Doc { label: string; filePath: string; currency: string; scaling: string; documentClass: string; extractionStrategy: string; targets: Target[] }

const docs = JSON.parse(fs.readFileSync(AUDIT, 'utf8')) as Doc[];

const UNIT_MULTIPLIER: Record<string, number> = { units: 1, thousands: 1_000, millions: 1_000_000, billions: 1_000_000_000 };
/** Issuer's real reporting currency, from the filing itself (public fact, used only as a plausibility check). */
const EXPECTED_CURRENCY: Record<string, string> = {
  'Apator SA Raport R 2024': 'PLN',
  'Grupa Apator Raport RS 2023': 'PLN',
  'Grupa Apator Raport RS 2024': 'PLN',
  'Raport skonsolidowany Apator': 'PLN',
  'BMW Group Financial Statements 2024': 'EUR',
  'KGHM SRR 2024': 'PLN',
  'bp Annual Report 2025': 'USD',
  'Coca-Cola 10-K 2025': 'USD',
  'Tesla 10-K 2024': 'USD',
};

const NAMED_IN_SECTION_13 = ['CD Projekt', 'Apator', 'Tesco', 'Tesla'];

const rows = docs.map((d) => {
  const find = (id: string) => {
    for (const t of d.targets) for (const l of t.topMappedLines) if (l.canonicalId === id) return l.value;
    return null;
  };
  const mult = UNIT_MULTIPLIER[d.scaling] ?? null;
  const revenue = find('fsl-pl-revenue');
  const totalAssets = find('fsl-bs-total-assets');
  const equity = find('fsl-bs-equity');
  const expected = EXPECTED_CURRENCY[d.label] ?? null;
  return {
    label: d.label,
    filePath: d.filePath,
    declaredCurrency: d.currency,
    expectedCurrency: expected,
    currencyPlausible: expected === null ? null : expected === d.currency,
    declaredScaling: d.scaling,
    unitMultiplier: mult,
    extractionStrategy: d.extractionStrategy,
    perStatement: d.targets.map((t) => ({ type: t.statementType, period: t.selectedPeriodLabel, comparison: t.comparisonPeriodLabel, extracted: t.extractedLineCount, mapped: t.mappedLineCount, coveragePct: t.coveragePct, readiness: t.readinessStatus, score: t.readinessScore, warnings: t.warnings })),
    revenueRaw: revenue,
    revenueFullUnits: revenue === null || mult === null ? null : revenue * mult,
    totalAssetsRaw: totalAssets,
    totalAssetsFullUnits: totalAssets === null || mult === null ? null : totalAssets * mult,
    equityRaw: equity,
    equityFullUnits: equity === null || mult === null ? null : equity * mult,
    separatorMisparse: misparseStats(d),
  };
});

/**
 * Thousands-separator misparse detector.
 *
 * A number written "122,070" (English thousands separator) parsed with the European convention
 * (comma = decimal separator) becomes 122.07 — the DIGIT SEQUENCE is preserved, only the separator
 * is reinterpreted, and the magnitude drops by exactly 1000. The tell-tale is a value with a
 * fractional part of exactly 1-3 digits sitting in a statement whose declared scaling is
 * millions/thousands (real statement subtotals at that scale are integers).
 */
function misparseStats(d: Doc) {
  let total = 0;
  let fractional = 0;
  const examples: Array<{ label: string; canonicalId: string; value: number; valueIfCommaWasThousandsSeparator: number }> = [];
  for (const t of d.targets) {
    for (const l of t.topMappedLines) {
      total++;
      const frac = Math.abs(l.value % 1);
      if (frac > 1e-9) {
        fractional++;
        // Reinterpreting the separator as a thousands separator restores the original digit
        // sequence, i.e. exactly 1000x the stored value when the fractional part has 3 digits.
        if (examples.length < 6) examples.push({ label: l.label.slice(0, 60), canonicalId: l.canonicalId, value: l.value, valueIfCommaWasThousandsSeparator: Number(String(Math.abs(l.value)).replace('.', '')) * Math.sign(l.value) });
      }
    }
  }
  return { totalLines: total, fractionalLines: fractional, fractionalPct: total === 0 ? 0 : Math.round((fractional / total) * 1000) / 10, examples };
}

const availability = NAMED_IN_SECTION_13.map((name) => ({
  companyNamedInHandoffSection13: name,
  presentInRepo: docs.some((d) => d.label.toLowerCase().includes(name.toLowerCase())),
  matchingDocuments: docs.filter((d) => d.label.toLowerCase().includes(name.toLowerCase())).map((d) => d.label),
}));

const currencyDefects = rows.filter((r) => r.currencyPlausible === false);

const out = {
  generatedAt: new Date().toISOString(),
  sourceAudit: path.relative(path.resolve(HERE, '..', '..', '..', '..', '..', '..'), AUDIT),
  note: 'Every figure is verbatim from the committed extraction audit; only the scaling multiplication is done here.',
  section13Availability: availability,
  companies: rows,
  currencyDetectionDefects: currencyDefects.map((r) => ({ label: r.label, declared: r.declaredCurrency, expected: r.expectedCurrency })),
  thousandsSeparatorMisparse: rows
    .filter((r) => r.separatorMisparse.fractionalPct >= 30)
    .map((r) => ({ label: r.label, declaredScaling: r.declaredScaling, fractionalPct: r.separatorMisparse.fractionalPct, totalLines: r.separatorMisparse.totalLines, examples: r.separatorMisparse.examples })),
};

fs.writeFileSync(path.join(HERE, 'crosscompany_scale_survey.json'), JSON.stringify(out, null, 2));

console.log('=== handoff section 13 availability ===');
for (const a of availability) console.log(`  ${a.companyNamedInHandoffSection13.padEnd(12)} present=${a.presentInRepo} ${a.matchingDocuments.join(', ')}`);
console.log('\n=== per-company declared scale / currency ===');
for (const r of rows) {
  console.log(`  ${r.label}`);
  console.log(`      currency declared=${r.declaredCurrency} expected=${r.expectedCurrency ?? '?'} plausible=${r.currencyPlausible} | scaling=${r.declaredScaling} (x${r.unitMultiplier})`);
  console.log(`      revenue raw=${r.revenueRaw ?? 'n/a'} -> full ${r.revenueFullUnits === null ? 'n/a' : r.revenueFullUnits.toLocaleString('en-US')} | totalAssets raw=${r.totalAssetsRaw ?? 'n/a'} -> full ${r.totalAssetsFullUnits === null ? 'n/a' : r.totalAssetsFullUnits.toLocaleString('en-US')}`);
}
console.log('\n=== thousands-separator misparse (fraction of extracted values carrying a decimal part) ===');
for (const r of rows) console.log(`  ${r.label.padEnd(40)} ${String(r.separatorMisparse.fractionalPct).padStart(5)}% of ${r.separatorMisparse.totalLines} lines (declared scaling: ${r.declaredScaling})`);
console.log(`\n=== currency-detection defects: ${currencyDefects.length} ===`);
for (const d of currencyDefects) console.log(`  ${d.label}: declared ${d.declaredCurrency}, issuer reports in ${d.expectedCurrency}`);
console.log('\nwritten: crosscompany_scale_survey.json');
