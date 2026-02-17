/**
 * ProjectController - Team & Steering Board Unit Tests (canonical membership)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  dbAll: (...args: unknown[]) => mockQueryAll(...args),
  dbGet: (...args: unknown[]) => mockQueryOne(...args),
  dbRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('../../../../server/src/utils/asyncHandler.js', () => ({
  asyncHandler: (fn: Function) => fn,
}));

vi.mock('uuid', () => ({
  v4: () => 'uuid-123',
}));

describe('ProjectController team endpoints', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      user: { id: 'user-1', organizationId: 'org-1' },
      params: { id: 'p1', userId: 'u2' },
      body: {},
    };
    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  it('getProjectMembers should return mapped members', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'p1' }); // project exists
    mockQueryAll.mockResolvedValueOnce([
      {
        id: 'm1',
        project_id: 'p1',
        user_id: 'u2',
        project_role: 'PMO',
        is_invoked: 1,
        consultant_profile: 'EXTERNAL',
        engagement_type: 'INVITED_BY_CLIENT',
        allocation_percent: 80,
        permissions: '{"canViewProject":true}',
        start_date: null,
        end_date: null,
        created_at: 'now',
        updated_at: 'now',
        added_by_id: 'user-1',
        firstName: 'Ala',
        lastName: 'Kowalska',
        email: 'a@b.com',
        avatarUrl: null,
        accountRole: 'ADMIN',
      },
    ]);

    const { ProjectController } =
      await import('../../../../server/src/controllers/ProjectController.js');
    await ProjectController.getProjectMembers(mockReq, mockRes, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        members: [
          expect.objectContaining({
            id: 'm1',
            projectId: 'p1',
            userId: 'u2',
            projectRole: 'PMO',
            isInvoked: true,
            consultantProfile: 'EXTERNAL',
            engagementType: 'INVITED_BY_CLIENT',
            allocationPercent: 80,
            accountRole: 'ADMIN',
          }),
        ],
      })
    );
  });

  it('addProjectMember should insert canonical membership', async () => {
    mockReq.body = { userId: 'u2', projectRole: 'TEAM_MEMBER', allocationPercent: 50 };
    mockQueryOne
      .mockResolvedValueOnce({ id: 'p1' }) // project exists
      .mockResolvedValueOnce(null); // no existing membership
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { ProjectController } =
      await import('../../../../server/src/controllers/ProjectController.js');
    await ProjectController.addProjectMember(mockReq, mockRes, mockNext);

    expect(mockQueryRun).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('updateSteeringBoard should upsert configuration', async () => {
    mockReq.body = { enabled: true, quorumRule: 'SIMPLE_MAJORITY', slaHours: 72 };
    mockQueryOne
      .mockResolvedValueOnce({ id: 'p1' }) // project exists
      .mockResolvedValueOnce(null); // board missing (insert)
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { ProjectController } =
      await import('../../../../server/src/controllers/ProjectController.js');
    await ProjectController.updateSteeringBoard(mockReq, mockRes, mockNext);

    expect(mockQueryRun).toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith({ success: true });
  });
});
