/**
 * ProjectController unit tests (aligned with current controller + queryHelpers)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('ProjectController', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      user: { id: 'user-1', organizationId: 'org-1' },
      params: {},
      query: {},
      body: {},
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it('getProjects should 401 without org', async () => {
    mockReq.user.organizationId = null;
    const { ProjectController } =
      await import('../../../../server/src/controllers/ProjectController.js');
    await ProjectController.getProjects(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  it('getProjects should map counts into response', async () => {
    mockQueryAll.mockResolvedValueOnce([
      {
        id: 'p1',
        name: 'Project',
        description: 'Desc',
        real_member_count: 2,
        real_initiative_count: 3,
        real_assessment_count: 4,
        real_document_count: 5,
      },
    ]);
    mockQueryOne.mockResolvedValueOnce({ total: 1 });

    const { ProjectController } =
      await import('../../../../server/src/controllers/ProjectController.js');
    await ProjectController.getProjects(mockReq, mockRes, mockNext);

    expect(mockRes.setHeader).toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'p1',
        memberCount: 2,
        initiativeCount: 3,
        assessmentCount: 4,
        documentCount: 5,
      }),
    ]);
  });

  it('createProject should 400 without name', async () => {
    const { ProjectController } =
      await import('../../../../server/src/controllers/ProjectController.js');
    await ProjectController.createProject(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Project name is required' });
  });

  it('createProject should insert and return 201', async () => {
    mockReq.body = { name: 'P', description: null, ownerId: 'foreign-user' };
    mockQueryRun.mockResolvedValueOnce({ changes: 1 });
    mockQueryOne.mockResolvedValueOnce({
      id: 'uuid-123',
      name: 'P',
      description: null,
      status: 'active',
      owner_id: 'user-1',
    });

    const { ProjectController } =
      await import('../../../../server/src/controllers/ProjectController.js');
    await ProjectController.createProject(mockReq, mockRes, mockNext);

    expect(mockQueryRun).toHaveBeenCalledWith(expect.not.stringContaining('goal'), [
      'uuid-123',
      'org-1',
      'P',
      null,
      'active',
      'user-1',
    ]);
    expect(mockQueryOne).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = ? AND organization_id = ?'),
      ['uuid-123', 'org-1']
    );
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'uuid-123',
        name: 'P',
        status: 'active',
        ownerId: 'user-1',
      })
    );
  });
});
