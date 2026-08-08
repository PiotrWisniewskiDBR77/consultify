import { describe, expect, it } from 'vitest';

import { calculateNextScheduleRun } from '../wave8AgentRuntimeService.js';

describe('calculateNextScheduleRun', () => {
  it('preserves Warsaw wall-clock time across the spring DST transition', () => {
    expect(calculateNextScheduleRun('2026-03-28T09:00:00.000Z', 'daily', 'Europe/Warsaw')).toBe(
      '2026-03-29T08:00:00.000Z'
    );
  });

  it('preserves Warsaw wall-clock time across the autumn DST transition', () => {
    expect(calculateNextScheduleRun('2026-10-24T08:00:00.000Z', 'daily', 'Europe/Warsaw')).toBe(
      '2026-10-25T09:00:00.000Z'
    );
  });

  it('rejects an invalid timezone and ends one-time schedules', () => {
    expect(calculateNextScheduleRun('2026-08-07T10:00:00.000Z', 'once', 'UTC')).toBeNull();
    expect(() =>
      calculateNextScheduleRun('2026-08-07T10:00:00.000Z', 'daily', 'Mars/Olympus')
    ).toThrow('invalid_schedule_timezone');
  });
});
