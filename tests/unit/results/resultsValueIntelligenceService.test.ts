import { describe, expect, it } from 'vitest';

import {
  buildValueIntelligence,
  type ValueIntelligenceInput,
} from '../../../server/src/services/results/resultsValueIntelligenceService.js';

describe('buildValueIntelligence', () => {
  it('a realized initiative is banked in the scorecard (L5, full realized value)', () => {
    const input: ValueIntelligenceInput = {
      initiatives: [{ id: 'done-1', name: 'Realized', status: 'DONE' }],
      roiAssumptions: [{ initiative_id: 'done-1', expected_npv: 100_000 }],
      roiRealized: [
        { initiative_id: 'done-1', realized_revenue_delta: 120_000, realized_savings: 10_000 },
      ],
    };

    const out = buildValueIntelligence(input);
    const item = out.items[0];

    expect(item.stage).toBe('L5_realized');
    expect(item.realizedValue).toBe(130_000); // 120k rev + 10k savings
    expect(item.hasRealized).toBe(true);
    // banked = Σ realizedValue
    expect(out.scorecard.banked).toBe(130_000);
    // realized item is not at risk
    expect(item.atRisk).toBe(false);
    expect(out.topBenefits[0]).toMatchObject({ id: 'done-1', realizedValue: 130_000 });
  });

  it('an in-flight initiative contributes forecast, not banked', () => {
    const input: ValueIntelligenceInput = {
      initiatives: [{ id: 'exec-1', name: 'In flight', status: 'EXECUTING' }],
      roiAssumptions: [
        { initiative_id: 'exec-1', expected_revenue_delta: 200_000, expected_cost_delta: 50_000 },
      ],
      // realized above the 0.6 threshold so it is genuinely in-flight, not at-risk
      roiRealized: [{ initiative_id: 'exec-1', realized_revenue_delta: 120_000 }],
    };

    const out = buildValueIntelligence(input);
    const item = out.items[0];

    expect(item.stage).toBe('L4_inflight');
    expect(item.valueAtStake).toBe(150_000); // 200k − 50k
    expect(item.realizedValue).toBe(120_000);
    expect(item.realizationPct).toBeCloseTo(0.8, 5); // 120k / 150k, above 0.6
    expect(item.atRisk).toBe(false);
    // banked = Σ realizedValue
    expect(out.scorecard.banked).toBe(120_000);
    // partially realized + not at risk → forecast not re-counted as at-risk
    expect(out.scorecard.atRisk).toBe(0);
    // funnel: value at stake lands in the 'inflight' stage
    const inflight = out.funnel.find((f) => f.stage === 'inflight');
    expect(inflight?.value).toBe(150_000);
  });

  it('an endangered initiative is flagged atRisk and gets an INTERVENE/STOP decision', () => {
    const input: ValueIntelligenceInput = {
      initiatives: [{ id: 'risk-1', name: 'Endangered', status: 'EXECUTING' }],
      roiAssumptions: [{ initiative_id: 'risk-1', expected_npv: 1_000_000 }],
      // realized far below stake → realizationPct ~0.1 (< 0.6)
      roiRealized: [{ initiative_id: 'risk-1', realized_revenue_delta: 100_000 }],
    };

    const out = buildValueIntelligence(input);
    const item = out.items[0];

    expect(item.stage).toBe('L4_inflight');
    expect(item.realizationPct).toBeCloseTo(0.1, 5);
    expect(item.atRisk).toBe(true);

    const decision = out.decisions.find((d) => d.id === 'risk-1');
    expect(decision).toBeDefined();
    expect(['INTERVENE', 'STOP']).toContain(decision!.action);

    // at-risk forecast is surfaced in scorecard.atRisk and topRisks
    expect(out.scorecard.atRisk).toBeGreaterThan(0);
    expect(out.topRisks[0]).toMatchObject({ id: 'risk-1' });
    expect(out.valueAtRisk.atRiskCount).toBeGreaterThanOrEqual(1);
  });

  it('handles empty input without throwing (zeroed aggregates)', () => {
    const out = buildValueIntelligence({
      initiatives: [],
      roiAssumptions: [],
      roiRealized: [],
    });

    expect(out.items).toEqual([]);
    expect(out.scorecard.banked).toBe(0);
    expect(out.scorecard.totalTarget).toBe(0);
    expect(out.decisions).toEqual([]);
    expect(out.topBenefits).toEqual([]);
    expect(out.topRisks).toEqual([]);
    expect(out.valueAtRisk.atRiskValue).toBe(0);
    expect(out.valueSplit.total).toBe(0);
    // funnel still has all 4 stages, zeroed
    expect(out.funnel).toHaveLength(4);
    expect(out.funnel.every((f) => f.value === 0)).toBe(true);
  });
});
