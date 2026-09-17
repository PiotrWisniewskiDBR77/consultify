import { describe, expect, it, vi } from 'vitest';

import { PostgresInitiativeReader } from '../postgresInitiativeReader.js';

describe('PostgresInitiativeReader.listExecutionTasks task source convergence', () => {
  it('returns Work tab tasks for the execution case initiative and deduplicates runtime tasks', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            aggregate_id: 'task-runtime',
            version: 2,
            payload_json: {
              title: 'Runtime task',
              status: 'BLOCKED',
              assigneeId: 'owner-1',
              dueAt: '2026-09-15T09:00:00.000Z',
              priority: 'HIGH',
            },
            initiative_id: 'initiative-1',
            project_id: 'project-1',
            project_title: 'Work project',
          },
        ],
      })
      .mockImplementationOnce(async (sql: string) => ({
        rows: String(sql).includes('case_scope.initiative_id = t.initiative_id')
          ? [
              {
                aggregate_id: 'task-runtime',
                title: 'Duplicate Work task',
                status: 'todo',
                assignee_id: 'owner-1',
                due_date: '2026-09-15T09:00:00.000Z',
                completed_at: null,
                priority: 'HIGH',
                initiative_id: 'initiative-1',
                project_id: 'project-1',
                project_title: 'Work project',
              },
              {
                aggregate_id: 'task-work-tab',
                title: 'Work tab task',
                status: 'todo',
                assignee_id: 'owner-2',
                due_date: '2026-09-20T09:00:00.000Z',
                completed_at: null,
                priority: 'MEDIUM',
                initiative_id: 'initiative-1',
                project_id: 'project-1',
                project_title: 'Work project',
              },
            ]
          : [],
      }));
    const reader = new PostgresInitiativeReader({ query } as never);

    const tasks = await reader.listExecutionTasks('org-1', 'case-1');

    expect(tasks.map((task) => task.taskId)).toEqual(['task-runtime', 'task-work-tab']);
    expect(tasks).toEqual([
      expect.objectContaining({
        taskId: 'task-runtime',
        title: 'Runtime task',
        sourceType: 'runtime-v1',
      }),
      expect.objectContaining({
        taskId: 'task-work-tab',
        title: 'Work tab task',
        sourceType: 'tasks',
        initiativeId: 'initiative-1',
      }),
    ]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[1][0])).toContain('JOIN case_scope');
    expect(String(query.mock.calls[1][0])).toContain('case_scope.initiative_id = t.initiative_id');
  });
});
