/**
 * Pure unit tests for `formulaAstEvaluator.ts` — no database, mock
 * `CellResolver`/`FormulaRefResolver`/`DynamicConstantResolver`. Mirrors the
 * "pure, DB-free" test style `lifecycleService.test.ts` already established
 * in this directory.
 */
import { describe, expect, it } from 'vitest';

import {
  evaluateFormula,
  type CellRefOperand,
  type CellResolution,
  type CellResolver,
  type DynamicConstantResolver,
  type EvaluationResult,
  type FormulaNode,
  type FormulaRefResolver,
} from '../formulaAstEvaluator.js';

function cellRef(canonicalLineCode: string, periodOffset: CellRefOperand['periodOffset'] = 'CURRENT'): CellRefOperand {
  return { canonicalLineCode, consolidationScope: 'CONSOLIDATED', entityScope: 'ANALYSIS_DEFAULT', periodOffset };
}

function fixedCellResolver(values: Record<string, number | 'MISSING'>): CellResolver {
  return {
    async resolveCell(ref: CellRefOperand): Promise<CellResolution> {
      const key = `${ref.canonicalLineCode}::${ref.periodOffset}`;
      const v = values[key];
      if (v === undefined) throw new Error(`fixedCellResolver: no fixture for ${key}`);
      if (v === 'MISSING') return { ok: true, status: 'MISSING' };
      return { ok: true, status: v === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO', value: v };
    },
  };
}

const noFormulaRefs: FormulaRefResolver = {
  async resolveFormulaRef(kpiCode: string): Promise<EvaluationResult> {
    throw new Error(`unexpected formula_ref lookup: ${kpiCode}`);
  },
};

const fixedDays = (days: number): DynamicConstantResolver => ({
  daysInPeriod: () => days,
  annualizationFactor: () => null,
});

describe('evaluateFormula — CURRENT_RATIO shape (ratio, POINT_IN_TIME, SHOW_WITH_FLAG)', () => {
  const ast: FormulaNode = {
    node: 'operator',
    op: 'ratio',
    left: { node: 'operand', kind: 'cell_ref', cellRef: cellRef('CURRENT_ASSETS') },
    right: { node: 'operand', kind: 'cell_ref', cellRef: cellRef('CURRENT_LIABILITIES') },
  };

  it('computes a plain positive ratio', async () => {
    const result = await evaluateFormula(
      ast,
      {
        cellResolver: fixedCellResolver({ 'CURRENT_ASSETS::CURRENT': 200, 'CURRENT_LIABILITIES::CURRENT': 100 }),
        formulaRefResolver: noFormulaRefs,
        dynamicConstants: fixedDays(365),
      },
      'SHOW_WITH_FLAG'
    );
    expect(result).toEqual({ status: 'PRESENT_NONZERO', value: 2, qualityFlag: null, detail: null });
  });

  it('DIVISION_BY_ZERO: denominator exactly 0 -> NA (P1 fix), never a fabricated number, never silently PRESENT_ZERO', async () => {
    // P1 fix (PKG_FIX_CANONICAL_report.md, defect 2): before this fix, a zero denominator mapped
    // to NOT_APPLICABLE, and NOTHING in this evaluator could ever produce NA — the DEC-FIN-005
    // guarantee ("brak danych daje N/A z powodem, NIGDY zero") had no live code path. qualityFlag
    // stays null here (not 'DIVISION_BY_ZERO') because the DB CHECK
    // chk_finance_analysis_kpi_values_division_by_zero_shape pairs that flag with
    // value_status='NOT_APPLICABLE', not 'NA' — the reason code instead lives in `detail`.
    const result = await evaluateFormula(
      ast,
      {
        cellResolver: fixedCellResolver({ 'CURRENT_ASSETS::CURRENT': 200, 'CURRENT_LIABILITIES::CURRENT': 0 }),
        formulaRefResolver: noFormulaRefs,
        dynamicConstants: fixedDays(365),
      },
      'SHOW_WITH_FLAG'
    );
    expect(result.status).toBe('NA');
    expect(result.value).toBeNull();
    expect(result.qualityFlag).toBeNull();
    expect(result.detail).toContain('DIVISION_BY_ZERO');
  });

  it('a genuinely computed zero (present numerator/denominator, quotient is 0) stays PRESENT_ZERO — distinguishable from the NA-by-zero-denominator case above', async () => {
    // The critical distinction the P1 fix must not blur: a REAL computed zero (e.g. numerator=0,
    // a healthy nonzero denominator) is data, not an error — PRESENT_ZERO, never NA.
    const result = await evaluateFormula(
      ast,
      {
        cellResolver: fixedCellResolver({ 'CURRENT_ASSETS::CURRENT': 0, 'CURRENT_LIABILITIES::CURRENT': 100 }),
        formulaRefResolver: noFormulaRefs,
        dynamicConstants: fixedDays(365),
      },
      'SHOW_WITH_FLAG'
    );
    expect(result.status).toBe('PRESENT_ZERO');
    expect(result.value).toBe(0);
    expect(result.qualityFlag).toBeNull();
    // The two outcomes must be reliably distinguishable by any caller.
    expect(result.status).not.toBe('NA');
  });

  it('SHOW_WITH_FLAG negative denominator: keeps the numeric value, attaches NEGATIVE_DENOMINATOR', async () => {
    const result = await evaluateFormula(
      ast,
      {
        cellResolver: fixedCellResolver({ 'CURRENT_ASSETS::CURRENT': 200, 'CURRENT_LIABILITIES::CURRENT': -50 }),
        formulaRefResolver: noFormulaRefs,
        dynamicConstants: fixedDays(365),
      },
      'SHOW_WITH_FLAG'
    );
    expect(result.status).toBe('PRESENT_NONZERO');
    expect(result.value).toBe(-4);
    expect(result.qualityFlag).toBe('NEGATIVE_DENOMINATOR');
  });

  it('FORCE_NA negative denominator: NOT_APPLICABLE with NO quality_flag (a policy decision, not a computed error)', async () => {
    const result = await evaluateFormula(
      ast,
      {
        cellResolver: fixedCellResolver({ 'CURRENT_ASSETS::CURRENT': 200, 'CURRENT_LIABILITIES::CURRENT': -50 }),
        formulaRefResolver: noFormulaRefs,
        dynamicConstants: fixedDays(365),
      },
      'FORCE_NA'
    );
    expect(result.status).toBe('NOT_APPLICABLE');
    expect(result.value).toBeNull();
    expect(result.qualityFlag).toBeNull();
  });

  it('a MISSING numerator (denominator present/healthy) never fabricates a value — stays MISSING, not NA', async () => {
    // Numerator absence is "the data itself is not there" (MISSING) — a different fact from "the
    // division is mathematically undefined" (NA), even though both refuse to compute a number.
    const result = await evaluateFormula(
      ast,
      {
        cellResolver: fixedCellResolver({ 'CURRENT_ASSETS::CURRENT': 'MISSING', 'CURRENT_LIABILITIES::CURRENT': 100 }),
        formulaRefResolver: noFormulaRefs,
        dynamicConstants: fixedDays(365),
      },
      'SHOW_WITH_FLAG'
    );
    expect(result.status).toBe('MISSING');
    expect(result.value).toBeNull();
  });

  it('a MISSING denominator (numerator present) is NA, not MISSING (P1 fix) — the division itself is undefined regardless of the numerator', async () => {
    const result = await evaluateFormula(
      ast,
      {
        cellResolver: fixedCellResolver({ 'CURRENT_ASSETS::CURRENT': 200, 'CURRENT_LIABILITIES::CURRENT': 'MISSING' }),
        formulaRefResolver: noFormulaRefs,
        dynamicConstants: fixedDays(365),
      },
      'SHOW_WITH_FLAG'
    );
    expect(result.status).toBe('NA');
    expect(result.value).toBeNull();
    expect(result.qualityFlag).toBeNull();
    expect(result.detail).toContain('DENOMINATOR_MISSING');
  });

  it('BOTH numerator and denominator MISSING: MISSING wins, not NA — "no data here at all" is a more fundamental fact than "this specific division is undefined" (regression guard: an empty/new Analysis with zero source data must read as MISSING, never as a failed computation)', async () => {
    const result = await evaluateFormula(
      ast,
      {
        cellResolver: fixedCellResolver({ 'CURRENT_ASSETS::CURRENT': 'MISSING', 'CURRENT_LIABILITIES::CURRENT': 'MISSING' }),
        formulaRefResolver: noFormulaRefs,
        dynamicConstants: fixedDays(365),
      },
      'SHOW_WITH_FLAG'
    );
    expect(result.status).toBe('MISSING');
    expect(result.value).toBeNull();
  });
});

describe('evaluateFormula — DSO shape (root op is divide, not ratio, but policy still applies at the root)', () => {
  // AR_avg / (REVENUE / DAYS_IN_PERIOD) — literal shape from WP-D03 ADR section 5.5 / the P0 seed.
  const dsoAst: FormulaNode = {
    node: 'operator',
    op: 'divide',
    left: { node: 'operand', kind: 'cell_ref', cellRef: cellRef('AR', 'AVERAGE_CURRENT_AND_PRIOR') },
    right: {
      node: 'operator',
      op: 'divide',
      left: { node: 'operand', kind: 'cell_ref', cellRef: cellRef('REVENUE') },
      right: { node: 'operand', kind: 'literal', valueRef: 'DAYS_IN_PERIOD' },
    },
  };

  it('computes AR_avg * days / revenue', async () => {
    const result = await evaluateFormula(
      dsoAst,
      {
        cellResolver: fixedCellResolver({ 'AR::AVERAGE_CURRENT_AND_PRIOR': 25_000_000, 'REVENUE::CURRENT': 182_000_000 }),
        formulaRefResolver: noFormulaRefs,
        dynamicConstants: fixedDays(365),
      },
      'FORCE_NA'
    );
    expect(result.status).toBe('PRESENT_NONZERO');
    expect(result.value).toBeCloseTo((25_000_000 * 365) / 182_000_000, 9);
  });

  it('a nested divide-by-zero (REVENUE/DAYS_IN_PERIOD side) never leaks past this evaluator as a number', async () => {
    const result = await evaluateFormula(
      dsoAst,
      {
        cellResolver: fixedCellResolver({ 'AR::AVERAGE_CURRENT_AND_PRIOR': 25_000_000, 'REVENUE::CURRENT': 182_000_000 }),
        formulaRefResolver: noFormulaRefs,
        dynamicConstants: { daysInPeriod: () => 0, annualizationFactor: () => null },
      },
      'FORCE_NA'
    );
    // REVENUE/0 (DAYS_IN_PERIOD=0, a degenerate fixture) -> inner divide is DIVISION_BY_ZERO (NA,
    // P1 fix) -> outer divide's right operand is NA -> propagates via propagateUnusable's NA
    // branch, never a number.
    expect(result.status).toBe('NA');
    expect(result.value).toBeNull();
  });

  it('negative_denominator_policy applies at the DSO root even though the root op is "divide", not "ratio" (see module header design note)', async () => {
    const result = await evaluateFormula(
      dsoAst,
      // A negative AR average is not realistic business data, but this proves the policy check
      // fires on the outer "divide" root, not only on a literal "ratio" node.
      {
        cellResolver: fixedCellResolver({ 'AR::AVERAGE_CURRENT_AND_PRIOR': 25_000_000, 'REVENUE::CURRENT': -182_000_000 }),
        formulaRefResolver: noFormulaRefs,
        dynamicConstants: fixedDays(365),
      },
      'FORCE_NA'
    );
    expect(result.status).toBe('NOT_APPLICABLE');
    expect(result.qualityFlag).toBeNull();
  });
});

describe('evaluateFormula — CASH_CONVERSION_CYCLE shape (formula_ref composite, root op subtract -> no negative-denominator policy applies)', () => {
  const cccAst: FormulaNode = {
    node: 'operator',
    op: 'subtract',
    left: {
      node: 'operator',
      op: 'add',
      left: { node: 'operand', kind: 'formula_ref', kpiCode: 'DSO' },
      right: { node: 'operand', kind: 'formula_ref', kpiCode: 'DIO' },
    },
    right: { node: 'operand', kind: 'formula_ref', kpiCode: 'DPO' },
  };

  it('composes three formula_ref values (DSO + DIO - DPO)', async () => {
    const byCode: Record<string, EvaluationResult> = {
      DSO: { status: 'PRESENT_NONZERO', value: 50, qualityFlag: null, detail: null },
      DIO: { status: 'PRESENT_NONZERO', value: 40, qualityFlag: null, detail: null },
      DPO: { status: 'PRESENT_NONZERO', value: 30, qualityFlag: null, detail: null },
    };
    const result = await evaluateFormula(
      cccAst,
      {
        cellResolver: fixedCellResolver({}),
        formulaRefResolver: { resolveFormulaRef: async (code) => byCode[code] },
        dynamicConstants: fixedDays(365),
      },
      null
    );
    expect(result).toEqual({ status: 'PRESENT_NONZERO', value: 60, qualityFlag: null, detail: null }); // 50+40-30
  });

  it('one MISSING formula_ref dependency propagates MISSING for the whole composite (never a partial sum)', async () => {
    const byCode: Record<string, EvaluationResult> = {
      DSO: { status: 'PRESENT_NONZERO', value: 50, qualityFlag: null, detail: null },
      DIO: { status: 'MISSING', value: null, qualityFlag: null, detail: 'no data' },
      DPO: { status: 'PRESENT_NONZERO', value: 30, qualityFlag: null, detail: null },
    };
    const result = await evaluateFormula(
      cccAst,
      {
        cellResolver: fixedCellResolver({}),
        formulaRefResolver: { resolveFormulaRef: async (code) => byCode[code] },
        dynamicConstants: fixedDays(365),
      },
      null
    );
    expect(result.status).toBe('MISSING');
    expect(result.value).toBeNull();
  });
});

describe('evaluateFormula — INSUFFICIENT_HISTORY propagation (AVERAGE_BALANCE with no prior period)', () => {
  it('a cell_ref resolver reporting INSUFFICIENT_HISTORY surfaces as NOT_APPLICABLE with that quality_flag, never MISSING and never a fallback point-in-time number', async () => {
    const ast: FormulaNode = {
      node: 'operator',
      op: 'ratio',
      left: { node: 'operand', kind: 'cell_ref', cellRef: cellRef('NET_INCOME') },
      right: { node: 'operand', kind: 'cell_ref', cellRef: cellRef('EQUITY', 'AVERAGE_CURRENT_AND_PRIOR') },
    };
    const cellResolver: CellResolver = {
      async resolveCell(ref) {
        if (ref.canonicalLineCode === 'NET_INCOME') return { ok: true, status: 'PRESENT_NONZERO', value: 100 };
        return { ok: false, reason: 'INSUFFICIENT_HISTORY', detail: 'first period on record, no previous_period_id' };
      },
    };
    const result = await evaluateFormula(ast, { cellResolver, formulaRefResolver: noFormulaRefs, dynamicConstants: fixedDays(365) }, 'SHOW_WITH_FLAG');
    expect(result.status).toBe('NOT_APPLICABLE');
    expect(result.qualityFlag).toBe('INSUFFICIENT_HISTORY');
    expect(result.value).toBeNull();
  });
});
