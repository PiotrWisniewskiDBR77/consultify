import { describe, expect, it } from 'vitest';

import {
  PERSPECTIVES,
  bscOverview,
  groupByPerspective,
  inferPerspective,
  perspectiveHealth,
  type BscKpi,
} from '../../../server/src/services/results/balancedScorecardService.js';

const kpis: BscKpi[] = [
  { id: 'f1', name: 'Koszt operacyjny', perspective: 'financial', status: 'on-target' },
  { id: 'f2', name: 'Marża', perspective: 'financial', status: 'below' },
  { id: 'c1', name: 'NPS', perspective: 'customer', status: 'on-target' },
  { id: 'p1', name: 'Czas cyklu', perspective: 'process', status: 'no-data' },
  { id: 'l1', name: 'Szkolenia', perspective: 'learning', value: 10, target: 8 },
];

describe('groupByPerspective', () => {
  it('always returns all 4 perspectives even when empty', () => {
    const grouped = groupByPerspective([]);
    expect(Object.keys(grouped).sort()).toEqual([...PERSPECTIVES].sort());
    for (const p of PERSPECTIVES) {
      expect(grouped[p]).toEqual([]);
    }
  });

  it('routes KPIs to their declared perspective', () => {
    const grouped = groupByPerspective(kpis);
    expect(grouped.financial.map((k) => k.id)).toEqual(['f1', 'f2']);
    expect(grouped.customer.map((k) => k.id)).toEqual(['c1']);
    expect(grouped.process.map((k) => k.id)).toEqual(['p1']);
    expect(grouped.learning.map((k) => k.id)).toEqual(['l1']);
  });
});

describe('perspectiveHealth', () => {
  it('computes healthPct = onTarget / measured (no-data excluded)', () => {
    const health = perspectiveHealth(kpis);

    expect(health.financial).toMatchObject({ count: 2, onTarget: 1, below: 1, noData: 0 });
    expect(health.financial.healthPct).toBeCloseTo(0.5);

    expect(health.customer).toMatchObject({ count: 1, onTarget: 1, below: 0, noData: 0 });
    expect(health.customer.healthPct).toBeCloseTo(1);

    // no-data KPI is not measured -> healthPct falls back to 0
    expect(health.process).toMatchObject({ count: 1, onTarget: 0, below: 0, noData: 1 });
    expect(health.process.healthPct).toBe(0);

    // derived status from value/target (10 >= 8 -> on-target)
    expect(health.learning).toMatchObject({ count: 1, onTarget: 1, below: 0, noData: 0 });
    expect(health.learning.healthPct).toBeCloseTo(1);
  });

  it('returns 0 healthPct for a perspective with zero measured KPIs', () => {
    const health = perspectiveHealth([]);
    for (const p of PERSPECTIVES) {
      expect(health[p]).toEqual({ count: 0, onTarget: 0, below: 0, noData: 0, healthPct: 0 });
    }
  });
});

describe('bscOverview', () => {
  it('is balanced when every perspective has >=1 KPI', () => {
    const overview = bscOverview(kpis);
    expect(overview.balanced).toBe(true);
    // measured across all = f1,f2,c1,l1 = 4; onTarget = f1,c1,l1 = 3
    expect(overview.overallHealthPct).toBeCloseTo(3 / 4);
  });

  it('is NOT balanced when a perspective is missing', () => {
    const missingLearning = kpis.filter((k) => k.perspective !== 'learning');
    const overview = bscOverview(missingLearning);
    expect(overview.balanced).toBe(false);
  });

  it('handles empty input deterministically', () => {
    const overview = bscOverview([]);
    expect(overview.balanced).toBe(false);
    expect(overview.overallHealthPct).toBe(0);
  });
});

describe('inferPerspective', () => {
  it('maps financial keywords', () => {
    expect(inferPerspective('Koszt operacyjny')).toBe('financial');
    expect(inferPerspective('Przychód kwartalny')).toBe('financial');
    expect(inferPerspective('Marża brutto')).toBe('financial');
    expect(inferPerspective('Revenue growth')).toBe('financial');
  });

  it('maps customer keywords', () => {
    expect(inferPerspective('Klient NPS')).toBe('customer');
    expect(inferPerspective('Satysfakcja klienta')).toBe('customer');
    expect(inferPerspective('Customer retention')).toBe('customer');
  });

  it('maps process keywords', () => {
    expect(inferPerspective('Czas realizacji')).toBe('process');
    expect(inferPerspective('Cykl produkcyjny')).toBe('process');
    expect(inferPerspective('Jakość wyrobu')).toBe('process');
  });

  it('maps learning keywords', () => {
    expect(inferPerspective('Szkolenie zespołu')).toBe('learning');
    expect(inferPerspective('Rozwój kompetencji')).toBe('learning');
    expect(inferPerspective('Training hours')).toBe('learning');
  });

  it('defaults to process when nothing matches', () => {
    expect(inferPerspective('Coś zupełnie innego')).toBe('process');
    expect(inferPerspective('')).toBe('process');
  });
});
