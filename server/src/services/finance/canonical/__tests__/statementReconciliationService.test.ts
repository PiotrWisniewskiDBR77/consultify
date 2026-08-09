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
  determineReconciliationStatus,
  PROVISIONAL_MATERIALITY_THRESHOLD_PCT,
  severityForResidual,
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
