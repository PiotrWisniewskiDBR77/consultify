import { describe, expect, it } from 'vitest';

import {
  reconcile,
  reconcilePortfolio,
  type ReconcileRow,
} from '../../../server/src/services/realizedValueReconciliationService.js';

describe('reconcile (single)', () => {
  it('matched: within tolerance', () => {
    // declared 100, statement 103 → 3% ≤ 5% → matched
    const r = reconcile(100, 103, 5);
    expect(r.status).toBe('matched');
    expect(r.variance).toBe(3);
    expect(r.variancePct).toBeCloseTo(3);
    expect(r.case).toBeUndefined();
  });

  it('matched: exactly at tolerance boundary stays matched', () => {
    const r = reconcile(100, 105, 5); // exactly 5% → not > tolerance
    expect(r.status).toBe('matched');
  });

  it('variance: beyond tolerance, statement exceeds declared', () => {
    const r = reconcile(100, 130, 5);
    expect(r.status).toBe('variance');
    expect(r.variance).toBe(30);
    expect(r.variancePct).toBeCloseTo(30);
    expect(r.case).toBe('statement-exceeds-declared');
  });

  it('variance: beyond tolerance, declared exceeds statement', () => {
    const r = reconcile(100, 70, 5);
    expect(r.status).toBe('variance');
    expect(r.variance).toBe(-30);
    expect(r.case).toBe('declared-exceeds-statement');
  });

  it('unmapped: no statement value (null)', () => {
    const r = reconcile(100, null);
    expect(r.status).toBe('unmapped');
    expect(r.variance).toBe(0);
    expect(r.variancePct).toBe(0);
  });

  it('unmapped: no statement value (undefined)', () => {
    const r = reconcile(100, undefined);
    expect(r.status).toBe('unmapped');
  });

  it('declared zero + statement nonzero → variance case', () => {
    const r = reconcile(0, 50);
    expect(r.status).toBe('variance');
    expect(r.variance).toBe(50);
    expect(r.case).toBe('declared-zero-statement-nonzero');
  });

  it('declared zero + statement zero → matched', () => {
    const r = reconcile(0, 0);
    expect(r.status).toBe('matched');
  });
});

describe('reconcilePortfolio (aggregate)', () => {
  it('aggregates matched / variances / unmapped per KPI/initiative', () => {
    const rows: ReconcileRow[] = [
      // matched (2% drift)
      { kpiId: 'k1', initiativeId: 'i1', declaredValue: 100, mappedStatementLineCode: 'REV', statementValue: 102 },
      // variance (40% drift)
      { kpiId: 'k2', initiativeId: 'i1', declaredValue: 100, mappedStatementLineCode: 'COGS', statementValue: 140 },
      // unmapped: no code
      { kpiId: 'k3', initiativeId: 'i2', declaredValue: 100 },
      // unmapped: code present but no statement value
      { kpiId: 'k4', initiativeId: 'i2', declaredValue: 100, mappedStatementLineCode: 'OPEX', statementValue: null },
    ];

    const result = reconcilePortfolio(rows, 5);

    expect(result.matched).toBe(1);
    expect(result.variances).toBe(1);
    expect(result.unmapped).toBe(2);
    expect(result.items).toHaveLength(4);

    const byKpi = Object.fromEntries(result.items.map((i) => [i.kpiId, i]));
    expect(byKpi.k1.status).toBe('matched');
    expect(byKpi.k2.status).toBe('variance');
    expect(byKpi.k2.case).toBe('statement-exceeds-declared');
    expect(byKpi.k3.status).toBe('unmapped');
    expect(byKpi.k4.status).toBe('unmapped');
    // carried-through detail
    expect(byKpi.k1.initiativeId).toBe('i1');
    expect(byKpi.k3.mappedStatementLineCode).toBeNull();
  });

  it('empty input yields zeroed aggregate', () => {
    const result = reconcilePortfolio([]);
    expect(result).toEqual({ matched: 0, variances: 0, unmapped: 0, items: [] });
  });

  it('treats empty-string mapping code as unmapped', () => {
    const result = reconcilePortfolio([
      { kpiId: 'k1', initiativeId: 'i1', declaredValue: 100, mappedStatementLineCode: '', statementValue: 100 },
    ]);
    expect(result.unmapped).toBe(1);
    expect(result.items[0].status).toBe('unmapped');
  });
});
