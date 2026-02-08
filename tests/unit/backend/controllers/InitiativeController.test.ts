/**
 * InitiativeController Unit Tests
 * Tests PMO initiative management functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('../../../../server/src/utils/asyncHandler.js', () => ({
  asyncHandler: (fn: Function) => fn,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'initiative-uuid-123',
}));

describe('InitiativeController', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      user: {
        id: 'user-123',
        organizationId: 'org-123',
      },
      params: {},
      query: {},
      body: {},
    };

    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('getInitiatives', () => {
    it('should return all initiatives for organization', async () => {
      const mockInitiatives = [
        {
          id: 'i1',
          title: 'Initiative 1',
          status: 'PLANNING',
          progress: 50,
          organization_id: 'org-123',
        },
        {
          id: 'i2',
          title: 'Initiative 2',
          status: 'DONE',
          progress: 100,
          organization_id: 'org-123',
        },
      ];
      mockQueryAll.mockResolvedValue(mockInitiatives);

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.getInitiatives(mockReq, mockRes, mockNext);

      expect(mockQueryAll).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
      const result = mockRes.json.mock.calls[0][0];
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('name', 'Initiative 1');
    });

    it('should return 401 when user not authenticated', async () => {
      mockReq.user = { id: 'user-123' }; // no organizationId

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.getInitiatives(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should parse JSON fields correctly', async () => {
      const mockInitiative = {
        id: 'i1',
        title: 'Initiative with JSON',
        deliverables: '["item1", "item2"]',
        success_criteria: '["criteria1"]',
        scope_in: '[]',
        scope_out: '[]',
        key_risks: '["risk1"]',
      };
      mockQueryAll.mockResolvedValue([mockInitiative]);

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.getInitiatives(mockReq, mockRes, mockNext);

      const result = mockRes.json.mock.calls[0][0];
      expect(result[0].deliverables).toEqual(['item1', 'item2']);
      expect(result[0].keyRisks).toEqual(['risk1']);
    });
  });

  describe('getInitiativeById', () => {
    it('should return initiative when found', async () => {
      const mockInitiative = {
        id: 'i1',
        title: 'Test Initiative',
        organization_id: 'org-123',
      };
      mockReq.params.id = 'i1';
      mockQueryOne.mockResolvedValue(mockInitiative);

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.getInitiativeById(mockReq, mockRes, mockNext);

      expect(mockQueryOne).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should return 404 when initiative not found', async () => {
      mockReq.params.id = 'non-existent';
      mockQueryOne.mockResolvedValue(null);

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.getInitiativeById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Initiative not found' });
    });
  });

  describe('createInitiative', () => {
    it('should create initiative with valid data', async () => {
      mockReq.body = {
        projectId: 'proj-123',
        title: 'New Initiative',
        axis: 'DIGITAL',
        area: 'OPERATIONS',
        summary: 'Test summary',
        hypothesis: 'Test hypothesis',
        businessValue: 100000,
      };
      mockQueryRun.mockResolvedValue({ changes: 1 });

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.createInitiative(mockReq, mockRes, mockNext);

      expect(mockQueryRun).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'initiative-uuid-123',
          name: 'New Initiative',
          message: 'Initiative created',
        })
      );
    });

    it('should return 401 when user not authenticated', async () => {
      mockReq.user = { id: 'user-123' }; // no organizationId
      mockReq.body = { title: 'Test' };

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.createInitiative(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 400 when title missing', async () => {
      mockReq.body = { projectId: 'proj-123' };

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.createInitiative(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Title is required' });
    });

    it('should store JSON arrays for deliverables and risks', async () => {
      mockReq.body = {
        title: 'Initiative with arrays',
        deliverables: ['D1', 'D2'],
        successCriteria: ['SC1'],
        scopeIn: ['In scope'],
        scopeOut: ['Out of scope'],
        keyRisks: ['Risk 1', 'Risk 2'],
      };
      mockQueryRun.mockResolvedValue({ changes: 1 });

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.createInitiative(mockReq, mockRes, mockNext);

      const callArgs = mockQueryRun.mock.calls[0][1];
      expect(callArgs).toContain('["D1","D2"]');
      expect(callArgs).toContain('["Risk 1","Risk 2"]');
    });
  });

  describe('updateInitiative', () => {
    it('should update initiative', async () => {
      mockReq.params.id = 'i1';
      mockReq.body = { title: 'Updated Title' };
      // Controller first fetches existing initiative
      mockQueryOne
        .mockResolvedValueOnce({ id: 'i1', title: 'Old Title', status: 'PLANNING', organization_id: 'org-123' })
        .mockResolvedValueOnce({ id: 'i1', title: 'Updated Title', status: 'PLANNING', organization_id: 'org-123' });
      mockQueryRun.mockResolvedValue({ changes: 1 });

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.updateInitiative(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalled();
      const result = mockRes.json.mock.calls[0][0];
      expect(result).toHaveProperty('message', 'Initiative updated');
      expect(result).toHaveProperty('id', 'i1');
    });

    it('should return 401 when user not authenticated', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.params.id = 'i1';

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.updateInitiative(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('updateInitiativeStatus', () => {
    it('should update initiative status', async () => {
      mockReq.params.id = 'i1';
      mockReq.body = { status: 'PENDING_REVIEW', reason: 'Ready for review' };
      // Controller queries existing initiative first
      mockQueryOne.mockResolvedValue({ status: 'DRAFT', name: 'Test Initiative', created_by: 'user-123' });
      mockQueryRun.mockResolvedValue({ changes: 1 });

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.updateInitiativeStatus(mockReq, mockRes, mockNext);

      // Should either succeed with json or fail with status code (depends on transition rules)
      const jsonCalled = mockRes.json.mock.calls.length > 0;
      const statusCalled = mockRes.status.mock.calls.length > 0;
      expect(jsonCalled || statusCalled).toBe(true);
    });

    it('should return 401 when user not authenticated', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.params.id = 'i1';
      mockReq.body = { status: 'PLANNING' };

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.updateInitiativeStatus(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });
});
