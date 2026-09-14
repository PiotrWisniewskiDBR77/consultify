import { describe, expect, it, vi } from 'vitest';

const { getExecutionResourcePlan } = vi.hoisted(() => ({
  getExecutionResourcePlan: vi.fn(),
}));

vi.mock('../../../services/workloadCapacityService.js', () => ({ getExecutionResourcePlan }));

import { PostgresInitiativeReader } from '../postgresInitiativeReader.js';

describe('WORKLOAD_CAPACITY report adapter', () => {
  it('captures workload truth for the shared reportDefinition/reportRun engine', async () => {
    getExecutionResourcePlan.mockResolvedValue({
      asOf: '2026-09-14T09:00:00.000Z',
      weeks: ['2026-09-14'],
      people: [
        {
          userId: 'u1',
          name: 'Anna',
          weeklyCapacityHours: 20,
          availabilityPercent: 100,
          role: 'Lead',
          supplySource: 'PROFIL',
          backlogHours: 0,
          unscheduledHours: 0,
          backlogTaskIds: [],
          backlogTasks: [],
        },
      ],
      rows: [
        {
          userId: 'u1',
          name: 'Anna',
          role: 'Lead',
          weekStart: '2026-09-14',
          demandHours: 30,
          supplyHours: 20,
          utilizationPercent: 150,
          gapHours: -10,
          overdueHours: 0,
          backlogHours: 0,
          backlogTaskIds: [],
          backlogTasks: [],
          taskCount: 1,
          supplySource: 'PROFIL',
        },
      ],
    });
    const pool = { query: vi.fn() } as any;
    const reader = new PostgresInitiativeReader(pool);

    const captured = await reader.buildInitiativeWorkReport('org-1', {
      title: 'Workload report',
      templateId: 'WORKLOAD_CAPACITY',
      projectIds: ['project-1'],
    });

    expect(getExecutionResourcePlan).toHaveBeenCalledWith('org-1', {
      weeks: 8,
      projectIds: ['project-1'],
      includeAvailablePeople: true,
    });
    expect(pool.query).not.toHaveBeenCalled();
    expect(captured.content.workload).toMatchObject({ overloadedCount: 1 });
    expect(captured.sources).toEqual([
      expect.objectContaining({
        sourceType: 'initiative_workload',
        sourceId: 'projects:project-1',
      }),
    ]);
  });
});
