import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbRun = vi.fn();
const mockGetManagerProblems = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));
vi.mock('../../../utils/queryHelpers.js', () => ({
  withPgTransaction: async (
    fn: (client: {
      query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
    }) => Promise<unknown>
  ) =>
    fn({
      query: async (sql: string, params: unknown[] = []) => {
        if (/^\s*SELECT/i.test(sql)) {
          return { rows: await mockDbAll(sql, params), rowCount: 0 };
        }
        const result = await mockDbRun(sql, params);
        return { rows: [], rowCount: result?.changes ?? 0 };
      },
    }),
}));
vi.mock('../managerProblemsService.js', () => ({
  getManagerProblems: (...args: unknown[]) => mockGetManagerProblems(...args),
}));

import {
  applyManagerSuggestion,
  executeManagerProblemAction,
} from '../managerActionExecutionService.js';

const ORG = 'org-test-001';
const UID = 'user-test-001';
const LANE_ID = 'lane-test';

const taskProblem = {
  id: 'prob-task-overdue-1',
  severity: 'warning',
  problemType: 'task_overdue',
  title: 'Overdue task',
  rootCause: 'Past due date',
  sourceEntityType: 'TASK',
  sourceEntityId: 'task-1',
  sourceEntityName: 'Test task',
  ownerId: 'user-1',
  ownerName: 'John',
  daysOverdue: 5,
  impactCount: 1,
  affectedEntities: [],
  actions: [
    { id: 'reassign', label: 'Reassign' },
    { id: 'set_due_date', label: 'Set due date' },
    { id: 'unblock', label: 'Unblock' },
  ],
  meta: {},
};

const initiativeProblem = {
  id: 'prob-init-1',
  severity: 'warning',
  problemType: 'delay_overdue',
  title: 'Delayed initiative',
  rootCause: 'Behind schedule',
  sourceEntityType: 'INITIATIVE',
  sourceEntityId: 'init-1',
  sourceEntityName: 'Test initiative',
  ownerId: 'user-1',
  ownerName: 'John',
  daysOverdue: 3,
  impactCount: 2,
  affectedEntities: [],
  actions: [{ id: 'assign_owner', label: 'Assign owner' }],
  meta: {},
};

const decisionProblem = {
  id: 'prob-dec-1',
  severity: 'warning',
  problemType: 'overdue_decision',
  title: 'Pending decision',
  rootCause: 'Needs approval',
  sourceEntityType: 'DECISION',
  sourceEntityId: 'dec-1',
  sourceEntityName: 'Test decision',
  ownerId: 'user-1',
  ownerName: 'John',
  daysOverdue: 2,
  impactCount: 1,
  affectedEntities: [],
  actions: [{ id: 'approve', label: 'Approve' }],
  meta: {},
};

const raidProblem = {
  id: 'prob-raid-1',
  severity: 'warning',
  problemType: 'open_risk',
  title: 'Open risk',
  rootCause: 'No mitigation',
  sourceEntityType: 'RAID_ITEM',
  sourceEntityId: 'raid-1',
  sourceEntityName: 'Risk item',
  ownerId: 'user-1',
  ownerName: 'John',
  daysOverdue: null,
  impactCount: 1,
  affectedEntities: [],
  actions: [{ id: 'create_mitigation', label: 'Mitigation' }],
  meta: {},
};

const personProblem = {
  id: 'prob-person-overload-1',
  severity: 'warning',
  problemType: 'overloaded_person',
  title: 'Overloaded person',
  rootCause: 'Too many tasks',
  sourceEntityType: 'PERSON',
  sourceEntityId: 'user-1',
  sourceEntityName: 'John',
  ownerId: 'user-1',
  ownerName: 'John',
  daysOverdue: null,
  impactCount: 5,
  affectedEntities: [],
  actions: [
    { id: 'distribute_work', label: 'Distribute work' },
    { id: 'reassign', label: 'Reassign' },
  ],
  meta: {},
};

function routeDbAll(sql: string): Promise<unknown[]> {
  if (sql.includes('FROM users u')) {
    return Promise.resolve([{ id: 'user-2', display_name: 'Other User', load_score: 1 }]);
  }
  if (sql.includes('assignee_id IS NULL') && sql.includes('LIMIT 25')) {
    return Promise.resolve([{ id: 'task-unowned-1', title: 'Unowned task' }]);
  }
  if (sql.includes('FROM tasks') && sql.includes('LIMIT 3')) {
    return Promise.resolve([{ id: 'task-rebal-1' }]);
  }
  return Promise.resolve([]);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-11T12:00:00.000Z'));
  mockDbAll.mockReset();
  mockDbRun.mockReset();
  mockGetManagerProblems.mockReset();
  mockDbAll.mockImplementation((sql: string) => routeDbAll(sql));
  mockDbRun.mockResolvedValue({ changes: 1 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

function expectSuccessResult(result: {
  success: boolean;
  changedCount: number;
  changedEntities: Array<{ entityType: string; entityId: string }>;
}) {
  expect(result.success).toBe(true);
  expect(result.changedCount).toBeGreaterThanOrEqual(1);
  expect(Array.isArray(result.changedEntities)).toBe(true);
  expect(result.changedEntities.length).toBeGreaterThan(0);
}

describe('managerActionExecutionService', () => {
  it('executeManagerProblemAction succeeds for task reassign action', async () => {
    mockGetManagerProblems.mockResolvedValue([taskProblem]);
    const result = await executeManagerProblemAction({
      organizationId: ORG,
      userId: UID,
      laneId: LANE_ID,
      problemId: taskProblem.id,
      actionId: 'reassign',
    });
    expectSuccessResult(result);
    expect(mockGetManagerProblems).toHaveBeenCalledWith(ORG, LANE_ID, undefined);
  });

  it('executeManagerProblemAction succeeds for task set_due_date action', async () => {
    mockGetManagerProblems.mockResolvedValue([taskProblem]);
    const result = await executeManagerProblemAction({
      organizationId: ORG,
      userId: UID,
      laneId: LANE_ID,
      problemId: taskProblem.id,
      actionId: 'set_due_date',
    });
    expectSuccessResult(result);
  });

  it('executeManagerProblemAction succeeds for task unblock action', async () => {
    mockGetManagerProblems.mockResolvedValue([taskProblem]);
    const result = await executeManagerProblemAction({
      organizationId: ORG,
      userId: UID,
      laneId: LANE_ID,
      problemId: taskProblem.id,
      actionId: 'unblock',
    });
    expectSuccessResult(result);
  });

  it('executeManagerProblemAction succeeds for initiative assign_owner action', async () => {
    mockGetManagerProblems.mockResolvedValue([initiativeProblem]);
    const result = await executeManagerProblemAction({
      organizationId: ORG,
      userId: UID,
      laneId: LANE_ID,
      problemId: initiativeProblem.id,
      actionId: 'assign_owner',
    });
    expectSuccessResult(result);
  });

  it('executeManagerProblemAction succeeds for decision approve action', async () => {
    mockGetManagerProblems.mockResolvedValue([decisionProblem]);
    const result = await executeManagerProblemAction({
      organizationId: ORG,
      userId: UID,
      laneId: LANE_ID,
      problemId: decisionProblem.id,
      actionId: 'approve',
    });
    expectSuccessResult(result);
  });

  it('executeManagerProblemAction succeeds for RAID create_mitigation action', async () => {
    mockGetManagerProblems.mockResolvedValue([raidProblem]);
    const result = await executeManagerProblemAction({
      organizationId: ORG,
      userId: UID,
      laneId: LANE_ID,
      problemId: raidProblem.id,
      actionId: 'create_mitigation',
    });
    expectSuccessResult(result);
  });

  it('executeManagerProblemAction throws when problem not found', async () => {
    mockGetManagerProblems.mockResolvedValue([taskProblem]);
    await expect(
      executeManagerProblemAction({
        organizationId: ORG,
        userId: UID,
        laneId: LANE_ID,
        problemId: 'missing-problem-id',
        actionId: 'reassign',
      })
    ).rejects.toThrow(/Problem missing-problem-id not found/);
  });

  it('applyManagerSuggestion handles sug-aq:unowned-tasks suggestion', async () => {
    mockGetManagerProblems.mockResolvedValue([]);
    const result = await applyManagerSuggestion({
      organizationId: ORG,
      userId: UID,
      laneId: LANE_ID,
      suggestionId: 'sug-aq:unowned-tasks',
    });
    expectSuccessResult(result);
    expect(result.message).toMatch(/unassigned task/i);
  });

  it('executeManagerProblemAction succeeds for person distribute_work action', async () => {
    mockGetManagerProblems.mockResolvedValue([personProblem]);
    const result = await executeManagerProblemAction({
      organizationId: ORG,
      userId: UID,
      laneId: LANE_ID,
      problemId: personProblem.id,
      actionId: 'distribute_work',
    });
    expectSuccessResult(result);
  });
});
