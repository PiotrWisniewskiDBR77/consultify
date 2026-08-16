/**
 * workloadCapacityService — capacity semantics (HARVARD H5.6)
 *
 * Root-cause fixed: allocatedHours used to be SUM(estimated_hours) of ALL open
 * tasks (lifetime), divided by ONE week of capacity → absurd "512% utilized".
 * Now allocatedHours is measured against the CURRENT capacity window
 * (this Mon..Sun via due_date), and undated open tasks are reported separately
 * as backlogHours (NOT folded into utilization).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/utils/DbPromise.js', () => {
  const all = vi.fn();
  const get = vi.fn();
  const run = vi.fn();
  const api = { all, get, run };
  return { __esModule: true, default: api, all, get, run };
});

import {
  getCapacityOverview,
  getCapacityTimeline,
  getOverloadAlerts,
} from '../../../server/src/services/workloadCapacityService';
import DbPromise from '../../../server/src/utils/DbPromise.js';

const mockedAll = vi.mocked(DbPromise.all);
const mockedGet = vi.mocked(DbPromise.get);

/**
 * The service issues (in order):
 *  1. members query
 *  2. task allocation split (window_hours / backlog_hours)
 *  3. time_entries actuals
 * We drive each via sequential resolves on DbPromise.all.
 */
function primeAll(members: unknown[], alloc: unknown[], actuals: unknown[] = []) {
  mockedAll
    .mockResolvedValueOnce(members as never)
    .mockResolvedValueOnce(alloc as never)
    .mockResolvedValueOnce(actuals as never);
}

describe('workloadCapacityService.getCapacityOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('measures allocation against the current week window (unit-consistent utilization)', async () => {
    // 100% allocation → 40h capacity for the week.
    primeAll(
      [{ user_id: 'u1', name: 'Alice', email: 'a@x.io', allocation_percent: 100 }],
      // 32h of tasks due THIS window; backlog computed separately below
      [{ user_id: 'u1', window_hours: 32, backlog_hours: 120 }]
    );

    const out = await getCapacityOverview('org-1');
    const u = out.users[0];

    expect(u.capacityHours).toBe(40);
    expect(u.allocatedHours).toBe(32); // window only, NOT lifetime
    expect(u.utilizationPercent).toBe(80); // 32/40 — sane, never 512%
    expect(u.overloaded).toBe(false);
  });

  it('reports undated backlog SEPARATELY and never folds it into utilization', async () => {
    primeAll(
      [{ user_id: 'u1', name: 'Alice', email: 'a@x.io', allocation_percent: 100 }],
      [{ user_id: 'u1', window_hours: 10, backlog_hours: 200 }]
    );

    const out = await getCapacityOverview('org-1');
    const u = out.users[0];

    expect(u.backlogHours).toBe(200);
    expect(u.allocatedHours).toBe(10);
    // Utilization is driven by the window allocation ONLY — huge backlog must not spike it.
    expect(u.utilizationPercent).toBe(25); // 10/40
    expect(out.summary.totalBacklog).toBe(200);
  });

  it('handles a member with no window tasks and no due dates (backlog only)', async () => {
    primeAll(
      [{ user_id: 'u1', name: 'Bob', email: 'b@x.io', allocation_percent: 50 }],
      [{ user_id: 'u1', window_hours: 0, backlog_hours: 40 }]
    );

    const out = await getCapacityOverview('org-1');
    const u = out.users[0];

    expect(u.capacityHours).toBe(20); // 50% of 40
    expect(u.allocatedHours).toBe(0);
    expect(u.utilizationPercent).toBe(0);
    expect(u.backlogHours).toBe(40);
    expect(u.overloaded).toBe(false);
  });

  it('returns an empty, well-formed overview when there are 0 members', async () => {
    // Only the members query runs (early return); no alloc/actuals fetch.
    mockedAll.mockResolvedValueOnce([] as never);

    const out = await getCapacityOverview('org-empty');

    expect(out.users).toEqual([]);
    expect(out.summary).toEqual({
      totalCapacity: 0,
      totalAllocated: 0,
      totalBacklog: 0,
      avgUtilization: 0,
    });
    expect(typeof out.windowStart).toBe('string');
    expect(typeof out.windowEnd).toBe('string');
    // Only the members query was issued.
    expect(mockedAll).toHaveBeenCalledTimes(1);
  });

  it('exposes a valid Mon..Sun capacity window', async () => {
    primeAll(
      [{ user_id: 'u1', name: 'Alice', email: 'a@x.io', allocation_percent: 100 }],
      [{ user_id: 'u1', window_hours: 0, backlog_hours: 0 }]
    );

    const out = await getCapacityOverview('org-1');
    const start = new Date(out.windowStart + 'T00:00:00Z');
    const end = new Date(out.windowEnd + 'T00:00:00Z');

    // Window spans exactly 6 days (Mon..Sun inclusive).
    const spanDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(spanDays).toBe(6);
    expect(out.windowStart <= out.windowEnd).toBe(true);
  });

  it('flags overload only when WINDOW allocation exceeds capacity (not lifetime backlog)', async () => {
    primeAll(
      [{ user_id: 'u1', name: 'Carol', email: 'c@x.io', allocation_percent: 100 }],
      [{ user_id: 'u1', window_hours: 50, backlog_hours: 0 }] // 50h in a 40h window
    );

    const out = await getCapacityOverview('org-1');
    const u = out.users[0];

    expect(u.utilizationPercent).toBe(125); // 50/40 — realistic overload, not 500%+
    expect(u.overloaded).toBe(true); // > 40 * 1.1
  });
});

describe('workloadCapacityService.getOverloadAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces backlogHours on alerts and scales to the requested window', async () => {
    primeAll(
      [{ user_id: 'u1', name: 'Carol', email: 'c@x.io', allocation_percent: 100 }],
      [{ user_id: 'u1', window_hours: 60, backlog_hours: 20 }] // overloaded in a 40h week
    );

    const alerts = await getOverloadAlerts('org-1', 'week');

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      userId: 'u1',
      capacityHours: 40,
      allocatedHours: 60,
      backlogHours: 20,
      severity: 'critical', // 60 > 40 * 1.3
    });
    expect(alerts[0].overloadHours).toBe(20);
  });

  it('emits no alert when window allocation is within capacity even with large backlog', async () => {
    primeAll(
      [{ user_id: 'u1', name: 'Dan', email: 'd@x.io', allocation_percent: 100 }],
      [{ user_id: 'u1', window_hours: 30, backlog_hours: 500 }]
    );

    const alerts = await getOverloadAlerts('org-1', 'week');
    expect(alerts).toEqual([]);
  });
});

describe('workloadCapacityService.getCapacityTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses an explicit stable anchor and returns identical cold readbacks', async () => {
    mockedGet.mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(*) AS cnt')) return { cnt: 2 } as never;
      if (sql.includes('task_allocations')) return { hours: 0 } as never;
      if (sql.includes('SUM(estimated_hours)')) return { hours: 10 } as never;
      throw new Error(`Unexpected query: ${sql}`);
    });

    const first = await getCapacityTimeline('org-1', 'initiative-1', '2026-08-12');
    vi.clearAllMocks(); // simulate a fresh service consumer/restart boundary
    mockedGet.mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(*) AS cnt')) return { cnt: 2 } as never;
      if (sql.includes('task_allocations')) return { hours: 0 } as never;
      if (sql.includes('SUM(estimated_hours)')) return { hours: 10 } as never;
      throw new Error(`Unexpected query: ${sql}`);
    });
    const cold = await getCapacityTimeline('org-1', 'initiative-1', '2026-08-12');

    expect(cold).toEqual(first);
    expect(first).toHaveLength(12);
    expect(first[0]).toEqual({
      weekStart: '2026-08-10',
      totalCapacity: 80,
      totalAllocated: 10,
      utilizationPercent: 13,
    });
  });
});
