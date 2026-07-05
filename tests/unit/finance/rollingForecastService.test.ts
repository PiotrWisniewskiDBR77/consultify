/**
 * Rolling Forecast Service tests (M16/6.2)
 */

import { describe, expect, it } from 'vitest';

import {
  fyBridge,
  reforecast,
  rollForward,
  snapshotForecast,
  type PeriodValue,
} from '../../../server/src/services/rollingForecastService.js';

const plan: PeriodValue[] = [
  { period: '2026-M01', value: 100 },
  { period: '2026-M02', value: 110 },
  { period: '2026-M03', value: 120 },
  { period: '2026-M04', value: 130 },
];

// M01/M02 are closed (actuals present); M03/M04 are still in the future.
const actuals: PeriodValue[] = [
  { period: '2026-M01', value: 90 },
  { period: '2026-M02', value: 115 },
];

describe('reforecast', () => {
  it('takes actuals for closed periods and plan for future periods', () => {
    const result = reforecast(plan, actuals);

    expect(result).toEqual([
      { period: '2026-M01', value: 90, source: 'actual' },
      { period: '2026-M02', value: 115, source: 'actual' },
      { period: '2026-M03', value: 120, source: 'forecast' },
      { period: '2026-M04', value: 130, source: 'forecast' },
    ]);
  });

  it('preserves plan order and length', () => {
    const result = reforecast(plan, actuals);
    expect(result.map((r) => r.period)).toEqual(plan.map((p) => p.period));
  });

  it('treats all periods as forecast when no actuals exist', () => {
    const result = reforecast(plan, []);
    expect(result.every((r) => r.source === 'forecast')).toBe(true);
  });
});

describe('rollForward', () => {
  it('emits exactly N periods forward', () => {
    const result = rollForward(plan, 3);
    expect(result).toHaveLength(3);
  });

  it('extrapolates by the trailing trend and increments period labels', () => {
    // last two: 120 -> 130, step = +10
    const result = rollForward(plan, 2);
    expect(result).toEqual([
      { period: '2026-M05', value: 140 },
      { period: '2026-M06', value: 150 },
    ]);
  });

  it('defaults to one period forward', () => {
    const result = rollForward(plan);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ period: '2026-M05', value: 140 });
  });

  it('repeats the last value when only one point is given', () => {
    const result = rollForward([{ period: '2026-M01', value: 42 }], 2);
    expect(result).toEqual([
      { period: '2026-M02', value: 42 },
      { period: '2026-M03', value: 42 },
    ]);
  });

  it('returns empty for empty input or zero periods', () => {
    expect(rollForward([], 3)).toEqual([]);
    expect(rollForward(plan, 0)).toEqual([]);
  });
});

describe('fyBridge', () => {
  it('splits FY into YTD actual + remaining forecast', () => {
    const bridge = fyBridge(plan, actuals);

    expect(bridge.ytdActual).toBe(90 + 115); // 205
    expect(bridge.remainingForecast).toBe(120 + 130); // 250
    expect(bridge.fyPlan).toBe(100 + 110 + 120 + 130); // 460
  });

  it('satisfies ytdActual + remainingForecast === fyForecast', () => {
    const bridge = fyBridge(plan, actuals);
    expect(bridge.ytdActual + bridge.remainingForecast).toBe(bridge.fyForecast);
  });

  it('computes variance as fyForecast - fyPlan', () => {
    const bridge = fyBridge(plan, actuals);
    // fyForecast = 205 + 250 = 455; fyPlan = 460; variance = -5
    expect(bridge.fyForecast).toBe(455);
    expect(bridge.variance).toBe(-5);
  });
});

describe('snapshotForecast', () => {
  it('captures label, supplied period, and a deep copy of lines', () => {
    const forecast: PeriodValue[] = [{ period: '2026-M01', value: 10 }];
    const snap = snapshotForecast(forecast, 'v1', '2026-M02');

    expect(snap.label).toBe('v1');
    expect(snap.createdPeriod).toBe('2026-M02');
    expect(snap.lines).toEqual([{ period: '2026-M01', value: 10 }]);

    // mutation of source must not leak into the snapshot
    forecast[0].value = 999;
    expect(snap.lines[0].value).toBe(10);
  });
});
