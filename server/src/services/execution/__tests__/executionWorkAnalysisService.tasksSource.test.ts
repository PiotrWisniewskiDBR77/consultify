/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  all: dbAll,
  get: dbGet,
  run: dbRun,
}));

const persistedFrom = (payload: Record<string, unknown>) => ({
  id: 'snapshot-1',
  periodStart: '2026-09-14T00:00:00.000Z',
  periodEnd: '2026-09-21T00:00:00.000Z',
  asOf: '2026-09-17T12:00:00.000Z',
  payload: JSON.stringify(payload),
});

describe('execution work analysis Work task source', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T12:00:00.000Z'));
    dbAll.mockReset();
    dbGet.mockReset();
    dbRun.mockReset();
  });

  it('counts Work tab tasks when runtime-v1 execution work has no task rows', async () => {
    const persisted: Record<string, unknown>[] = [];
    dbGet
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ taskCount: 3, decisionCount: 0 })
      .mockImplementationOnce(async () => persistedFrom(persisted[0] as Record<string, unknown>));
    dbAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          aggregate_id: 'task-overdue',
          title: 'Overdue Work task',
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
          aggregate_id: 'task-blocked',
          title: 'Blocked Work task',
          status: 'BLOCKED',
          assignee_id: null,
          owner_id: 'owner-fallback',
          due_date: '2026-09-20T09:00:00.000Z',
          completed_at: null,
          priority: 'CRITICAL',
          initiative_id: 'initiative-1',
          project_id: 'project-1',
          project_title: 'Work project',
        },
        {
          aggregate_id: 'task-done',
          title: 'Done Work task',
          status: 'done',
          assignee_id: 'owner-1',
          due_date: '2026-09-16T09:00:00.000Z',
          completed_at: '2026-09-16T11:00:00.000Z',
          priority: 'LOW',
          initiative_id: 'initiative-1',
          project_id: 'project-1',
          project_title: 'Work project',
        },
      ]);
    dbRun.mockImplementationOnce(async (_sql: string, params: unknown[]) => {
      persisted.push(JSON.parse(String(params[7])));
      return { changes: 1 };
    });

    const { generateExecutionWorkAnalysis } = await import('../executionWorkAnalysisService.js');
    const result = await generateExecutionWorkAnalysis({ organizationId: 'org-1', weekOf: new Date('2026-09-17T00:00:00.000Z') });

    expect(result.created).toBe(true);
    const metrics = Object.fromEntries((result.payload.metrics as Array<{ id: string; value: string }>).map((metric) => [metric.id, metric.value]));
    expect(metrics).toMatchObject({
      workTasksTotal: '3',
      workTasksOverdue: '1',
      workTasksBlocked: '1',
    });
    expect(JSON.stringify(result.payload)).toContain('Overdue Work task');
    expect(JSON.stringify(result.payload)).toContain('Blocked Work task');
    expect(JSON.stringify(result.payload)).toContain('"source":"tasks"');
    expect(JSON.stringify(result.payload)).not.toContain('BLOCKED, UNASSIGNED');
    expect(dbRun).toHaveBeenCalledTimes(1);
  });

  it('deduplicates task rows that already exist in runtime-v1', async () => {
    const persisted: Record<string, unknown>[] = [];
    dbGet
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ taskCount: 1, decisionCount: 0 })
      .mockImplementationOnce(async () => persistedFrom(persisted[0] as Record<string, unknown>));
    dbAll
      .mockResolvedValueOnce([
        {
          aggregate_type: 'execution_task',
          aggregate_id: 'same-task',
          version: 2,
          payload_json: {
            executionCaseId: 'case-1',
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
      ])
      .mockResolvedValueOnce([
        {
          aggregate_id: 'same-task',
          title: 'Legacy duplicate',
          status: 'BLOCKED',
          assignee_id: 'owner-1',
          due_date: '2026-09-15T09:00:00.000Z',
          completed_at: null,
          priority: 'HIGH',
          initiative_id: 'initiative-1',
          project_id: 'project-1',
          project_title: 'Work project',
        },
      ]);
    dbRun.mockImplementationOnce(async (_sql: string, params: unknown[]) => {
      persisted.push(JSON.parse(String(params[7])));
      return { changes: 1 };
    });

    const { generateExecutionWorkAnalysis } = await import('../executionWorkAnalysisService.js');
    const result = await generateExecutionWorkAnalysis({ organizationId: 'org-1', weekOf: new Date('2026-09-17T00:00:00.000Z') });

    const metrics = Object.fromEntries((result.payload.metrics as Array<{ id: string; value: string }>).map((metric) => [metric.id, metric.value]));
    expect(metrics.workTasksTotal).toBe('1');
    expect(JSON.stringify(result.payload)).toContain('Runtime task');
    expect(JSON.stringify(result.payload)).not.toContain('Legacy duplicate');
  });


  it('refuses to persist an empty analysis when source tasks exist', async () => {
    const { assertNonEmptyExecutionWorkSnapshot } = await import('../executionWorkTaskSource.js');

    expect(() =>
      assertNonEmptyExecutionWorkSnapshot({
        taskItems: [],
        decisionItems: [],
        sourceTaskCount: 1,
        sourceDecisionCount: 0,
      })
    ).toThrow('EXECUTION_WORK_ANALYSIS_EMPTY_SNAPSHOT');
  });
});
