/**
 * `valuationMath` — unit tests + KONTROLE NEGATYWNE (Pakiet H).
 *
 * Every gate below has: (1) a passing case, (2) a failing case, (3) a negative control proving
 * the test itself can go red (mutate the "good" input into the "bad" shape and assert it now
 * fails), per CLAUDE.md's "kontrola negatywna obowiązkowa dla każdego testu bramkującego".
 */
import { describe, expect, it } from 'vitest';

import type { ValuationAdvisorFindingGeneratedDto, ValuationAdvisorFindingStoredDto, ValuationSensitivityCellDto } from '@/services/api/financeV2.types';

import {
  assertGBelowWacc,
  assertSensitivityGridIntegrity,
  assertSensitivityGridShape,
  assertWaccConsistency,
  computeMethodResultRange,
  evaluateGConsistency,
  findSensitivityMonotonicityViolation,
  groupAdvisorFindingsByKind,
  impliedGFromReinvestmentRoic,
  normalizeAdvisorFinding,
  validateBasketWeights,
  validateBasketWeightsFromMethods,
} from '../valuationMath';

// =============================================================================================
// g < WACC
// =============================================================================================

describe('assertGBelowWacc', () => {
  it('accepts g strictly below WACC', () => {
    expect(assertGBelowWacc(2, 9)).toEqual({ ok: true });
  });

  it('rejects g == WACC (boundary, not just g > WACC)', () => {
    const result = assertGBelowWacc(9, 9);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('G_MUST_BE_LESS_THAN_WACC');
  });

  it('rejects g > WACC', () => {
    const result = assertGBelowWacc(12, 9);
    expect(result.ok).toBe(false);
  });

  it('rejects non-finite input rather than silently passing', () => {
    expect(assertGBelowWacc(NaN, 9).ok).toBe(false);
    expect(assertGBelowWacc(2, Infinity).ok).toBe(false);
  });

  it('KONTROLA NEGATYWNA: a case that must fail (g=WACC) does fail — proves this test can go red', () => {
    // If someone weakened assertGBelowWacc to `g > waccPct` (allowing equality), this specific
    // assertion is the one that would start passing when it shouldn't.
    expect(assertGBelowWacc(9, 9).ok).not.toBe(true);
  });
});

// =============================================================================================
// g = reinvestment × ROIC consistency
// =============================================================================================

describe('impliedGFromReinvestmentRoic / evaluateGConsistency', () => {
  it('computes the implied g identity correctly', () => {
    // 40% reinvestment * 10% ROIC = 4% implied g.
    expect(impliedGFromReinvestmentRoic(40, 10)).toBeCloseTo(4, 10);
  });

  it('flags consistency when g matches the implied value within tolerance', () => {
    const result = evaluateGConsistency(4, 40, 10, 1);
    expect(result.inputsMissing).toBe(false);
    expect(result.impliedGPct).toBeCloseTo(4, 10);
    expect(result.consistent).toBe(true);
  });

  it('flags inconsistency when g diverges from the implied value beyond tolerance', () => {
    const result = evaluateGConsistency(8, 40, 10, 1); // implied 4%, actual 8% => 4pp gap > 1pp tolerance
    expect(result.consistent).toBe(false);
    expect(result.gapPp).toBeCloseTo(4, 10);
  });

  it('never reports "consistent" when an input is missing — missing is its own state, not a silent match', () => {
    const result = evaluateGConsistency(4, null, 10, 1);
    expect(result.inputsMissing).toBe(true);
    expect(result.consistent).toBe(false);
    expect(result.impliedGPct).toBeNull();
  });

  it('KONTROLA NEGATYWNA: a 4pp gap outside a 1pp tolerance must NOT be reported consistent', () => {
    const result = evaluateGConsistency(8, 40, 10, 1);
    expect(result.consistent).not.toBe(true);
  });
});

// =============================================================================================
// Nominal/real + pre/post-tax + currency consistency (coordinator correction)
// =============================================================================================

describe('assertWaccConsistency', () => {
  const nominalPostTaxPln = { nominalOrReal: 'NOMINAL' as const, preOrPostTax: 'POST_TAX' as const, currency: 'PLN' };

  it('accepts NOMINAL/POST_TAX WACC matching the FCFF currency', () => {
    expect(assertWaccConsistency(nominalPostTaxPln, 'PLN')).toEqual({ ok: true });
  });

  it('rejects REAL WACC against this engine\'s always-NOMINAL FCFF (the classic nominal/real mixing error)', () => {
    const result = assertWaccConsistency({ ...nominalPostTaxPln, nominalOrReal: 'REAL' }, 'PLN');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNSUPPORTED_NOMINAL_REAL_CONVENTION');
  });

  it('rejects PRE_TAX WACC against the always-POST_TAX FCFF', () => {
    const result = assertWaccConsistency({ ...nominalPostTaxPln, preOrPostTax: 'PRE_TAX' }, 'PLN');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNSUPPORTED_PRE_POST_TAX_CONVENTION');
  });

  it('rejects a currency mismatch between WACC and FCFF', () => {
    const result = assertWaccConsistency(nominalPostTaxPln, 'EUR');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CURRENCY_MISMATCH');
  });

  it('KONTROLA NEGATYWNA: REAL/PLN WACC against NOMINAL/PLN FCFF must not silently pass just because currency matches', () => {
    const result = assertWaccConsistency({ ...nominalPostTaxPln, nominalOrReal: 'REAL' }, 'PLN');
    expect(result.ok).not.toBe(true);
  });
});

// =============================================================================================
// Sensitivity monotonicity (coordinator correction — WP-D05: "25 komórek MONOTONIC")
// =============================================================================================

/** A monotonic 5x5: EV falls as WACC (col) rises, EV rises as g (row) rises. Base cell = center. */
function makeMonotonicCells() {
  const cells: { rowIndex: number; colIndex: number; rowAxisValue: number; columnAxisValue: number; cellValueDecimal: number | null; isBaseCell: boolean }[] = [];
  for (let r = 1; r <= 5; r++) {
    for (let c = 1; c <= 5; c++) {
      // EV increases with row (g), decreases with col (WACC) — strictly monotonic synthetic surface.
      const value = 1000 + r * 50 - c * 30;
      cells.push({ rowIndex: r, colIndex: c, rowAxisValue: r, columnAxisValue: c, cellValueDecimal: value, isBaseCell: r === 3 && c === 3 });
    }
  }
  return cells;
}

describe('findSensitivityMonotonicityViolation', () => {
  it('reports no violation for a monotonic grid (EV falls as WACC rises, rises as g rises)', () => {
    expect(findSensitivityMonotonicityViolation(makeMonotonicCells())).toBeNull();
  });

  it('detects a row-wise violation (EV rises with WACC, holding g fixed — physically wrong)', () => {
    const cells = makeMonotonicCells();
    // Break row 1: make col 5 (highest WACC) have a HIGHER EV than col 1 (lowest WACC).
    const row1Col1 = cells.find((c) => c.rowIndex === 1 && c.colIndex === 1)!;
    const row1Col5 = cells.find((c) => c.rowIndex === 1 && c.colIndex === 5)!;
    row1Col5.cellValueDecimal = (row1Col1.cellValueDecimal as number) + 500;
    const violation = findSensitivityMonotonicityViolation(cells);
    expect(violation).not.toBeNull();
    expect(violation).toMatch(/wiersz 1/);
  });

  it('detects a column-wise violation (EV falls with g, holding WACC fixed — physically wrong)', () => {
    // Value depends ONLY on row (flat across columns) — row-wise check is trivially satisfied
    // (equal, never increasing), so a broken row-wise check can never mask/coincide with the
    // column-wise violation this test is isolating.
    const cells: { rowIndex: number; colIndex: number; rowAxisValue: number; columnAxisValue: number; cellValueDecimal: number | null; isBaseCell: boolean }[] = [];
    const rowValue = [1000, 1100, 1200, 1300, 1400]; // strictly increasing with row(g) — correct baseline
    for (let r = 1; r <= 5; r++) {
      for (let c = 1; c <= 5; c++) {
        cells.push({ rowIndex: r, colIndex: c, rowAxisValue: r, columnAxisValue: c, cellValueDecimal: rowValue[r - 1], isBaseCell: r === 3 && c === 3 });
      }
    }
    expect(findSensitivityMonotonicityViolation(cells)).toBeNull(); // sanity: baseline is clean

    // Break it: row 5 (highest g) now has a LOWER value than row 4 — EV should never fall as g rises.
    cells.filter((c) => c.rowIndex === 5).forEach((c) => (c.cellValueDecimal = 900));
    const violation = findSensitivityMonotonicityViolation(cells);
    expect(violation).not.toBeNull();
    expect(violation).toMatch(/kolumna/);
  });

  it('skips null (structurally undefined, g>=WACC) cells rather than flagging them as violations', () => {
    const cells = makeMonotonicCells();
    cells.find((c) => c.rowIndex === 5 && c.colIndex === 1)!.cellValueDecimal = null;
    expect(findSensitivityMonotonicityViolation(cells)).toBeNull();
  });

  it('KONTROLA NEGATYWNA: an intentionally-broken grid must be caught, proving the checker is not vacuously green', () => {
    const cells = makeMonotonicCells();
    cells.find((c) => c.rowIndex === 2 && c.colIndex === 2)!.cellValueDecimal = 999999;
    expect(findSensitivityMonotonicityViolation(cells)).not.toBeNull();
  });
});

describe('assertSensitivityGridIntegrity', () => {
  it('combines shape + monotonicity: a well-formed, monotonic grid passes both', () => {
    const result = assertSensitivityGridIntegrity(makeMonotonicCells());
    expect(result.ok).toBe(true);
    expect(result.shape.ok).toBe(true);
    expect(result.monotonicityViolation).toBeNull();
  });

  it('a shape-valid but non-monotonic grid fails overall, even though the shape gate alone would pass', () => {
    const cells = makeMonotonicCells();
    cells.find((c) => c.rowIndex === 2 && c.colIndex === 2)!.cellValueDecimal = 999999;
    const result = assertSensitivityGridIntegrity(cells);
    expect(result.shape.ok).toBe(true);
    expect(result.monotonicityViolation).not.toBeNull();
    expect(result.ok).toBe(false);
  });

  it('skips the monotonicity check when the shape itself is already broken (24 cells) — no point checking monotonicity on a malformed grid', () => {
    const result = assertSensitivityGridIntegrity(makeMonotonicCells().slice(0, 24) as any);
    expect(result.shape.ok).toBe(false);
    expect(result.monotonicityViolation).toBeNull();
    expect(result.ok).toBe(false);
  });
});

// =============================================================================================
// Disagreement analysis / range (coordinator correction — WP-D05: range, not a false single value)
// =============================================================================================

function method(overrides: Partial<{ methodType: string; readiness: string; status: string; valueDecimal: string | null }> = {}) {
  return {
    methodId: overrides.methodType ?? 'm',
    methodType: (overrides.methodType ?? 'DCF_FCFF') as any,
    readiness: (overrides.readiness ?? 'READY') as any,
    result: { status: (overrides.status ?? 'PRESENT_NONZERO') as any, valueDecimal: overrides.valueDecimal === undefined ? '1000' : overrides.valueDecimal },
    isInRecommendationBasket: true,
    weightPct: '50',
  };
}

describe('computeMethodResultRange', () => {
  it('returns min/max/spread across READY, present-valued methods', () => {
    const methods = [
      method({ methodType: 'DCF_FCFF', valueDecimal: '900' }),
      method({ methodType: 'TRADING_COMPS', valueDecimal: '1100' }),
    ];
    const range = computeMethodResultRange(methods as any);
    expect(range.readyCount).toBe(2);
    expect(range.min).toBe(900);
    expect(range.max).toBe(1100);
    expect(range.spreadPct).not.toBeNull();
  });

  it('excludes NA/NOT_APPLICABLE/MISSING/DATA_INCOMPLETE methods — never coerces them into the range as 0', () => {
    const methods = [
      method({ methodType: 'DCF_FCFF', valueDecimal: '1000' }),
      method({ methodType: 'TRADING_COMPS', readiness: 'NOT_CONFIGURED', status: 'NA', valueDecimal: null }),
      method({ methodType: 'ASSET_BASED', readiness: 'DATA_INCOMPLETE', status: 'MISSING', valueDecimal: null }),
    ];
    const range = computeMethodResultRange(methods as any);
    expect(range.readyCount).toBe(1);
    expect(range.min).toBe(1000);
    expect(range.max).toBe(1000);
    // A single ready method has no spread to report (need >=2 points).
    expect(range.spreadPct).toBeNull();
  });

  it('flags material disagreement when spread exceeds the threshold', () => {
    const methods = [method({ methodType: 'DCF_FCFF', valueDecimal: '1000' }), method({ methodType: 'TRADING_COMPS', valueDecimal: '2000' })];
    const range = computeMethodResultRange(methods as any, 20);
    expect(range.hasMaterialDisagreement).toBe(true);
  });

  it('does not flag disagreement for a tight spread under the threshold', () => {
    const methods = [method({ methodType: 'DCF_FCFF', valueDecimal: '1000' }), method({ methodType: 'TRADING_COMPS', valueDecimal: '1030' })];
    const range = computeMethodResultRange(methods as any, 20);
    expect(range.hasMaterialDisagreement).toBe(false);
  });

  it('returns nulls (never a fabricated 0) when zero methods are ready', () => {
    const methods = [method({ readiness: 'NOT_CONFIGURED', status: 'NA', valueDecimal: null })];
    const range = computeMethodResultRange(methods as any);
    expect(range.readyCount).toBe(0);
    expect(range.min).toBeNull();
    expect(range.max).toBeNull();
    expect(range.hasMaterialDisagreement).toBe(false);
  });

  it('KONTROLA NEGATYWNA: a 100% spread must be flagged material under a 20% threshold, proving the check is not always-false', () => {
    const methods = [method({ methodType: 'DCF_FCFF', valueDecimal: '1000' }), method({ methodType: 'TRADING_COMPS', valueDecimal: '2000' })];
    expect(computeMethodResultRange(methods as any, 20).hasMaterialDisagreement).not.toBe(false);
  });
});

// =============================================================================================
// Basket weights sum to 100%
// =============================================================================================

describe('validateBasketWeights', () => {
  it('accepts a basket whose weights sum to exactly 100', () => {
    const result = validateBasketWeights([
      { methodId: 'm1', isInRecommendationBasket: true, weightPct: 60 },
      { methodId: 'm2', isInRecommendationBasket: true, weightPct: 40 },
      { methodId: 'm3', isInRecommendationBasket: false, weightPct: null }, // cross-check, unweighted
    ]);
    expect(result.ok).toBe(true);
    expect(result.basketSumPct).toBe(100);
    expect(result.sumMatches100).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects a basket that sums to 99 (not exactly 100)', () => {
    const result = validateBasketWeights([
      { methodId: 'm1', isInRecommendationBasket: true, weightPct: 60 },
      { methodId: 'm2', isInRecommendationBasket: true, weightPct: 39 },
    ]);
    expect(result.sumMatches100).toBe(false);
    expect(result.ok).toBe(false);
  });

  it('rejects a cross-check carrying a weight (DEC-FIN-005: cross-checks are never weighted)', () => {
    const result = validateBasketWeights([{ methodId: 'm1', isInRecommendationBasket: false, weightPct: 10 }]);
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe('WEIGHT_NOT_ALLOWED');
  });

  it('rejects a basket member with no weight — this is the N/A!=0 vector for weights specifically', () => {
    const result = validateBasketWeights([{ methodId: 'm1', isInRecommendationBasket: true, weightPct: null }]);
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe('MISSING_WEIGHT');
  });

  it('rejects a non-positive weight (0 or negative) on a basket member', () => {
    const result = validateBasketWeights([{ methodId: 'm1', isInRecommendationBasket: true, weightPct: 0 }]);
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe('WEIGHT_NOT_POSITIVE');
  });

  it('an empty basket (no members at all) is not itself an error — basketSumPct is null, not 0', () => {
    const result = validateBasketWeights([{ methodId: 'm1', isInRecommendationBasket: false, weightPct: null }]);
    expect(result.basketSumPct).toBeNull();
    expect(result.ok).toBe(true);
  });

  it('KONTROLA NEGATYWNA: 99% (one less than the true 100% boundary) must fail, proving the test is not vacuously true', () => {
    const almost = validateBasketWeights([{ methodId: 'm1', isInRecommendationBasket: true, weightPct: 99 }]);
    expect(almost.sumMatches100).not.toBe(true);
  });

  it('validateBasketWeightsFromMethods parses decimal-string weightPct from the DTO', () => {
    const result = validateBasketWeightsFromMethods([
      { methodId: 'm1', methodType: 'DCF_FCFF', readiness: 'READY', result: { status: 'PRESENT_NONZERO', valueDecimal: '1000' }, isInRecommendationBasket: true, weightPct: '100' },
    ]);
    expect(result.basketSumPct).toBe(100);
    expect(result.ok).toBe(true);
  });
});

// =============================================================================================
// Sensitivity 5x5 shape (OWN-FIN-002 regression class)
// =============================================================================================

function make5x5Cells(overrides: Partial<Pick<ValuationSensitivityCellDto, 'rowIndex' | 'colIndex' | 'isBaseCell'>>[] = []): Pick<ValuationSensitivityCellDto, 'rowIndex' | 'colIndex' | 'isBaseCell'>[] {
  const cells: Pick<ValuationSensitivityCellDto, 'rowIndex' | 'colIndex' | 'isBaseCell'>[] = [];
  for (let r = 1; r <= 5; r++) {
    for (let c = 1; c <= 5; c++) {
      cells.push({ rowIndex: r, colIndex: c, isBaseCell: r === 3 && c === 3 });
    }
  }
  overrides.forEach((o, i) => Object.assign(cells[i], o));
  return cells;
}

describe('assertSensitivityGridShape', () => {
  it('accepts a well-formed 5x5 grid with exactly one base cell', () => {
    expect(assertSensitivityGridShape(make5x5Cells())).toEqual({ ok: true });
  });

  it('rejects a grid with 24 cells (this exact class of bug once crashed the whole view, OWN-FIN-002)', () => {
    const cells = make5x5Cells().slice(0, 24);
    const result = assertSensitivityGridShape(cells);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('WRONG_CELL_COUNT');
  });

  it('rejects a grid with 26 cells', () => {
    const cells = [...make5x5Cells(), { rowIndex: 1, colIndex: 1, isBaseCell: false }];
    const result = assertSensitivityGridShape(cells);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('WRONG_CELL_COUNT');
  });

  it('rejects zero base cells', () => {
    const cells = make5x5Cells().map((c) => ({ ...c, isBaseCell: false }));
    const result = assertSensitivityGridShape(cells);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('WRONG_BASE_CELL_COUNT');
  });

  it('rejects two base cells', () => {
    const cells = make5x5Cells();
    cells[0] = { ...cells[0], isBaseCell: true };
    cells[1] = { ...cells[1], isBaseCell: true };
    const result = assertSensitivityGridShape(cells);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('WRONG_BASE_CELL_COUNT');
  });

  it('rejects a duplicated cell coordinate (25 cells total, but not a true 5x5 lattice)', () => {
    const cells = make5x5Cells();
    // Overwrite the last cell to duplicate the first cell's coordinate — still 25 entries, still
    // exactly one base cell, but now missing full row/col coverage AND has a duplicate coordinate.
    cells[24] = { ...cells[0], isBaseCell: false };
    const result = assertSensitivityGridShape(cells);
    expect(result.ok).toBe(false);
    expect(['DUPLICATE_CELL_COORDINATE', 'INCOMPLETE_ROW_OR_COLUMN_COVERAGE']).toContain(!result.ok ? result.code : null);
  });

  it('rejects a row index out of the 1..5 range', () => {
    const cells = make5x5Cells();
    cells[0] = { ...cells[0], rowIndex: 6 };
    const result = assertSensitivityGridShape(cells);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('ROW_INDEX_OUT_OF_RANGE');
  });

  it('KONTROLA NEGATYWNA: a 24-cell grid (one short of the true 25) must be rejected, proving the count check is exact, not "at least 25"', () => {
    const cells = make5x5Cells().slice(0, 24);
    expect(assertSensitivityGridShape(cells).ok).not.toBe(true);
  });
});

// =============================================================================================
// Advisor finding normalization (camelCase POST vs snake_case GET)
// =============================================================================================

const GENERATED_FINDING: ValuationAdvisorFindingGeneratedDto = {
  id: 'find-1',
  ruleId: 'ADV-R01',
  outputKind: 'FACT',
  title: 'Terminal value share of EV',
  narrative: 'Terminal value is 62% of enterprise value.',
  evidenceRef: { ruleId: 'ADV-R01', generator: 'RULE_ENGINE', rulesVersion: '1', pointers: [{ table: 'finance_valuation_terminal', column: 'terminal_share_pct', rowId: 't1', observedValue: 62, label: 'Terminal share' }], derived: {}, impactUnit: 'PCT' },
  driverRef: 'TERMINAL_SHARE',
  impactDecimal: 62,
  confidence: 'HIGH',
  isComparison: false,
  comparedVariants: [],
  hallucinationEvalStatus: 'PASSED',
};

const STORED_FINDING: ValuationAdvisorFindingStoredDto = {
  id: 'find-1',
  business_version_id: 'bv-1',
  compute_snapshot_id: 'snap-1',
  output_kind: 'FACT',
  title: 'Terminal value share of EV',
  narrative: 'Terminal value is 62% of enterprise value.',
  evidence_ref: { ruleId: 'ADV-R01', generator: 'RULE_ENGINE', rulesVersion: '1', pointers: [{ table: 'finance_valuation_terminal', column: 'terminal_share_pct', rowId: 't1', observedValue: 62, label: 'Terminal share' }], derived: {}, impactUnit: 'PCT' },
  driver_ref: 'TERMINAL_SHARE',
  impact_decimal: '62',
  confidence: 'HIGH',
  is_comparison: false,
  is_frozen: true,
  frozen_at: '2026-08-01T00:00:00Z',
  is_stale: false,
  ai_provider: 'rule-engine',
  ai_prompt_version: '1',
  ai_hallucination_eval_status: 'PASSED',
};

describe('normalizeAdvisorFinding', () => {
  it('normalizes the POST(generate) camelCase shape', () => {
    const view = normalizeAdvisorFinding(GENERATED_FINDING);
    expect(view.id).toBe('find-1');
    expect(view.outputKind).toBe('FACT');
    expect(view.isFactual).toBe(true);
    expect(view.impactDecimal).toBe(62);
    expect(view.isFrozen).toBe(false); // freshly generated, not yet persisted-and-reloaded
  });

  it('normalizes the GET(list) snake_case shape to the SAME view shape', () => {
    const view = normalizeAdvisorFinding(STORED_FINDING);
    expect(view.id).toBe('find-1');
    expect(view.outputKind).toBe('FACT');
    expect(view.isFactual).toBe(true);
    expect(view.impactDecimal).toBe(62); // string '62' parsed to number 62
    expect(view.isFrozen).toBe(true);
  });

  it('both shapes normalize to an identical view for the same logical finding (proves the adapter, not just each branch)', () => {
    const fromGenerated = normalizeAdvisorFinding(GENERATED_FINDING);
    const fromStored = normalizeAdvisorFinding(STORED_FINDING);
    expect(fromGenerated.outputKind).toBe(fromStored.outputKind);
    expect(fromGenerated.title).toBe(fromStored.title);
    expect(fromGenerated.impactDecimal).toBe(fromStored.impactDecimal);
  });

  it('marks HYPOTHESIS/RISK/QUESTION/ACTION as explicitly NOT factual — fact vs hypothesis must never be inferred from tone alone', () => {
    const hypothesis = normalizeAdvisorFinding({ ...GENERATED_FINDING, outputKind: 'HYPOTHESIS' });
    expect(hypothesis.isFactual).toBe(false);
  });

  it('KONTROLA NEGATYWNA: a RISK finding must not be reported as factual', () => {
    const risk = normalizeAdvisorFinding({ ...STORED_FINDING, output_kind: 'RISK' });
    expect(risk.isFactual).not.toBe(true);
  });
});

describe('groupAdvisorFindingsByKind', () => {
  it('groups a mixed list into all five kinds, including empty groups', () => {
    const findings = [normalizeAdvisorFinding(GENERATED_FINDING), normalizeAdvisorFinding({ ...STORED_FINDING, output_kind: 'RISK', id: 'find-2' })];
    const grouped = groupAdvisorFindingsByKind(findings);
    expect(grouped.FACT).toHaveLength(1);
    expect(grouped.RISK).toHaveLength(1);
    expect(grouped.HYPOTHESIS).toHaveLength(0);
    expect(grouped.QUESTION).toHaveLength(0);
    expect(grouped.ACTION).toHaveLength(0);
  });
});
