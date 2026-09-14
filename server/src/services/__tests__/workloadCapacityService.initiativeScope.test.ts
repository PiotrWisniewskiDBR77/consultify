import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAll } = vi.hoisted(() => ({ dbAll: vi.fn() }));

vi.mock('../../utils/DbPromise.js', () => ({
  default: { all: dbAll, get: vi.fn() },
  isSilenceableMissingRelationError: () => true,
}));

import {
  getExecutionResourcePlan,
  getInitiativeWorkloadProposals,
} from '../workloadCapacityService.js';

describe('getExecutionResourcePlan initiative scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T09:00:00.000Z'));
    dbAll.mockResolvedValueOnce([]);
  });
  afterEach(() => vi.useRealTimers());

  it('binds project and initiative statuses inside the tenant-scoped task query', async () => {
    await getExecutionResourcePlan('org-1', {
      weeks: 8,
      projectId: 'project-1',
      initiativeStatuses: ['PENDING_APPROVAL', 'APPROVED'],
    });

    const [sql, params] = dbAll.mock.calls[0];
    expect(sql).toContain('i.project_id IN (?)');
    expect(sql).not.toContain('t.project_id = ?');
    expect(sql).toContain('FROM initiatives');
    expect(sql).toContain('UPPER(COALESCE(i.status');
    expect(params).toEqual(['org-1', 'project-1', 'PENDING_APPROVAL', 'APPROVED']);
  });

  it('proposes a planning move without mutating assignments', async () => {
    dbAll.mockReset();
    dbAll
      .mockResolvedValueOnce([
        {
          task_id: 'task-1',
          title: 'Planned task',
          status: 'todo',
          user_id: 'overloaded',
          due_date: '2026-09-16',
          start_at: '2026-09-14',
          hours: 30,
          actual_hours: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          user_id: 'overloaded',
          name: 'Over Loaded',
          role: 'Lead',
          weekly_capacity_hours: 20,
          availability_percent: 100,
        },
        {
          user_id: 'available',
          name: 'Ava Ilable',
          role: 'Analyst',
          weekly_capacity_hours: 40,
          availability_percent: 100,
        },
      ])
      .mockResolvedValueOnce([
        {
          task_id: 'task-1',
          task_title: 'Planned task',
          initiative_id: 'initiative-1',
          initiative_status: 'APPROVED',
          assignee_id: 'overloaded',
          estimated_hours: 30,
          actual_hours: 0,
          due_date: '2026-09-16',
        },
      ]);

    const result = await getInitiativeWorkloadProposals('org-1', { weeks: 1 });

    expect(result.proposals).toEqual([
      expect.objectContaining({
        taskId: 'task-1',
        initiativeStatus: 'APPROVED',
        fromUserId: 'overloaded',
        toUserId: 'available',
        proposedHours: 10,
        requiresHumanApproval: true,
        applied: false,
      }),
    ]);
    expect(dbAll.mock.calls.every(([sql]) => !/^\s*(UPDATE|INSERT|DELETE)/i.test(sql))).toBe(true);
  });

  it('returns no proposal when the requested canonical status is already executing', async () => {
    dbAll.mockReset();
    const result = await getInitiativeWorkloadProposals('org-1', {
      weeks: 1,
      initiativeStatuses: ['IN_EXECUTION'],
    });
    expect(result.proposals).toEqual([]);
    expect(dbAll).not.toHaveBeenCalled();
  });
});
