import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  run: vi.fn().mockResolvedValue({ changes: 0 }),
}));

import { getManagerProblems } from '../managerProblemsService.js';

const ORG_ID = 'org-test-001';

let fixtureInitiatives: unknown[] = [];
let fixtureTasks: unknown[] = [];
let fixtureDecisions: unknown[] = [];
let fixtureRaid: unknown[] = [];
let fixtureTaskCounts: unknown[] = [];

function routeDbRows(sql: string): unknown[] {
  if (sql.includes('FROM raid_items r')) return fixtureRaid;
  if (sql.includes('FROM decisions d')) return fixtureDecisions;
  if (sql.includes('GROUP BY assignee_id')) return fixtureTaskCounts;
  if (sql.includes('FROM tasks t')) return fixtureTasks;
  if (sql.includes('FROM initiatives i')) return fixtureInitiatives;
  return [];
}

function setDbFixture(fixture: {
  initiatives?: unknown[];
  tasks?: unknown[];
  decisions?: unknown[];
  raid?: unknown[];
  taskCounts?: unknown[];
}) {
  fixtureInitiatives = fixture.initiatives ?? [];
  fixtureTasks = fixture.tasks ?? [];
  fixtureDecisions = fixture.decisions ?? [];
  fixtureRaid = fixture.raid ?? [];
  fixtureTaskCounts = fixture.taskCounts ?? [];
}

/** `ManagerProblemRow` is not exported; derive it from the service's return type. */
type ManagerProblemRow = Awaited<ReturnType<typeof getManagerProblems>>[number];

function expectManagerProblemShape(row: ManagerProblemRow) {
  expect(row).toMatchObject({
    id: expect.any(String),
    severity: expect.stringMatching(/^(critical|warning|info)$/),
    title: expect.any(String),
    sourceEntityType: expect.stringMatching(/^(INITIATIVE|TASK|DECISION|RAID_ITEM|PERSON)$/),
  });
  expect(Array.isArray(row.actions)).toBe(true);
  expect(row.actions.length).toBeGreaterThan(0);
  for (const a of row.actions) {
    expect(a).toMatchObject({ id: expect.any(String), label: expect.any(String) });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-11T12:00:00.000Z'));
  mockDbAll.mockReset();
  mockDbAll.mockImplementation((sql: string) => Promise.resolve(routeDbRows(sql)));
  setDbFixture({});
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('getManagerProblems', () => {
  it('action-queue lane returns problems from overdue tasks and pending (non-final) overdue decisions', async () => {
    setDbFixture({
      tasks: [
        {
          id: 'task-1',
          title: 'Overdue Task',
          status: 'IN_PROGRESS',
          due_date: '2026-01-01',
          assignee_id: 'user-1',
          estimated_hours: 8,
          initiative_id: 'init-1',
          project_id: 'proj-1',
          updated_at: '2026-03-01',
          assignee_name: 'John',
          initiative_name: 'Test Init',
        },
      ],
      decisions: [
        {
          id: 'dec-1',
          title: 'Pending Decision',
          status: 'PENDING',
          priority: 'HIGH',
          deadline: '2026-01-15',
          owner_id: 'user-1',
          owner_name: 'John',
          initiative_id: 'init-1',
          created_at: '2025-12-01',
          initiative_name: 'Test Init',
        },
      ],
    });

    const rows = await getManagerProblems(ORG_ID, 'action-queue');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.problemType === 'overdue_task')).toBe(true);
    expect(rows.some((r) => r.problemType === 'overdue_decision')).toBe(true);
    rows.forEach((r) => expectManagerProblemShape(r));
  });

  it('decisions lane returns pending and overdue decisions', async () => {
    setDbFixture({
      decisions: [
        {
          id: 'dec-1',
          title: 'Pending Decision',
          status: 'PENDING',
          priority: 'HIGH',
          deadline: null,
          owner_id: 'user-1',
          owner_name: 'John',
          initiative_id: 'init-1',
          created_at: '2025-12-01',
          initiative_name: 'Test Init',
        },
        {
          id: 'dec-2',
          title: 'Late Decision',
          status: 'PENDING',
          priority: 'HIGH',
          deadline: '2026-01-01',
          owner_id: 'user-1',
          owner_name: 'John',
          initiative_id: 'init-1',
          created_at: '2026-02-01',
          initiative_name: 'Test Init',
        },
      ],
    });

    const rows = await getManagerProblems(ORG_ID, 'decisions');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.problemType === 'pending_decision')).toBe(true);
    expect(rows.some((r) => r.problemType === 'overdue_decision')).toBe(true);
    rows.forEach((r) => expectManagerProblemShape(r));
  });

  it('blockers lane returns blocked initiatives, blocked tasks, and dependency RAID items', async () => {
    setDbFixture({
      initiatives: [
        {
          id: 'init-1',
          name: 'Blocked Init',
          status: 'BLOCKED',
          owner_execution_id: 'user-1',
          planned_start_date: '2026-01-01',
          planned_end_date: '2026-02-01',
          start_date: '2026-01-05',
          progress: 30,
          updated_at: '2026-03-01',
          project_id: 'proj-1',
          owner_name: 'John Doe',
          sponsor_name: 'Jane Smith',
          sponsor_id: 'user-2',
        },
      ],
      tasks: [
        {
          id: 'task-1',
          title: 'Blocked Task',
          status: 'BLOCKED',
          due_date: null,
          assignee_id: 'user-1',
          estimated_hours: 4,
          initiative_id: 'init-1',
          project_id: 'proj-1',
          updated_at: '2026-03-01',
          assignee_name: 'John',
          initiative_name: 'Test Init',
        },
      ],
      raid: [
        {
          id: 'raid-dep-1',
          title: 'Vendor dependency',
          type: 'DEPENDENCY',
          status: 'OPEN',
          probability: 3,
          impact: 4,
          risk_score: 8,
          owner_id: 'user-1',
          owner_name: 'John',
          initiative_id: 'init-1',
          initiative_name: 'Test Init',
          due_date: '2026-04-20',
          mitigation_plan: null,
          response_strategy: null,
          mitigation_status: null,
        },
      ],
    });

    const rows = await getManagerProblems(ORG_ID, 'blockers');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.problemType === 'blocked_initiative')).toBe(true);
    expect(rows.some((r) => r.problemType === 'blocked_task')).toBe(true);
    expect(rows.some((r) => r.problemType === 'dependency_block')).toBe(true);
    rows.forEach((r) => expectManagerProblemShape(r));
  });

  it('workload lane returns overloaded owners and unassigned tasks', async () => {
    setDbFixture({
      taskCounts: [{ assignee_id: 'user-1', cnt: 15 }],
      tasks: [
        {
          id: 'task-1',
          title: 'Active Task',
          status: 'IN_PROGRESS',
          due_date: '2026-05-01',
          assignee_id: 'user-1',
          estimated_hours: 2,
          initiative_id: 'init-1',
          project_id: 'proj-1',
          updated_at: '2026-03-01',
          assignee_name: 'John',
          initiative_name: 'Test Init',
        },
        {
          id: 'task-2',
          title: 'Unassigned Task',
          status: 'TODO',
          due_date: null,
          assignee_id: null,
          estimated_hours: 1,
          initiative_id: 'init-1',
          project_id: 'proj-1',
          updated_at: '2026-03-01',
          assignee_name: '',
          initiative_name: 'Test Init',
        },
      ],
    });

    const rows = await getManagerProblems(ORG_ID, 'workload');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.problemType === 'overloaded_person')).toBe(true);
    expect(rows.some((r) => r.problemType === 'unassigned_task')).toBe(true);
    rows.forEach((r) => expectManagerProblemShape(r));
  });

  it('risk lane returns RAID risks and initiative risk signals', async () => {
    setDbFixture({
      raid: [
        {
          id: 'raid-1',
          title: 'Major Risk',
          type: 'RISK',
          status: 'OPEN',
          probability: 4,
          impact: 4,
          risk_score: 9,
          owner_id: 'user-1',
          owner_name: 'John',
          initiative_id: 'init-1',
          initiative_name: 'Test Init',
          due_date: '2026-04-15',
          mitigation_plan: null,
          response_strategy: 'AVOID',
          mitigation_status: null,
        },
      ],
      initiatives: [
        {
          id: 'init-1',
          name: 'No Baseline Init',
          status: 'IN_PROGRESS',
          owner_execution_id: 'user-1',
          planned_start_date: null,
          planned_end_date: null,
          start_date: null,
          progress: 10,
          updated_at: '2026-04-01',
          project_id: 'proj-1',
          owner_name: 'John Doe',
          sponsor_name: 'Jane Smith',
          sponsor_id: 'user-2',
        },
      ],
    });

    const rows = await getManagerProblems(ORG_ID, 'risk');
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.some((r) => r.sourceEntityType === 'RAID_ITEM' && r.title.startsWith('Risk:'))
    ).toBe(true);
    expect(rows.some((r) => r.problemType === 'missing_baseline')).toBe(true);
    rows.forEach((r) => expectManagerProblemShape(r));
  });

  it('people-change lane returns bus-factor and related concentration signals', async () => {
    const baseInit = {
      status: 'IN_PROGRESS',
      planned_start_date: '2026-01-01',
      planned_end_date: '2026-06-01',
      start_date: '2026-01-02',
      progress: 20,
      updated_at: '2026-04-01',
      project_id: 'proj-1',
      owner_name: 'John Doe',
      sponsor_name: 'Jane Smith',
      sponsor_id: 'user-2',
    };
    setDbFixture({
      initiatives: [
        { id: 'init-1', name: 'Init One', owner_execution_id: 'user-1', ...baseInit },
        { id: 'init-2', name: 'Init Two', owner_execution_id: 'user-1', ...baseInit },
        { id: 'init-3', name: 'Init Three', owner_execution_id: 'user-1', ...baseInit },
      ],
      tasks: [
        {
          id: 'task-1',
          title: 'Sample',
          status: 'IN_PROGRESS',
          due_date: null,
          assignee_id: 'user-1',
          estimated_hours: 1,
          initiative_id: 'init-1',
          project_id: 'proj-1',
          updated_at: '2026-03-01',
          assignee_name: 'John Doe',
          initiative_name: 'Init One',
        },
      ],
    });

    const rows = await getManagerProblems(ORG_ID, 'people-change');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.problemType === 'bus_factor')).toBe(true);
    rows.forEach((r) => expectManagerProblemShape(r));
  });
});
