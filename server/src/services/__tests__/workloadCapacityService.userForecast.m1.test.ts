import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/DbPromise.js', () => {
  const all = vi.fn();
  const get = vi.fn();
  return {
    default: { all, get, run: vi.fn() },
    all,
    get,
    isSilenceableMissingRelationError: (message: string) =>
      message.includes('no such table') || message.includes('does not exist'),
  };
});

import DbPromise from '../../utils/DbPromise.js';
import { getUserForecast } from '../workloadCapacityService.js';

const mockedAll = vi.mocked(DbPromise.all);
const mockedGet = vi.mocked(DbPromise.get);

describe('M1a getUserForecast', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses profile capacity once and spreads each task over its actual weeks', async () => {
    mockedGet.mockResolvedValueOnce({
      weekly_capacity_hours: 37,
      availability_percent: 100,
    } as never);
    mockedAll.mockResolvedValueOnce([] as never).mockResolvedValueOnce([
      {
        task_id: 'task-80h',
        estimated_hours: 80,
        started_at: '2026-09-14',
        created_at: '2026-09-01',
        due_date: '2026-09-25',
      },
    ] as never);

    const result = await getUserForecast('org-1', 'user-1', {
      // Date-only Monday must stay Monday even on a host west of UTC.
      asOf: '2026-09-14',
      weekCount: 2,
      initiativeIds: ['initiative-1'],
    });

    expect(result.map((week) => week.weekStart)).toEqual(['2026-09-14', '2026-09-21']);
    expect(result.map((week) => week.capacityHours)).toEqual([37, 37]);
    expect(result.map((week) => week.allocatedHours)).toEqual([40, 40]);
    expect(result.map((week) => week.taskIds)).toEqual([['task-80h'], ['task-80h']]);
    expect(result.every((week) => week.knowledgeState === 'KNOWN')).toBe(true);

    const queries = [...mockedGet.mock.calls, ...mockedAll.mock.calls].map(([sql]) => sql);
    expect(queries.every((sql) => !sql.includes('project_members'))).toBe(true);
    expect(mockedAll.mock.calls[1][0]).toContain('t.initiative_id IN (?)');
    expect(mockedAll.mock.calls[1][1]).toEqual(['user-1', 'org-1', 'initiative-1']);
  });

  it('keeps an unquantified task UNKNOWN instead of reporting known zero', async () => {
    mockedGet.mockResolvedValueOnce({
      weekly_capacity_hours: 40,
      availability_percent: 100,
    } as never);
    mockedAll.mockResolvedValueOnce([] as never).mockResolvedValueOnce([
      {
        task_id: 'missing-estimate',
        estimated_hours: null,
        started_at: '2026-09-14',
        created_at: '2026-09-14',
        due_date: '2026-09-18',
      },
    ] as never);

    const [week] = await getUserForecast('org-1', 'user-1', {
      asOf: '2026-09-16T12:00:00',
      weekCount: 1,
    });

    expect(week.allocatedHours).toBe(0);
    expect(week.knowledgeState).toBe('UNKNOWN');
    expect(week.unknownTaskIds).toEqual(['missing-estimate']);
  });

  it('keeps a Friday timestamp-without-time-zone Date in its local week', async () => {
    mockedGet.mockResolvedValueOnce({
      weekly_capacity_hours: 40,
      availability_percent: 100,
    } as never);
    mockedAll.mockResolvedValueOnce([] as never).mockResolvedValueOnce([
      {
        task_id: 'friday-start',
        estimated_hours: 88,
        started_at: null,
        created_at: new Date(2026, 8, 18, 17),
        due_date: new Date(2026, 9, 16, 17),
      },
    ] as never);

    const [week] = await getUserForecast('org-1', 'user-1', {
      asOf: '2026-09-14',
      weekCount: 1,
    });

    expect(week.taskIds).toEqual(['friday-start']);
    expect(week.allocatedHours).toBeGreaterThan(0);
  });

  it('prefers explicit task allocations and preserves their task provenance', async () => {
    mockedGet.mockResolvedValueOnce({
      weekly_capacity_hours: 32,
      availability_percent: 50,
    } as never);
    mockedAll
      .mockResolvedValueOnce([
        {
          week_start: '2026-09-14',
          hours: 12,
          task_id: 'allocated-task',
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          task_id: 'allocated-task',
          estimated_hours: 80,
          started_at: '2026-09-14',
          created_at: '2026-09-14',
          due_date: '2026-09-25',
        },
        {
          task_id: 'fallback-task',
          estimated_hours: 10,
          started_at: '2026-09-14',
          created_at: '2026-09-14',
          due_date: '2026-09-18',
        },
      ] as never);

    const result = await getUserForecast('org-1', 'user-1', {
      asOf: '2026-09-16T12:00:00',
      weekCount: 2,
    });

    expect(result[0]).toMatchObject({
      capacityHours: 16,
      allocatedHours: 22,
      taskIds: ['allocated-task', 'fallback-task'],
    });
    expect(result[1]).toMatchObject({
      capacityHours: 16,
      allocatedHours: 40,
      taskIds: ['allocated-task'],
    });
    expect(mockedAll.mock.calls[0][0]).not.toContain('ARRAY_AGG');
  });

  it('preserves an explicitly declared zero capacity instead of replacing it with 40h', async () => {
    mockedGet.mockResolvedValueOnce({
      weekly_capacity_hours: 0,
      availability_percent: 100,
    } as never);
    mockedAll.mockResolvedValueOnce([] as never).mockResolvedValueOnce([
      {
        task_id: 'task-8h',
        estimated_hours: 8,
        started_at: '2026-09-14',
        created_at: '2026-09-14',
        due_date: '2026-09-18',
      },
    ] as never);

    const [week] = await getUserForecast('org-1', 'user-1', {
      asOf: '2026-09-14',
      weekCount: 1,
    });

    expect(week.capacityHours).toBe(0);
    expect(week.availableHours).toBe(0);
    expect(week.allocatedHours).toBe(8);
  });

  it('rejects an oversized initiative scope instead of silently truncating it', async () => {
    const initiativeIds = Array.from({ length: 101 }, (_, index) => `initiative-${index}`);
    await expect(getUserForecast('org-1', 'user-1', { initiativeIds })).rejects.toThrow(
      'M1_INITIATIVE_SCOPE_INVALID'
    );
    expect(mockedGet).not.toHaveBeenCalled();
    expect(mockedAll).not.toHaveBeenCalled();
  });

  it('does not turn a real task allocation query failure into fallback demand', async () => {
    mockedGet.mockResolvedValueOnce({
      weekly_capacity_hours: 40,
      availability_percent: 100,
    } as never);
    mockedAll.mockRejectedValueOnce(new Error('permission denied for task_allocations'));

    await expect(
      getUserForecast('org-1', 'user-1', { asOf: '2026-09-14', weekCount: 1 })
    ).rejects.toThrow('permission denied for task_allocations');
    expect(mockedAll).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the user is outside the organization scope', async () => {
    mockedGet.mockResolvedValueOnce(null as never);
    await expect(getUserForecast('org-1', 'other-user')).rejects.toThrow('M1_USER_NOT_FOUND');
    expect(mockedAll).not.toHaveBeenCalled();
  });
});
