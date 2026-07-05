import { describe, expect, it } from 'vitest';

import {
  scheduleHealth,
  valueAtRisk,
  portfolioVaR,
  varHeatmapCells,
} from '../../../server/src/services/valueAtRiskService.js';

describe('valueAtRiskService — schedule-health bridge (EVM)', () => {
  describe('scheduleHealth(spi)', () => {
    it('is SPI*100, capped at 100', () => {
      expect(scheduleHealth(0.8)).toBe(80);
      expect(scheduleHealth(0.5)).toBe(50);
      expect(scheduleHealth(1)).toBe(100);
      expect(scheduleHealth(1.3)).toBe(100); // capped
      expect(scheduleHealth(0)).toBe(0);
    });
  });

  describe('valueAtRisk(forecast, spi)', () => {
    it('SPI 0.8 => VaR = 20% of forecast, confidence = 80', () => {
      const r = valueAtRisk(100_000, 0.8);
      expect(r.valueAtRisk).toBeCloseTo(20_000, 6);
      expect(r.confidencePct).toBe(80);
      // 0.2 ratio => medium (>0.1, <=0.25)
      expect(r.level).toBe('medium');
    });

    it('SPI >= 1 => VaR ~= 0 (on/ahead of schedule)', () => {
      const onTrack = valueAtRisk(100_000, 1);
      expect(onTrack.valueAtRisk).toBeCloseTo(0, 6);
      expect(onTrack.confidencePct).toBe(100);
      expect(onTrack.level).toBe('low');

      const ahead = valueAtRisk(100_000, 1.4);
      expect(ahead.valueAtRisk).toBeCloseTo(0, 6);
      expect(ahead.confidencePct).toBe(100);
      expect(ahead.level).toBe('low');
    });

    it('SPI null => no signal: VaR 0, confidence unknown, level low', () => {
      const r = valueAtRisk(100_000, null);
      expect(r.valueAtRisk).toBe(0);
      expect(r.confidencePct).toBeNull();
      expect(r.level).toBe('low');
    });

    describe('level thresholds (VaR / forecast)', () => {
      it('ratio <= 0.1 => low (SPI 0.95 => 0.05)', () => {
        expect(valueAtRisk(100_000, 0.95).level).toBe('low');
      });
      it('0.1 < ratio <= 0.25 => medium (SPI 0.8 => 0.2)', () => {
        expect(valueAtRisk(100_000, 0.8).level).toBe('medium');
      });
      it('0.25 < ratio <= 0.5 => high (SPI 0.6 => 0.4)', () => {
        expect(valueAtRisk(100_000, 0.6).level).toBe('high');
      });
      it('ratio > 0.5 => critical (SPI 0.3 => 0.7)', () => {
        expect(valueAtRisk(100_000, 0.3).level).toBe('critical');
      });
      it('exact boundary 0.1 is low (not medium)', () => {
        // SPI 0.9 => ratio exactly 0.1
        expect(valueAtRisk(100_000, 0.9).level).toBe('low');
      });
      it('exact boundary 0.5 is high (not critical)', () => {
        // SPI 0.5 => ratio exactly 0.5
        expect(valueAtRisk(100_000, 0.5).level).toBe('high');
      });
    });
  });

  describe('portfolioVaR(items)', () => {
    it('aggregates forecast, at-risk and share across initiatives', () => {
      const r = portfolioVaR([
        { initiativeId: 'a', benefitForecast: 100_000, spi: 0.8 }, // VaR 20k
        { initiativeId: 'b', benefitForecast: 50_000, spi: 1.0 }, //  VaR 0
        { initiativeId: 'c', benefitForecast: 50_000, spi: null }, // VaR 0 (no signal)
      ]);

      expect(r.totalForecast).toBe(200_000);
      expect(r.totalAtRisk).toBeCloseTo(20_000, 6);
      expect(r.atRiskPct).toBeCloseTo(0.1, 6);

      expect(r.byInitiative).toHaveLength(3);
      const a = r.byInitiative.find((i) => i.initiativeId === 'a')!;
      expect(a.valueAtRisk).toBeCloseTo(20_000, 6);
      expect(a.confidencePct).toBe(80);
      const c = r.byInitiative.find((i) => i.initiativeId === 'c')!;
      expect(c.confidencePct).toBeNull();
    });

    it('empty portfolio => zeros, no division by zero', () => {
      const r = portfolioVaR([]);
      expect(r.totalForecast).toBe(0);
      expect(r.totalAtRisk).toBe(0);
      expect(r.atRiskPct).toBe(0);
      expect(r.byInitiative).toEqual([]);
    });
  });

  describe('varHeatmapCells(items)', () => {
    it('intensity = atRisk / forecast, clamped 0..1', () => {
      const cells = varHeatmapCells([
        { initiativeId: 'a', benefitForecast: 100_000, spi: 0.8 }, // 0.2
        { initiativeId: 'b', benefitForecast: 100_000, spi: 1.0 }, // 0
        { initiativeId: 'c', benefitForecast: 100_000, spi: 0.3 }, // 0.7
        { initiativeId: 'd', benefitForecast: 0, spi: 0.5 }, //       0 (guard)
      ]);

      expect(cells).toEqual([
        { initiativeId: 'a', intensity: expect.closeTo(0.2, 6) },
        { initiativeId: 'b', intensity: expect.closeTo(0, 6) },
        { initiativeId: 'c', intensity: expect.closeTo(0.7, 6) },
        { initiativeId: 'd', intensity: 0 },
      ]);
    });
  });
});
