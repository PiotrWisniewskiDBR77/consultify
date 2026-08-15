/**
 * DecisionController Unit Tests
 * Tests PMO decision management functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockTransformRow = vi.fn((row) => row);
const mockFinalizeDecisionTransition = vi.fn();
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  transformRow: (row: unknown) => mockTransformRow(row),
  withPgTransaction: async (callback: (client: { query: typeof mockQueryRun }) => unknown) =>
    callback({ query: mockQueryRun }),
}));

vi.mock(
  '../../../../server/src/services/decisionCollaborationService.js',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../server/src/services/decisionCollaborationService.js')
      >();
    return {
      ...actual,
      finalizeDecisionTransition: (...args: unknown[]) => mockFinalizeDecisionTransition(...args),
    };
  }
);

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: vi.fn().mockResolvedValue(new Set(['workflow_status'])),
}));

vi.mock('../../../../server/src/utils/asyncHandler.js', () => ({
  asyncHandler: (fn: Function) => fn,
}));

vi.mock('../../../../server/src/services/AuditEventsService.js', () => ({
  default: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123',
}));

describe('DecisionController', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFinalizeDecisionTransition.mockImplementation(
      async (input: { targetStatus: string; actorId: string }) => ({
        previousStatus: 'pending',
        status: input.targetStatus,
        version: 2,
        decidedBy: input.actorId,
        decidedAt: '2026-08-14T07:00:00.000Z',
      })
    );

    mockReq = {
      user: {
        id: 'user-123',
        organizationId: 'org-123',
        role: 'ADMIN',
      },
      params: {},
      query: {},
      body: {},
      can: vi.fn().mockReturnValue(true),
    };

    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('getDecisions', () => {
    it('should return all decisions for organization', async () => {
      const mockDecisions = [
        {
          id: 'd1',
          title: 'Decision 1',
          status: 'pending',
          decision_maker_id: 'user-123',
          created_by: 'user-123',
          created_at: new Date().toISOString(),
        },
        {
          id: 'd2',
          title: 'Decision 2',
          status: 'approved',
          decision_maker_id: 'user-456',
          created_by: 'user-123',
          created_at: new Date().toISOString(),
        },
      ];
      mockQueryAll.mockResolvedValue(mockDecisions);

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.getDecisions(mockReq, mockRes, mockNext);

      expect(mockQueryAll).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'd1', status: 'PENDING' }),
          expect.objectContaining({ id: 'd2', status: 'APPROVED' }),
        ])
      );
    });

    it('should filter decisions by projectId', async () => {
      mockReq.query.projectId = 'proj-123';
      mockQueryAll.mockResolvedValue([]);

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.getDecisions(mockReq, mockRes, mockNext);

      const callArgs = mockQueryAll.mock.calls[0];
      expect(callArgs[0]).toContain('project_id');
      expect(callArgs[1]).toContain('proj-123');
    });

    it('should filter decisions by status', async () => {
      mockReq.query.status = 'PENDING';
      mockQueryAll.mockResolvedValue([]);

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.getDecisions(mockReq, mockRes, mockNext);

      const callArgs = mockQueryAll.mock.calls[0];
      expect(callArgs[0]).toContain('status');
      expect(callArgs[1]).toContain('pending');
    });
  });

  describe('getDecisionById', () => {
    it('should return decision when found', async () => {
      const mockDecision = {
        id: 'd1',
        title: 'Test Decision',
        status: 'pending',
        decision_maker_id: 'user-123',
        created_by: 'user-123',
        created_at: new Date().toISOString(),
        organization_id: 'org-123',
      };
      mockReq.params.id = 'd1';
      mockQueryOne.mockResolvedValue(mockDecision);
      mockQueryAll.mockResolvedValue([]);

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.getDecisionById(mockReq, mockRes, mockNext);

      expect(mockQueryOne).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should return 404 when decision not found', async () => {
      mockReq.params.id = 'non-existent';
      mockQueryOne.mockResolvedValue(null);

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.getDecisionById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Decision not found' });
    });
  });

  describe('createDecision', () => {
    it('should create decision with valid data', async () => {
      mockReq.body = {
        projectId: 'proj-123',
        title: 'New Decision',
        description: 'Test description',
        pmoDomain: 'GOVERNANCE_DECISION_MAKING',
      };
      mockQueryOne.mockResolvedValue({ id: 'proj-123' });
      mockQueryRun.mockResolvedValue({ changes: 1 });

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.createDecision(mockReq, mockRes, mockNext);

      expect(mockQueryRun).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid-123',
          projectId: 'proj-123',
          title: 'New Decision',
          status: 'PENDING',
        })
      );
    });

    it('should return 401 when user not authenticated', async () => {
      mockReq.user = null;
      mockReq.body = { projectId: 'proj-123', title: 'Test' };

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.createDecision(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when permission denied', async () => {
      mockReq.can.mockReturnValue(false);
      mockReq.body = { projectId: 'proj-123', title: 'Test' };

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.createDecision(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 when required fields missing', async () => {
      mockReq.body = {};

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.createDecision(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Missing required fields' });
    });
  });

  describe('decide', () => {
    it('should approve decision with rationale', async () => {
      mockReq.params.id = 'd1';
      mockReq.body = { decision: 'approved', rationale: 'Good proposal' };
      mockQueryOne.mockResolvedValue({
        id: 'd1',
        decision_maker_id: 'user-123',
        status: 'pending',
      });
      mockQueryRun.mockResolvedValue({ changes: 1 });

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.decide(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'd1',
          status: 'APPROVED',
        })
      );
    });

    it('should reject decision with rationale', async () => {
      mockReq.params.id = 'd1';
      mockReq.body = { decision: 'rejected', rationale: 'Not feasible' };
      mockQueryOne.mockResolvedValue({
        id: 'd1',
        decision_maker_id: 'user-123',
        status: 'pending',
      });
      mockQueryRun.mockResolvedValue({ changes: 1 });

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.decide(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'REJECTED',
        })
      );
    });

    it('should return 400 for invalid decision type', async () => {
      mockReq.params.id = 'd1';
      mockReq.body = { decision: 'invalid', rationale: 'Test' };

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.decide(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid decision' });
    });

    it('should return 404 when decision not found', async () => {
      mockReq.params.id = 'non-existent';
      mockReq.body = { decision: 'approved', rationale: 'Test' };
      mockQueryOne.mockResolvedValue(null);

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.decide(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 when user is not decision owner', async () => {
      mockReq.params.id = 'd1';
      mockReq.body = { decision: 'approved', rationale: 'Test' };
      mockReq.user.role = 'USER';
      mockQueryOne.mockResolvedValue({
        id: 'd1',
        decision_maker_id: 'other-user',
        status: 'pending',
      });

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.decide(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('getBottlenecks', () => {
    it('should return aging and blocking decisions', async () => {
      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.getBottlenecks(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          aging: expect.any(Array),
          blocking: expect.any(Array),
        })
      );
      expect(mockDbAll).toHaveBeenCalledTimes(3);
      for (const call of mockDbAll.mock.calls) {
        expect(call[2]).toEqual({ fallback: false });
      }
      expect(String(mockDbAll.mock.calls[1][0])).toContain(
        "di.is_blocker::text IN ('1','true')"
      );
      expect(String(mockDbAll.mock.calls[1][0])).toContain('HAVING COUNT(di.id) > 0');
    });
  });

  describe('escalateDecision', () => {
    it('should escalate decision', async () => {
      mockReq.params.id = 'd1';
      mockReq.body = { reason: 'Urgent', escalateToUserId: 'manager-123' };
      mockQueryOne.mockResolvedValue({
        id: 'd1',
        decision_maker_id: 'user-123',
        status: 'pending',
      });
      mockQueryRun.mockResolvedValue({ changes: 1 });

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.escalateDecision(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'd1',
          message: 'Decision escalated',
        })
      );
    });
  });

  describe('updateDecision', () => {
    it('persists explicit status updates instead of silently ignoring them', async () => {
      mockReq.params.id = 'd-status';
      mockReq.body = { status: 'PENDING' };
      mockQueryOne.mockResolvedValue({
        id: 'd-status',
        status: 'returned_for_clarification',
        created_by: 'user-123',
      });
      mockQueryRun.mockResolvedValue({ changes: 1 });

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.updateDecision(mockReq, mockRes, mockNext);

      expect(mockQueryRun).toHaveBeenCalledWith(
        expect.stringContaining('status = ?'),
        expect.arrayContaining(['pending', 'd-status'])
      );
      expect(mockQueryRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO decision_history'),
        expect.arrayContaining(['returned_for_clarification', 'pending'])
      );
      expect(mockRes.json).toHaveBeenCalledWith({ id: 'd-status', message: 'Decision updated' });
    });
  });

  describe('decide', () => {
    it('allows OWNER auth alias to approve decisions they do not own directly', async () => {
      mockReq.user.role = 'OWNER';
      mockReq.params.id = 'd-approve';
      mockReq.body = { decision: 'approved', rationale: 'Gate approved' };
      mockQueryOne.mockResolvedValue({
        id: 'd-approve',
        status: 'pending',
        decision_maker_id: 'someone-else',
      });
      mockQueryRun.mockResolvedValue({ changes: 1 });

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.decide(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'd-approve',
          status: 'APPROVED',
          decidedBy: 'user-123',
          version: 2,
        })
      );
    });
  });

  describe('transitionWorkflow', () => {
    it('allows review to proposed rollback', async () => {
      mockReq.params.id = 'd-workflow';
      mockReq.body = { toStatus: 'proposed' };
      mockQueryOne.mockResolvedValue({
        id: 'd-workflow',
        workflow_status: 'review',
        initiative_id: null,
        project_id: 'proj-123',
        title: 'Rollback workflow',
        description: 'Rollback workflow',
        status: 'pending',
        playbook_id: null,
        type: null,
        priority: 'medium',
        impact: 'medium',
        deadline: null,
        decision_maker_id: 'user-123',
        decision_rationale: null,
        options: '[]',
      });
      mockQueryRun.mockResolvedValue({ changes: 1 });

      const { DecisionController } =
        await import('../../../../server/src/controllers/DecisionController.js');
      await DecisionController.transitionWorkflow(mockReq, mockRes, mockNext);

      expect(mockQueryRun).toHaveBeenCalledWith(expect.stringContaining('workflow_status = ?'), [
        'proposed',
        'd-workflow',
      ]);
      expect(mockRes.json).toHaveBeenCalledWith({
        id: 'd-workflow',
        workflowStatus: 'proposed',
        createdTaskIds: [],
      });
    });
  });
});
