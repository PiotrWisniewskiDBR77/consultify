import { describe, expect, it } from 'vitest';
import {
  linearTrend,
  forecastValue,
  projectToTarget,
  leadingAlert,
} from '../../../server/src/services/results/kpiForecastService.js';

describe('kpiForecastService.linearTrend', () => {
  it('wykrywa trend rosnący (slope > 0)', () => {
    const { slope, intercept } = linearTrend([
      { t: 0, value: 0 },
      { t: 1, value: 2 },
      { t: 2, value: 4 },
      { t: 3, value: 6 },
    ]);
    expect(slope).toBeCloseTo(2, 6);
    expect(intercept).toBeCloseTo(0, 6);
  });

  it('wykrywa trend malejący (slope < 0)', () => {
    const { slope, intercept } = linearTrend([
      { t: 0, value: 10 },
      { t: 1, value: 8 },
      { t: 2, value: 6 },
    ]);
    expect(slope).toBeCloseTo(-2, 6);
    expect(intercept).toBeCloseTo(10, 6);
  });

  it('slope = 0 przy mniej niż 2 punktach', () => {
    expect(linearTrend([])).toEqual({ slope: 0, intercept: 0 });
    expect(linearTrend([{ t: 5, value: 7 }])).toEqual({ slope: 0, intercept: 7 });
  });

  it('ignoruje punkty z wartościami niefinalnymi', () => {
    const { slope } = linearTrend([
      { t: 0, value: 0 },
      { t: 1, value: Number.NaN },
      { t: 2, value: 4 },
    ]);
    // pozostają (0,0) i (2,4) → slope = 2
    expect(slope).toBeCloseTo(2, 6);
  });
});

describe('kpiForecastService.forecastValue', () => {
  it('prognozuje wartość w przyszłym t z trendu', () => {
    const pts = [
      { t: 0, value: 0 },
      { t: 1, value: 2 },
      { t: 2, value: 4 },
    ];
    expect(forecastValue(pts, 5)).toBeCloseTo(10, 6);
  });

  it('zwraca null gdy brak punktów', () => {
    expect(forecastValue([], 3)).toBeNull();
  });
});

describe('kpiForecastService.projectToTarget', () => {
  it('HIGHER_IS_BETTER: trend rosnący trafia w target w przyszłości', () => {
    const res = projectToTarget({
      points: [
        { t: 0, value: 0 },
        { t: 1, value: 2 },
        { t: 2, value: 4 },
        { t: 3, value: 6 },
        { t: 4, value: 8 },
      ],
      target: 10,
      direction: 'HIGHER_IS_BETTER',
    });
    expect(res.willHitTarget).toBe(true);
    expect(res.etaT).toBeCloseTo(5, 6);
    expect(res.projectedAtLast).toBeCloseTo(8, 6);
    expect(res.confidence).toBe('high');
  });

  it('HIGHER_IS_BETTER: trend malejący NIE trafia w wyższy target', () => {
    const res = projectToTarget({
      points: [
        { t: 0, value: 10 },
        { t: 1, value: 8 },
        { t: 2, value: 6 },
      ],
      target: 20,
      direction: 'HIGHER_IS_BETTER',
    });
    expect(res.willHitTarget).toBe(false);
    expect(res.etaT).toBeNull();
  });

  it('LOWER_IS_BETTER: trend malejący trafia w niższy target', () => {
    const res = projectToTarget({
      points: [
        { t: 0, value: 10 },
        { t: 1, value: 8 },
        { t: 2, value: 6 },
      ],
      target: 0,
      direction: 'LOWER_IS_BETTER',
    });
    expect(res.willHitTarget).toBe(true);
    expect(res.etaT).toBeCloseTo(5, 6);
  });

  it('LOWER_IS_BETTER: trend rosnący NIE trafia w niższy target', () => {
    const res = projectToTarget({
      points: [
        { t: 0, value: 0 },
        { t: 1, value: 2 },
        { t: 2, value: 4 },
      ],
      target: -5,
      direction: 'LOWER_IS_BETTER',
    });
    expect(res.willHitTarget).toBe(false);
    expect(res.etaT).toBeNull();
  });

  it('target już osiągnięty na ostatnim t → willHit true', () => {
    const res = projectToTarget({
      points: [
        { t: 0, value: 4 },
        { t: 1, value: 6 },
        { t: 2, value: 8 },
      ],
      target: 5,
      direction: 'HIGHER_IS_BETTER',
    });
    expect(res.willHitTarget).toBe(true);
  });

  it('pusty szereg → brak prognozy, confidence low', () => {
    const res = projectToTarget({
      points: [],
      target: 10,
      direction: 'HIGHER_IS_BETTER',
    });
    expect(res.willHitTarget).toBe(false);
    expect(res.etaT).toBeNull();
    expect(res.projectedAtLast).toBeNull();
    expect(res.confidence).toBe('low');
  });
});

describe('kpiForecastService.leadingAlert', () => {
  it('alert gdy target nie zostanie trafiony', () => {
    const proj = projectToTarget({
      points: [
        { t: 0, value: 10 },
        { t: 1, value: 8 },
        { t: 2, value: 6 },
      ],
      target: 20,
      direction: 'HIGHER_IS_BETTER',
    });
    const a = leadingAlert(proj);
    expect(a.alert).toBe(true);
    expect(a.message).toMatch(/nie osiągnie/i);
  });

  it('alert gdy target trafiony, ale po deadline', () => {
    const proj = projectToTarget({
      points: [
        { t: 0, value: 0 },
        { t: 1, value: 2 },
        { t: 2, value: 4 },
        { t: 3, value: 6 },
      ],
      target: 10,
      direction: 'HIGHER_IS_BETTER',
    });
    // etaT = 5, deadline = 4 → alert
    const a = leadingAlert(proj, 4);
    expect(a.alert).toBe(true);
    expect(a.message).toMatch(/deadline/i);
  });

  it('brak alertu gdy target trafiony przed deadline', () => {
    const proj = projectToTarget({
      points: [
        { t: 0, value: 0 },
        { t: 1, value: 2 },
        { t: 2, value: 4 },
        { t: 3, value: 6 },
      ],
      target: 10,
      direction: 'HIGHER_IS_BETTER',
    });
    // etaT = 5, deadline = 8 → bez alertu
    const a = leadingAlert(proj, 8);
    expect(a.alert).toBe(false);
  });
});
