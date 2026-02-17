import { beforeEach, describe, expect, it, vi } from 'vitest';

const DbPromiseMock = vi.hoisted(() => ({
  all: vi.fn(),
  run: vi.fn(),
}));

const notificationServiceMock = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  default: DbPromiseMock,
}));

vi.mock('../../../../server/src/services/notificationService.js', () => ({
  default: notificationServiceMock,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../../server/src/services/projectMemberService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/services/ActivityService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/services/pmoDomainRegistry.js', () => ({
  PMO_DOMAIN_IDS: {},
}));

vi.mock('../../../../server/src/services/pmoStandardsMapping.js', () => ({
  default: {},
}));

import TaskAssignmentService from '../../../../server/src/services/taskAssignmentService.js';

describe('TaskAssignmentService.checkAndNotifyOverdueStakeholders', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-16T00:00:00.000Z'));

    DbPromiseMock.all.mockReset();
    DbPromiseMock.run.mockReset();
    notificationServiceMock.send.mockReset();
  });

  it('returns zeros when no tasks', async () => {
    DbPromiseMock.all.mockResolvedValueOnce([]);
    const res = await TaskAssignmentService.checkAndNotifyOverdueStakeholders();
    expect(res).toEqual({ processed: 0, notified: 0, skipped: 0, failed: 0 });
  });

  it('skips tasks with no recipients', async () => {
    DbPromiseMock.all.mockResolvedValueOnce([
      { id: 't-1', title: 'X', organization_id: 'org', status: 'todo' },
    ]);
    const res = await TaskAssignmentService.checkAndNotifyOverdueStakeholders();
    expect(res.processed).toBe(1);
    expect(res.skipped).toBe(1);
    expect(notificationServiceMock.send).not.toHaveBeenCalled();
  });

  it('notifies assignee only when present', async () => {
    DbPromiseMock.all.mockResolvedValueOnce([
      {
        id: 't-1',
        title: 'Task',
        organization_id: 'org',
        status: 'todo',
        priority: 'medium',
        due_date: '2026-02-15T00:00:00.000Z',
        assignee_id: 'u-1',
      },
    ]);

    const res = await TaskAssignmentService.checkAndNotifyOverdueStakeholders();
    expect(res.notified).toBe(1);
    expect(notificationServiceMock.send).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-1', type: 'task_overdue', entityId: 't-1' })
    );
    expect(DbPromiseMock.run).toHaveBeenCalled();
  });

  it('dedupes recipients (assignee/owner/backup)', async () => {
    DbPromiseMock.all.mockResolvedValueOnce([
      {
        id: 't-1',
        title: 'Task',
        organization_id: 'org',
        status: 'todo',
        priority: 'medium',
        due_date: '2026-02-15T00:00:00.000Z',
        assignee_id: 'u-1',
        owner_id: 'u-1',
        backup_assignee_id: 'u-1',
      },
    ]);

    const res = await TaskAssignmentService.checkAndNotifyOverdueStakeholders();
    expect(res.notified).toBe(1);
  });

  it('uses urgent notification priority for urgent/critical tasks', async () => {
    DbPromiseMock.all.mockResolvedValueOnce([
      {
        id: 't-1',
        title: 'Task',
        organization_id: 'org',
        status: 'todo',
        priority: 'urgent',
        due_date: '2026-02-15T00:00:00.000Z',
        assignee_id: 'u-1',
      },
    ]);

    await TaskAssignmentService.checkAndNotifyOverdueStakeholders();
    expect(notificationServiceMock.send).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'urgent' })
    );
  });

  it('uses high priority when overdue >= 3 days', async () => {
    DbPromiseMock.all.mockResolvedValueOnce([
      {
        id: 't-1',
        title: 'Task',
        organization_id: 'org',
        status: 'todo',
        priority: 'medium',
        due_date: '2026-02-10T00:00:00.000Z',
        assignee_id: 'u-1',
      },
    ]);

    await TaskAssignmentService.checkAndNotifyOverdueStakeholders();
    expect(notificationServiceMock.send).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'high' })
    );
  });

  it('uses normal priority when overdue < 3 days and not urgent', async () => {
    DbPromiseMock.all.mockResolvedValueOnce([
      {
        id: 't-1',
        title: 'Task',
        organization_id: 'org',
        status: 'todo',
        priority: 'low',
        due_date: '2026-02-15T00:00:00.000Z',
        assignee_id: 'u-1',
      },
    ]);

    await TaskAssignmentService.checkAndNotifyOverdueStakeholders();
    expect(notificationServiceMock.send).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'normal' })
    );
  });

  it('marks backup recipient with backup type', async () => {
    DbPromiseMock.all.mockResolvedValueOnce([
      {
        id: 't-1',
        title: 'Task',
        organization_id: 'org',
        status: 'todo',
        priority: 'low',
        due_date: '2026-02-15T00:00:00.000Z',
        assignee_id: 'u-1',
        backup_assignee_id: 'u-2',
      },
    ]);

    await TaskAssignmentService.checkAndNotifyOverdueStakeholders();
    expect(notificationServiceMock.send).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-2', type: 'task_overdue_backup' })
    );
  });

  it('updates last_overdue_notified_at after notifications', async () => {
    DbPromiseMock.all.mockResolvedValueOnce([
      {
        id: 't-1',
        title: 'Task',
        organization_id: 'org',
        status: 'todo',
        priority: 'low',
        due_date: '2026-02-15T00:00:00.000Z',
        assignee_id: 'u-1',
      },
    ]);

    await TaskAssignmentService.checkAndNotifyOverdueStakeholders();
    expect(DbPromiseMock.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tasks SET last_overdue_notified_at'),
      expect.arrayContaining(['2026-02-16T00:00:00.000Z'])
    );
  });

  it('counts failed when notification send throws and continues', async () => {
    DbPromiseMock.all.mockResolvedValueOnce([
      {
        id: 't-1',
        title: 'Task',
        organization_id: 'org',
        status: 'todo',
        priority: 'low',
        due_date: '2026-02-15T00:00:00.000Z',
        assignee_id: 'u-1',
      },
      {
        id: 't-2',
        title: 'Task2',
        organization_id: 'org',
        status: 'todo',
        priority: 'low',
        due_date: '2026-02-15T00:00:00.000Z',
        assignee_id: 'u-2',
      },
    ]);

    notificationServiceMock.send.mockRejectedValueOnce(new Error('boom'));
    const res = await TaskAssignmentService.checkAndNotifyOverdueStakeholders();

    expect(res.failed).toBe(1);
    expect(res.processed).toBe(2);
    expect(notificationServiceMock.send).toHaveBeenCalledTimes(2);
  });
});
