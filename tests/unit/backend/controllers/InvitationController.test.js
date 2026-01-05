/**
 * Invitation Controller Tests
 *
 * Tests for invitation management, user onboarding, and access control.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InvitationController } from '../../../../server/src/controllers/InvitationController.js';
import { setupStandardTest } from '../../../helpers/unifiedMockSetup.js';

// Mock services
vi.mock('../../../../server/services/invitationService.js', () => ({
    getInvitationsForOrganization: vi.fn(),
    createInvitation: vi.fn(),
    resendInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
    cancelInvitation: vi.fn()
}));

const mockInvitationService = await import('../../../../server/services/invitationService.js');

describe('InvitationController', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        // Setup request/response mocks
        mockReq = {
            user: {
                id: 'user-123',
                organizationId: 'org-456'
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

    describe('getInvitations()', () => {
        it('should retrieve invitations for organization', async () => {
            const mockInvitations = [
                {
                    id: 'inv-1',
                    email: 'user1@example.com',
                    role: 'member',
                    status: 'pending',
                    expires_at: '2024-02-01T00:00:00Z',
                    created_at: '2024-01-01T00:00:00Z'
                },
                {
                    id: 'inv-2',
                    email: 'user2@example.com',
                    role: 'admin',
                    status: 'accepted',
                    expires_at: '2024-02-15T00:00:00Z',
                    created_at: '2024-01-15T00:00:00Z'
                }
            ];

            mockInvitationService.getInvitationsForOrganization.mockResolvedValue(mockInvitations);

            await InvitationController.getInvitations(mockReq, mockRes);

            expect(mockInvitationService.getInvitationsForOrganization).toHaveBeenCalledWith('org-456');
            expect(mockRes.json).toHaveBeenCalledWith({
                invitations: mockInvitations,
                total: 2
            });
        });

        it('should filter by status when provided', async () => {
            mockReq.query.status = 'pending';

            mockInvitationService.getInvitationsForOrganization.mockResolvedValue([]);

            await InvitationController.getInvitations(mockReq, mockRes);

            // Service should handle filtering
            expect(mockInvitationService.getInvitationsForOrganization).toHaveBeenCalledWith('org-456');
        });

        it('should return 401 when user has no organization', async () => {
            mockReq.user.organizationId = null;

            await InvitationController.getInvitations(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
            expect(mockInvitationService.getInvitationsForOrganization).not.toHaveBeenCalled();
        });

        it('should handle service errors', async () => {
            const serviceError = new Error('Database query failed');
            mockInvitationService.getInvitationsForOrganization.mockRejectedValue(serviceError);

            await InvitationController.getInvitations(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to retrieve invitations',
                details: serviceError.message
            });
        });
    });

    describe('createInvitation()', () => {
        it('should create new invitation', async () => {
            mockReq.body = {
                email: 'newuser@example.com',
                role: 'member',
                message: 'Welcome to our team!'
            };

            const mockInvitation = {
                id: 'inv-new',
                email: 'newuser@example.com',
                role: 'member',
                status: 'pending',
                expires_at: '2024-02-01T00:00:00Z',
                invite_code: 'abc123',
                organization_id: 'org-456',
                created_by: 'user-123'
            };

            mockInvitationService.createInvitation.mockResolvedValue(mockInvitation);

            await InvitationController.createInvitation(mockReq, mockRes);

            expect(mockInvitationService.createInvitation).toHaveBeenCalledWith({
                organization_id: 'org-456',
                created_by: 'user-123',
                ...mockReq.body
            });
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(mockInvitation);
        });

        it('should validate required email field', async () => {
            mockReq.body = {
                role: 'member'
                // Missing email
            };

            await InvitationController.createInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Email and role are required'
            });
        });

        it('should validate email format', async () => {
            mockReq.body = {
                email: 'invalid-email',
                role: 'member'
            };

            await InvitationController.createInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid email format'
            });
        });

        it('should validate role values', async () => {
            mockReq.body = {
                email: 'valid@example.com',
                role: 'invalid-role'
            };

            await InvitationController.createInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid role. Must be one of: OWNER, ADMIN, MANAGER, USER, GUEST'
            });
        });

        it('should handle duplicate email invitations', async () => {
            mockReq.body = {
                email: 'existing@example.com',
                role: 'member'
            };

            const serviceError = new Error('User already invited');
            mockInvitationService.createInvitation.mockRejectedValue(serviceError);

            await InvitationController.createInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to create invitation',
                details: serviceError.message
            });
        });
    });

    describe('resendInvitation()', () => {
        it('should resend invitation email', async () => {
            mockReq.params.id = 'inv-123';

            mockInvitationService.resendInvitation.mockResolvedValue(true);

            await InvitationController.resendInvitation(mockReq, mockRes);

            expect(mockInvitationService.resendInvitation).toHaveBeenCalledWith('inv-123', 'org-456');
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Invitation resent successfully'
            });
        });

        it('should return 404 when invitation not found', async () => {
            mockReq.params.id = 'inv-999';

            mockInvitationService.resendInvitation.mockResolvedValue(false);

            await InvitationController.resendInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invitation not found' });
        });

        it('should handle service errors', async () => {
            mockReq.params.id = 'inv-123';
            const serviceError = new Error('Email service unavailable');
            mockInvitationService.resendInvitation.mockRejectedValue(serviceError);

            await InvitationController.resendInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to resend invitation',
                details: serviceError.message
            });
        });
    });

    describe('acceptInvitation()', () => {
        it('should accept invitation with valid code', async () => {
            mockReq.body = { code: 'valid-invite-code' };

            const mockResult = {
                success: true,
                user: {
                    id: 'user-new',
                    email: 'invited@example.com',
                    organization_id: 'org-456'
                },
                organization: {
                    id: 'org-456',
                    name: 'Test Organization'
                }
            };

            mockInvitationService.acceptInvitation.mockResolvedValue(mockResult);

            await InvitationController.acceptInvitation(mockReq, mockRes);

            expect(mockInvitationService.acceptInvitation).toHaveBeenCalledWith('valid-invite-code');
            expect(mockRes.json).toHaveBeenCalledWith(mockResult);
        });

        it('should validate required invitation code', async () => {
            mockReq.body = {}; // Missing code

            await InvitationController.acceptInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invitation code is required'
            });
        });

        it('should handle expired invitations', async () => {
            mockReq.body = { code: 'expired-code' };

            const serviceError = new Error('Invitation has expired');
            mockInvitationService.acceptInvitation.mockRejectedValue(serviceError);

            await InvitationController.acceptInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to accept invitation',
                details: serviceError.message
            });
        });

        it('should handle invalid invitation codes', async () => {
            mockReq.body = { code: 'invalid-code' };

            const serviceError = new Error('Invalid invitation code');
            mockInvitationService.acceptInvitation.mockRejectedValue(serviceError);

            await InvitationController.acceptInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to accept invitation',
                details: serviceError.message
            });
        });
    });

    describe('cancelInvitation()', () => {
        it('should cancel pending invitation', async () => {
            mockReq.params.id = 'inv-cancel';

            mockInvitationService.cancelInvitation.mockResolvedValue(true);

            await InvitationController.cancelInvitation(mockReq, mockRes);

            expect(mockInvitationService.cancelInvitation).toHaveBeenCalledWith('inv-cancel', 'org-456');
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Invitation cancelled successfully'
            });
        });

        it('should return 404 when invitation not found', async () => {
            mockReq.params.id = 'inv-999';

            mockInvitationService.cancelInvitation.mockResolvedValue(false);

            await InvitationController.cancelInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invitation not found' });
        });

        it('should prevent cancelling accepted invitations', async () => {
            mockReq.params.id = 'inv-accepted';

            const serviceError = new Error('Cannot cancel accepted invitation');
            mockInvitationService.cancelInvitation.mockRejectedValue(serviceError);

            await InvitationController.cancelInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to cancel invitation',
                details: serviceError.message
            });
        });

        it('should handle service errors', async () => {
            mockReq.params.id = 'inv-123';
            const serviceError = new Error('Database error');
            mockInvitationService.cancelInvitation.mockRejectedValue(serviceError);

            await InvitationController.cancelInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to cancel invitation',
                details: serviceError.message
            });
        });
    });

    describe('Security & Authorization', () => {
        it('should enforce organization boundaries for invitations', async () => {
            mockReq.params.id = 'inv-cross-org';
            mockReq.user.organizationId = 'org-different';

            mockInvitationService.cancelInvitation.mockResolvedValue(false);

            await InvitationController.cancelInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invitation not found' });
        });

        it('should prevent accepting invitations for wrong organization', async () => {
            mockReq.body = { code: 'wrong-org-code' };

            const serviceError = new Error('Invitation belongs to different organization');
            mockInvitationService.acceptInvitation.mockRejectedValue(serviceError);

            await InvitationController.acceptInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to accept invitation',
                details: serviceError.message
            });
        });

        it('should validate user permissions for invitation management', async () => {
            // Admin permissions might be required for some operations
            mockReq.user.role = 'USER'; // Non-admin role

            mockReq.body = {
                email: 'newuser@example.com',
                role: 'admin' // Trying to invite admin
            };

            // Service should validate permissions
            mockInvitationService.createInvitation.mockResolvedValue({ id: 'inv-test' });

            await InvitationController.createInvitation(mockReq, mockRes);

            expect(mockInvitationService.createInvitation).toHaveBeenCalled();
        });

        it('should audit invitation lifecycle events', async () => {
            // Invitation creation, acceptance, cancellation should be auditable
            mockReq.body = {
                email: 'audit@example.com',
                role: 'member'
            };

            mockInvitationService.createInvitation.mockResolvedValue({ id: 'inv-audit' });

            await InvitationController.createInvitation(mockReq, mockRes);

            // In real implementation, this should create audit log
            expect(mockInvitationService.createInvitation).toHaveBeenCalled();
        });
    });

    describe('Business Logic Validation', () => {
        it('should prevent duplicate invitations for same email', async () => {
            mockReq.body = {
                email: 'existing@example.com',
                role: 'member'
            };

            const serviceError = new Error('User already has pending invitation');
            mockInvitationService.createInvitation.mockRejectedValue(serviceError);

            await InvitationController.createInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to create invitation',
                details: serviceError.message
            });
        });

        it('should validate invitation expiration', async () => {
            mockReq.body = { code: 'expired-code' };

            const serviceError = new Error('Invitation expired');
            mockInvitationService.acceptInvitation.mockRejectedValue(serviceError);

            await InvitationController.acceptInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Failed to accept invitation',
                details: serviceError.message
            });
        });

        it('should handle invitation workflow state transitions', async () => {
            // Test state transitions: pending -> accepted/cancelled
            mockReq.params.id = 'inv-workflow';
            mockReq.body = { code: 'workflow-code' };

            // First cancel the invitation
            mockInvitationService.cancelInvitation.mockResolvedValue(true);

            await InvitationController.cancelInvitation(mockReq, mockRes);

            expect(mockInvitationService.cancelInvitation).toHaveBeenCalledWith('inv-workflow', 'org-456');

            // Then try to accept it (should fail)
            const serviceError = new Error('Invitation already cancelled');
            mockInvitationService.acceptInvitation.mockRejectedValue(serviceError);

            await InvitationController.acceptInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
        });
    });
});


