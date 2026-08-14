/**
 * InitiativeController Unit Tests
 * Tests PMO initiative management functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockGetTableColumns = vi.fn();
const mockResolveInitiativeAccessContext = vi.fn();
const mockGetBlockingReadinessItems = vi.fn();
const mockHandoffFromClosure = vi.fn();
const mockExecuteInitiativeTransition = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
  getTableColumns: (...args: unknown[]) => mockGetTableColumns(...args),
}));

vi.mock('../../../../server/src/services/initiative/initiativeAccessResolver.js', () => ({
  resolveInitiativeAccessContext: (...args: unknown[]) =>
    mockResolveInitiativeAccessContext(...args),
}));

vi.mock('../../../../server/src/services/initiative/initiativeGateReadinessService.js', () => ({
  getBlockingReadinessItems: (...args: unknown[]) => mockGetBlockingReadinessItems(...args),
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

vi.mock('../../../../server/src/services/executionResultsBridge.js', () => ({
  handoffFromClosure: (...args: unknown[]) => mockHandoffFromClosure(...args),
  CLOSURE_HANDOFF_SOURCE: 'M14_CLOSURE_HANDOFF',
}));

vi.mock(
  '../../../../server/src/services/initiative/initiativeTransitionService.js',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../server/src/services/initiative/initiativeTransitionService.js')
      >();
    return {
      ...actual,
      executeInitiativeTransition: (...args: unknown[]) => mockExecuteInitiativeTransition(...args),
    };
  }
);

describe('InitiativeController', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INITIATIVE_FUNNEL_ENABLED = 'false';
    mockResolveInitiativeAccessContext.mockReset();
    mockGetTableColumns.mockReset();
    mockGetBlockingReadinessItems.mockReset();
    mockHandoffFromClosure.mockReset();
    mockHandoffFromClosure.mockResolvedValue({ created: 0, skipped: 0, considered: 0 });
    mockResolveInitiativeAccessContext.mockResolvedValue({
      effectiveRoles: ['ADMIN'],
      steeringBoard: { enabled: false, memberType: null },
      roleAssignments: [],
      projectId: null,
    });
    mockExecuteInitiativeTransition.mockResolvedValue({
      ok: true,
      id: 'i1',
      status: 'PENDING_REVIEW',
      previousStatus: 'DRAFT',
      gate: null,
    });
    mockGetTableColumns.mockResolvedValue([
      { name: 'status' },
      { name: 'updated_at' },
      { name: 'review_requested_at' },
      { name: 'review_requested_by' },
      { name: 'approved_at' },
      { name: 'approved_by' },
      { name: 'approval_comment' },
      { name: 'execution_started_at' },
      { name: 'blocked_at' },
      { name: 'blocked_reason' },
      { name: 'unblocked_at' },
      { name: 'done_at' },
      { name: 'done_by' },
      { name: 'completed_at' },
      { name: 'cancelled_at' },
      { name: 'cancelled_reason' },
      { name: 'archived_at' },
      { name: 'updated_by' },
    ]);
    mockGetBlockingReadinessItems.mockResolvedValue([]);

    mockReq = {
      user: {
        id: 'user-123',
        organizationId: 'org-123',
        role: 'ADMIN',
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
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Initiative not found',
        code: 'INITIATIVE_NOT_FOUND',
      });
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

    it('should return 422 when title is rejected by the card content gate', async () => {
      mockReq.body = { projectId: 'proj-123' };

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.createInitiative(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'CARD_CONTENT_FORMULA_VIOLATION' })
      );
    });

    it('should store JSON arrays for deliverables and risks', async () => {
      mockReq.body = {
        projectId: 'proj-123',
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
        .mockResolvedValueOnce({
          id: 'i1',
          title: 'Old Title',
          status: 'PLANNING',
          organization_id: 'org-123',
        })
        .mockResolvedValueOnce({
          id: 'i1',
          title: 'Updated Title',
          status: 'PLANNING',
          organization_id: 'org-123',
        });
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
    it('delegates the transition and maps a successful service result', async () => {
      mockReq.params.id = 'i1';
      mockReq.body = { status: 'PENDING_REVIEW', reason: 'Ready for review' };

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.updateInitiativeStatus(mockReq, mockRes, mockNext);

      expect(mockExecuteInitiativeTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org-123',
          initiativeId: 'i1',
          actorId: 'user-123',
          actorRole: 'ADMIN',
          nextStatusInput: 'PENDING_REVIEW',
          reason: 'Ready for review',
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        id: 'i1',
        status: 'PENDING_REVIEW',
        previousStatus: 'DRAFT',
        gate: null,
        message: 'Status updated',
      });
    });

    it('maps a transition-service rejection without performing controller SQL', async () => {
      mockReq.params.id = 'i1';
      mockReq.body = { status: 'TRACKING' };
      mockExecuteInitiativeTransition.mockResolvedValueOnce({
        ok: false,
        statusCode: 400,
        body: {
          error: 'Benefits KPIs are required',
          rule: 'BENEFITS_KPI_REQUIRED',
        },
      });

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.updateInitiativeStatus(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          rule: 'BENEFITS_KPI_REQUIRED',
        })
      );
      expect(mockQueryRun).not.toHaveBeenCalled();
    });

    it('should return 401 when user not authenticated', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.params.id = 'i1';
      mockReq.body = { status: 'PLANNING' };

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.updateInitiativeStatus(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockExecuteInitiativeTransition).not.toHaveBeenCalled();
    });
  });

  describe('getGateReadinessCheck capabilities', () => {
    it('should return capabilities contract (v1)', async () => {
      mockReq.params.id = 'i1';
      mockQueryOne.mockResolvedValueOnce({
        id: 'i1',
        organization_id: 'org-123',
        status: 'PLANNING',
        owner_business_id: null,
        owner_execution_id: null,
        sponsor_id: null,
      });
      mockResolveInitiativeAccessContext.mockResolvedValue({
        effectiveRoles: ['PMO'],
        steeringBoard: { enabled: false, memberType: null },
        roleAssignments: [],
        projectId: null,
      });

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.getGateReadinessCheck(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalled();
      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.capabilities).toEqual(
        expect.objectContaining({
          version: 1,
          source: 'backend',
          topBar: expect.objectContaining({
            canEditPriority: true,
            canEditOwner: true,
            canEditTargetDate: true,
          }),
          cards: expect.objectContaining({ canEditCards: true }),
          ctaBar: expect.objectContaining({
            contextCreateActions: expect.arrayContaining(['task', 'decision', 'raid']),
            canUseAi: true,
          }),
        })
      );
    });

    it('should allow superadmin to edit gated top-bar fields', async () => {
      mockReq.params.id = 'i1';
      mockQueryOne.mockResolvedValueOnce({
        id: 'i1',
        organization_id: 'org-123',
        status: 'DRAFT',
        owner_business_id: null,
        owner_execution_id: null,
        sponsor_id: null,
      });
      mockResolveInitiativeAccessContext.mockResolvedValue({
        effectiveRoles: ['SUPERADMIN'],
        steeringBoard: { enabled: false, memberType: null },
        roleAssignments: [],
        projectId: null,
      });

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.getGateReadinessCheck(mockReq, mockRes, mockNext);

      const payload = mockRes.json.mock.calls.at(-1)?.[0];
      expect(payload.capabilities?.topBar).toEqual(
        expect.objectContaining({
          canEditPriority: true,
          canEditOwner: true,
          canEditTargetDate: true,
        })
      );
    });
  });

  describe('quickUpdateInitiative enforcement', () => {
    it('should block status updates via quick-update', async () => {
      mockReq.params.id = 'i1';
      mockReq.body = { status: 'DONE' };
      mockQueryOne.mockResolvedValueOnce({
        status: 'PLANNING',
        planned_start_date: null,
        planned_end_date: null,
        owner_business_id: null,
        owner_execution_id: null,
        name: 'Initiative',
      });

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.quickUpdateInitiative(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'status',
        })
      );
    });

    it('should block priority update when top-bar capability denies it', async () => {
      mockReq.params.id = 'i1';
      mockReq.body = { priority: 'high' };
      mockQueryOne.mockResolvedValueOnce({
        status: 'DONE',
        planned_start_date: null,
        planned_end_date: null,
        owner_business_id: null,
        owner_execution_id: null,
        name: 'Initiative',
      });
      mockResolveInitiativeAccessContext.mockResolvedValue({
        effectiveRoles: ['TEAM_MEMBER'],
        steeringBoard: { enabled: false, memberType: null },
        roleAssignments: [],
        projectId: null,
      });

      const { InitiativeController } =
        await import('../../../../server/src/controllers/InitiativeController.js');
      await InitiativeController.quickUpdateInitiative(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'priority',
        })
      );
      expect(mockQueryRun).not.toHaveBeenCalled();
    });
  });
});
