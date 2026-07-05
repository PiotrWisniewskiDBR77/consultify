import { describe, it, expect } from 'vitest';
import {
  zScoreAnomalies,
  iqrAnomalies,
  detectAnomalies,
} from '../../../server/src/services/results/kpiAnomalyService.js';

describe('kpiAnomalyService', () => {
  describe('zScoreAnomalies', () => {
    it('returns empty list for a flat series (no spread)', () => {
      expect(zScoreAnomalies([5, 5, 5, 5])).toEqual([]);
    });

    it('returns empty list when stddev is 0 (all equal)', () => {
      expect(zScoreAnomalies([10, 10, 10])).toEqual([]);
    });

    it('returns empty list for an empty series', () => {
      expect(zScoreAnomalies([])).toEqual([]);
    });

    it('returns empty list for a single point (no determinable spread)', () => {
      expect(zScoreAnomalies([42])).toEqual([]);
    });

    it('detects a single high outlier via z-score', () => {
      // tight cluster around 10 with one spike at 100
      const hits = zScoreAnomalies([10, 11, 9, 10, 10, 10, 100], 2);
      expect(hits).toHaveLength(1);
      expect(hits[0].index).toBe(6);
      expect(hits[0].value).toBe(100);
      expect(hits[0].z).toBeGreaterThan(2);
    });

    it('respects a custom threshold (looser → no anomalies)', () => {
      const values = [10, 11, 9, 10, 10, 10, 100];
      // With a huge threshold nothing should trip.
      expect(zScoreAnomalies(values, 100)).toEqual([]);
    });

    it('filters out NaN / Infinity while keeping original indices', () => {
      // index 2 is NaN (dropped); spike sits at original index 7
      const values = [10, 11, Number.NaN, 9, 10, 10, 10, 100];
      const hits = zScoreAnomalies(values, 2);
      expect(hits).toHaveLength(1);
      expect(hits[0].index).toBe(7);
      expect(hits[0].value).toBe(100);
    });
  });

  describe('iqrAnomalies', () => {
    it('detects a high outlier outside Q3 + k*IQR', () => {
      const hits = iqrAnomalies([1, 2, 3, 4, 5, 100], 1.5);
      const high = hits.find((h) => h.value === 100);
      expect(high).toBeDefined();
      expect(high?.bound).toBe('high');
    });

    it('detects a low outlier outside Q1 - k*IQR', () => {
      const hits = iqrAnomalies([-100, 10, 11, 12, 13, 14], 1.5);
      const low = hits.find((h) => h.value === -100);
      expect(low).toBeDefined();
      expect(low?.bound).toBe('low');
    });

    it('returns empty list when IQR is 0 (no interquartile spread)', () => {
      expect(iqrAnomalies([5, 5, 5, 5, 5])).toEqual([]);
    });

    it('returns empty list for empty and single-element series', () => {
      expect(iqrAnomalies([])).toEqual([]);
      expect(iqrAnomalies([7])).toEqual([]);
    });

    it('filters NaN/Infinity and keeps original indices', () => {
      const values = [1, 2, Number.POSITIVE_INFINITY, 3, 4, 5, 100];
      const hits = iqrAnomalies(values, 1.5);
      const high = hits.find((h) => h.value === 100);
      expect(high?.index).toBe(6);
    });
  });

  describe('detectAnomalies', () => {
    it('reports no anomalies for a clean flat series', () => {
      const res = detectAnomalies([5, 5, 5, 5]);
      expect(res.summary.hasAnomalies).toBe(false);
      expect(res.summary.count).toBe(0);
      expect(res.anomalies).toEqual([]);
      expect(res.summary.method).toBe('z-score+iqr');
    });

    it('combines both methods (union) and marks agreement as severe', () => {
      const res = detectAnomalies([10, 11, 9, 10, 12, 100]);
      const spike = res.anomalies.find((a) => a.value === 100);
      expect(spike).toBeDefined();
      // both z-score and IQR catch the 100 spike → method 'both' → severe
      expect(spike?.method).toBe('both');
      expect(spike?.severity).toBe('severe');
    });

    it('returns anomalies sorted by index ascending', () => {
      const res = detectAnomalies([100, 10, 11, 9, 10, 12, -80]);
      const idx = res.anomalies.map((a) => a.index);
      const sorted = [...idx].sort((a, b) => a - b);
      expect(idx).toEqual(sorted);
    });

    it('flags a severe anomaly when |z| >= severe threshold', () => {
      // one extreme spike → very large |z|
      const res = detectAnomalies([1, 1, 1, 1, 1, 1, 1, 1, 1, 50], {
        severeZThreshold: 3,
      });
      const spike = res.anomalies.find((a) => a.value === 50);
      expect(spike?.severity).toBe('severe');
    });

    it('filters NaN/Infinity before detection', () => {
      const res = detectAnomalies([10, 11, Number.NaN, 9, 10, 12, 100]);
      // NaN must never appear as an anomaly value
      expect(res.anomalies.every((a) => Number.isFinite(a.value))).toBe(true);
      expect(res.anomalies.some((a) => a.value === 100)).toBe(true);
    });

    it('honors custom z and iqr options (loose → none)', () => {
      const res = detectAnomalies([10, 11, 9, 10, 12, 100], {
        zThreshold: 100,
        iqrK: 100,
      });
      expect(res.summary.hasAnomalies).toBe(false);
    });
  });
});
