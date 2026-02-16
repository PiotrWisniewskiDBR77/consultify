import { beforeEach, describe, expect, it, vi } from 'vitest';

const DbPromiseMock = vi.hoisted(() => ({
  get: vi.fn(),
  run: vi.fn(),
  all: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  default: DbPromiseMock,
}));

const ProjectMemberServiceMock = vi.hoisted(() => ({
  getMember: vi.fn(),
  PROJECT_ROLES: {
    TASK_ASSIGNEE: 'TASK_ASSIGNEE',
    INITIATIVE_OWNER: 'INITIATIVE_OWNER',
    WORKSTREAM_OWNER: 'WORKSTREAM_OWNER',
    PMO_LEAD: 'PMO_LEAD',
  },
}));

vi.mock('../../../../server/src/services/projectMemberService.js', () => ({
  default: ProjectMemberServiceMock,
}));

vi.mock('../../../../server/src/services/ActivityService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/services/notificationService.js', () => ({
  default: { send: vi.fn() },
}));

import TaskAssignmentService, {
  SLA_HOURS_BY_PRIORITY,
} from '../../../../server/src/services/taskAssignmentService.js';

describe('TaskAssignmentService.assignTask', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-16T00:00:00.000Z'));

    DbPromiseMock.get.mockReset();
    DbPromiseMock.run.mockReset();
    DbPromiseMock.all.mockReset();
    ProjectMemberServiceMock.getMember.mockReset();
  });

  it('throws when task is missing', async () => {
    DbPromiseMock.get.mockResolvedValueOnce(null);
    await expect(TaskAssignmentService.assignTask('t-1', 'u-1')).rejects.toThrow('Task not found');
  });

  it('throws when assignee is not a project member', async () => {
    DbPromiseMock.get.mockResolvedValueOnce({ id: 't-1', project_id: 'p-1', priority: 'high' });
    ProjectMemberServiceMock.getMember.mockResolvedValueOnce(null);

    await expect(TaskAssignmentService.assignTask('t-1', 'u-2')).rejects.toThrow(
      'User is not a member of this project'
    );
  });

  it('throws when member role cannot be assigned tasks', async () => {
    DbPromiseMock.get.mockResolvedValueOnce({ id: 't-1', project_id: 'p-1', priority: 'high' });
    ProjectMemberServiceMock.getMember.mockResolvedValueOnce({ projectRole: 'VIEWER' });

    await expect(TaskAssignmentService.assignTask('t-1', 'u-2')).rejects.toThrow(
      /cannot be assigned tasks/i
    );
  });

  it('updates task with calculated SLA and resets escalation flags', async () => {
    DbPromiseMock.get.mockResolvedValueOnce({ id: 't-1', project_id: 'p-1', priority: 'high' });
    ProjectMemberServiceMock.getMember.mockResolvedValueOnce({
      projectRole: ProjectMemberServiceMock.PROJECT_ROLES.TASK_ASSIGNEE,
    });

    const logAudit = vi
      .spyOn(TaskAssignmentService as any, '_logAudit')
      .mockResolvedValueOnce(undefined);
    const createActivity = vi
      .spyOn(TaskAssignmentService as any, '_createActivity')
      .mockResolvedValueOnce(undefined);
    const getTask = vi.spyOn(TaskAssignmentService as any, 'getTask').mockResolvedValueOnce({
      id: 't-1',
      assignee_id: 'u-2',
    });

    await TaskAssignmentService.assignTask('t-1', 'u-2', { assignedById: 'u-admin' });

    const effective = SLA_HOURS_BY_PRIORITY.high;
    expect(effective).toBe(24);

    expect(DbPromiseMock.run).toHaveBeenCalled();
    const [, params] = DbPromiseMock.run.mock.calls[0];
    expect(params[0]).toBe('u-2'); // assignee_id
    expect(params[1]).toBe(effective); // sla_hours
    expect(params[2]).toBe('2026-02-17T00:00:00.000Z'); // sla_due_at
    expect(params[4]).toBe('t-1'); // WHERE id = ?

    expect(logAudit).toHaveBeenCalled();
    expect(createActivity).toHaveBeenCalled();
    expect(getTask).toHaveBeenCalledWith('t-1');

    vi.useRealTimers();
  });

  it('uses explicit slaHours override when provided', async () => {
    DbPromiseMock.get.mockResolvedValueOnce({ id: 't-1', project_id: 'p-1', priority: 'low' });
    ProjectMemberServiceMock.getMember.mockResolvedValueOnce({
      projectRole: ProjectMemberServiceMock.PROJECT_ROLES.PMO_LEAD,
    });

    vi.spyOn(TaskAssignmentService as any, '_logAudit').mockResolvedValueOnce(undefined);
    vi.spyOn(TaskAssignmentService as any, '_createActivity').mockResolvedValueOnce(undefined);
    vi.spyOn(TaskAssignmentService as any, 'getTask').mockResolvedValueOnce({ id: 't-1' });

    await TaskAssignmentService.assignTask('t-1', 'u-2', { slaHours: 5 });

    const [, params] = DbPromiseMock.run.mock.calls[0];
    expect(params[1]).toBe(5);
    expect(params[2]).toBe('2026-02-16T05:00:00.000Z');

    vi.useRealTimers();
  });
});
