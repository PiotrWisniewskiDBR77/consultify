import { describe, expect, it } from 'vitest';

import {
  aggregateKpiFinancialImpact,
  bridgeToFinanceModule,
  financialImpactByStatement,
  type KpiFinanceMapping,
  type StatementLineImpact,
} from '../../../server/src/services/results/financeLinkService.js';

describe('financeLinkService.aggregateKpiFinancialImpact', () => {
  it('computes impact = kpiDelta × multiplier × sign(direction)', () => {
    const mappings: KpiFinanceMapping[] = [
      {
        kpiId: 'k1',
        statementLineId: 'revenue',
        statementType: 'P&L',
        kpiDelta: 100,
        multiplier: 2,
        direction: 'positive',
      },
    ];
    const result = aggregateKpiFinancialImpact(mappings);
    expect(result).toHaveLength(1);
    expect(result[0].totalImpact).toBe(200);
    expect(result[0].statementLineId).toBe('revenue');
    expect(result[0].statementType).toBe('P&L');
  });

  it('applies direction sign: positive=+1, negative=-1, neutral=0', () => {
    const base: Omit<KpiFinanceMapping, 'direction' | 'statementLineId'> = {
      kpiId: 'k',
      statementType: 'P&L',
      kpiDelta: 50,
      multiplier: 1,
    };
    const result = aggregateKpiFinancialImpact([
      { ...base, statementLineId: 'a', direction: 'positive' },
      { ...base, statementLineId: 'b', direction: 'negative' },
      { ...base, statementLineId: 'c', direction: 'neutral' },
    ]);
    const byId = Object.fromEntries(result.map((r) => [r.statementLineId, r.totalImpact]));
    expect(byId.a).toBe(50);
    expect(byId.b).toBe(-50);
    expect(byId.c).toBe(0);
  });

  it('defaults multiplier=1, direction=positive, kpiDelta=0', () => {
    const result = aggregateKpiFinancialImpact([
      { kpiId: 'k1', statementLineId: 'x', statementType: 'BS', kpiDelta: 30 },
      { kpiId: 'k2', statementLineId: 'y', statementType: 'BS' }, // kpiDelta missing → 0
    ]);
    const byId = Object.fromEntries(result.map((r) => [r.statementLineId, r.totalImpact]));
    expect(byId.x).toBe(30);
    expect(byId.y).toBe(0);
  });

  it('aggregates multiple mappings onto the same line', () => {
    const result = aggregateKpiFinancialImpact([
      { kpiId: 'k1', statementLineId: 'cogs', statementType: 'P&L', kpiDelta: 100, direction: 'negative' },
      { kpiId: 'k2', statementLineId: 'cogs', statementType: 'P&L', kpiDelta: 40, direction: 'negative' },
      { kpiId: 'k3', statementLineId: 'cogs', statementType: 'P&L', kpiDelta: 10, direction: 'positive' },
    ]);
    expect(result).toHaveLength(1);
    // -100 - 40 + 10 = -130
    expect(result[0].totalImpact).toBe(-130);
  });

  it('keeps same lineId in different statements as separate rows', () => {
    const result = aggregateKpiFinancialImpact([
      { kpiId: 'k1', statementLineId: 'cash', statementType: 'BS', kpiDelta: 100 },
      { kpiId: 'k2', statementLineId: 'cash', statementType: 'CF', kpiDelta: 100 },
    ]);
    expect(result).toHaveLength(2);
  });

  it('ignores mappings without a statementLineId', () => {
    const result = aggregateKpiFinancialImpact([
      { kpiId: 'k1', statementLineId: '', statementType: 'P&L', kpiDelta: 99 },
    ]);
    expect(result).toHaveLength(0);
  });

  it('treats non-finite numbers as defaults', () => {
    const result = aggregateKpiFinancialImpact([
      {
        kpiId: 'k1',
        statementLineId: 'x',
        statementType: 'P&L',
        kpiDelta: Number.NaN,
        multiplier: Number.POSITIVE_INFINITY,
      },
    ]);
    expect(result[0].totalImpact).toBe(0);
  });
});

describe('financeLinkService.financialImpactByStatement', () => {
  it('sums totals per statement type and always returns the full key set', () => {
    const impacts: StatementLineImpact[] = [
      { statementLineId: 'rev', statementType: 'P&L', totalImpact: 200 },
      { statementLineId: 'cogs', statementType: 'P&L', totalImpact: -50 },
      { statementLineId: 'cash', statementType: 'CF', totalImpact: 75 },
    ];
    const byStatement = financialImpactByStatement(impacts);
    expect(byStatement['P&L']).toBe(150);
    expect(byStatement.CF).toBe(75);
    expect(byStatement.BS).toBe(0); // no entries → 0, key still present
  });

  it('returns all-zero map for empty input', () => {
    expect(financialImpactByStatement([])).toEqual({ 'P&L': 0, BS: 0, CF: 0 });
  });
});

describe('financeLinkService.bridgeToFinanceModule', () => {
  it('emits M16 bridge format with M15_BENEFITS source', () => {
    const impacts: StatementLineImpact[] = [
      { statementLineId: 'rev', statementType: 'P&L', totalImpact: 200 },
      { statementLineId: 'cash', statementType: 'CF', totalImpact: -10 },
    ];
    const bridge = bridgeToFinanceModule(impacts);
    expect(bridge).toEqual([
      { lineId: 'rev', statementType: 'P&L', value: 200, source: 'M15_BENEFITS' },
      { lineId: 'cash', statementType: 'CF', value: -10, source: 'M15_BENEFITS' },
    ]);
  });

  it('produces an empty bridge for empty impacts', () => {
    expect(bridgeToFinanceModule([])).toEqual([]);
  });

  it('end-to-end: mappings → aggregate → bridge', () => {
    const bridge = bridgeToFinanceModule(
      aggregateKpiFinancialImpact([
        { kpiId: 'k1', statementLineId: 'rev', statementType: 'P&L', kpiDelta: 100, multiplier: 1.5, direction: 'positive' },
      ]),
    );
    expect(bridge[0]).toEqual({
      lineId: 'rev',
      statementType: 'P&L',
      value: 150,
      source: 'M15_BENEFITS',
    });
  });
});
