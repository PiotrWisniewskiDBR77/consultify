import { describe, expect, it } from 'vitest';

import { buildExecutionWorkAnalysis, type ExecutionWorkAnalysisItem } from '../workAnalysisModel';

const item = (overrides: Partial<ExecutionWorkAnalysisItem>): ExecutionWorkAnalysisItem => ({
  id: 'task-1',
  executionCaseId: 'case-1',
  initiativeId: 'initiative-1',
  projectId: 'project-1',
  projectTitle: 'North plant',
  title: 'Close the supplier gap',
  kind: 'TASK',
  status: 'OPEN',
  priority: 'HIGH',
  ownerId: 'owner-1',
  dueAt: '2026-09-16T12:00:00.000Z',
  completedAt: null,
  slaAt: null,
  dependencies: [],
  evidenceRefs: [],
  definitionOfDone: null,
  sourceVersion: 2,
  ...overrides,
});

describe('F2-2 E2 work analysis model', () => {
  const weekStart = new Date('2026-09-14T12:00:00.000Z');

  it('builds the three contractual time windows from one selected week', () => {
    const analysis = buildExecutionWorkAnalysis(
      [
        item({ id: 'past-open', dueAt: '2026-09-10T12:00:00.000Z' }),
        item({ id: 'next-week', dueAt: '2026-09-16T12:00:00.000Z' }),
        item({ id: 'next-month', dueAt: '2026-10-02T12:00:00.000Z' }),
      ],
      weekStart
    );

    expect(analysis.windows.previousWeek.items.map((entry) => entry.id)).toEqual(['past-open']);
    expect(analysis.windows.nextWeek.items.map((entry) => entry.id)).toEqual(['next-week']);
    expect(analysis.windows.nextMonth.items.map((entry) => entry.id)).toEqual([
      'next-week',
      'next-month',
    ]);
    expect(analysis.windows.previousWeek.start).toBe('2026-09-07T00:00:00.000Z');
    expect(analysis.windows.nextWeek.start).toBe('2026-09-14T00:00:00.000Z');
  });

  it('uses completion time for completed work from the previous week', () => {
    const analysis = buildExecutionWorkAnalysis(
      [
        item({
          id: 'completed-last-week',
          status: 'DONE',
          dueAt: '2026-08-20T12:00:00.000Z',
          completedAt: '2026-09-11T15:00:00.000Z',
        }),
      ],
      weekStart
    );

    expect(analysis.windows.previousWeek.items.map((entry) => entry.id)).toEqual([
      'completed-last-week',
    ]);
    expect(analysis.windows.previousWeek.completed).toEqual({ numerator: 1, denominator: 1 });
  });

  it('groups real work by project and priority without treating missing project as zero', () => {
    const analysis = buildExecutionWorkAnalysis(
      [
        item({ id: 'high', projectId: 'project-1', priority: 'HIGH' }),
        item({
          id: 'unknown-project',
          projectId: null,
          projectTitle: null,
          priority: null,
        }),
      ],
      weekStart
    );

    expect(analysis.byProject.map((group) => [group.projectId, group.items.length])).toEqual([
      [null, 1],
      ['project-1', 1],
    ]);
    expect(analysis.byPriority.UNKNOWN.map((entry) => entry.id)).toEqual(['unknown-project']);
    expect(analysis.byPriority.HIGH.map((entry) => entry.id)).toEqual(['high']);
  });

  it('explains special-attention items with measured reasons', () => {
    const analysis = buildExecutionWorkAnalysis(
      [
        item({ id: 'blocked', status: 'BLOCKED' }),
        item({ id: 'overdue', dueAt: '2026-09-10T12:00:00.000Z' }),
        item({ id: 'unassigned', ownerId: null }),
        item({ id: 'undated', dueAt: null }),
      ],
      weekStart
    );

    expect(analysis.attention.find((entry) => entry.item.id === 'blocked')?.reasons).toContain(
      'BLOCKED'
    );
    expect(analysis.attention.find((entry) => entry.item.id === 'overdue')?.reasons).toContain(
      'OVERDUE'
    );
    expect(analysis.attention.find((entry) => entry.item.id === 'unassigned')?.reasons).toContain(
      'UNASSIGNED'
    );
    expect(analysis.attention.find((entry) => entry.item.id === 'undated')?.reasons).toContain(
      'NO_DUE_DATE'
    );
  });
});
