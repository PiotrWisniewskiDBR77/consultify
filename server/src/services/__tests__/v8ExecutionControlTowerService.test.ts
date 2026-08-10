import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../delayDetectionService.js', () => ({
  detectDelaySignals: vi.fn(),
}));

vi.mock('../workloadCapacityService.js', () => ({
  getOverloadAlerts: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: vi.fn(),
}));

import { all as dbAll } from '../../utils/DbPromise.js';
import { detectDelaySignals } from '../delayDetectionService.js';
import {
  getExecutionControlTowerQueues,
  V8_EXECUTION_CONTROL_TOWER_CONTRACT,
} from '../v8ExecutionControlTowerService.js';
import { getOverloadAlerts } from '../workloadCapacityService.js';

describe('v8ExecutionControlTowerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(detectDelaySignals).mockResolvedValue([]);
    vi.mocked(getOverloadAlerts).mockResolvedValue([]);
    // `DbPromise.all` is overloaded; `vi.mocked` resolves to the last overload
    // `(db, sql, params?, options?)`, while the control-tower service calls the
    // `(sql, params?)` form. Narrow to the overload actually exercised so the
    // stub's first parameter really is the SQL string.
    vi.mocked(dbAll as (sql: string, params?: unknown[]) => Promise<unknown[]>).mockImplementation(async (sql: string) => {
      if (
        sql.includes('FROM initiatives') &&
        !sql.includes('JOIN initiatives i ON i.id = t.initiative_id')
      ) {
        return [
          {
            id: 'i1',
            name: 'Init One',
            status: 'EXECUTING',
            project_id: 'p1',
            planned_end_date: '2020-01-15',
            sla_deadline: null,
            updated_at: '2026-03-20T10:00:00.000Z',
            blocked_reason: null,
            blocked_at: null,
          },
        ];
      }
      if (sql.includes('FROM tasks t') && sql.includes('JOIN initiatives i')) {
        return [
          {
            id: 't1',
            title: 'Task One',
            status: 'IN_PROGRESS',
            initiative_id: 'i1',
            project_id: 'p1',
            due_date: '2020-02-01',
            assignee_id: 'u-over',
            estimated_hours: 8,
            updated_at: '2026-03-20T10:00:00.000Z',
            blocked_reason: null,
          },
        ];
      }
      return [];
    });
  });

  it('classifies past-due initiatives and tasks into late queue with tower contract id', async () => {
    vi.mocked(getOverloadAlerts).mockResolvedValue([
      {
        userId: 'u-over',
        name: 'Busy',
        capacityHours: 40,
        allocatedHours: 60,
        backlogHours: 0,
        overloadHours: 20,
        severity: 'warning',
        suggestion: 'Review',
        window: 'week',
      },
    ]);

    const out = await getExecutionControlTowerQueues('org-1', { queue: 'all' });

    expect(out.contract).toBe(V8_EXECUTION_CONTROL_TOWER_CONTRACT);
    expect(out.counts.late).toBeGreaterThanOrEqual(2);
    const lateIds = new Set(out.queues.late.map((x) => `${x.entityType}:${x.entityId}`));
    expect(lateIds.has('INITIATIVE:i1')).toBe(true);
    expect(lateIds.has('TASK:t1')).toBe(true);
    expect(out.counts.overloaded).toBeGreaterThanOrEqual(1);
  });

  it('filters to a single queue when queue option is set', async () => {
    const out = await getExecutionControlTowerQueues('org-1', { queue: 'late' });
    expect(out.queues.late.length).toBeGreaterThan(0);
    expect(out.queues.blocked).toEqual([]);
    expect(out.counts.blocked).toBe(0);
  });
});
