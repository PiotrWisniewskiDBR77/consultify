import { describe, expect, it } from 'vitest';

import { PERSPECTIVES } from '../../../server/src/services/results/balancedScorecardService.js';
import {
  buildStrategicView,
  type BuildStrategicViewInput,
} from '../../../server/src/services/results/resultsStrategicViewService.js';

const baseInput: BuildStrategicViewInput = {
  kpis: [
    // No explicit perspective → inferred from name keywords.
    { id: 'k-fin', name: 'Koszt operacyjny', value: 12, target: 10 }, // financial
    { id: 'k-cust', name: 'NPS klienta', value: 5, target: 8 }, // customer
    { id: 'k-proc', name: 'Czas cyklu', value: 3, target: 3 }, // process
    { id: 'k-learn', name: 'Rozwój kompetencji', value: 9, target: 8 }, // learning
  ],
  initiatives: [
    { id: 'i-1', name: 'Automatyzacja faktur' },
    { id: 'i-2', name: 'Program szkoleń' },
  ],
  initiativeToKpi: [
    { initiativeId: 'i-1', kpiId: 'k-fin' },
    { initiativeId: 'i-1', kpiId: 'k-proc' },
    { initiativeId: 'i-2', kpiId: 'k-learn' },
  ],
};

describe('buildStrategicView', () => {
  it('produces a BSC overview covering all 4 perspectives (inferred when absent)', () => {
    const { bsc } = buildStrategicView(baseInput);

    // All 4 canonical perspectives are always present.
    for (const p of PERSPECTIVES) {
      expect(bsc.perspectives[p]).toBeDefined();
    }
    // Each named KPI landed in its keyword-inferred perspective.
    expect(bsc.perspectives.financial.count).toBe(1);
    expect(bsc.perspectives.customer.count).toBe(1);
    expect(bsc.perspectives.process.count).toBe(1);
    expect(bsc.perspectives.learning.count).toBe(1);
    // With at least one KPI per perspective, the scorecard is balanced.
    expect(bsc.balanced).toBe(true);
    expect(bsc.overallHealthPct).toBeGreaterThanOrEqual(0);
    expect(bsc.overallHealthPct).toBeLessThanOrEqual(1);
  });

  it('honors an explicit perspective over the inferred one', () => {
    const { bsc } = buildStrategicView({
      ...baseInput,
      kpis: [{ id: 'k1', name: 'Koszt operacyjny', perspective: 'customer', value: 1, target: 1 }],
      initiatives: [],
      initiativeToKpi: [],
    });
    // "Koszt" would infer financial, but explicit perspective wins.
    expect(bsc.perspectives.customer.count).toBe(1);
    expect(bsc.perspectives.financial.count).toBe(0);
  });

  it('builds a BDN graph from initiative↔KPI mappings', () => {
    const { bdn } = buildStrategicView(baseInput);

    // 2 enablers (initiatives) + 4 benefits (KPIs) = 6 nodes; 3 edges.
    expect(bdn.stats.byType.enabler).toBe(2);
    expect(bdn.stats.byType.benefit).toBe(4);
    expect(bdn.stats.nodeCount).toBe(6);
    expect(bdn.stats.edgeCount).toBe(3);
    expect(bdn.edges.length).toBe(3);

    // The enabler→benefit edge for i-1 → k-fin exists.
    expect(
      bdn.edges.some((e) => e.fromId === 'enabler:i-1' && e.toId === 'benefit:k-fin'),
    ).toBe(true);

    // No objectives wired → every benefit is orphan (no edge to an objective).
    expect(bdn.stats.orphanBenefits.length).toBe(4);
  });

  it('emits a non-empty value narrative (from scorecard, or zeros when absent)', () => {
    const { narrative } = buildStrategicView(baseInput);

    expect(narrative.headline.length).toBeGreaterThan(0);
    expect(narrative.paragraphs.length).toBeGreaterThan(0);
    expect(narrative.paragraphs.every((p) => p.length > 0)).toBe(true);
  });

  it('passes scorecard aggregates through to the narrative', () => {
    const { narrative } = buildStrategicView({
      ...baseInput,
      scorecard: {
        banked: 1_200_000,
        inFlight: 300_000,
        atRisk: 50_000,
        totalTarget: 2_000_000,
        pctOfTarget: 60,
      },
    });
    // Headline reflects the banked value and % of target.
    expect(narrative.headline).toContain('1,2 M');
    expect(narrative.headline).toContain('60%');
  });
});
