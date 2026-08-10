/**
 * Pure unit tests for the WP-D02 waterfall logic — no database. Real
 * Postgres persistence (finance_reconciliation_runs / finance_stmt_reconciliation
 * inserts, the residual GENERATED column, the exception raise, and the
 * DRAFT -> READY_FOR_REVIEW transition) is exercised by
 * `statementServices.pg.test.ts` in this directory. This file only proves
 * `computeWaterfall`/`determineReconciliationStatus`/`severityForResidual`
 * agree with the residual formula `finance_reconciliation_runs` itself
 * computes as a GENERATED column (WP-B05 migration:
 * `source_total - canonical_total - excluded_total - unmapped_total`),
 * so a caller gets a fast, DB-free answer that matches what the DB will
 * independently compute once persisted.
 */
import { describe, expect, it } from 'vitest';

import {
  computeWaterfall,
  detectPeriodOverPeriodJumps,
  determineReconciliationStatus,
  determineResidualStatus,
  determineResultQuality,
  PERIOD_JUMP_MATERIALITY_ANCHOR_PCT,
  PERIOD_JUMP_RELATIVE_THRESHOLD_PCT,
  PROVISIONAL_MATERIALITY_THRESHOLD_PCT,
  severityForResidual,
  type PeriodObservation,
  type WaterfallRow,
} from '../statementReconciliationService.js';

function row(overrides: Partial<WaterfallRow>): WaterfallRow {
  return { bucket: 'MAPPED', sourceAmount: 0, mappedAmount: null, signConvention: 'NATURAL', ...overrides };
}

describe('computeWaterfall', () => {
  it('a fully mapped, balanced batch has zero residual', () => {
    const totals = computeWaterfall([
      row({ bucket: 'MAPPED', sourceAmount: 1_000_000, mappedAmount: 1_000_000 }),
      row({ bucket: 'MAPPED', sourceAmount: 500_000, mappedAmount: 500_000 }),
    ]);
    expect(totals.sourceTotal).toBe(1_500_000);
    expect(totals.canonicalTotal).toBe(1_500_000);
    expect(totals.residual).toBe(0);
    expect(totals.residualPct).toBe(0);
  });

  it('excluded and unmapped rows are subtracted out of the residual formula (do not count as a discrepancy)', () => {
    const totals = computeWaterfall([
      row({ bucket: 'MAPPED', sourceAmount: 900_000, mappedAmount: 900_000 }),
      row({ bucket: 'EXCLUDED', sourceAmount: 50_000 }),
      row({ bucket: 'UNMAPPED', sourceAmount: 50_000 }),
    ]);
    expect(totals.sourceTotal).toBe(1_000_000);
    expect(totals.canonicalTotal).toBe(900_000);
    expect(totals.excludedTotal).toBe(50_000);
    expect(totals.unmappedTotal).toBe(50_000);
    // 1,000,000 - 900,000 - 50,000 - 50,000 = 0
    expect(totals.residual).toBe(0);
  });

  it('an unresolved DUPLICATE is NEVER netted out — it always surfaces as residual (the whole point of the DUPLICATE bucket)', () => {
    const totals = computeWaterfall([
      row({ bucket: 'MAPPED', sourceAmount: 500_000, mappedAmount: 500_000 }),
      // second raw row landed on the same canonical cell -> classified DUPLICATE, contributes 0 to canonicalTotal
      row({ bucket: 'DUPLICATE', sourceAmount: 120_000 }),
    ]);
    expect(totals.sourceTotal).toBe(620_000);
    expect(totals.canonicalTotal).toBe(500_000);
    expect(totals.duplicateTotal).toBe(120_000);
    // residual formula does not subtract duplicateTotal -> the 120,000 shows up as residual, unresolved.
    expect(totals.residual).toBe(120_000);
    expect(totals.residualPct).toBeCloseTo(120_000 / 620_000, 10);
  });

  it('RECLASS rows contribute their full value to canonicalTotal (relocated, not destroyed)', () => {
    const totals = computeWaterfall([row({ bucket: 'RECLASS', sourceAmount: 75_000, mappedAmount: 75_000 })]);
    expect(totals.reclassNetTotal).toBe(75_000);
    expect(totals.canonicalTotal).toBe(75_000);
    expect(totals.residual).toBe(0);
  });

  it('a balanced ELIMINATION pair (NATURAL debit + CONTRA credit) nets to zero contribution', () => {
    const totals = computeWaterfall([
      row({ bucket: 'ELIMINATION', sourceAmount: 500_000, mappedAmount: 500_000, signConvention: 'NATURAL' }),
      row({ bucket: 'ELIMINATION', sourceAmount: -500_000, mappedAmount: 500_000, signConvention: 'CONTRA' }),
    ]);
    expect(totals.eliminationNetTotal).toBe(0);
    expect(totals.canonicalTotal).toBe(0);
  });

  it('an unbalanced ELIMINATION pair leaves a nonzero net that surfaces as residual', () => {
    const totals = computeWaterfall([
      row({ bucket: 'ELIMINATION', sourceAmount: 700_000, mappedAmount: 700_000, signConvention: 'NATURAL' }),
      row({ bucket: 'ELIMINATION', sourceAmount: -500_000, mappedAmount: 500_000, signConvention: 'CONTRA' }),
    ]);
    expect(totals.eliminationNetTotal).toBe(200_000);
    // sourceTotal(200,000) == canonicalTotal(200,000) here -> residual is 0 at THIS layer. The
    // 200,000 imbalance is instead caught by the DB's finance_stmt_check_elimination_balance
    // trigger at the finance_stmt_lines WRITE (a different layer — see statementServices.pg.test.ts,
    // "unbalanced elimination pair is rejected at the finance_stmt_lines write, before reconciliation runs").
    expect(totals.residual).toBe(0);
  });

  it('a MISSING value (mappedAmount null) contributes zero, not a fabricated 0 masquerading as PRESENT_ZERO', () => {
    const totals = computeWaterfall([row({ bucket: 'MAPPED', sourceAmount: 0, mappedAmount: null })]);
    expect(totals.canonicalTotal).toBe(0);
    expect(totals.residual).toBe(0);
  });

  it('sourceTotal=0 with a nonzero residual reports residualPct=null (undefined %, not 0%)', () => {
    const totals = computeWaterfall([
      row({ bucket: 'MAPPED', sourceAmount: 100, mappedAmount: 100 }),
      row({ bucket: 'DUPLICATE', sourceAmount: -100 }),
    ]);
    expect(totals.sourceTotal).toBe(0);
    expect(totals.residual).toBe(-100 - 0); // source(0) - canonical(100) - excluded(0) - unmapped(0) = -100
    expect(totals.residualPct).toBeNull();
  });
});

describe('determineReconciliationStatus', () => {
  it('CLEAN when residual is exactly zero', () => {
    const totals = computeWaterfall([row({ bucket: 'MAPPED', sourceAmount: 100, mappedAmount: 100 })]);
    expect(determineReconciliationStatus(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT)).toBe('CLEAN');
  });

  it('WITHIN_TOLERANCE when residual is nonzero but under the materiality threshold', () => {
    const totals = computeWaterfall([
      row({ bucket: 'MAPPED', sourceAmount: 980_000, mappedAmount: 980_000 }),
      row({ bucket: 'DUPLICATE', sourceAmount: 10_000 }), // 10,000 / 990,000 ≈ 1.01% < 5%
    ]);
    expect(determineReconciliationStatus(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT)).toBe('WITHIN_TOLERANCE');
  });

  it('EXCEEDS_MATERIALITY when residual exceeds the threshold — the CD Projekt regression shape', () => {
    // Two different mapping rules for THE SAME source label land on the same canonical cell
    // with two different reported values (the exact "radically different margins" defect from
    // the CD Projekt 2025 audit finding) -> first occurrence MAPPED, second DUPLICATE, and the
    // gap between them is large relative to source -> must be EXCEEDS_MATERIALITY, never silently CLEAN.
    const totals = computeWaterfall([
      row({ bucket: 'MAPPED', sourceAmount: 500_000, mappedAmount: 500_000 }), // e.g. "Operating profit" -> EBIT
      row({ bucket: 'DUPLICATE', sourceAmount: 620_000 }), // e.g. "EBIT (reported)" -> same EBIT cell, different value
    ]);
    expect(determineReconciliationStatus(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT)).toBe('EXCEEDS_MATERIALITY');
    expect(totals.residual).toBe(620_000);
  });

  it('EXCEEDS_MATERIALITY when sourceTotal is 0 but residual is not (residualPct undefined is never treated as passing)', () => {
    const totals = computeWaterfall([
      row({ bucket: 'MAPPED', sourceAmount: 100, mappedAmount: 100 }),
      row({ bucket: 'DUPLICATE', sourceAmount: -100 }),
    ]);
    expect(determineReconciliationStatus(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT)).toBe('EXCEEDS_MATERIALITY');
  });
});

// ---------------------------------------------------------------------------
// BUGFIX RC-01 — coverage
// ---------------------------------------------------------------------------

describe('computeWaterfall coverage metrics (RC-01)', () => {
  it('counts rows and absolute source value on both sides of the canonical boundary', () => {
    const totals = computeWaterfall([
      row({ bucket: 'MAPPED', sourceAmount: 600, mappedAmount: 600 }),
      row({ bucket: 'RECLASS', sourceAmount: 100, mappedAmount: 100 }),
      row({ bucket: 'UNMAPPED', sourceAmount: 300 }),
      row({ bucket: 'EXCLUDED', sourceAmount: 50 }), // analyst decision, not coverage loss
    ]);
    const c = totals.coverage;
    expect(c.totalRowCount).toBe(4);
    expect(c.mappedRowCount).toBe(2);
    expect(c.unmappedRowCount).toBe(1);
    expect(c.excludedRowCount).toBe(1);
    expect(c.coverageLossRowCount).toBe(1);
    expect(c.absSourceTotal).toBe(1050);
    expect(c.absCoveredTotal).toBe(700);
    expect(c.absCoverageLossTotal).toBe(300);
    expect(c.sourceValueCoveragePct).toBeCloseTo(700 / 1050, 10);
    expect(c.coverageLossSharePct).toBeCloseTo(300 / 1050, 10);
  });

  it('uses ABSOLUTE magnitudes so a contra line cannot cancel a lost line into "nothing missing"', () => {
    const totals = computeWaterfall([
      row({ bucket: 'MAPPED', sourceAmount: 500, mappedAmount: 500 }),
      row({ bucket: 'UNMAPPED', sourceAmount: -500 }),
    ]);
    // Signed source total is 0 here — the old, signed-only view would have had nothing to say.
    expect(totals.sourceTotal).toBe(0);
    expect(totals.coverage.absSourceTotal).toBe(1000);
    expect(totals.coverage.coverageLossSharePct).toBeCloseTo(0.5, 10);
  });

  it('falls back to the ROW share when every source value is 0 (a zero-valued line still needs a taxonomy slot)', () => {
    const totals = computeWaterfall([
      row({ bucket: 'MAPPED', sourceAmount: 0, mappedAmount: 0 }),
      row({ bucket: 'UNMAPPED', sourceAmount: 0 }),
    ]);
    expect(totals.coverage.sourceValueCoveragePct).toBeNull(); // undefined, NOT 100%
    expect(totals.coverage.coverageLossSharePct).toBe(0.5);
  });

  it('an EXCLUDED row flagged coverageLoss (taxonomy gap) counts as loss; a plain EXCLUDED row does not', () => {
    const taxonomyGap = computeWaterfall([
      row({ bucket: 'MAPPED', sourceAmount: 100, mappedAmount: 100 }),
      row({ bucket: 'EXCLUDED', sourceAmount: 900, coverageLoss: true }),
    ]);
    expect(taxonomyGap.coverage.coverageLossRowCount).toBe(1);
    expect(taxonomyGap.coverage.coverageLossSharePct).toBeCloseTo(0.9, 10);

    const analystDecision = computeWaterfall([
      row({ bucket: 'MAPPED', sourceAmount: 100, mappedAmount: 100 }),
      row({ bucket: 'EXCLUDED', sourceAmount: 900 }),
    ]);
    expect(analystDecision.coverage.coverageLossRowCount).toBe(0);
    expect(analystDecision.coverage.coverageLossSharePct).toBe(0);
  });

  it('a DUPLICATE is a conflict, not a coverage gap — the value IS in the canonical model', () => {
    const totals = computeWaterfall([
      row({ bucket: 'MAPPED', sourceAmount: 500, mappedAmount: 500 }),
      row({ bucket: 'DUPLICATE', sourceAmount: 620 }),
    ]);
    expect(totals.coverage.coverageLossRowCount).toBe(0);
    expect(totals.residual).toBe(620); // still caught, on the residual axis where it belongs
  });
});

describe('determineReconciliationStatus / determineResultQuality with coverage loss (RC-01)', () => {
  /** The real Apator PASS A proportion: 212 of 280 line-values with no P0 canonical target. */
  const apatorShape = () =>
    computeWaterfall([
      ...Array.from({ length: 68 }, () => row({ bucket: 'MAPPED', sourceAmount: 1_000, mappedAmount: 1_000 })),
      ...Array.from({ length: 212 }, () => row({ bucket: 'EXCLUDED', sourceAmount: 1_000, coverageLoss: true })),
    ]);

  it('THE BUG: residual is exactly 0 yet three quarters of the source never arrived — this must not read CLEAN', () => {
    const totals = apatorShape();
    expect(totals.residual).toBe(0);
    expect(determineResidualStatus(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT)).toBe('CLEAN'); // the old answer
    expect(determineReconciliationStatus(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT)).not.toBe('CLEAN');
    expect(determineReconciliationStatus(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT)).toBe('WITHIN_TOLERANCE');
    expect(determineResultQuality(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT)).toBe('PROVISIONAL');
  });

  it('coverage loss never escalates to EXCEEDS_MATERIALITY on its own — DEC-FIN-009 marks, it does not block the readiness gate', () => {
    const totals = apatorShape();
    expect(determineReconciliationStatus(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT)).not.toBe('EXCEEDS_MATERIALITY');
  });

  it('a single immaterial lost row still forbids CLEAN, but only reaches CONDITIONAL', () => {
    const totals = computeWaterfall([
      ...Array.from({ length: 99 }, () => row({ bucket: 'MAPPED', sourceAmount: 10_000, mappedAmount: 10_000 })),
      row({ bucket: 'UNMAPPED', sourceAmount: 1 }), // ~0.0001% of source value
    ]);
    expect(determineReconciliationStatus(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT)).toBe('WITHIN_TOLERANCE');
    expect(determineResultQuality(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT)).toBe('CONDITIONAL');
  });

  it('perfect coverage and zero residual is still CLEAN on both axes (no over-firing)', () => {
    const totals = computeWaterfall([
      row({ bucket: 'MAPPED', sourceAmount: 1_000, mappedAmount: 1_000 }),
      row({ bucket: 'EXCLUDED', sourceAmount: 50 }),
    ]);
    expect(determineReconciliationStatus(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT)).toBe('CLEAN');
    expect(determineResultQuality(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT)).toBe('CLEAN');
  });

  it('an over-threshold residual is PROVISIONAL even with perfect coverage (the CD Projekt shape)', () => {
    const totals = computeWaterfall([
      row({ bucket: 'MAPPED', sourceAmount: 500_000, mappedAmount: 500_000 }),
      row({ bucket: 'DUPLICATE', sourceAmount: 620_000 }),
    ]);
    expect(determineResultQuality(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT)).toBe('PROVISIONAL');
  });

  it('a period-jump warning alone marks the pack CONDITIONAL, never PROVISIONAL', () => {
    const totals = computeWaterfall([row({ bucket: 'MAPPED', sourceAmount: 1_000, mappedAmount: 1_000 })]);
    expect(determineResultQuality(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT, 0)).toBe('CLEAN');
    expect(determineResultQuality(totals, PROVISIONAL_MATERIALITY_THRESHOLD_PCT, 3)).toBe('CONDITIONAL');
  });
});

// ---------------------------------------------------------------------------
// BUGFIX RC-05 — period-over-period plausibility
// ---------------------------------------------------------------------------

describe('detectPeriodOverPeriodJumps (RC-05)', () => {
  function obs(overrides: Partial<PeriodObservation>): PeriodObservation {
    return {
      entityId: 'entity-1',
      canonicalLineId: 'fsl-bs-ap',
      lineCode: 'AP',
      statementType: 'BS',
      consolidationScope: 'CONSOLIDATED',
      accumulationBasis: 'FULL_YEAR',
      periodId: 'p',
      periodLabel: 'FY',
      periodEnd: '2024-12-31',
      value: 0,
      ...overrides,
    };
  }

  /** Total assets carry the materiality anchor; they are also the "normal" control series. */
  const apatorTotalAssets = [
    obs({ canonicalLineId: 'fsl-bs-total-assets', lineCode: 'TOTAL_ASSETS', periodId: 'p2023', periodLabel: 'FY2023', periodEnd: '2023-12-31', value: 1_408_419 }),
    obs({ canonicalLineId: 'fsl-bs-total-assets', lineCode: 'TOTAL_ASSETS', periodId: 'p2024', periodLabel: 'FY2024', periodEnd: '2024-12-31', value: 1_337_264 }),
  ];

  it('THE BUG: Apator trade payables 93 591 -> 722 (-99.2%) is reported, with both periods and the % change', () => {
    const findings = detectPeriodOverPeriodJumps([
      ...apatorTotalAssets,
      obs({ periodId: 'p2023', periodLabel: 'FY2023', periodEnd: '2023-12-31', value: 93_591 }),
      obs({ periodId: 'p2024', periodLabel: 'FY2024', periodEnd: '2024-12-31', value: 722 }),
    ]);
    const ap = findings.find((f) => f.lineCode === 'AP');
    expect(ap).toBeDefined();
    expect(ap!.priorPeriodLabel).toBe('FY2023');
    expect(ap!.currentPeriodLabel).toBe('FY2024');
    expect(ap!.priorValue).toBe(93_591);
    expect(ap!.currentValue).toBe(722);
    expect(ap!.direction).toBe('COLLAPSE');
    expect(ap!.absChangePct).toBeCloseTo(0.99228, 4);
    expect(ap!.description).toContain('FY2023');
    expect(ap!.description).toContain('FY2024');
  });

  it('walks the FULL chain: the FY2022 -> FY2023 leg (121 894 -> 93 591, -23%) stays silent, only the FY2024 leg fires', () => {
    const findings = detectPeriodOverPeriodJumps([
      ...apatorTotalAssets,
      obs({ periodId: 'p2022', periodLabel: 'FY2022', periodEnd: '2022-12-31', value: 121_894 }),
      obs({ periodId: 'p2023', periodLabel: 'FY2023', periodEnd: '2023-12-31', value: 93_591 }),
      obs({ periodId: 'p2024', periodLabel: 'FY2024', periodEnd: '2024-12-31', value: 722 }),
    ]);
    const apFindings = findings.filter((f) => f.lineCode === 'AP');
    expect(apFindings).toHaveLength(1);
    expect(apFindings[0].priorPeriodLabel).toBe('FY2023');
  });

  it('does not fire on total assets moving -5% year over year (no false positive on the anchor itself)', () => {
    const findings = detectPeriodOverPeriodJumps(apatorTotalAssets);
    expect(findings).toHaveLength(0);
  });

  it('an immaterial line may swing freely — 3 -> 300 (+9 900%) on a 1.4bn pack is noise, not a finding', () => {
    const findings = detectPeriodOverPeriodJumps([
      ...apatorTotalAssets,
      obs({ canonicalLineId: 'tiny', lineCode: 'TINY', periodId: 'p2023', periodLabel: 'FY2023', periodEnd: '2023-12-31', value: 3 }),
      obs({ canonicalLineId: 'tiny', lineCode: 'TINY', periodId: 'p2024', periodLabel: 'FY2024', periodEnd: '2024-12-31', value: 300 }),
    ]);
    expect(findings).toHaveLength(0);
  });

  it('a material SPIKE is caught too, not only a collapse', () => {
    const findings = detectPeriodOverPeriodJumps([
      ...apatorTotalAssets,
      obs({ periodId: 'p2023', periodLabel: 'FY2023', periodEnd: '2023-12-31', value: 50_000 }),
      obs({ periodId: 'p2024', periodLabel: 'FY2024', periodEnd: '2024-12-31', value: 200_000 }),
    ]);
    const ap = findings.find((f) => f.lineCode === 'AP');
    expect(ap?.direction).toBe('SPIKE');
    expect(ap?.changePct).toBeCloseTo(3, 10);
  });

  it('a MISSING period is skipped, never read as a 100% collapse (that is RC-06, a different finding)', () => {
    const findings = detectPeriodOverPeriodJumps([
      ...apatorTotalAssets,
      obs({ periodId: 'p2023', periodLabel: 'FY2023', periodEnd: '2023-12-31', value: 93_591 }),
      obs({ periodId: 'p2024', periodLabel: 'FY2024', periodEnd: '2024-12-31', value: null }),
    ]);
    expect(findings.filter((f) => f.lineCode === 'AP')).toHaveLength(0);
  });

  it('a prior value of exactly 0 is skipped — the relative change is undefined, and a new line is ordinary', () => {
    const findings = detectPeriodOverPeriodJumps([
      ...apatorTotalAssets,
      obs({ periodId: 'p2023', periodLabel: 'FY2023', periodEnd: '2023-12-31', value: 0 }),
      obs({ periodId: 'p2024', periodLabel: 'FY2024', periodEnd: '2024-12-31', value: 90_000 }),
    ]);
    expect(findings.filter((f) => f.lineCode === 'AP')).toHaveLength(0);
  });

  it('series are keyed per entity/line/scope/basis — two entities never bleed into one another', () => {
    const findings = detectPeriodOverPeriodJumps([
      ...apatorTotalAssets,
      obs({ entityId: 'e1', periodId: 'p2023', periodLabel: 'FY2023', periodEnd: '2023-12-31', value: 93_591 }),
      obs({ entityId: 'e2', periodId: 'p2024', periodLabel: 'FY2024', periodEnd: '2024-12-31', value: 722 }),
    ]);
    expect(findings.filter((f) => f.lineCode === 'AP')).toHaveLength(0);
  });

  it('order of input does not matter — the series is sorted by period end, not by arrival', () => {
    const forwards = detectPeriodOverPeriodJumps([
      ...apatorTotalAssets,
      obs({ periodId: 'p2023', periodLabel: 'FY2023', periodEnd: '2023-12-31', value: 93_591 }),
      obs({ periodId: 'p2024', periodLabel: 'FY2024', periodEnd: '2024-12-31', value: 722 }),
    ]);
    const backwards = detectPeriodOverPeriodJumps([
      obs({ periodId: 'p2024', periodLabel: 'FY2024', periodEnd: '2024-12-31', value: 722 }),
      obs({ periodId: 'p2023', periodLabel: 'FY2023', periodEnd: '2023-12-31', value: 93_591 }),
      ...apatorTotalAssets,
    ]);
    expect(backwards.filter((f) => f.lineCode === 'AP')).toEqual(forwards.filter((f) => f.lineCode === 'AP'));
  });

  it('thresholds are the documented ones and are overridable per call', () => {
    expect(PERIOD_JUMP_RELATIVE_THRESHOLD_PCT).toBe(0.8);
    expect(PERIOD_JUMP_MATERIALITY_ANCHOR_PCT).toBe(0.01);

    const series = [
      ...apatorTotalAssets,
      obs({ periodId: 'p2023', periodLabel: 'FY2023', periodEnd: '2023-12-31', value: 100_000 }),
      obs({ periodId: 'p2024', periodLabel: 'FY2024', periodEnd: '2024-12-31', value: 60_000 }), // -40%
    ];
    expect(detectPeriodOverPeriodJumps(series).filter((f) => f.lineCode === 'AP')).toHaveLength(0);
    expect(detectPeriodOverPeriodJumps(series, { relativeThresholdPct: 0.3 }).filter((f) => f.lineCode === 'AP')).toHaveLength(1);
  });

  it('is unit-agnostic: the same statement filed in UNITS instead of THOUSANDS yields the same findings', () => {
    const thousands = detectPeriodOverPeriodJumps([
      ...apatorTotalAssets,
      obs({ periodId: 'p2023', periodLabel: 'FY2023', periodEnd: '2023-12-31', value: 93_591 }),
      obs({ periodId: 'p2024', periodLabel: 'FY2024', periodEnd: '2024-12-31', value: 722 }),
    ]);
    const units = detectPeriodOverPeriodJumps([
      obs({ canonicalLineId: 'fsl-bs-total-assets', lineCode: 'TOTAL_ASSETS', periodId: 'p2023', periodLabel: 'FY2023', periodEnd: '2023-12-31', value: 1_408_419_000 }),
      obs({ canonicalLineId: 'fsl-bs-total-assets', lineCode: 'TOTAL_ASSETS', periodId: 'p2024', periodLabel: 'FY2024', periodEnd: '2024-12-31', value: 1_337_264_000 }),
      obs({ periodId: 'p2023', periodLabel: 'FY2023', periodEnd: '2023-12-31', value: 93_591_000 }),
      obs({ periodId: 'p2024', periodLabel: 'FY2024', periodEnd: '2024-12-31', value: 722_000 }),
    ]);
    expect(units.filter((f) => f.lineCode === 'AP')).toHaveLength(1);
    expect(units.find((f) => f.lineCode === 'AP')!.absChangePct).toBeCloseTo(
      thousands.find((f) => f.lineCode === 'AP')!.absChangePct,
      10
    );
  });

  it('an empty or all-zero pack produces no findings and never divides by zero', () => {
    expect(detectPeriodOverPeriodJumps([])).toEqual([]);
    expect(
      detectPeriodOverPeriodJumps([
        obs({ periodId: 'p2023', periodEnd: '2023-12-31', value: 0 }),
        obs({ periodId: 'p2024', periodEnd: '2024-12-31', value: 0 }),
      ])
    ).toEqual([]);
  });
});

describe('severityForResidual', () => {
  it('scales WARNING -> MATERIAL -> CRITICAL_DATA as the residual grows relative to the threshold, never SECURITY', () => {
    expect(severityForResidual(0.06, 0.05)).toBe('WARNING'); // 1.2x threshold
    expect(severityForResidual(0.1, 0.05)).toBe('WARNING'); // 2x threshold (boundary, inclusive)
    expect(severityForResidual(0.15, 0.05)).toBe('MATERIAL'); // 3x threshold
    expect(severityForResidual(0.25, 0.05)).toBe('MATERIAL'); // 5x threshold (boundary, inclusive)
    expect(severityForResidual(0.3, 0.05)).toBe('CRITICAL_DATA'); // 6x threshold
    expect(severityForResidual(null, 0.05)).toBe('CRITICAL_DATA'); // undefined % is treated as the worst case
  });
});
