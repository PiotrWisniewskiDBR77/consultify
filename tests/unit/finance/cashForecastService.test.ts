import { describe, it, expect } from 'vitest';

import {
  directCashForecast,
  runway,
  minCashAlerts,
  cashCurve,
  type CashForecastRow,
} from '../../../server/src/services/cashForecastService.js';

describe('cashForecastService', () => {
  describe('directCashForecast', () => {
    it('accumulates closing cash from openingCash across periods', () => {
      const forecast = directCashForecast({
        openingCash: 100,
        periods: [
          { period: '2026-01', inflows: 50, outflows: 30 }, // net +20
          { period: '2026-02', inflows: 40, outflows: 60 }, // net -20
          { period: '2026-03', inflows: 10, outflows: 5 }, // net +5
        ],
      });

      expect(forecast).toHaveLength(3);

      expect(forecast[0]).toMatchObject({ period: '2026-01', netCash: 20, closingCash: 120 });
      expect(forecast[1]).toMatchObject({ period: '2026-02', netCash: -20, closingCash: 100 });
      expect(forecast[2]).toMatchObject({ period: '2026-03', netCash: 5, closingCash: 105 });

      // closingCash of one period is the opening of the next (cumulative chain)
      expect(forecast[2].closingCash).toBe(105);
    });

    it('labels periods by index when no period name given', () => {
      const forecast = directCashForecast({
        openingCash: 0,
        periods: [{ inflows: 10, outflows: 0 }, { inflows: 0, outflows: 4 }],
      });
      expect(forecast.map((r) => r.period)).toEqual(['P1', 'P2']);
      expect(forecast[1].closingCash).toBe(6);
    });

    it('returns [] for empty periods', () => {
      expect(directCashForecast({ openingCash: 100, periods: [] })).toEqual([]);
    });
  });

  describe('runway', () => {
    it('counts periods until cash is exhausted (closingCash <= 0)', () => {
      // opening 100, burning 40/period → closes 60, 20, -20, -60
      const forecast = directCashForecast({
        openingCash: 100,
        periods: [
          { period: 'M1', inflows: 0, outflows: 40 },
          { period: 'M2', inflows: 0, outflows: 40 },
          { period: 'M3', inflows: 0, outflows: 40 },
          { period: 'M4', inflows: 0, outflows: 40 },
        ],
      });

      const r = runway(forecast);
      // M1=60, M2=20 survive; M3=-20 is first non-positive
      expect(r.runwayPeriods).toBe(2);
      expect(r.cashOutPeriod).toBe('M3');
    });

    it('returns full length and null cash-out when cash never runs out', () => {
      const forecast = directCashForecast({
        openingCash: 100,
        periods: [
          { period: 'M1', inflows: 50, outflows: 10 },
          { period: 'M2', inflows: 50, outflows: 10 },
        ],
      });
      const r = runway(forecast);
      expect(r.runwayPeriods).toBe(2);
      expect(r.cashOutPeriod).toBeNull();
    });

    it('extrapolates remaining periods from monthlyBurn when forecast stays positive', () => {
      const forecast = directCashForecast({
        openingCash: 100,
        periods: [{ period: 'M1', inflows: 0, outflows: 0 }], // closes at 100
      });
      // final cash 100, burn 25/period → 4 extra periods
      const r = runway(forecast, 25);
      expect(r.runwayPeriods).toBe(1 + 4);
      expect(r.cashOutPeriod).toBeNull();
    });
  });

  describe('minCashAlerts', () => {
    it('flags periods where closingCash dips below the floor with shortfall', () => {
      const forecast: CashForecastRow[] = [
        { period: 'M1', inflows: 0, outflows: 0, netCash: 0, closingCash: 80 },
        { period: 'M2', inflows: 0, outflows: 0, netCash: 0, closingCash: 30 },
        { period: 'M3', inflows: 0, outflows: 0, netCash: 0, closingCash: -10 },
      ];

      const alerts = minCashAlerts(forecast, 50);
      // M1 (80) is above floor; M2 (30) and M3 (-10) breach
      expect(alerts).toHaveLength(2);
      expect(alerts[0]).toEqual({ period: 'M2', closingCash: 30, shortfall: 20 });
      expect(alerts[1]).toEqual({ period: 'M3', closingCash: -10, shortfall: 60 });
    });

    it('returns [] when all periods stay at or above the floor', () => {
      const forecast: CashForecastRow[] = [
        { period: 'M1', inflows: 0, outflows: 0, netCash: 0, closingCash: 50 },
        { period: 'M2', inflows: 0, outflows: 0, netCash: 0, closingCash: 90 },
      ];
      expect(minCashAlerts(forecast, 50)).toEqual([]);
    });
  });

  describe('cashCurve', () => {
    it('maps closing cash to {t, cash} points preserving order', () => {
      const forecast = directCashForecast({
        openingCash: 100,
        periods: [
          { period: 'M1', inflows: 0, outflows: 40 },
          { period: 'M2', inflows: 0, outflows: 40 },
        ],
      });

      const curve = cashCurve(forecast);
      expect(curve).toEqual([
        { t: 'M1', cash: 60 },
        { t: 'M2', cash: 20 },
      ]);
    });

    it('returns [] for empty forecast', () => {
      expect(cashCurve([])).toEqual([]);
    });
  });
});
