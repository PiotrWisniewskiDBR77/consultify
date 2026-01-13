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

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
    queryAll: (...args: unknown[]) => mockQueryAll(...args),
    queryOne: (...args: unknown[]) => mockQueryOne(...args),
    queryRun: (...args: unknown[]) => mockQueryRun(...args),
    transformRow: (row: unknown) => mockTransformRow(row),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
    all: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../../server/src/utils/asyncHandler.js', () => ({
    asyncHandler: (fn: Function) => fn,
}));

vi.mock('uuid', () => ({
    v4: () => 'test-uuid-123',
}));

describe('DecisionController', () => {
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
        vi.clearAllMocks();

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
    });

    describe('getDecisions', () => {
        it('should return all decisions for organization', async () => {
            const mockDecisions = [
                { id: 'd1', title: 'Decision 1', status: 'PENDING' },
                { id: 'd2', title: 'Decision 2', status: 'APPROVED' },
            ];
            mockQueryAll.mockResolvedValue(mockDecisions);

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.getDecisions(mockReq, mockRes);

            expect(mockQueryAll).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(mockDecisions);
        });

        it('should filter decisions by projectId', async () => {
            mockReq.query.projectId = 'proj-123';
            mockQueryAll.mockResolvedValue([]);

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.getDecisions(mockReq, mockRes);

            const callArgs = mockQueryAll.mock.calls[0];
            expect(callArgs[0]).toContain('project_id');
            expect(callArgs[1]).toContain('proj-123');
        });

        it('should filter decisions by status', async () => {
            mockReq.query.status = 'PENDING';
            mockQueryAll.mockResolvedValue([]);

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.getDecisions(mockReq, mockRes);

            const callArgs = mockQueryAll.mock.calls[0];
            expect(callArgs[0]).toContain('status');
            expect(callArgs[1]).toContain('PENDING');
        });
    });

    describe('getDecisionById', () => {
        it('should return decision when found', async () => {
            const mockDecision = { id: 'd1', title: 'Test Decision' };
            mockReq.params.id = 'd1';
            mockQueryOne.mockResolvedValue(mockDecision);

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.getDecisionById(mockReq, mockRes);

            expect(mockQueryOne).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalled();
        });

        it('should return 404 when decision not found', async () => {
            mockReq.params.id = 'non-existent';
            mockQueryOne.mockResolvedValue(null);

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.getDecisionById(mockReq, mockRes);

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
            mockQueryRun.mockResolvedValue({ changes: 1 });

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.createDecision(mockReq, mockRes);

            expect(mockQueryRun).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'test-uuid-123',
                    projectId: 'proj-123',
                    title: 'New Decision',
                    status: 'pending',
                })
            );
        });

        it('should return 401 when user not authenticated', async () => {
            mockReq.user = null;
            mockReq.body = { projectId: 'proj-123', title: 'Test' };

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.createDecision(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should return 403 when permission denied', async () => {
            mockReq.can.mockReturnValue(false);
            mockReq.body = { projectId: 'proj-123', title: 'Test' };

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.createDecision(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        it('should return 400 when required fields missing', async () => {
            mockReq.body = {};

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.createDecision(mockReq, mockRes);

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
                decision_owner_id: 'user-123',
                audit_trail: '[]',
            });
            mockQueryRun.mockResolvedValue({ changes: 1 });

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.decide(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'd1',
                    status: 'approved',
                })
            );
        });

        it('should reject decision with rationale', async () => {
            mockReq.params.id = 'd1';
            mockReq.body = { decision: 'rejected', rationale: 'Not feasible' };
            mockQueryOne.mockResolvedValue({
                id: 'd1',
                decision_owner_id: 'user-123',
                audit_trail: '[]',
            });
            mockQueryRun.mockResolvedValue({ changes: 1 });

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.decide(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'rejected',
                })
            );
        });

        it('should return 400 for invalid decision type', async () => {
            mockReq.params.id = 'd1';
            mockReq.body = { decision: 'invalid', rationale: 'Test' };

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.decide(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid decision' });
        });

        it('should return 400 when rationale missing', async () => {
            mockReq.params.id = 'd1';
            mockReq.body = { decision: 'approved', rationale: '' };

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.decide(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 when decision not found', async () => {
            mockReq.params.id = 'non-existent';
            mockReq.body = { decision: 'approved', rationale: 'Test' };
            mockQueryOne.mockResolvedValue(null);

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.decide(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
        });

        it('should return 403 when user is not decision owner', async () => {
            mockReq.params.id = 'd1';
            mockReq.body = { decision: 'approved', rationale: 'Test' };
            mockReq.user.role = 'USER';
            mockQueryOne.mockResolvedValue({
                id: 'd1',
                decision_owner_id: 'other-user',
                audit_trail: '[]',
            });

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.decide(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(403);
        });
    });

    describe('getBottlenecks', () => {
        it('should return aging and blocking decisions', async () => {
            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.getBottlenecks(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    aging: expect.any(Array),
                    blocking: expect.any(Array),
                })
            );
        });
    });

    describe('escalateDecision', () => {
        it('should escalate decision', async () => {
            mockReq.params.id = 'd1';
            mockReq.body = { reason: 'Urgent', escalateToUserId: 'manager-123' };

            const { DecisionController } = await import(
                '../../../../server/src/controllers/DecisionController.js'
            );
            await DecisionController.escalateDecision(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'd1',
                    message: 'Decision escalated',
                })
            );
        });
    });
});


