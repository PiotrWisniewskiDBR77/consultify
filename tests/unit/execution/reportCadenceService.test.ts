import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock DbPromise: `all` is the only function the service touches.
const dbAll = vi.hoisted(() => vi.fn());

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: dbAll,
  default: { all: dbAll },
}));

import {
  isReportDue,
  nextDueDate,
  findDueReports,
  PERIOD_DAYS,
} from '../../../server/src/services/reportCadenceService.js';

const DAY = 24 * 60 * 60 * 1000;
// Fixed "now" anchor: 2026-06-23T12:00:00Z
const NOW = Date.parse('2026-06-23T12:00:00.000Z');

function daysAgo(n: number): string {
  return new Date(NOW - n * DAY).toISOString();
}

describe('isReportDue (CZYSTA)', () => {
  it('never generated → due', () => {
    expect(isReportDue('WEEKLY', null, NOW)).toBe(true);
    expect(isReportDue('MONTHLY', null, NOW)).toBe(true);
    expect(isReportDue('QUARTERLY', null, NOW)).toBe(true);
  });

  it('unparseable last value → due', () => {
    expect(isReportDue('WEEKLY', 'not-a-date', NOW)).toBe(true);
  });

  it('fresh report → not due (each period type)', () => {
    expect(isReportDue('WEEKLY', daysAgo(1), NOW)).toBe(false);
    expect(isReportDue('MONTHLY', daysAgo(5), NOW)).toBe(false);
    expect(isReportDue('QUARTERLY', daysAgo(10), NOW)).toBe(false);
  });

  it('after the full period elapses → due', () => {
    expect(isReportDue('WEEKLY', daysAgo(7), NOW)).toBe(true);
    expect(isReportDue('WEEKLY', daysAgo(8), NOW)).toBe(true);
    expect(isReportDue('MONTHLY', daysAgo(30), NOW)).toBe(true);
    expect(isReportDue('MONTHLY', daysAgo(31), NOW)).toBe(true);
    expect(isReportDue('QUARTERLY', daysAgo(90), NOW)).toBe(true);
    expect(isReportDue('QUARTERLY', daysAgo(91), NOW)).toBe(true);
  });

  it('just under the period boundary → not due', () => {
    // 6.9 days < 7 days
    expect(isReportDue('WEEKLY', new Date(NOW - 6.9 * DAY).toISOString(), NOW)).toBe(false);
    // 29.9 days < 30 days
    expect(isReportDue('MONTHLY', new Date(NOW - 29.9 * DAY).toISOString(), NOW)).toBe(false);
    // 89.9 days < 90 days
    expect(isReportDue('QUARTERLY', new Date(NOW - 89.9 * DAY).toISOString(), NOW)).toBe(false);
  });

  it('parses Postgres space-separated timestamps as UTC', () => {
    // 8 days ago in "YYYY-MM-DD HH:MM:SS" form (CURRENT_TIMESTAMP shape).
    const pg = new Date(NOW - 8 * DAY).toISOString().replace('T', ' ').slice(0, 19);
    expect(isReportDue('WEEKLY', pg, NOW)).toBe(true);
    const pgRecent = new Date(NOW - 1 * DAY).toISOString().replace('T', ' ').slice(0, 19);
    expect(isReportDue('WEEKLY', pgRecent, NOW)).toBe(false);
  });
});

describe('nextDueDate (CZYSTA)', () => {
  it('never generated → now + one period', () => {
    expect(nextDueDate('WEEKLY', null, NOW)).toBe(new Date(NOW + 7 * DAY).toISOString());
    expect(nextDueDate('MONTHLY', null, NOW)).toBe(new Date(NOW + 30 * DAY).toISOString());
    expect(nextDueDate('QUARTERLY', null, NOW)).toBe(new Date(NOW + 90 * DAY).toISOString());
  });

  it('anchored to last report + one period', () => {
    const last = daysAgo(2);
    const lastMs = Date.parse(last);
    expect(nextDueDate('WEEKLY', last, NOW)).toBe(new Date(lastMs + 7 * DAY).toISOString());
  });

  it('period lengths match PERIOD_DAYS', () => {
    expect(PERIOD_DAYS).toEqual({ WEEKLY: 7, MONTHLY: 30, QUARTERLY: 90 });
  });
});

describe('findDueReports (DbPromise mock)', () => {
  beforeEach(() => {
    dbAll.mockReset();
  });

  it('returns only due (initiative, periodType) pairs', async () => {
    // Two initiatives × three period rows each (LEFT JOIN MAX shape).
    dbAll.mockResolvedValueOnce([
      // init-1: weekly never generated (due), monthly fresh (not due), quarterly old (due)
      { initiative_id: 'init-1', period_type: 'WEEKLY', last_generated_at: null },
      { initiative_id: 'init-1', period_type: 'MONTHLY', last_generated_at: daysAgo(3) },
      { initiative_id: 'init-1', period_type: 'QUARTERLY', last_generated_at: daysAgo(120) },
      // init-2: weekly old (due), monthly fresh (not due), quarterly fresh (not due)
      { initiative_id: 'init-2', period_type: 'WEEKLY', last_generated_at: daysAgo(9) },
      { initiative_id: 'init-2', period_type: 'MONTHLY', last_generated_at: daysAgo(10) },
      { initiative_id: 'init-2', period_type: 'QUARTERLY', last_generated_at: daysAgo(10) },
    ]);

    const due = await findDueReports('org-1', NOW);

    expect(due).toEqual([
      { initiativeId: 'init-1', periodType: 'WEEKLY' },
      { initiativeId: 'init-1', periodType: 'QUARTERLY' },
      { initiativeId: 'init-2', periodType: 'WEEKLY' },
    ]);
  });

  it('passes orgId as the only bound param (org-scope)', async () => {
    dbAll.mockResolvedValueOnce([]);
    await findDueReports('org-42', NOW);

    expect(dbAll).toHaveBeenCalledTimes(1);
    const [sql, params] = dbAll.mock.calls[0];
    expect(params).toEqual(['org-42']);
    expect(sql).toMatch(/i\.organization_id = \?/);
    expect(sql).toMatch(/EXECUTING/);
    expect(sql).toMatch(/LEFT JOIN status_reports/);
  });

  it('ignores unknown period types defensively', async () => {
    dbAll.mockResolvedValueOnce([
      { initiative_id: 'init-1', period_type: 'DAILY', last_generated_at: null },
      { initiative_id: 'init-1', period_type: 'WEEKLY', last_generated_at: null },
    ]);
    const due = await findDueReports('org-1', NOW);
    expect(due).toEqual([{ initiativeId: 'init-1', periodType: 'WEEKLY' }]);
  });

  it('empty initiative set → empty list', async () => {
    dbAll.mockResolvedValueOnce([]);
    expect(await findDueReports('org-1', NOW)).toEqual([]);
  });
});
