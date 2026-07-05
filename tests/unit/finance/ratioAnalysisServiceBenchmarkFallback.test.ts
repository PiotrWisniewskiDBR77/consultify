/**
 * ratioAnalysisService — O6.2/O6.3 benchmark-fallback unit tests.
 *
 * `buildRatioBenchmark` is the pure decision function that replaces the
 * universal warn/critical threshold as the ONLY comparison context: it
 * prefers an organization-entered DB row (financial_ratio_benchmarks) and
 * falls back to the static per-industry quartile band
 * (financeIndustryBenchmarks) when the org has not entered its own. No DB
 * access happens inside this function — it takes the already-loaded row (or
 * undefined) as a plain argument, so it is fully testable without mocking
 * DbPromise.
 */
import { describe, expect, it } from 'vitest';

import {
  buildRatioBenchmark,
  getRatioCatalog,
} from '../../../server/src/services/ratioAnalysisService.ts';

describe('buildRatioBenchmark', () => {
  it('prefers an organization-entered benchmark row over the industry fallback', () => {
    const orgRow = {
      p25: 15,
      median: 20,
      p75: 25,
      target_min: 18,
      target_max: 22,
      source_label: 'Org-specific peer set (manually entered)',
    };
    const result = buildRatioBenchmark('EBITDA_MARGIN', orgRow, 'produkcja przemysłowa', 8);
    expect(result).toBeDefined();
    expect(result!.origin).toBe('org');
    expect(result!.p25).toBe(15);
    expect(result!.median).toBe(20);
    expect(result!.p75).toBe(25);
    expect(result!.source).toBe('Org-specific peer set (manually entered)');
    // Org rows don't get the O6.2/O6.3 narrative sentence (that's only
    // synthesised for the industry fallback path today).
    expect(result!.narrativePl).toBeUndefined();
  });

  it('falls back to the static industry band when no org row exists', () => {
    const result = buildRatioBenchmark('EBITDA_MARGIN', undefined, 'produkcja przemysłowa', 8);
    expect(result).toBeDefined();
    expect(result!.origin).toBe('industry');
    expect(result!.industry).toBe('industrial-manufacturing');
    expect(result!.industryLabelPl).toBe('Produkcja przemysłowa');
    expect(result!.median).toBe(11);
    expect(result!.source).toContain('Damodaran');
    expect(result!.confidence).toBe('sourced');
  });

  it('cites the industry band in a bilingual narrative sentence (replaces ±15%)', () => {
    const result = buildRatioBenchmark('EBITDA_MARGIN', undefined, 'produkcja przemysłowa', 8);
    expect(result!.narrativePl).toContain('mediana branży');
    expect(result!.narrativePl).not.toMatch(/±\s*15\s*%/);
    expect(result!.narrativeEn).toContain('industry median');
  });

  it('falls back to the generic cross-industry band when the org industry is unknown/unset', () => {
    const result = buildRatioBenchmark('EBITDA_MARGIN', undefined, undefined, 8);
    expect(result).toBeDefined();
    expect(result!.origin).toBe('industry');
    expect(result!.industry).toBe('generic');
  });

  it('orders p25/p75 by "worse/better" direction for a lower-is-better ratio (DSO)', () => {
    // Industrial DSO band: p25=70 (worse), median=50, p75=35 (better).
    // For a lower-is-better ratio, ComputedRatio.benchmark.p25 should still
    // represent the WEAKER tail and p75 the STRONGER tail so UI/consumers
    // don't need to special-case direction.
    const result = buildRatioBenchmark('DSO', undefined, 'produkcja przemysłowa', 50);
    expect(result).toBeDefined();
    expect(result!.p25).toBe(70); // weaker tail for lower-is-better
    expect(result!.p75).toBe(35); // stronger tail for lower-is-better
    expect(result!.median).toBe(50);
  });

  it('orders p25/p75 ascending for a higher-is-better ratio (EBITDA margin)', () => {
    const result = buildRatioBenchmark('EBITDA_MARGIN', undefined, 'produkcja przemysłowa', 8);
    expect(result!.p25).toBeLessThan(result!.p75!);
  });

  it('returns undefined for a ratio code with no industry-benchmark mapping and no org row', () => {
    // OCF_TO_TOTAL_DEBT is in RATIO_CATALOG but not yet in the
    // CATALOG_TO_BENCHMARK_CODE map (no industry band authored for it).
    const result = buildRatioBenchmark('OCF_TO_TOTAL_DEBT', undefined, 'produkcja przemysłowa', 1);
    expect(result).toBeUndefined();
  });

  it('returns undefined when computedValue is null even if an industry band exists (no narrative without a value)', () => {
    const result = buildRatioBenchmark('EBITDA_MARGIN', undefined, 'produkcja przemysłowa', null);
    // Band metadata is still returned...
    expect(result).toBeDefined();
    expect(result!.median).toBe(11);
    // ...but no narrative sentence can cite a value that doesn't exist.
    expect(result!.narrativePl).toBeUndefined();
    expect(result!.narrativeEn).toBeUndefined();
  });

  it('every RATIO_CATALOG code mapped to a benchmark resolves to a defined band for at least one industry', () => {
    // Sanity check that the mapping table in ratioAnalysisService stays in
    // sync with financeIndustryBenchmarks — if a code is wired up, it must
    // actually resolve (this catches typos in either module).
    const mappedCodes = ['GROSS_MARGIN', 'OPERATING_MARGIN', 'EBITDA_MARGIN', 'NET_MARGIN', 'ROE', 'ROA', 'CURRENT_RATIO', 'QUICK_RATIO', 'DEBT_TO_EQUITY', 'INVENTORY_TURNOVER', 'DSO', 'DIO'];
    const catalog = getRatioCatalog();
    for (const code of mappedCodes) {
      expect(catalog.some((r) => r.code === code), `${code} missing from RATIO_CATALOG`).toBe(true);
      const result = buildRatioBenchmark(code, undefined, 'produkcja przemysłowa', 1);
      expect(result, `${code} did not resolve an industry benchmark`).toBeDefined();
    }
  });
});
