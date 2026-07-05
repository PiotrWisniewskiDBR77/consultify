/**
 * M13/V1 — getInitiativeTaskDependenciesRead: Postgres lowercase-alias fix.
 *
 * node-pg folds UNQUOTED column aliases to lowercase, so `td.predecessor_id as
 * fromTaskId` arrives as `fromtaskid`. The mapping previously read `row.fromTaskId`
 * → undefined → `sourceTaskId/taskId: "undefined"` (Gantt/deps rendered nothing).
 * This locks in the case-robust read so the dependency ids resolve on Postgres
 * (lowercase) AND SQLite (camelCase).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQueryOne, mockQueryAll } = vi.hoisted(() => ({
  mockQueryOne: vi.fn(),
  mockQueryAll: vi.fn(),
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: (...a: any[]) => mockQueryOne(...a),
  queryAll: (...a: any[]) => mockQueryAll(...a),
  queryRun: vi.fn(),
  getTableColumns: vi.fn(async () => []),
}));

import { getInitiativeTaskDependenciesRead } from '../../../server/src/services/v8/planningPortfolioReadService.js';

describe('getInitiativeTaskDependenciesRead — Postgres lowercase aliases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryOne.mockResolvedValue({ id: 'ini-1' }); // initiative exists
  });

  it('resolves real task ids from LOWERCASE pg rows (not "undefined")', async () => {
    // Postgres returns folded keys: fromtaskid / totaskid / fromtitle / ...
    mockQueryAll.mockResolvedValue([
      {
        id: 'dep-1',
        fromtaskid: 'task-A',
        totaskid: 'task-B',
        fromtitle: 'Analiza',
        totitle: 'Projekt',
        fromstatus: 'todo',
        tostatus: 'todo',
        dependencytype: 'finish_to_start',
        lagdays: 0,
      },
    ]);

    const out = await getInitiativeTaskDependenciesRead('ini-1', 'org-1');

    // flatMap → predecessor + successor entries
    expect(out).toHaveLength(2);
    const ids = out.flatMap((d: any) => [d.sourceTaskId, d.taskId]);
    expect(ids).not.toContain('undefined'); // the bug
    expect(new Set(ids)).toEqual(new Set(['task-A', 'task-B']));
    const pred = out.find((d: any) => d.direction === 'predecessor') as any;
    expect(pred.taskId).toBe('task-A');
    expect(pred.sourceTaskId).toBe('task-B');
    expect(pred.dependencyType).toBe('FS');
  });

  it('still works with camelCase rows (SQLite preserves alias case)', async () => {
    mockQueryAll.mockResolvedValue([
      { id: 'dep-2', fromTaskId: 'task-X', toTaskId: 'task-Y', dependencyType: 'finish_to_start' },
    ]);

    const out = await getInitiativeTaskDependenciesRead('ini-1', 'org-1');
    const ids = out.flatMap((d: any) => [d.sourceTaskId, d.taskId]);
    expect(ids).not.toContain('undefined');
    expect(new Set(ids)).toEqual(new Set(['task-X', 'task-Y']));
  });

  it('returns [] when the initiative is not in the org', async () => {
    mockQueryOne.mockResolvedValue(null);
    const out = await getInitiativeTaskDependenciesRead('ini-x', 'org-2');
    expect(out).toEqual([]);
  });
});
