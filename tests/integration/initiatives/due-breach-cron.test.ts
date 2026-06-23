/**
 * M13/R4-E3 — due-breach CRON deps wiring (domknięcie 2026-06-22).
 *
 * The pure scan/idempotency logic is covered by due-breach.test.ts; this asserts
 * the DB-backed deps in InitiativeDueBreachCron: fetchCandidates maps overdue
 * open tasks (+ recipients + lastNotifiedDueDate), notify fires notifyDueBreach,
 * and markNotified persists due_breach_notified_for — all fail-safe.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetCols, mockQueryAll, mockQueryRun, mockNotifyDueBreach } = vi.hoisted(() => ({
  mockGetCols: vi.fn(async () => [{ name: 'due_breach_notified_for' }] as Array<{ name: string }>),
  mockQueryAll: vi.fn(async () => [] as any[]),
  mockQueryRun: vi.fn(async () => ({ changes: 1, lastID: 0 })),
  mockNotifyDueBreach: vi.fn(async () => undefined),
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  getTableColumns: (...a: any[]) => mockGetCols(...a),
  queryAll: (...a: any[]) => mockQueryAll(...a),
  queryRun: (...a: any[]) => mockQueryRun(...a),
  queryOne: vi.fn(),
}));

vi.mock('../../../server/src/services/initiative/initiativeNotificationService.js', () => ({
  notifyDueBreach: (...a: any[]) => mockNotifyDueBreach(...a),
}));

import { runDueBreachScan } from '../../../server/src/cron/InitiativeDueBreachCron.js';

const NOW = new Date('2026-06-22T12:00:00.000Z');

function row(over: Partial<Record<string, any>>) {
  return {
    itemId: 'task-x',
    itemTitle: 'Task X',
    dueDate: '2026-06-10T09:00:00.000Z',
    status: 'in_progress',
    initiativeId: 'ini-1',
    organizationId: 'org-1',
    ownerBusinessId: 'owner-1',
    ownerExecutionId: null,
    sponsorId: null,
    lastNotifiedDueDate: null,
    ...over,
  };
}

describe('M13/R4-E3 — due-breach cron deps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCols.mockResolvedValue([{ name: 'due_breach_notified_for' }]);
    mockQueryRun.mockResolvedValue({ changes: 1, lastID: 0 });
    mockNotifyDueBreach.mockResolvedValue(undefined);
  });

  it('notifies an overdue open task and records the notified due date', async () => {
    mockQueryAll.mockResolvedValue([row({ itemId: 'task-a' })]);

    const res = await runDueBreachScan(NOW);

    expect(res.scanned).toBe(1);
    expect(res.notified).toBe(1);
    expect(mockNotifyDueBreach).toHaveBeenCalledTimes(1);
    expect(mockNotifyDueBreach).toHaveBeenCalledWith(
      'org-1',
      'ini-1',
      'Task X',
      '2026-06-10T09:00:00.000Z',
      ['owner-1', null, null]
    );
    // markNotified persists the due date for idempotency
    const updateCall = mockQueryRun.mock.calls.find((c) =>
      String(c[0]).includes('due_breach_notified_for = ?')
    );
    expect(updateCall).toBeTruthy();
    expect(updateCall?.[1]).toEqual(['2026-06-10T09:00:00.000Z', 'task-a']);
  });

  it('skips an item already notified for the same due date (idempotency)', async () => {
    mockQueryAll.mockResolvedValue([
      row({ itemId: 'task-b', lastNotifiedDueDate: '2026-06-10T09:00:00.000Z' }),
    ]);

    const res = await runDueBreachScan(NOW);

    expect(res.scanned).toBe(1);
    expect(res.notified).toBe(0);
    expect(mockNotifyDueBreach).not.toHaveBeenCalled();
  });

  it('skips terminal-status items and items with no recipients', async () => {
    mockQueryAll.mockResolvedValue([
      row({ itemId: 'task-done', status: 'DONE' }),
      row({ itemId: 'task-noone', ownerBusinessId: null, ownerExecutionId: null, sponsorId: null }),
    ]);

    const res = await runDueBreachScan(NOW);

    expect(res.scanned).toBe(2);
    expect(res.notified).toBe(0);
    expect(mockNotifyDueBreach).not.toHaveBeenCalled();
  });

  it('lazy-ensures the idempotency column when missing (ALTER), then still scans', async () => {
    mockGetCols.mockResolvedValue([{ name: 'id' }]); // column absent
    mockQueryAll.mockResolvedValue([row({ itemId: 'task-c' })]);

    const res = await runDueBreachScan(NOW);

    const alterCall = mockQueryRun.mock.calls.find((c) =>
      /ALTER TABLE tasks ADD COLUMN due_breach_notified_for/i.test(String(c[0]))
    );
    expect(alterCall).toBeTruthy();
    expect(res.notified).toBe(1);
  });

  it('fail-safe: a fetch error yields an empty result, never throws', async () => {
    mockQueryAll.mockRejectedValue(new Error('db down'));

    const res = await runDueBreachScan(NOW);

    expect(res).toEqual({ scanned: 0, notified: 0, skipped: 0, errors: 0 });
    expect(mockNotifyDueBreach).not.toHaveBeenCalled();
  });
});
