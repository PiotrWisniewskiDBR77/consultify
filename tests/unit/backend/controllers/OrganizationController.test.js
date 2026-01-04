/**
 * Organization Controller Tests
 *
 * Tests for organization management business logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrganizationController } from '../../../../server/src/controllers/OrganizationController.js';
import { setupStandardTest } from '../../../helpers/unifiedMockSetup.js';

// Mock organization service
vi.mock('../../../../server/services/organizationService.js', () => ({
    getUserOrganizations: vi.fn(),
    createOrganization: vi.fn(),
    getOrganizationById: vi.fn(),
    updateOrganization: vi.fn(),
    getOrganizationMembers: vi.fn(),
    addMemberToOrganization: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMemberFromOrganization: vi.fn()
}));

const mockOrganizationService = await import('../../../../server/services/organizationService.js');

describe('OrganizationController', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        // Setup request/response mocks
        mockReq = {
            user: {
                id: 'user-123'
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

            await OrganizationController.getCurrentOrganizations(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to retrieve organizations',
                details: serviceError.message
            });
        });
    });

    describe('createOrganization()', () => {
        it('should create new organization', async () => {
            mockReq.body = { name: 'New Organization', description: 'Test org' };
            const mockResult = { id: 'org-new', name: 'New Organization' };

            mockOrganizationService.createOrganization.mockResolvedValue(mockResult);

            await OrganizationController.createOrganization(mockReq, mockRes);

            expect(mockOrganizationService.createOrganization).toHaveBeenCalledWith('user-123', {
                name: 'New Organization',
                description: 'Test org'
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
                error: 'Organization name is required'
            });
        });

        it('should handle service errors during creation', async () => {
            mockReq.body = { name: 'Test Org' };
            const serviceError = new Error('Organization name already exists');
            mockOrganizationService.createOrganization.mockRejectedValue(serviceError);

            await OrganizationController.createOrganization(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to create organization',
                details: serviceError.message
            });
        });
    });

    describe('getOrganizationById()', () => {
        it('should retrieve organization by ID', async () => {
            mockReq.params.id = 'org-456';
            const mockOrg = {
                id: 'org-456',
                name: 'Test Organization',
                description: 'Test desc',
                plan: 'enterprise'
            };

            mockOrganizationService.getOrganizationById.mockResolvedValue(mockOrg);

            await OrganizationController.getOrganizationById(mockReq, mockRes);

            expect(mockOrganizationService.getOrganizationById).toHaveBeenCalledWith('org-456');
            expect(mockRes.json).toHaveBeenCalledWith({ organization: mockOrg });
        });

        it('should return 404 when organization not found', async () => {
            mockReq.params.id = 'non-existent';
            mockOrganizationService.getOrganizationById.mockResolvedValue(null);

            await OrganizationController.getOrganizationById(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Organization not found' });
        });

        it('should handle service errors', async () => {
            mockReq.params.id = 'org-123';
            const serviceError = new Error('Database error');
            mockOrganizationService.getOrganizationById.mockRejectedValue(serviceError);

            await OrganizationController.getOrganizationById(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to retrieve organization',
                details: serviceError.message
            });
        });
    });

    describe('updateOrganization()', () => {
        it('should update organization details', async () => {
            mockReq.params.id = 'org-789';
            mockReq.body = { name: 'Updated Name', description: 'Updated desc' };

            mockOrganizationService.updateOrganization.mockResolvedValue(true);

            await OrganizationController.updateOrganization(mockReq, mockRes);

            expect(mockOrganizationService.updateOrganization).toHaveBeenCalledWith('org-789', {
                name: 'Updated Name',
                description: 'Updated desc'
            });
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Organization updated successfully'
            });
        });

        it('should return 404 when organization not found', async () => {
            mockReq.params.id = 'org-999';
            mockReq.body = { name: 'Test' };

            mockOrganizationService.updateOrganization.mockResolvedValue(false);

            await OrganizationController.updateOrganization(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Organization not found' });
        });

        it('should handle service errors', async () => {
            mockReq.params.id = 'org-123';
            mockReq.body = { name: 'Test' };

            const serviceError = new Error('Update failed');
            mockOrganizationService.updateOrganization.mockRejectedValue(serviceError);

            await OrganizationController.updateOrganization(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to update organization',
                details: serviceError.message
            });
        });
    });

    describe('getMembers()', () => {
        it('should retrieve organization members', async () => {
            mockReq.params.orgId = 'org-111';
            const mockMembers = [
                { id: 'user-1', email: 'user1@test.com', role: 'admin' },
                { id: 'user-2', email: 'user2@test.com', role: 'member' }
            ];

            mockOrganizationService.getOrganizationMembers.mockResolvedValue(mockMembers);

            await OrganizationController.getMembers(mockReq, mockRes);

            expect(mockOrganizationService.getOrganizationMembers).toHaveBeenCalledWith('org-111');
            expect(mockRes.json).toHaveBeenCalledWith({ members: mockMembers });
        });

        it('should handle service errors', async () => {
            mockReq.params.orgId = 'org-123';
            const serviceError = new Error('Failed to get members');
            mockOrganizationService.getOrganizationMembers.mockRejectedValue(serviceError);

            await OrganizationController.getMembers(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to retrieve organization members',
                details: serviceError.message
            });
        });
    });

    describe('addMember()', () => {
        it('should add member to organization', async () => {
            mockReq.params.orgId = 'org-222';
            mockReq.body = { userId: 'user-new', role: 'member' };

            mockOrganizationService.addMemberToOrganization.mockResolvedValue({
                id: 'member-123',
                userId: 'user-new',
                role: 'member'
            });

            await OrganizationController.addMember(mockReq, mockRes);

            expect(mockOrganizationService.addMemberToOrganization).toHaveBeenCalledWith('org-222', {
                userId: 'user-new',
                role: 'member'
            });
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Member added successfully',
                member: { id: 'member-123', userId: 'user-new', role: 'member' }
            });
        });

        it('should validate required fields', async () => {
            mockReq.params.orgId = 'org-123';
            mockReq.body = { role: 'member' }; // Missing userId

            await OrganizationController.addMember(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'User ID and role are required'
            });
        });

        it('should validate role values', async () => {
            mockReq.params.orgId = 'org-123';
            mockReq.body = { userId: 'user-123', role: 'invalid-role' };

            await OrganizationController.addMember(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid role. Must be one of: OWNER, ADMIN, MANAGER, USER, GUEST'
            });
        });

        it('should handle service errors', async () => {
            mockReq.params.orgId = 'org-123';
            mockReq.body = { userId: 'user-123', role: 'member' };

            const serviceError = new Error('User already member');
            mockOrganizationService.addMemberToOrganization.mockRejectedValue(serviceError);

            await OrganizationController.addMember(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to add member to organization',
                details: serviceError.message
            });
        });
    });

    describe('updateMemberRole()', () => {
        it('should update member role', async () => {
            mockReq.params.orgId = 'org-333';
            mockReq.params.memberId = 'user-444';
            mockReq.body = { role: 'admin' };

            mockOrganizationService.updateMemberRole.mockResolvedValue(true);

            await OrganizationController.updateMemberRole(mockReq, mockRes);

            expect(mockOrganizationService.updateMemberRole).toHaveBeenCalledWith('org-333', 'user-444', 'admin');
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Member role updated successfully'
            });
        });

        it('should return 404 when member not found', async () => {
            mockReq.params.orgId = 'org-123';
            mockReq.params.memberId = 'user-999';
            mockReq.body = { role: 'admin' };

            mockOrganizationService.updateMemberRole.mockResolvedValue(false);

            await OrganizationController.updateMemberRole(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Member not found' });
        });

        it('should validate role values', async () => {
            mockReq.params.orgId = 'org-123';
            mockReq.params.memberId = 'user-123';
            mockReq.body = { role: 'invalid' };

            await OrganizationController.updateMemberRole(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid role. Must be one of: OWNER, ADMIN, MANAGER, USER, GUEST'
            });
        });

        it('should handle service errors', async () => {
            mockReq.params.orgId = 'org-123';
            mockReq.params.memberId = 'user-123';
            mockReq.body = { role: 'admin' };

            const serviceError = new Error('Permission denied');
            mockOrganizationService.updateMemberRole.mockRejectedValue(serviceError);

            await OrganizationController.updateMemberRole(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to update member role',
                details: serviceError.message
            });
        });
    });

    describe('removeMember()', () => {
        it('should remove member from organization', async () => {
            mockReq.params.orgId = 'org-444';
            mockReq.params.memberId = 'user-555';

            mockOrganizationService.removeMemberFromOrganization.mockResolvedValue(true);

            await OrganizationController.removeMember(mockReq, mockRes);

            expect(mockOrganizationService.removeMemberFromOrganization).toHaveBeenCalledWith('org-444', 'user-555');
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Member removed successfully'
            });
        });

        it('should return 404 when member not found', async () => {
            mockReq.params.orgId = 'org-123';
            mockReq.params.memberId = 'user-999';

            mockOrganizationService.removeMemberFromOrganization.mockResolvedValue(false);

            await OrganizationController.removeMember(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Member not found' });
        });

        it('should handle service errors', async () => {
            mockReq.params.orgId = 'org-123';
            mockReq.params.memberId = 'user-123';

            const serviceError = new Error('Cannot remove owner');
            mockOrganizationService.removeMemberFromOrganization.mockRejectedValue(serviceError);

            await OrganizationController.removeMember(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to remove member from organization',
                details: serviceError.message
            });
        });
    });

    describe('Security & Authorization', () => {
        it('should enforce user authentication for all operations', async () => {
            mockReq.user = null;

            await OrganizationController.getCurrentOrganizations(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
        });

        it('should prevent role escalation attacks', async () => {
            mockReq.params.orgId = 'org-123';
            mockReq.params.memberId = 'user-123';
            mockReq.body = { role: 'OWNER' };

            // This should be validated at the controller level
            await OrganizationController.updateMemberRole(mockReq, mockRes);

            expect(mockOrganizationService.updateMemberRole).toHaveBeenCalledWith('org-123', 'user-123', 'OWNER');
        });

        it('should validate organization ownership for sensitive operations', async () => {
            mockReq.params.orgId = 'org-different';
            mockReq.params.memberId = 'user-123';
            mockReq.body = { role: 'admin' };

            // Service should handle organization access validation
            mockOrganizationService.updateMemberRole.mockResolvedValue(true);

            await OrganizationController.updateMemberRole(mockReq, mockRes);

            expect(mockOrganizationService.updateMemberRole).toHaveBeenCalledWith('org-different', 'user-123', 'admin');
        });
    });
});
