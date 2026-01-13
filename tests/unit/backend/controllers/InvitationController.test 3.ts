/**
 * InvitationController Unit Tests
 * Tests invitation management functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock InvitationService
const mockGetInvitations = vi.fn();
const mockCreateInvitation = vi.fn();
const mockResendInvitation = vi.fn();
const mockRevokeInvitation = vi.fn();
const mockGetInvitationAudit = vi.fn();
const mockAcceptInvitation = vi.fn();
const mockValidateInvitationToken = vi.fn();

vi.mock('../../../../server/src/services/invitationService.js', () => ({
    default: {
        getInvitations: (...args: unknown[]) => mockGetInvitations(...args),
        createInvitation: (...args: unknown[]) => mockCreateInvitation(...args),
        resendInvitation: (...args: unknown[]) => mockResendInvitation(...args),
        revokeInvitation: (...args: unknown[]) => mockRevokeInvitation(...args),
        getInvitationAudit: (...args: unknown[]) => mockGetInvitationAudit(...args),
    },
    acceptInvitation: (...args: unknown[]) => mockAcceptInvitation(...args),
    validateInvitationToken: (...args: unknown[]) => mockValidateInvitationToken(...args),
}));

vi.mock('../../../../server/src/utils/asyncHandler.js', () => ({
    asyncHandler: (fn: Function) => fn,
}));

describe('InvitationController', () => {
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

    describe('getInvitations', () => {
        it('should return all invitations for organization', async () => {
            const mockInvitations = [
                { id: 'inv1', email: 'user1@test.com', status: 'PENDING' },
                { id: 'inv2', email: 'user2@test.com', status: 'ACCEPTED' },
            ];
            mockGetInvitations.mockResolvedValue(mockInvitations);

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.getInvitations(mockReq, mockRes);

            expect(mockGetInvitations).toHaveBeenCalledWith('org-123');
            expect(mockRes.json).toHaveBeenCalledWith(mockInvitations);
        });

        it('should return 401 when user not authenticated', async () => {
            mockReq.user = { id: 'user-123' }; // no organizationId

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.getInvitations(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
        });
    });

    describe('createInvitation', () => {
        it('should create invitation with valid data', async () => {
            mockReq.body = {
                email: 'newuser@test.com',
                role: 'MEMBER',
                message: 'Welcome to the team!',
            };
            const mockInvitation = { id: 'inv-new', email: 'newuser@test.com', status: 'PENDING' };
            mockCreateInvitation.mockResolvedValue(mockInvitation);

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.createInvitation(mockReq, mockRes);

            expect(mockCreateInvitation).toHaveBeenCalledWith({
                email: 'newuser@test.com',
                role: 'MEMBER',
                organizationId: 'org-123',
                invitedByUserId: 'user-123',
                metadata: { message: 'Welcome to the team!' },
            });
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                invitation: mockInvitation,
            });
        });

        it('should return 401 when user not authenticated', async () => {
            mockReq.user = null;
            mockReq.body = { email: 'test@test.com', role: 'MEMBER' };

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.createInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('should return 400 when organizationId missing', async () => {
            mockReq.user = { id: 'user-123' };
            mockReq.body = { email: 'test@test.com', role: 'MEMBER' };

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.createInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Organization ID is required' });
        });

        it('should handle already exists error', async () => {
            mockReq.body = { email: 'existing@test.com', role: 'MEMBER' };
            mockCreateInvitation.mockRejectedValue(new Error('User already exists'));

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.createInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });

    describe('resendInvitation', () => {
        it('should resend invitation successfully', async () => {
            mockReq.params.id = 'inv-123';
            mockReq.body = { invitationId: 'inv-123' };
            const mockInvitation = { id: 'inv-123', email: 'user@test.com' };
            mockResendInvitation.mockResolvedValue(mockInvitation);

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.resendInvitation(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                invitation: mockInvitation,
            });
        });

        it('should return 400 when invitationId missing', async () => {
            mockReq.params = {};
            mockReq.body = {};

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.resendInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invitation ID is required' });
        });

        it('should handle rate limit error', async () => {
            mockReq.body = { invitationId: 'inv-123' };
            mockResendInvitation.mockRejectedValue(new Error('Please wait before resending'));

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.resendInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });

    describe('acceptInvitation', () => {
        it('should accept invitation with valid data', async () => {
            mockReq.body = {
                token: 'valid-token',
                email: 'user@test.com',
                firstName: 'John',
                lastName: 'Doe',
                password: 'SecurePass123!',
            };
            const mockResult = { success: true, userId: 'new-user-id' };
            mockAcceptInvitation.mockResolvedValue(mockResult);

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.acceptInvitation(mockReq, mockRes);

            expect(mockAcceptInvitation).toHaveBeenCalledWith({
                token: 'valid-token',
                email: 'user@test.com',
                firstName: 'John',
                lastName: 'Doe',
                password: 'SecurePass123!',
            });
            expect(mockRes.json).toHaveBeenCalledWith(mockResult);
        });

        it('should handle email mismatch error', async () => {
            mockReq.body = {
                token: 'valid-token',
                email: 'wrong@test.com',
                firstName: 'John',
                lastName: 'Doe',
                password: 'SecurePass123!',
            };
            mockAcceptInvitation.mockRejectedValue(new Error('Email does not match invitation'));

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.acceptInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
        });
    });

    describe('validateToken', () => {
        it('should validate token successfully', async () => {
            mockReq.params.token = 'valid-token';
            const mockResult = { email: 'user@test.com', organizationName: 'Test Org' };
            mockValidateInvitationToken.mockResolvedValue(mockResult);

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.validateToken(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                valid: true,
                ...mockResult,
            });
        });

        it('should return 404 for invalid token', async () => {
            mockReq.params.token = 'invalid-token';
            mockValidateInvitationToken.mockRejectedValue(new Error('Token not found'));

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.validateToken(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
        });
    });

    describe('getInvitationAudit', () => {
        it('should return audit trail', async () => {
            mockReq.params.id = 'inv-123';
            const mockAudit = [
                { action: 'CREATED', at: '2024-01-01T00:00:00Z' },
                { action: 'RESENT', at: '2024-01-02T00:00:00Z' },
            ];
            mockGetInvitationAudit.mockResolvedValue(mockAudit);

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.getInvitationAudit(mockReq, mockRes);

            expect(mockGetInvitationAudit).toHaveBeenCalledWith('inv-123');
            expect(mockRes.json).toHaveBeenCalledWith(mockAudit);
        });
    });

    describe('cancelInvitation', () => {
        it('should cancel invitation successfully', async () => {
            mockReq.params.id = 'inv-123';
            const mockInvitation = { id: 'inv-123', status: 'REVOKED' };
            mockRevokeInvitation.mockResolvedValue(mockInvitation);

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.cancelInvitation(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Invitation cancelled',
                invitation: mockInvitation,
            });
        });

        it('should return 404 when invitation not found', async () => {
            mockReq.params.id = 'non-existent';
            mockRevokeInvitation.mockRejectedValue(new Error('Invitation not found'));

            const { InvitationController } = await import(
                '../../../../server/src/controllers/InvitationController.js'
            );
            await InvitationController.cancelInvitation(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
        });
    });
});


