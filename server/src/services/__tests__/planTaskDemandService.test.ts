import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/DbPromise.js', () => ({
  default: { all: vi.fn() },
}));

import DbPromise from '../../utils/DbPromise.js';
import {
  calculatePlanTaskDemand,
  type PlanDemandPeriod,
  readPlanTaskDemand,
} from '../workload/planTaskDemandService.js';

const periods: PlanDemandPeriod[] = [
  { periodId: 'W1', start: '2026-09-07', end: '2026-09-14' },
  { periodId: 'W2', start: '2026-09-14', end: '2026-09-21' },
];

describe('M1a plan task demand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('spreads hours over working days and keeps task provenance in each cell', () => {
    const result = calculatePlanTaskDemand(
      [
        {
          taskId: 'task-80h',
          userId: 'user-1',
          roleLabel: 'Controls Engineer',
          estimatedHours: 80,
          startedAt: '2026-09-07',
          createdAt: '2026-09-01',
          dueDate: '2026-09-18',
        },
      ],
      periods,
      { asOf: '2026-09-01T00:00:00.000Z', initiativeIds: ['initiative-1'] }
    );

    expect(result.knowledgeState).toBe('KNOWN');
    expect(result.cells.map((cell) => [cell.periodId, cell.demandHours])).toEqual([
      ['W1', 40],
      ['W2', 40],
    ]);
    expect(result.cells[0].contributions).toEqual([
      {
        taskId: 'task-80h',
        userId: 'user-1',
        hours: 40,
        startSource: 'started_at',
        incompleteReasons: [],
      },
    ]);
  });

  it('uses created_at as the explicit temporary fallback when started_at is absent', () => {
    const result = calculatePlanTaskDemand(
      [
        {
          taskId: 'fallback-start',
          userId: 'user-1',
          roleLabel: 'Planner',
          estimatedHours: 10,
          startedAt: '',
          createdAt: '2026-09-07T12:00:00.000Z',
          dueDate: '2026-09-11',
        },
      ],
      periods
    );

    expect(result.cells[0].demandHours).toBe(10);
    expect(result.cells[0].contributions[0].startSource).toBe('created_at');
  });

  it('keeps the local calendar day of database Date values', () => {
    const result = calculatePlanTaskDemand(
      [
        {
          taskId: 'local-friday-start',
          userId: 'user-1',
          roleLabel: 'Planner',
          estimatedHours: 88,
          startedAt: null,
          createdAt: new Date(2026, 8, 18, 17),
          dueDate: new Date(2026, 9, 16, 17),
        },
      ],
      periods
    );

    expect(result.cells.find((cell) => cell.periodId === 'W2')?.demandHours).toBeGreaterThan(0);
  });

  it('returns UNKNOWN instead of zero when a contributing task has no estimate', () => {
    const result = calculatePlanTaskDemand(
      [
        {
          taskId: 'unknown-hours',
          userId: 'user-1',
          roleLabel: 'Planner',
          estimatedHours: null,
          startedAt: '2026-09-07',
          createdAt: '2026-09-07',
          dueDate: '2026-09-11',
        },
      ],
      periods
    );

    expect(result.knowledgeState).toBe('UNKNOWN');
    expect(result.cells[0]).toMatchObject({
      periodId: 'W1',
      demandHours: null,
      knowledgeState: 'UNKNOWN',
    });
    expect(result.incompleteTasks).toEqual([
      { taskId: 'unknown-hours', reasons: ['MISSING_ESTIMATE'] },
    ]);
  });

  it('does not invent a period for a task without a due date', () => {
    const result = calculatePlanTaskDemand(
      [
        {
          taskId: 'unscheduled',
          userId: 'user-1',
          roleLabel: 'Planner',
          estimatedHours: 8,
          startedAt: '2026-09-07',
          createdAt: '2026-09-07',
          dueDate: null,
        },
      ],
      periods
    );

    expect(result.cells).toEqual([]);
    expect(result.knowledgeState).toBe('UNKNOWN');
    expect(result.incompleteTasks).toEqual([
      { taskId: 'unscheduled', reasons: ['MISSING_DUE_DATE'] },
    ]);
  });

  it('keeps weekend-only work in the period containing the due date', () => {
    const result = calculatePlanTaskDemand(
      [
        {
          taskId: 'weekend',
          userId: 'user-1',
          roleLabel: 'Planner',
          estimatedHours: 8,
          startedAt: '2026-09-12',
          createdAt: '2026-09-12',
          dueDate: '2026-09-13',
        },
      ],
      periods
    );

    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]).toMatchObject({ periodId: 'W1', demandHours: 8 });
  });

  it('treats a plan end-of-day timestamp as an inclusive calendar date', () => {
    const result = calculatePlanTaskDemand(
      [
        {
          taskId: 'quarter-end',
          userId: 'user-1',
          roleLabel: 'Planner',
          estimatedHours: 8,
          startedAt: '2026-09-30',
          createdAt: '2026-09-30',
          dueDate: '2026-09-30',
        },
      ],
      [
        {
          periodId: '2026-Q3',
          start: '2026-07-01T00:00:00.000Z',
          end: '2026-09-30T23:59:59.000Z',
        },
      ]
    );

    expect(result.cells[0]).toMatchObject({ periodId: '2026-Q3', demandHours: 8 });
  });

  it('reads only the explicit organization and initiative scope', async () => {
    vi.mocked(DbPromise.all).mockResolvedValueOnce([] as never);

    await readPlanTaskDemand('org-1', ['initiative-2', 'initiative-1', 'initiative-1'], periods, {
      asOf: '2026-09-01T00:00:00.000Z',
    });

    const [sql, params] = vi.mocked(DbPromise.all).mock.calls[0];
    expect(sql).toContain('t.organization_id=?');
    expect(sql).toContain('t.initiative_id IN (?,?)');
    expect(params).toEqual(['org-1', 'initiative-2', 'initiative-1']);
    expect(sql).not.toContain('project_members');
  });

  it('rejects an invalid scope or period contract before reading data', async () => {
    await expect(readPlanTaskDemand('org-1', [], periods)).rejects.toThrow(
      'M1_INITIATIVE_SCOPE_INVALID'
    );
    expect(DbPromise.all).not.toHaveBeenCalled();
    expect(() =>
      calculatePlanTaskDemand([], [{ periodId: 'bad', start: '2026-09-14', end: '2026-09-07' }])
    ).toThrow('M1_PERIOD_RANGE_INVALID');
    expect(() =>
      calculatePlanTaskDemand(
        [],
        [
          { periodId: 'A', start: '2026-09-07', end: '2026-09-15' },
          { periodId: 'B', start: '2026-09-14', end: '2026-09-21' },
        ]
      )
    ).toThrow('M1_PERIODS_OVERLAP:A:B');
    expect(() =>
      calculatePlanTaskDemand(
        [],
        [{ periodId: 'bad-date', start: '2026-02-30', end: '2026-03-07' }]
      )
    ).toThrow('M1_PERIOD_RANGE_INVALID');
  });
});
