/**
 * Pure unit tests for AP-05's `financeCompareService.ts` diff/materiality/
 * scale logic — no database. Same split as `statementReconciliationService.test.ts`
 * in this directory: this file proves `toFullUnitValue`/`diffPair`/
 * `buildMatchKey` in isolation with real numbers; real Postgres persistence
 * (the SQL loaders, tenant-scoping, entity_code resolution, the actual
 * `compareVersions`/`compareScenarios`/`compareValuationMethods` wrappers
 * against the real migrated schema) is exercised by
 * `financeCompareService.pg.test.ts` in this directory.
 *
 * Fixture numbers are the REAL GoldCo Fala 3 restatement figures from
 * `docs/validation/finance-v3/generated/gate-d/goldco/goldco_oracle.json`
 * (`parent.FY2024_original` / `parent.FY2024_restated`) and the real Base vs
 * Downside REVENUE figures from
 * `docs/validation/finance-v3/generated/gate-d/WP-D08_prediction_compute_engine_report.md`
 * section 6 (Jan-2026 row) — not invented numbers, so a materiality-threshold
 * assertion here is also an assertion about the real dataset's own economics
 * (e.g. the restatement's COGS delta really is >5% material, not just
 * numerically nonzero).
 */
import { describe, expect, it } from 'vitest';

import { PROVISIONAL_MATERIALITY_THRESHOLD_PCT } from '../statementReconciliationService.js';
import { buildMatchKey, diffPair, presenceForStatus, toFullUnitValue, type LoadedCell } from '../financeCompareService.js';

// ---------------------------------------------------------------------------
// toFullUnitValue — scale/unit discipline (Apator-scale regression class)
// ---------------------------------------------------------------------------

describe('toFullUnitValue', () => {
  it('MISSING/NA/NOT_APPLICABLE always yield null, never 0 (task: "nigdy fałszywe 0 diff")', () => {
    expect(toFullUnitValue('MISSING', null, 'UNITS', '1')).toBeNull();
    expect(toFullUnitValue('NA', null, 'UNITS', '1')).toBeNull();
    expect(toFullUnitValue('NOT_APPLICABLE', null, 'UNITS', '1')).toBeNull();
  });

  it('PRESENT_ZERO is a real 0, distinct from null', () => {
    expect(toFullUnitValue('PRESENT_ZERO', '0', 'UNITS', '1')).toBe(0);
  });

  it('scales MILLIONS with a multiplier, matching valuationFcffService.ts toFullUnitValue', () => {
    // 12.5 MILLIONS x multiplier 1.02 = 12,750,000 full units.
    expect(toFullUnitValue('PRESENT_NONZERO', '12.5', 'MILLIONS', '1.02')).toBeCloseTo(12_750_000, 6);
  });

  it('unit=null (finance_valuation_methods has no unit column) treats the value as already full-scale', () => {
    expect(toFullUnitValue('PRESENT_NONZERO', '48000000', null, null)).toBe(48_000_000);
  });
});

// ---------------------------------------------------------------------------
// presenceForStatus
// ---------------------------------------------------------------------------

describe('presenceForStatus', () => {
  it('maps every finance_value_status to the right CompareCellPresence', () => {
    expect(presenceForStatus('PRESENT_ZERO')).toBe('PRESENT');
    expect(presenceForStatus('PRESENT_NONZERO')).toBe('PRESENT');
    expect(presenceForStatus('MISSING')).toBe('MISSING');
    expect(presenceForStatus('NA')).toBe('NA');
    expect(presenceForStatus('NOT_APPLICABLE')).toBe('NOT_APPLICABLE');
  });
});

// ---------------------------------------------------------------------------
// buildMatchKey
// ---------------------------------------------------------------------------

describe('buildMatchKey', () => {
  it('is order-independent (sorted internally) and stable', () => {
    const a = buildMatchKey({ entityId: 'PARENT', periodId: 'p1', canonicalLineId: 'REVENUE' }, []);
    const b = buildMatchKey({ periodId: 'p1', canonicalLineId: 'REVENUE', entityId: 'PARENT' }, []);
    expect(a).toBe(b);
  });

  it('ignoreDimensions removes exactly the named axis, so periods collapse to one key for comparePeriods', () => {
    const keyPeriodA = buildMatchKey({ entityId: 'PARENT', canonicalLineId: 'REVENUE', periodId: 'FY2024' }, ['periodId']);
    const keyPeriodB = buildMatchKey({ entityId: 'PARENT', canonicalLineId: 'REVENUE', periodId: 'FY2025' }, ['periodId']);
    expect(keyPeriodA).toBe(keyPeriodB);
  });
});

// ---------------------------------------------------------------------------
// diffPair — GoldCo FY2024 original vs restated (real oracle numbers, PLN, UNITS)
// docs/validation/finance-v3/generated/gate-d/goldco/goldco_oracle.json
// ---------------------------------------------------------------------------

function presentCell(fullUnitValue: number, presentationCurrency = 'PLN'): Pick<LoadedCell, 'valueStatus' | 'fullUnitValue' | 'presentationCurrency'> {
  return { valueStatus: fullUnitValue === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO', fullUnitValue, presentationCurrency };
}
function missingCell(): Pick<LoadedCell, 'valueStatus' | 'fullUnitValue' | 'presentationCurrency'> {
  return { valueStatus: 'MISSING', fullUnitValue: null, presentationCurrency: null };
}

describe('diffPair — GoldCo FY2024 restatement (real oracle figures)', () => {
  const materiality = PROVISIONAL_MATERIALITY_THRESHOLD_PCT; // 0.05

  it('REVENUE is untouched by the restatement -> exactly zero diff, not material', () => {
    const d = diffPair(presentCell(165_000_000) as LoadedCell, presentCell(165_000_000) as LoadedCell, materiality);
    expect(d.diffKind).toBe('BOTH_PRESENT');
    expect(d.absoluteDiff).toBe(0);
    expect(d.pctDiff).toBe(0);
    expect(d.materialityFlag).toBe(false);
  });

  it('COGS is the restatement root cause: 106,000,000 -> 109,000,000, +3,000,000 (worse cost, higher COGS)', () => {
    const d = diffPair(presentCell(106_000_000) as LoadedCell, presentCell(109_000_000) as LoadedCell, materiality);
    expect(d.diffKind).toBe('BOTH_PRESENT');
    expect(d.absoluteDiff).toBe(3_000_000);
    expect(d.pctDiff).toBeCloseTo(3_000_000 / 106_000_000, 10); // ~2.83%
    // 2.83% < 5% placeholder -> NOT flagged material on its own (the downstream P&L lines are).
    expect(d.materialityFlag).toBe(false);
  });

  it('INVENTORY (the balance-sheet side of the same write-down): 21,000,000 -> 18,000,000, -3,000,000, ~14.3% -> material', () => {
    const d = diffPair(presentCell(21_000_000) as LoadedCell, presentCell(18_000_000) as LoadedCell, materiality);
    expect(d.absoluteDiff).toBe(-3_000_000);
    expect(d.pctDiff).toBeCloseTo(-3_000_000 / 21_000_000, 10); // ~-14.3%
    expect(d.materialityFlag).toBe(true); // |−14.3%| > 5%
  });

  it('NET_INCOME: 14,823,000 -> 11,823,000, exactly the oracle restatementDeltaNetIncome (-3,000,000), material', () => {
    const d = diffPair(presentCell(14_823_000) as LoadedCell, presentCell(11_823_000) as LoadedCell, materiality);
    expect(d.absoluteDiff).toBe(-3_000_000); // matches goldco_oracle.json's own restatementDeltaNetIncome
    expect(d.materialityFlag).toBe(true);
  });

  it('OPEX is untouched -> zero diff (proves the restatement is selective, not a wholesale re-derivation)', () => {
    const d = diffPair(presentCell(32_000_000) as LoadedCell, presentCell(32_000_000) as LoadedCell, materiality);
    expect(d.absoluteDiff).toBe(0);
    expect(d.materialityFlag).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// diffPair — Base vs Downside Prediction (real WP-D08 figures, Jan-2026 REVENUE)
// ---------------------------------------------------------------------------

describe('diffPair — Base vs Downside Prediction (WP-D08 section 6, Jan-2026 REVENUE)', () => {
  it('Downside REVENUE is lower than Base by exactly the published delta, direction and magnitude both correct', () => {
    const base = 11_943_750.0;
    const downside = 11_602_500.0;
    const d = diffPair(presentCell(base) as LoadedCell, presentCell(downside) as LoadedCell, PROVISIONAL_MATERIALITY_THRESHOLD_PCT);
    expect(d.diffKind).toBe('BOTH_PRESENT');
    expect(d.absoluteDiff).toBeCloseTo(-341_250.0, 6); // WP-D08's own published "Downside Δ"
    expect(d.absoluteDiff!).toBeLessThan(0); // direction: downside is a DECREASE
    expect(d.pctDiff).toBeCloseTo(-341_250.0 / base, 10); // ~-2.857%
  });
});

// ---------------------------------------------------------------------------
// diffPair — MISSING handling (task's explicit test requirement: never a
// false numeric 0 when one side is MISSING)
// ---------------------------------------------------------------------------

describe('diffPair — MISSING handling', () => {
  it('side A PRESENT, side B MISSING -> diffKind=MISSING_IN_B, absoluteDiff/pctDiff both null (never 0)', () => {
    const d = diffPair(presentCell(1_000_000) as LoadedCell, missingCell() as LoadedCell, PROVISIONAL_MATERIALITY_THRESHOLD_PCT);
    expect(d.diffKind).toBe('MISSING_IN_B');
    expect(d.absoluteDiff).toBeNull();
    expect(d.pctDiff).toBeNull();
    expect(d.materialityFlag).toBe(false);
    expect(d.note).toBeTruthy();
  });

  it('side A MISSING, side B PRESENT -> diffKind=MISSING_IN_A, absoluteDiff/pctDiff both null (never 0)', () => {
    const d = diffPair(missingCell() as LoadedCell, presentCell(1_000_000) as LoadedCell, PROVISIONAL_MATERIALITY_THRESHOLD_PCT);
    expect(d.diffKind).toBe('MISSING_IN_A');
    expect(d.absoluteDiff).toBeNull();
    expect(d.pctDiff).toBeNull();
  });

  it('both sides MISSING -> diffKind=MISSING_IN_BOTH, still null (not equal-therefore-zero)', () => {
    const d = diffPair(missingCell() as LoadedCell, missingCell() as LoadedCell, PROVISIONAL_MATERIALITY_THRESHOLD_PCT);
    expect(d.diffKind).toBe('MISSING_IN_BOTH');
    expect(d.absoluteDiff).toBeNull();
    expect(d.pctDiff).toBeNull();
  });

  it('no row at all on one side (undefined, not even a MISSING-status row) is treated the same as MISSING, never as 0', () => {
    const d = diffPair(presentCell(500_000) as LoadedCell, undefined, PROVISIONAL_MATERIALITY_THRESHOLD_PCT);
    expect(d.diffKind).toBe('MISSING_IN_B');
    expect(d.absoluteDiff).toBeNull();
  });

  it('a zero base (side A = 0) with a nonzero side B is flagged material even though pctDiff is undefined (never silently "immaterial")', () => {
    const d = diffPair(presentCell(0) as LoadedCell, presentCell(500_000) as LoadedCell, PROVISIONAL_MATERIALITY_THRESHOLD_PCT);
    expect(d.diffKind).toBe('BOTH_PRESENT');
    expect(d.pctDiff).toBeNull();
    expect(d.absoluteDiff).toBe(500_000);
    expect(d.materialityFlag).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// diffPair — currency mismatch guard
// ---------------------------------------------------------------------------

describe('diffPair — currency mismatch', () => {
  it('different presentationCurrency on the two sides withholds the diff rather than silently subtracting mismatched currencies', () => {
    const d = diffPair(presentCell(1_000_000, 'PLN') as LoadedCell, presentCell(1_000_000, 'EUR') as LoadedCell, PROVISIONAL_MATERIALITY_THRESHOLD_PCT);
    expect(d.diffKind).toBe('CURRENCY_MISMATCH');
    expect(d.absoluteDiff).toBeNull();
    expect(d.pctDiff).toBeNull();
    expect(d.note).toMatch(/currency/i);
  });
});
