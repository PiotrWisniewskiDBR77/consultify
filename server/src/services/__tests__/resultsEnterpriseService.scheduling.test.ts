/**
 * Residual #10 — pure scheduling helpers in resultsEnterpriseService.
 *
 * deriveLookbackDays / resolveNextRunAt / calculateNextRunFromCron / matchesCronField /
 * calculateNextRunFromSendAt are module-scoped (not exported), so they are exercised here
 * through the public API surface that returns `nextRunAt`:
 *   - createConnector       → resolveNextRunAt({ scheduleCron })   → cron engine
 *   - createReportSchedule  → resolveNextRunAt({ scheduleCron, sendAt }) → cron + sendAt engine
 *
 * Expectations are hand-derived from the cron field rules, NOT snapshotted from service
 * output. The cron matcher uses LOCAL Date fields (getMinutes/getHours/getDate/getMonth/
 * getDay), so each expectation is built with the same local `new Date(y, m, d, h, min)`
 * constructor — this cancels the runner's timezone instead of hardcoding a UTC string.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryRun = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
  queryOne: (...a: unknown[]) => mockQueryOne(...a),
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../reportBuilderService.js', () => ({
  createReport: vi.fn(),
  updateSectionContent: vi.fn(),
  updateReportStatus: vi.fn(),
}));
vi.mock('../results/kpiDeviationService.js', () => ({ handleTimeSeriesRecorded: vi.fn() }));
vi.mock('../results/kpiReportSnapshotService.js', () => ({ createKpiReportSnapshot: vi.fn() }));

const ORG = 'org-1';
const USER = 'user-1';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let service: any;

beforeEach(async () => {
  vi.clearAllMocks();
  mockQueryRun.mockResolvedValue({ changes: 1 });
  mockQueryOne.mockResolvedValue(null);
  mockQueryAll.mockResolvedValue([]);
  const mod = await import('../resultsEnterpriseService.js');
  service = mod.resultsEnterpriseService;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('resolveNextRunAt — cron engine (via createConnector)', () => {
  it('daily cron "30 9 * * *" resolves to today 09:30 when now is before it', async () => {
    // now = local 2026-03-10 08:00:00
    vi.useFakeTimers().setSystemTime(new Date(2026, 2, 10, 8, 0, 0, 0));
    const { nextRunAt } = await service.createConnector(ORG, USER, {
      connectorName: 'c',
      config: {},
      scheduleCron: '30 9 * * *',
    });
    // Engine starts at now+1min and steps forward → first 09:30 is the same day.
    expect(nextRunAt).toBe(new Date(2026, 2, 10, 9, 30, 0, 0).toISOString());
  });

  it('daily cron "30 9 * * *" rolls to tomorrow when now is past today\'s slot', async () => {
    // now = local 2026-03-10 10:00:00 (already past 09:30)
    vi.useFakeTimers().setSystemTime(new Date(2026, 2, 10, 10, 0, 0, 0));
    const { nextRunAt } = await service.createConnector(ORG, USER, {
      connectorName: 'c',
      config: {},
      scheduleCron: '30 9 * * *',
    });
    expect(nextRunAt).toBe(new Date(2026, 2, 11, 9, 30, 0, 0).toISOString());
  });

  it('step cron "*/15 * * * *" resolves to the next quarter-hour', async () => {
    // now = local 2026-03-10 08:07:00 → start 08:08 → first minute %15==0 is 08:15
    vi.useFakeTimers().setSystemTime(new Date(2026, 2, 10, 8, 7, 0, 0));
    const { nextRunAt } = await service.createConnector(ORG, USER, {
      connectorName: 'c',
      config: {},
      scheduleCron: '*/15 * * * *',
    });
    expect(nextRunAt).toBe(new Date(2026, 2, 10, 8, 15, 0, 0).toISOString());
  });

  it('monthly cron "0 0 1 * *" resolves to midnight of the next month-start', async () => {
    // now = local 2026-03-10 08:00 → next day-of-month 1 at 00:00 is 2026-04-01
    vi.useFakeTimers().setSystemTime(new Date(2026, 2, 10, 8, 0, 0, 0));
    const { nextRunAt } = await service.createConnector(ORG, USER, {
      connectorName: 'c',
      config: {},
      scheduleCron: '0 0 1 * *',
    });
    expect(nextRunAt).toBe(new Date(2026, 3, 1, 0, 0, 0, 0).toISOString());
  });

  it('no cron + no sendAt → nextRunAt is null', async () => {
    const { nextRunAt } = await service.createConnector(ORG, USER, {
      connectorName: 'c',
      config: {},
    });
    expect(nextRunAt).toBeNull();
  });

  it('malformed cron (wrong field count) → nextRunAt is null', async () => {
    const { nextRunAt } = await service.createConnector(ORG, USER, {
      connectorName: 'c',
      config: {},
      scheduleCron: '30 9 *', // 3 fields, not 5
    });
    expect(nextRunAt).toBeNull();
  });
});

describe('resolveNextRunAt — sendAt engine (via createReportSchedule)', () => {
  const base = {
    reportName: 'r',
    kpiIds: ['k1'],
    recipientPolicy: { channel: 'email' },
  };

  it('sendAt "14:30" resolves to today when now is before it', async () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 2, 10, 8, 0, 0, 0));
    const { nextRunAt } = await service.createReportSchedule(ORG, USER, {
      ...base,
      sendAt: '14:30',
    });
    expect(nextRunAt).toBe(new Date(2026, 2, 10, 14, 30, 0, 0).toISOString());
  });

  it('sendAt "14:30" rolls to tomorrow when now is past it', async () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 2, 10, 15, 0, 0, 0));
    const { nextRunAt } = await service.createReportSchedule(ORG, USER, {
      ...base,
      sendAt: '14:30',
    });
    expect(nextRunAt).toBe(new Date(2026, 2, 11, 14, 30, 0, 0).toISOString());
  });

  it('cron takes precedence over sendAt when both are present', async () => {
    // cron "0 6 * * *" (06:00) wins; sendAt "23:00" is ignored. now 05:00 → today 06:00.
    vi.useFakeTimers().setSystemTime(new Date(2026, 2, 10, 5, 0, 0, 0));
    const { nextRunAt } = await service.createReportSchedule(ORG, USER, {
      ...base,
      scheduleCron: '0 6 * * *',
      sendAt: '23:00',
    });
    expect(nextRunAt).toBe(new Date(2026, 2, 10, 6, 0, 0, 0).toISOString());
  });

  it('malformed sendAt → nextRunAt is null', async () => {
    const { nextRunAt } = await service.createReportSchedule(ORG, USER, {
      ...base,
      sendAt: 'not-a-time',
    });
    expect(nextRunAt).toBeNull();
  });
});
