import { describe, expect, it } from 'vitest';

import {
  SLA_WINDOW_MS,
  computeSlaDueAtIso,
  slaWindowMs,
} from '../../../server/src/services/feedbackSla';

const HOUR = 60 * 60 * 1000;

describe('feedbackSla', () => {
  describe('slaWindowMs', () => {
    it('maps each severity to its window', () => {
      expect(slaWindowMs('CRITICAL')).toBe(4 * HOUR);
      expect(slaWindowMs('HIGH')).toBe(24 * HOUR);
      expect(slaWindowMs('MEDIUM')).toBe(72 * HOUR);
      expect(slaWindowMs('LOW')).toBe(168 * HOUR);
    });

    it('is case-insensitive', () => {
      expect(slaWindowMs('critical')).toBe(SLA_WINDOW_MS.CRITICAL);
      expect(slaWindowMs('High')).toBe(SLA_WINDOW_MS.HIGH);
    });

    it('falls back to priority when severity is missing/unknown', () => {
      expect(slaWindowMs(null, 'CRITICAL')).toBe(SLA_WINDOW_MS.CRITICAL);
      expect(slaWindowMs('', 'URGENT')).toBe(SLA_WINDOW_MS.CRITICAL);
      expect(slaWindowMs(undefined, 'HIGH')).toBe(SLA_WINDOW_MS.HIGH);
      expect(slaWindowMs('nonsense', 'LOW')).toBe(SLA_WINDOW_MS.LOW);
    });

    it('defaults to MEDIUM when nothing resolves', () => {
      expect(slaWindowMs(null, null)).toBe(SLA_WINDOW_MS.MEDIUM);
      expect(slaWindowMs('', '')).toBe(SLA_WINDOW_MS.MEDIUM);
    });
  });

  describe('computeSlaDueAtIso', () => {
    it('adds the window to createdAt and returns ISO', () => {
      const created = Date.UTC(2026, 0, 1, 0, 0, 0); // 2026-01-01T00:00:00Z
      expect(computeSlaDueAtIso('CRITICAL', null, created)).toBe('2026-01-01T04:00:00.000Z');
      expect(computeSlaDueAtIso('HIGH', null, created)).toBe('2026-01-02T00:00:00.000Z');
      expect(computeSlaDueAtIso('LOW', null, created)).toBe('2026-01-08T00:00:00.000Z');
    });

    it('a CRITICAL ticket is due sooner than a LOW one', () => {
      const created = Date.UTC(2026, 5, 1, 12, 0, 0);
      const critical = new Date(computeSlaDueAtIso('CRITICAL', null, created)).getTime();
      const low = new Date(computeSlaDueAtIso('LOW', null, created)).getTime();
      expect(critical).toBeLessThan(low);
    });
  });
});
