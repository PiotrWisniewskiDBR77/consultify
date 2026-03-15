import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { ScheduledAutomationExecutor, validateCronExpression } from '../ScheduledAutomationExecutor.js';

describe('ScheduledAutomationExecutor', () => {
  let executor: ScheduledAutomationExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new ScheduledAutomationExecutor();
  });

  // -----------------------------------------------------------------------
  // calculateNextRun
  // -----------------------------------------------------------------------

  describe('calculateNextRun', () => {
    it("'0 9 * * *' returns next 9am UTC", () => {
      const next = executor.calculateNextRun('0 9 * * *', 'UTC');

      const hours = next.getUTCHours();
      const minutes = next.getUTCMinutes();
      expect(hours).toBe(9);
      expect(minutes).toBe(0);
      expect(next.getTime()).toBeGreaterThan(Date.now());
    });

    it("'*/15 * * * *' returns next 15-min mark", () => {
      const next = executor.calculateNextRun('*/15 * * * *', 'UTC');

      const minutes = next.getUTCMinutes();
      expect(minutes % 15).toBe(0);
      expect(next.getTime()).toBeGreaterThan(Date.now());
    });

    it("'0 9 * * 1-5' skips weekends", () => {
      const next = executor.calculateNextRun('0 9 * * 1-5', 'UTC');

      const dayOfWeek = next.getUTCDay();
      expect(dayOfWeek).toBeGreaterThanOrEqual(1);
      expect(dayOfWeek).toBeLessThanOrEqual(5);
    });
  });

  // -----------------------------------------------------------------------
  // matchesCronField (tested indirectly via calculateNextRun)
  // -----------------------------------------------------------------------

  describe('matchesCronField (via calculateNextRun)', () => {
    it("'*' matches any value — every-minute cron finds next minute", () => {
      const next = executor.calculateNextRun('* * * * *', 'UTC');
      const diffMs = next.getTime() - Date.now();
      expect(diffMs).toBeLessThanOrEqual(60_000 + 1000);
      expect(diffMs).toBeGreaterThan(0);
    });

    it("'*/5' matches multiples of 5 — next run is on a 5-min boundary", () => {
      const next = executor.calculateNextRun('*/5 * * * *', 'UTC');
      expect(next.getUTCMinutes() % 5).toBe(0);
    });

    it("'1-5' matches range — day of week is Mon-Fri", () => {
      const next = executor.calculateNextRun('0 12 * * 1-5', 'UTC');
      const dow = next.getUTCDay();
      expect(dow).toBeGreaterThanOrEqual(1);
      expect(dow).toBeLessThanOrEqual(5);
    });

    it("'1,3,5' matches list — day of week is Mon, Wed, or Fri", () => {
      const next = executor.calculateNextRun('0 12 * * 1,3,5', 'UTC');
      const dow = next.getUTCDay();
      expect([1, 3, 5]).toContain(dow);
    });
  });

  // -----------------------------------------------------------------------
  // validateCronExpression
  // -----------------------------------------------------------------------

  describe('validateCronExpression', () => {
    it('accepts valid cron expression', () => {
      const result = validateCronExpression('0 9 * * *');

      expect(result.valid).toBe(true);
      expect(result.description).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('accepts every-15-minutes cron', () => {
      const result = validateCronExpression('*/15 * * * *');

      expect(result.valid).toBe(true);
      expect(result.description).toContain('15 minutes');
    });

    it('accepts weekday cron', () => {
      const result = validateCronExpression('0 9 * * 1-5');

      expect(result.valid).toBe(true);
      expect(result.description).toContain('weekdays');
    });

    it('rejects invalid cron with wrong field count', () => {
      const result = validateCronExpression('0 9 *');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('5 fields');
    });

    it('rejects cron with too many fields', () => {
      const result = validateCronExpression('0 9 * * * *');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('5 fields');
    });

    it('rejects out-of-range minute value', () => {
      const result = validateCronExpression('60 9 * * *');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('minute');
    });

    it('rejects out-of-range hour value', () => {
      const result = validateCronExpression('0 25 * * *');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('hour');
    });

    it('rejects out-of-range day-of-week value', () => {
      const result = validateCronExpression('0 9 * * 8');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('day of week');
    });
  });
});
