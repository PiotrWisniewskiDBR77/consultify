/**
 * M14/F3 — real decision escalation: escalated_to = sponsor + sponsor notified.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAll, dbRun, notifySend, getManagerProblems } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbRun: vi.fn(),
  notifySend: vi.fn(),
  getManagerProblems: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...a: any[]) => dbAll(...a),
  run: (...a: any[]) => dbRun(...a),
}));
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  withPgTransaction: async (fn: (client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }> }) => Promise<unknown>) =>
    fn({
      query: async (sql: string, params: unknown[] = []) => {
        if (/^\s*SELECT/i.test(sql)) {
          return { rows: await dbAll(sql, params), rowCount: 0 };
        }
        const result = await dbRun(sql, params);
        return { rows: [], rowCount: result?.changes ?? 0 };
      },
    }),
}));
vi.mock('../../../server/src/services/notificationService.js', () => ({
  send: (...a: any[]) => notifySend(...a),
}));
vi.mock('../../../server/src/services/v8/managerProblemsService.js', () => ({
  getManagerProblems: (...a: any[]) => getManagerProblems(...a),
}));

import { executeManagerProblemAction } from '../../../server/src/services/v8/managerActionExecutionService.js';

beforeEach(() => {
  vi.clearAllMocks();
  dbRun.mockResolvedValue({ changes: 1 });
  getManagerProblems.mockResolvedValue([
    {
      id: 'p1',
      sourceEntityType: 'DECISION',
      sourceEntityId: 'dec-1',
      problemType: 'overdue_decision',
      ownerId: 'owner-1',
    },
  ]);
});

describe('decision escalate → sponsor', () => {
  it('sets escalated_to = sponsor and notifies the sponsor (CRITICAL)', async () => {
    // sponsor lookup
    dbAll.mockResolvedValue([
      { initiative_id: 'i1', sponsor_id: 'sponsor-1', initiative_name: 'Cloud', decision_title: 'Approve budget' },
    ]);
    const res = await executeManagerProblemAction({
      organizationId: 'org-1',
      userId: 'manager-1',
      laneId: 'decisions',
      problemId: 'p1',
      actionId: 'escalate',
    });
    // escalated_to UPDATE fired with sponsor
    const updateCall = dbRun.mock.calls.find((c) => /escalated_to/i.test(c[0]));
    expect(updateCall).toBeTruthy();
    expect(updateCall![1]).toContain('sponsor-1');
    // sponsor notified
    expect(notifySend).toHaveBeenCalledTimes(1);
    expect(notifySend.mock.calls[0][0]).toMatchObject({
      userId: 'sponsor-1',
      severity: 'CRITICAL',
      type: 'decision.escalated',
    });
    expect(res.message).toMatch(/sponsor/i);
  });

  it('does not notify when there is no sponsor', async () => {
    dbAll.mockResolvedValue([{ initiative_id: 'i1', sponsor_id: null }]);
    await executeManagerProblemAction({
      organizationId: 'org-1',
      userId: 'manager-1',
      laneId: 'decisions',
      problemId: 'p1',
      actionId: 'escalate',
    });
    expect(notifySend).not.toHaveBeenCalled();
  });
});
