/**
 * Invitation Service Tests
 * 
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests invitation creation, token security, multi-tenant isolation, and seat limits.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';

describe('InvitationService', () => {
    let mockDb;
    let InvitationService;
    let mockAccessPolicyService;
    let mockAttributionService;
    let mockMetricsCollector;
    let mockCrypto;
    let mockBcrypt;
    let tokenCounter;

    beforeEach(async () => {
        vi.resetModules();
        tokenCounter = 0;
        
        mockDb = createMockDb();
        
        // Mock AccessPolicyService
        mockAccessPolicyService = {
            canInviteUsers: vi.fn().mockResolvedValue({ allowed: true }),
            getSeatAvailability: vi.fn().mockResolvedValue({
                available: 5,
                used: 3,
                total: 8
            })
        };

        mockAttributionService = {
            recordAttribution: vi.fn().mockResolvedValue({})
        };

        mockMetricsCollector = {
            record: vi.fn().mockResolvedValue({})
        };

        // Create unique tokens for each call
        mockCrypto = {
            randomBytes: vi.fn().mockImplementation(() => ({ 
                toString: () => `${String(++tokenCounter).padStart(2, '0')}${'a'.repeat(62)}` 
            })),
            createHash: vi.fn().mockImplementation(() => ({
                update: vi.fn().mockReturnThis(),
                digest: vi.fn().mockReturnValue('b'.repeat(64))
            }))
        };

        mockBcrypt = {
            hash: vi.fn().mockResolvedValue('hashed-password')
        };

        InvitationService = (await import('../../../server/services/invitationService.js')).default;
        
        InvitationService.setDependencies({
            db: mockDb,
            crypto: mockCrypto,
            bcrypt: mockBcrypt,
            uuidv4: () => 'test-invitation-uuid',
            AccessPolicyService: mockAccessPolicyService,
            AttributionService: mockAttributionService,
            MetricsCollector: mockMetricsCollector
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('generateSecureToken()', () => {
        it('should generate 64-character hex token', () => {
            const token = InvitationService.generateSecureToken();
            
            expect(token).toHaveLength(64);
            expect(token).toMatch(/^[0-9a-f]{64}$/);
        });

        it('should generate unique tokens', () => {
            const token1 = InvitationService.generateSecureToken();
            const token2 = InvitationService.generateSecureToken();
            
            expect(token1).not.toBe(token2);
        });
    });

    describe('hashToken()', () => {
        it('should hash token using SHA256', () => {
            const token = 'test-token-123';
            const hash = InvitationService.hashToken(token);
            
            expect(hash).toHaveLength(64);
            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });

        it('should produce consistent hash for same token', () => {
            const token = 'test-token-123';
            const hash1 = InvitationService.hashToken(token);
            const hash2 = InvitationService.hashToken(token);
            
            expect(hash1).toBe(hash2);
        });
    });

    describe('calculateExpiryDate()', () => {
        it('should calculate expiry date 7 days from now by default', () => {
            const expiry = InvitationService.calculateExpiryDate();
            const expiryDate = new Date(expiry);
            const expectedDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            
            // Allow 1 second difference
            expect(Math.abs(expiryDate - expectedDate)).toBeLessThan(1000);
        });

        it('should calculate expiry date for custom days', () => {
            const expiry = InvitationService.calculateExpiryDate(14);
            const expiryDate = new Date(expiry);
            const expectedDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
            
            expect(Math.abs(expiryDate - expectedDate)).toBeLessThan(1000);
        });
    });

    describe('checkInvitePermission()', () => {
        it('should allow invitation when policy allows', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = testUsers.admin.id;

            mockAccessPolicyService.canInviteUsers.mockResolvedValue({
                allowed: true
            });

            const result = await InvitationService.checkInvitePermission(orgId, userId);

            expect(result.allowed).toBe(true);
            expect(mockAccessPolicyService.canInviteUsers).toHaveBeenCalledWith(orgId, userId);
        });

        it('should deny invitation when policy denies', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = testUsers.user.id;

            mockAccessPolicyService.canInviteUsers.mockResolvedValue({
                allowed: false,
                reasonCode: 'USER_LIMIT_REACHED'
            });

            const result = await InvitationService.checkInvitePermission(orgId, userId);

            expect(result.allowed).toBe(false);
            expect(result.reasonCode).toBe('USER_LIMIT_REACHED');
            expect(result.reason).toBeDefined();
        });
    });

    describe('createOrganizationInvitation()', () => {
        it('should create organization invitation', async () => {
            const params = {
                organizationId: testOrganizations.org1.id,
                email: 'newuser@test.com',
                orgRole: 'USER',
                invitedByUserId: testUsers.admin.id
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('organizations')) {
                    callback(null, { id: params[0], name: 'Test Org' });
                } else {
                    callback(null, null);
                }
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const invitation = await InvitationService.createOrganizationInvitation(params);

            expect(invitation.id).toBeDefined();
            expect(invitation.email).toBe(params.email);
            expect(invitation.type).toBe(InvitationService.INVITATION_TYPES.ORG);
            expect(invitation.status).toBe(InvitationService.INVITATION_STATUS.PENDING);
            expect(invitation.token).toBeDefined();
            expect(invitation.tokenHash).toBeDefined();
            expect(invitation.tokenHash).toBe(InvitationService.hashToken(invitation.token));
        });

        it('should reject invalid email format', async () => {
            const params = {
                organizationId: testOrganizations.org1.id,
                email: 'invalid-email',
                orgRole: 'USER',
                invitedByUserId: testUsers.admin.id
            };

            await expect(
                InvitationService.createOrganizationInvitation(params)
            ).rejects.toThrow('Invalid email format');
        });

        it('should reject when organization not found', async () => {
            const params = {
                organizationId: 'non-existent',
                email: 'user@test.com',
                orgRole: 'USER',
                invitedByUserId: testUsers.admin.id
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            await expect(
                InvitationService.createOrganizationInvitation(params)
            ).rejects.toThrow('Organization not found');
        });

        it('should reject when permission denied', async () => {
            const params = {
                organizationId: testOrganizations.org1.id,
                email: 'user@test.com',
                orgRole: 'USER',
                invitedByUserId: testUsers.user.id
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { id: params[0], name: 'Test Org' });
            });

            mockAccessPolicyService.canInviteUsers.mockResolvedValue({
                allowed: false,
                reasonCode: 'USER_LIMIT_REACHED'
            });

            await expect(
                InvitationService.createOrganizationInvitation(params)
            ).rejects.toThrow();
        });
    });

    describe('createProjectInvitation()', () => {
        it('should create project invitation', async () => {
            const params = {
                organizationId: testOrganizations.org1.id,
                projectId: testProjects.project1.id,
                email: 'user@test.com',
                projectRole: 'member',
                orgRole: 'USER',
                invitedByUserId: testUsers.admin.id
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('projects')) {
                    callback(null, {
                        id: params[0],
                        name: 'Test Project',
                        organization_id: testOrganizations.org1.id
                    });
                } else {
                    callback(null, null);
                }
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const invitation = await InvitationService.createProjectInvitation(params);

            expect(invitation.id).toBeDefined();
            expect(invitation.type).toBe(InvitationService.INVITATION_TYPES.PROJECT);
            expect(invitation.projectId).toBe(params.projectId);
        });

        it('should reject when project not found', async () => {
            const params = {
                organizationId: testOrganizations.org1.id,
                projectId: 'non-existent',
                email: 'user@test.com',
                invitedByUserId: testUsers.admin.id
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            await expect(
                InvitationService.createProjectInvitation(params)
            ).rejects.toThrow('Project not found');
        });

        it('should reject when project belongs to different organization', async () => {
            const params = {
                organizationId: testOrganizations.org1.id,
                projectId: testProjects.project1.id,
                email: 'user@test.com',
                invitedByUserId: testUsers.admin.id
            };

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: params[0],
                    organization_id: testOrganizations.org2.id // Different org
                });
            });

            await expect(
                InvitationService.createProjectInvitation(params)
            ).rejects.toThrow('Project not found in this organization');
        });
    });

    describe('validateToken()', () => {
        it('should validate correct token', async () => {
            const token = InvitationService.generateSecureToken();
            const tokenHash = InvitationService.hashToken(token);
            const invitationId = 'inv-123';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: invitationId,
                    token_hash: tokenHash,
                    status: InvitationService.INVITATION_STATUS.PENDING,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                });
            });

            const result = await InvitationService.validateToken(token);

            expect(result.valid).toBe(true);
            expect(result.invitationId).toBe(invitationId);
        });

        it('should reject invalid token', async () => {
            const token = InvitationService.generateSecureToken();
            const wrongToken = InvitationService.generateSecureToken();
            const tokenHash = InvitationService.hashToken(token);

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    token_hash: tokenHash,
                    status: InvitationService.INVITATION_STATUS.PENDING
                });
            });

            const result = await InvitationService.validateToken(wrongToken);

            expect(result.valid).toBe(false);
        });

        it('should reject expired invitation', async () => {
            const token = InvitationService.generateSecureToken();
            const tokenHash = InvitationService.hashToken(token);

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    token_hash: tokenHash,
                    status: InvitationService.INVITATION_STATUS.PENDING,
                    expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Expired
                });
            });

            const result = await InvitationService.validateToken(token);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('expired');
        });

        it('should reject already accepted invitation', async () => {
            const token = InvitationService.generateSecureToken();
            const tokenHash = InvitationService.hashToken(token);

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    token_hash: tokenHash,
                    status: InvitationService.INVITATION_STATUS.ACCEPTED
                });
            });

            const result = await InvitationService.validateToken(token);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('already accepted');
        });
    });

    describe('acceptInvitation()', () => {
        it('should accept valid invitation', async () => {
            const token = InvitationService.generateSecureToken();
            const tokenHash = InvitationService.hashToken(token);
            const invitationId = 'inv-123';
            const email = 'user@test.com';

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('SELECT')) {
                    callback(null, {
                        id: invitationId,
                        token_hash: tokenHash,
                        email,
                        status: InvitationService.INVITATION_STATUS.PENDING,
                        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                        organization_id: testOrganizations.org1.id,
                        type: InvitationService.INVITATION_TYPES.ORG
                    });
                } else {
                    callback(null, null);
                }
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            mockDb.serialize.mockImplementation((callback) => {
                callback();
            });

            const result = await InvitationService.acceptInvitation(token, {
                email,
                password: 'password123',
                firstName: 'Test',
                lastName: 'User'
            });

            expect(result.success).toBe(true);
            expect(result.invitationId).toBe(invitationId);
        });

        it('should reject invitation with mismatched email', async () => {
            const token = InvitationService.generateSecureToken();
            const tokenHash = InvitationService.hashToken(token);

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    token_hash: tokenHash,
                    email: 'invited@test.com',
                    status: InvitationService.INVITATION_STATUS.PENDING
                });
            });

            await expect(
                InvitationService.acceptInvitation(token, {
                    email: 'different@test.com', // Different email
                    password: 'password123'
                })
            ).rejects.toThrow('Email mismatch');
        });
    });

    describe('revokeInvitation()', () => {
        it('should revoke pending invitation', async () => {
            const invitationId = 'inv-123';
            const userId = testUsers.admin.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: invitationId,
                    status: InvitationService.INVITATION_STATUS.PENDING
                });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await InvitationService.revokeInvitation(invitationId, userId);

            expect(result.success).toBe(true);
            expect(result.status).toBe(InvitationService.INVITATION_STATUS.REVOKED);
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should only return invitations for specified organization', async () => {
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                // Verify query filters by organization_id
                expect(params).toContain(org1Id);
                expect(params).not.toContain(org2Id);
                callback(null, []);
            });

            await InvitationService.getOrganizationInvitations(org1Id);

            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('organization_id = ?'),
                expect.arrayContaining([org1Id]),
                expect.any(Function)
            );
        });
    });
});

