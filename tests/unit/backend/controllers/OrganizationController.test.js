/**
 * Organization Controller Tests
 *
 * Tests for organization management business logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrganizationController } from '../../../../server/src/controllers/OrganizationController.js';

// Mock organization service
vi.mock('../../../../server/src/services/organizationService.js', () => ({
    getUserOrganizations: vi.fn(),
    createOrganization: vi.fn(),
    getOrganization: vi.fn(),
    updateOrganization: vi.fn(),
    getMembers: vi.fn(),
    addMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    default: {
        getUserOrganizations: vi.fn(),
        createOrganization: vi.fn(),
        getOrganization: vi.fn(),
        updateOrganization: vi.fn(),
        getMembers: vi.fn(),
        addMember: vi.fn(),
        updateMemberRole: vi.fn(),
        removeMember: vi.fn()
    }
}));

const mockOrganizationService = await import('../../../../server/src/services/organizationService.js');

describe('OrganizationController', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        // Setup request/response mocks
        mockReq = {
            user: {
                id: 'user-123',
                role: 'USER'
            },
            params: {},
            query: {},
            body: {}
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis()
        };

        mockNext = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getCurrentOrganizations()', () => {
        it('should retrieve organizations for authenticated user', async () => {
            const mockOrgs = [
                { id: 'org-1', name: 'Organization 1', role: 'owner' },
                { id: 'org-2', name: 'Organization 2', role: 'member' }
            ];

            mockOrganizationService.getUserOrganizations.mockResolvedValue(mockOrgs);

            await OrganizationController.getCurrentOrganizations(mockReq, mockRes);

            expect(mockOrganizationService.getUserOrganizations).toHaveBeenCalledWith('user-123');
            expect(mockRes.json).toHaveBeenCalledWith(mockOrgs);
        });

        it('should return 401 when user is not authenticated', async () => {
            mockReq.user = null;

            await OrganizationController.getCurrentOrganizations(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
            expect(mockOrganizationService.getUserOrganizations).not.toHaveBeenCalled();
        });

        it('should handle service errors', async () => {
            const serviceError = new Error('Database connection failed');
            mockOrganizationService.getUserOrganizations.mockRejectedValue(serviceError);

            await OrganizationController.getCurrentOrganizations(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(serviceError);
        });
    });

    describe('createOrganization()', () => {
        it('should create new organization', async () => {
            mockReq.body = { name: 'New Organization', description: 'Test org' };
            const mockResult = { id: 'org-new', name: 'New Organization' };

            mockOrganizationService.createOrganization.mockResolvedValue(mockResult);

            await OrganizationController.createOrganization(mockReq, mockRes);

            expect(mockOrganizationService.createOrganization).toHaveBeenCalledWith({
                userId: 'user-123',
                name: 'New Organization'
            });
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(mockResult);
        });

        it('should return 401 when user is not authenticated', async () => {
            mockReq.user = null;
            mockReq.body = { name: 'Test' };

            await OrganizationController.createOrganization(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
            expect(mockOrganizationService.createOrganization).not.toHaveBeenCalled();
        });

        it('should validate required name field', async () => {
            mockReq.body = { description: 'Test' }; // Missing name

            await OrganizationController.createOrganization(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Name is required'
            });
        });

        it('should handle service errors during creation', async () => {
            mockReq.body = { name: 'Test Org' };
            const serviceError = new Error('Organization name already exists');
            mockOrganizationService.createOrganization.mockRejectedValue(serviceError);

            await OrganizationController.createOrganization(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(serviceError);
        });
    });

    describe('getOrganizationById()', () => {
        it('should retrieve organization by ID', async () => {
            mockReq.params.orgId = 'org-456';
            const mockOrg = {
                id: 'org-456',
                name: 'Test Organization',
                description: 'Test desc'
            };
            const mockMembers = [{ user_id: 'user-123', role: 'MEMBER' }];

            mockOrganizationService.getMembers.mockResolvedValue(mockMembers);
            mockOrganizationService.getOrganization.mockResolvedValue(mockOrg);

            await OrganizationController.getOrganizationById(mockReq, mockRes);

            expect(mockOrganizationService.getMembers).toHaveBeenCalledWith('org-456');
            expect(mockOrganizationService.getOrganization).toHaveBeenCalledWith('org-456');
            expect(mockRes.json).toHaveBeenCalledWith(mockOrg);
        });

        it('should return 403 when user is not a member', async () => {
            mockReq.params.orgId = 'org-456';
            const mockMembers = [{ user_id: 'other-user', role: 'MEMBER' }];

            mockOrganizationService.getMembers.mockResolvedValue(mockMembers);

            await OrganizationController.getOrganizationById(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access denied' });
        });

        it('should return 404 when organization not found', async () => {
            mockReq.params.orgId = 'org-123';
            const mockMembers = [{ user_id: 'user-123', role: 'MEMBER' }];
            const serviceError = new Error('Organization not found');
            mockOrganizationService.getMembers.mockResolvedValue(mockMembers);
            mockOrganizationService.getOrganization.mockRejectedValue(serviceError);

            await OrganizationController.getOrganizationById(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalledWith(serviceError);
        });
    });

    describe('updateOrganization()', () => {
        it('should update organization details (stub)', async () => {
            mockReq.params.orgId = 'org-789';
            mockReq.body = { name: 'Updated Name' };

            await OrganizationController.updateOrganization(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                id: 'org-789',
                message: 'Organization updated'
            });
        });
    });

    describe('getMembers()', () => {
        it('should retrieve organization members', async () => {
            mockReq.params.orgId = 'org-111';
            const mockMembers = [
                { user_id: 'user-123', role: 'ADMIN' },
                { user_id: 'user-2', role: 'MEMBER' }
            ];

            mockOrganizationService.getMembers.mockResolvedValue(mockMembers);

            await OrganizationController.getMembers(mockReq, mockRes);

            expect(mockOrganizationService.getMembers).toHaveBeenCalledWith('org-111');
            expect(mockRes.json).toHaveBeenCalledWith(mockMembers);
        });

        it('should return 403 when user is not a member', async () => {
            mockReq.params.orgId = 'org-111';
            const mockMembers = [
                { user_id: 'other-user', role: 'ADMIN' }
            ];

            mockOrganizationService.getMembers.mockResolvedValue(mockMembers);

            await OrganizationController.getMembers(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access denied' });
        });
    });

    describe('addMember()', () => {
        it('should add member to organization', async () => {
            mockReq.params.orgId = 'org-222';
            mockReq.body = { targetUserId: 'user-new', role: 'MEMBER' };
            
            const mockMembers = [{ user_id: 'user-123', role: 'ADMIN' }];
            mockOrganizationService.getMembers.mockResolvedValue(mockMembers);
            mockOrganizationService.addMember.mockResolvedValue({
                id: 'member-123',
                organizationId: 'org-222',
                userId: 'user-new',
                role: 'MEMBER'
            });

            await OrganizationController.addMember(mockReq, mockRes);

            expect(mockOrganizationService.addMember).toHaveBeenCalledWith({
                organizationId: 'org-222',
                userId: 'user-new',
                role: 'MEMBER',
                invitedBy: 'user-123'
            });
            expect(mockRes.json).toHaveBeenCalledWith({
                id: 'member-123',
                organizationId: 'org-222',
                userId: 'user-new',
                role: 'MEMBER'
            });
        });

        it('should return 403 when non-admin tries to add member', async () => {
            mockReq.params.orgId = 'org-222';
            mockReq.body = { targetUserId: 'user-new', role: 'MEMBER' };
            
            const mockMembers = [{ user_id: 'user-123', role: 'MEMBER' }];
            mockOrganizationService.getMembers.mockResolvedValue(mockMembers);

            await OrganizationController.addMember(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Only Admins can add members' });
        });
    });

    describe('updateMemberRole()', () => {
        it('should update member role', async () => {
            mockReq.params.orgId = 'org-333';
            mockReq.params.memberId = 'user-444';
            mockReq.body = { role: 'ADMIN' };

            mockOrganizationService.updateMemberRole.mockResolvedValue({
                organizationId: 'org-333',
                userId: 'user-444',
                role: 'ADMIN'
            });

            await OrganizationController.updateMemberRole(mockReq, mockRes);

            expect(mockOrganizationService.updateMemberRole).toHaveBeenCalledWith({
                organizationId: 'org-333',
                userId: 'user-444',
                role: 'ADMIN'
            });
            expect(mockRes.json).toHaveBeenCalledWith({
                organizationId: 'org-333',
                userId: 'user-444',
                role: 'ADMIN'
            });
        });
    });

    describe('removeMember()', () => {
        it('should remove member from organization', async () => {
            mockReq.params.orgId = 'org-444';
            mockReq.params.memberId = 'user-555';

            mockOrganizationService.removeMember.mockResolvedValue(undefined);

            await OrganizationController.removeMember(mockReq, mockRes);

            expect(mockOrganizationService.removeMember).toHaveBeenCalledWith({
                organizationId: 'org-444',
                userId: 'user-555'
            });
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Member removed'
            });
        });
    });
});
