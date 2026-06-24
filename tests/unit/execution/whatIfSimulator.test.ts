import { describe, expect, it } from 'vitest';

import {
  compareScenarios,
  simulateWhatIf,
  type Intervention,
  type PortfolioMetrics,
} from '@/components/Execution/whatIfSimulator';

const baseline: PortfolioMetrics = {
  healthScore: 60,
  spi: 0.8,
  cpi: 0.9,
  capacityUtilizationPct: 120,
  openHighRisks: 5,
};

describe('simulateWhatIf — kierunek wpływu per typ interwencji', () => {
  it('add_resource: obniża wykorzystanie i podbija SPI', () => {
    const { projected } = simulateWhatIf(baseline, [{ type: 'add_resource', magnitude: 2 }]);
    expect(projected.capacityUtilizationPct!).toBeLessThan(baseline.capacityUtilizationPct!);
    expect(projected.capacityUtilizationPct).toBeCloseTo(120 - 16, 5); // 2 FTE × 8 pkt
    expect(projected.spi!).toBeGreaterThan(baseline.spi!);
    expect(projected.healthScore).toBeGreaterThan(baseline.healthScore);
  });

  it('descope: podbija SPI i healthScore', () => {
    const { projected } = simulateWhatIf(baseline, [{ type: 'descope', magnitude: 2 }]);
    expect(projected.spi!).toBeGreaterThan(baseline.spi!);
    expect(projected.healthScore).toBeGreaterThan(baseline.healthScore);
  });

  it('extend_deadline: dryfuje SPI ku 1.0 (mniej poślizgu)', () => {
    const { projected } = simulateWhatIf(baseline, [{ type: 'extend_deadline', magnitude: 5 }]);
    expect(projected.spi!).toBeGreaterThan(baseline.spi!);
    expect(projected.spi!).toBeLessThanOrEqual(1);
  });

  it('mitigate_risk: zmniejsza openHighRisks i podbija health', () => {
    const { projected } = simulateWhatIf(baseline, [{ type: 'mitigate_risk', magnitude: 2 }]);
    expect(projected.openHighRisks).toBe(3);
    expect(projected.healthScore).toBeGreaterThan(baseline.healthScore);
  });

  it('reprioritize: neutralny na CPI, lekko podbija SPI', () => {
    const { projected } = simulateWhatIf(baseline, [{ type: 'reprioritize', magnitude: 1 }]);
    expect(projected.cpi).toBe(baseline.cpi); // koszt bez zmian
    expect(projected.spi!).toBeGreaterThan(baseline.spi!);
  });
});

describe('simulateWhatIf — clampy', () => {
  it('healthScore nie przekracza 100', () => {
    const hot: PortfolioMetrics = { healthScore: 99, spi: 0.9, openHighRisks: 10 };
    const { projected } = simulateWhatIf(hot, [{ type: 'mitigate_risk', magnitude: 10 }]);
    expect(projected.healthScore).toBeLessThanOrEqual(100);
    expect(projected.healthScore).toBe(100);
  });

  it('openHighRisks nie schodzi poniżej 0', () => {
    const { projected } = simulateWhatIf(baseline, [{ type: 'mitigate_risk', magnitude: 50 }]);
    expect(projected.openHighRisks).toBe(0);
  });

  it('spi nie przekracza 2 i nie schodzi poniżej 0', () => {
    const high: PortfolioMetrics = { healthScore: 50, spi: 1.99, openHighRisks: 0 };
    const { projected } = simulateWhatIf(high, [
      { type: 'descope', magnitude: 100 },
    ]);
    expect(projected.spi!).toBeLessThanOrEqual(2);
  });

  it('capacityUtilizationPct nie schodzi poniżej 0 i clamp do 200', () => {
    const { projected } = simulateWhatIf(baseline, [{ type: 'add_resource', magnitude: 100 }]);
    expect(projected.capacityUtilizationPct!).toBeGreaterThanOrEqual(0);
    const overloaded: PortfolioMetrics = { healthScore: 50, capacityUtilizationPct: 250 };
    const { projected: p2 } = simulateWhatIf(overloaded, []);
    expect(p2.capacityUtilizationPct).toBe(200);
  });
});

describe('simulateWhatIf — brak danych i pusty zestaw', () => {
  it('pusty zestaw interwencji ≈ baseline', () => {
    const { projected, deltas, explanation } = simulateWhatIf(baseline, []);
    expect(projected.healthScore).toBe(baseline.healthScore);
    expect(projected.spi).toBe(baseline.spi);
    expect(projected.cpi).toBe(baseline.cpi);
    expect(projected.capacityUtilizationPct).toBe(baseline.capacityUtilizationPct);
    expect(projected.openHighRisks).toBe(baseline.openHighRisks);
    expect(deltas.healthScore).toBe(0);
    expect(deltas.openHighRisks).toBe(0);
    expect(explanation).toHaveLength(0);
  });

  it('spi=null pozostaje null (nie wymyśla metryki)', () => {
    const noSpi: PortfolioMetrics = { healthScore: 50, spi: null, cpi: null };
    const { projected, deltas } = simulateWhatIf(noSpi, [{ type: 'descope', magnitude: 3 }]);
    expect(projected.spi).toBeNull();
    expect(projected.cpi).toBeNull();
    expect(deltas.spi).toBeUndefined();
  });

  it('explanation cytuje każdą interwencję', () => {
    const interventions: Intervention[] = [
      { type: 'add_resource', magnitude: 1 },
      { type: 'mitigate_risk', magnitude: 1 },
    ];
    const { explanation } = simulateWhatIf(baseline, interventions);
    expect(explanation).toHaveLength(2);
    expect(explanation[0]).toContain('add_resource');
    expect(explanation[1]).toContain('mitigate_risk');
  });

  it('domyślna magnitude = 1 gdy brak', () => {
    const { projected } = simulateWhatIf(baseline, [{ type: 'add_resource' }]);
    expect(projected.capacityUtilizationPct).toBeCloseTo(120 - 8, 5);
  });
});

describe('compareScenarios — sortowanie malejące po healthDelta', () => {
  it('najlepszy scenariusz (najwyższy healthDelta) jest pierwszy', () => {
    const result = compareScenarios(baseline, [
      { label: 'lekki', interventions: [{ type: 'reprioritize', magnitude: 1 }] },
      { label: 'mocny', interventions: [{ type: 'mitigate_risk', magnitude: 5 }] },
      { label: 'sredni', interventions: [{ type: 'descope', magnitude: 2 }] },
    ]);
    expect(result).toHaveLength(3);
    expect(result[0].label).toBe('mocny');
    expect(result[0].healthDelta).toBeGreaterThanOrEqual(result[1].healthDelta);
    expect(result[1].healthDelta).toBeGreaterThanOrEqual(result[2].healthDelta);
  });

  it('remisy zachowują stabilną kolejność wejściową', () => {
    const result = compareScenarios(baseline, [
      { label: 'A', interventions: [{ type: 'reprioritize', magnitude: 1 }] },
      { label: 'B', interventions: [{ type: 'reprioritize', magnitude: 1 }] },
    ]);
    expect(result[0].healthDelta).toBe(result[1].healthDelta);
    expect(result.map((r) => r.label)).toEqual(['A', 'B']);
  });

  it('pusta lista scenariuszy = pusty wynik', () => {
    expect(compareScenarios(baseline, [])).toEqual([]);
  });
});
