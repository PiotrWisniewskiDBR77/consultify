/**
 * M13 / PMO tasks — PUT /api/pmo/tasks/:id (TaskController.updateTask).
 *
 * Exercises the REAL controller method, mocking only leaf deps:
 *   - DbPromise (the controller's DB layer — get/all/run);
 *   - the fire-and-forget side-effect services (Activity/Audit/Notification/
 *     communication sync / Jira / EventBus) so the path runs cleanly without a
 *     live DB or network.
 * taskWorkflowService is left REAL (pure transition validation).
 *
 * Asserts the org-scoped contract for a planning update (startedAt + dueDate):
 *   - 401 with no org;
 *   - the current-task load is org-scoped (id + organization_id);
 *   - 404 when the org-scoped load finds nothing (cross-org id is invisible);
 *   - the UPDATE persists BOTH started_at and due_date with the new values;
 *   - "no-op" body (no recognized fields) returns the current row, no UPDATE.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGet,
  mockAll,
  mockRun,
  mockNotifSend,
  mockNotifyAssignment,
  mockActivityLog,
  mockAuditLog,
  mockPublish,
  dbMock,
} = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockAll = vi.fn(async () => [] as any[]);
  const mockRun = vi.fn(async () => ({ changes: 1, lastID: 0 }));
  return {
    mockGet,
    mockAll,
    mockRun,
    mockNotifSend: vi.fn(async () => 'notif-id'),
    mockNotifyAssignment: vi.fn(async () => undefined),
    mockActivityLog: vi.fn(async () => undefined),
    mockAuditLog: vi.fn(async () => undefined),
    mockPublish: vi.fn(() => undefined),
    dbMock: {
      get: (...a: any[]) => mockGet(...a),
      all: (...a: any[]) => mockAll(...a),
      run: (...a: any[]) => mockRun(...a),
      safeAll: (...a: any[]) => mockAll(...a),
      transaction: vi.fn(),
      tableExists: vi.fn(async () => true),
      columnExists: vi.fn(async () => true),
      exec: vi.fn(async () => undefined),
      count: vi.fn(async () => 0),
    },
  };
});

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  __esModule: true,
  default: dbMock,
  DbPromise: dbMock,
  ...dbMock,
}));

vi.mock('../../../server/src/services/notificationService.js', () => ({
  default: { send: mockNotifSend },
  send: mockNotifSend,
}));

vi.mock('../../../server/src/services/initiative/initiativeNotificationService.js', () => ({
  notifyAssignment: (...a: any[]) => mockNotifyAssignment(...a),
}));

vi.mock('../../../server/src/services/ActivityService.js', () => ({
  default: { log: mockActivityLog },
  activityService: { log: mockActivityLog },
}));

vi.mock('../../../server/src/services/AuditEventsService.js', () => ({
  default: { log: mockAuditLog },
  auditEventsService: { log: mockAuditLog },
}));

vi.mock('../../../server/src/services/integrations/communicationSyncService.js', () => ({
  dispatchProjectCommunicationEvent: vi.fn(async () => undefined),
}));

vi.mock('../../../server/src/services/integrations/jiraOrgClient.js', () => ({
  createIssueFromTask: vi.fn(async () => undefined),
  updateIssueFromTask: vi.fn(async () => undefined),
  parseJiraConfig: vi.fn(() => null),
}));

vi.mock('../../../server/src/services/event/EventBus.js', () => ({
  EventBus: { getInstance: () => ({ publish: mockPublish }) },
  eventBus: { publish: mockPublish },
}));

import { TaskController } from '../../../server/src/controllers/TaskController.js';

const USER_ID = 'user-1';
const ORG_ID = 'org-1';
const TASK_ID = 'task-1';

const baseTask = {
  id: TASK_ID,
  organization_id: ORG_ID,
  title: 'Plan rollout',
  status: 'todo',
  priority: 'medium',
  assignee_id: USER_ID,
  owner_id: USER_ID,
  due_date: null,
  started_at: null,
  project_id: null,
  initiative_id: null,
  blocked_reason: '',
};

async function callUpdate(opts: {
  body: Record<string, unknown>;
  currentTask?: any | null;
  withOrg?: boolean;
}): Promise<{ statusCode: number | null; json: any }> {
  const current = opts.currentTask === undefined ? { ...baseTask } : opts.currentTask;

  // SQL-aware reads: the controller loads the task org-scoped, then re-SELECTs
  // post-update. All task SELECTs return our (mutated) row; custom-field schema
  // and notification-rule lookups return [] via mockAll.
  mockGet.mockImplementation(async (sql: string) => {
    if (/FROM tasks WHERE id = \?/.test(String(sql))) return current ? { ...current } : undefined;
    return undefined;
  });

  const req: any = {
    params: { id: TASK_ID },
    body: opts.body,
    user:
      opts.withOrg === false
        ? { id: USER_ID }
        : { id: USER_ID, organizationId: ORG_ID, role: 'ADMIN' },
  };
  let statusCode: number | null = null;
  let jsonBody: any = null;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      jsonBody = body;
      return this;
    },
  };
  let caught: any = null;
  await (TaskController.updateTask as any)(req, res, (e: any) => {
    caught = e;
  });
  if (caught) throw caught;
  return { statusCode, json: jsonBody };
}

/** The UPDATE tasks SET ... call (excludes the post-load SELECTs and inserts). */
function findUpdateCall(): { sql: string; params: any[] } | null {
  const call = mockRun.mock.calls.find((c) => /^\s*UPDATE tasks SET/i.test(String(c[0])));
  return call ? { sql: String(call[0]), params: call[1] as any[] } : null;
}

describe('PMO tasks — PUT /:id updateTask (real controller)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll.mockImplementation(async () => []);
    mockRun.mockImplementation(async () => ({ changes: 1, lastID: 0 }));
    mockNotifSend.mockImplementation(async () => 'notif-id');
    mockNotifyAssignment.mockImplementation(async () => undefined);
  });

  it('401 when the request carries no organization', async () => {
    const res = await callUpdate({ body: { startedAt: '2026-07-01' }, withOrg: false });
    expect(res.statusCode).toBe(401);
    expect(res.json).toEqual(expect.objectContaining({ error: 'Unauthorized' }));
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('loads the current task org-scoped (id + organization_id)', async () => {
    await callUpdate({ body: { startedAt: '2026-07-01T00:00:00.000Z' } });
    const loadCall = mockGet.mock.calls[0];
    expect(String(loadCall[0])).toMatch(/FROM tasks WHERE id = \? AND organization_id = \?/i);
    expect(loadCall[1]).toEqual([TASK_ID, ORG_ID]);
  });

  it('404 when the org-scoped load finds nothing (cross-org id invisible)', async () => {
    const res = await callUpdate({ body: { startedAt: '2026-07-01' }, currentTask: null });
    expect(res.statusCode).toBe(404);
    expect(res.json).toEqual(expect.objectContaining({ error: 'Task not found' }));
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('persists BOTH started_at and due_date in a single org-scoped UPDATE', async () => {
    const startedAt = '2026-07-01T00:00:00.000Z';
    const dueDate = '2026-07-31T00:00:00.000Z';

    await callUpdate({ body: { startedAt, dueDate } });

    const update = findUpdateCall();
    expect(update).not.toBeNull();
    // Both planning columns are in the SET clause.
    expect(update!.sql).toMatch(/started_at = \?/);
    expect(update!.sql).toMatch(/due_date = \?/);
    // …and bound to the requested values.
    expect(update!.params).toContain(startedAt);
    expect(update!.params).toContain(dueDate);
    // Targets exactly this task id (last bound param).
    expect(update!.params[update!.params.length - 1]).toBe(TASK_ID);
  });

  it('no recognized fields → returns the current row, no UPDATE', async () => {
    const res = await callUpdate({ body: { unknownField: 'x' } });
    expect(findUpdateCall()).toBeNull();
    expect(res.json).toEqual(expect.objectContaining({ id: TASK_ID }));
  });

  // M13/R4-E2: assignee change on an initiative task fires notifyAssignment.
  it('fires notifyAssignment when the assignee changes on an initiative task', async () => {
    await callUpdate({
      body: { assigneeId: 'new-owner' },
      currentTask: { ...baseTask, assignee_id: 'old-owner', initiative_id: 'ini-1' },
    });
    expect(mockNotifyAssignment).toHaveBeenCalledTimes(1);
    expect(mockNotifyAssignment).toHaveBeenCalledWith(
      ORG_ID,
      'ini-1',
      'new-owner',
      'task assignee',
      expect.objectContaining({ actorId: USER_ID })
    );
  });

  it('does NOT fire notifyAssignment when the assignee is unchanged or no initiative', async () => {
    // same assignee → no notification
    await callUpdate({
      body: { assigneeId: 'old-owner' },
      currentTask: { ...baseTask, assignee_id: 'old-owner', initiative_id: 'ini-1' },
    });
    // changed assignee but task is not linked to an initiative → no notification
    await callUpdate({
      body: { assigneeId: 'new-owner' },
      currentTask: { ...baseTask, assignee_id: 'old-owner', initiative_id: null },
    });
    expect(mockNotifyAssignment).not.toHaveBeenCalled();
  });
});
