/**
 * GovernanceController Unit Tests
 * Tests change requests and governance policies
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
    queryAll: (...args: unknown[]) => mockQueryAll(...args),
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
    v4: () => 'cr-uuid-123',
}));

describe('GovernanceController', () => {
    let mockReq: any;
    let mockRes: any;

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
    });

    describe('getChangeRequests', () => {
        it('should return all change requests for organization', async () => {
            const mockRequests = [
                { id: 'cr1', title: 'Change 1', status: 'PENDING' },
                { id: 'cr2', title: 'Change 2', status: 'APPROVED' },
            ];
            mockQueryAll.mockResolvedValue(mockRequests);

            const { GovernanceController } = await import(
                '../../../../server/src/controllers/GovernanceController.js'
            );
            await GovernanceController.getChangeRequests(mockReq, mockRes);

            expect(mockQueryAll).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(mockRequests);
        });

        it('should return 401 when user not authenticated', async () => {
            mockReq.user = { id: 'user-123' }; // no organizationId

            const { GovernanceController } = await import(
                '../../../../server/src/controllers/GovernanceController.js'
            );
            await GovernanceController.getChangeRequests(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
        });

        it('should query with organization filter', async () => {
            mockQueryAll.mockResolvedValue([]);

            const { GovernanceController } = await import(
                '../../../../server/src/controllers/GovernanceController.js'
            );
            await GovernanceController.getChangeRequests(mockReq, mockRes);

            expect(mockQueryAll).toHaveBeenCalledWith(
                expect.stringContaining('organization_id'),
                ['org-123']
            );
        });
    });

    describe('createChangeRequest', () => {
        it('should create change request with valid data', async () => {
            mockReq.body = {
                projectId: 'proj-123',
                title: 'New Change Request',
                description: 'Test description',
                reason: 'Business need',
                impact: 'Medium',
            };
            mockQueryRun.mockResolvedValue({ changes: 1 });

            const { GovernanceController } = await import(
                '../../../../server/src/controllers/GovernanceController.js'
            );
            await GovernanceController.createChangeRequest(mockReq, mockRes);

            expect(mockQueryRun).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'cr-uuid-123',
                    title: 'New Change Request',
                    status: 'PENDING',
                    message: 'Change request created',
                })
            );
        });

        it('should return 401 when user not authenticated', async () => {
            mockReq.user = { id: 'user-123' }; // no organizationId
            mockReq.body = { title: 'Test' };

            const { GovernanceController } = await import(
                '../../../../server/src/controllers/GovernanceController.js'
            );
            await GovernanceController.createChangeRequest(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should return 400 when title missing', async () => {
            mockReq.body = { description: 'No title' };

            const { GovernanceController } = await import(
                '../../../../server/src/controllers/GovernanceController.js'
            );
            await GovernanceController.createChangeRequest(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Title is required' });
        });

        it('should create without projectId', async () => {
            mockReq.body = {
                title: 'Org-level Change',
                description: 'Applies to whole org',
            };
            mockQueryRun.mockResolvedValue({ changes: 1 });

            const { GovernanceController } = await import(
                '../../../../server/src/controllers/GovernanceController.js'
            );
            await GovernanceController.createChangeRequest(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(201);
        });
    });

    describe('getPolicies', () => {
        it('should return governance policies', async () => {
            const mockPolicies = [
                { id: 'p1', name: 'Budget Policy', type: 'BUDGET' },
                { id: 'p2', name: 'Change Policy', type: 'CHANGE' },
            ];
            mockQueryAll.mockResolvedValue(mockPolicies);

            const { GovernanceController } = await import(
                '../../../../server/src/controllers/GovernanceController.js'
            );
            await GovernanceController.getPolicies(mockReq, mockRes);

            expect(mockQueryAll).toHaveBeenCalled();
            expect(mockRes.json).toHaveBeenCalledWith(mockPolicies);
        });

        it('should return 401 when user not authenticated', async () => {
            mockReq.user = { id: 'user-123' };

            const { GovernanceController } = await import(
                '../../../../server/src/controllers/GovernanceController.js'
            );
            await GovernanceController.getPolicies(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should include global policies (organization_id IS NULL)', async () => {
            mockQueryAll.mockResolvedValue([]);

            const { GovernanceController } = await import(
                '../../../../server/src/controllers/GovernanceController.js'
            );
            await GovernanceController.getPolicies(mockReq, mockRes);

            const sqlQuery = mockQueryAll.mock.calls[0][0];
            expect(sqlQuery).toContain('organization_id IS NULL');
        });
    });
});


