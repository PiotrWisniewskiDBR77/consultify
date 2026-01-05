/**
 * Consultant Service Tests
 *
 * Tests for consultant management, multi-organization access,
 * and consultant-generated invites for trial organizations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../../helpers/unifiedMockSetup.js';
import { testOrganizations } from '../../../fixtures/testData.js';

// Remove createRequire - using ESM imports

let consultantService;

describe('ConsultantService', () => {
    let mockDb;
    let mockLogger;
    let mockUuid;

    beforeEach(async () => {
        // Use unified mock setup
        const { mocks } = setupStandardTest();
        mockDb = mocks.db;
        mockLogger = mocks.logger;

        // Mock uuid
        mockUuid = vi.fn(() => 'test-uuid-123');

        // Import service using dynamic import
        const module = await import('../../../../server/src/services/consultantService.js');
        consultantService = module.default || module;

        // Set dependencies for testing
        consultantService.setDependencies({
            db: mockDb,
            uuidv4: mockUuid
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getConsultantProfile()', () => {
        it('should retrieve consultant profile by user ID', async () => {
            const userId = 'user-123';
            const mockProfile = {
                id: 'consultant-456',
                display_name: 'John Consultant',
                status: 'active',
                created_at: '2024-01-01T00:00:00Z'
            };

            mockDb.get.mockResolvedValue($2);

            const result = await consultantService.getConsultantProfile(userId);

            expect(mockDb.get).toHaveBeenCalledWith(
                expect.stringContaining('SELECT c.* FROM consultants c'),
                [userId],
                expect.any(Function)
            );
            expect(result).toEqual(mockProfile);
        });

        it('should return null when user is not a consultant', async () => {
            const userId = 'regular-user';

            mockDb.get.mockResolvedValue($2);

            const result = await consultantService.getConsultantProfile(userId);

            expect(result).toBeNull();
        });

        it('should handle database errors', async () => {
            const userId = 'user-123';
            const dbError = new Error('Database connection failed');

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(dbError, null);
            });

            await expect(consultantService.getConsultantProfile(userId))
                .rejects.toThrow('Database connection failed');
        });
    });

    describe('registerConsultant()', () => {
        it('should register a new consultant', async () => {
            const userId = 'user-123';
            const displayName = 'John Doe Consultant';

            mockDb.run.mockImplementation(function(query, params, callback) {
                callback.call({ lastID: 'consultant-456', changes: 1 }, null);
            });

            const result = await consultantService.registerConsultant(userId, displayName);

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO consultants'),
                expect.arrayContaining([userId, displayName]),
                expect.any(Function)
            );
            expect(result.id).toBe('consultant-456');
            expect(result.display_name).toBe(displayName);
            expect(result.status).toBe('active');
        });

        it('should reject if user is already a consultant', async () => {
            const userId = 'existing-consultant';
            const displayName = 'Existing Consultant';

            // Mock that user is already a consultant
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('SELECT c.* FROM consultants c')) {
                    callback(null, { id: 'existing-id' });
                }
            });

            await expect(consultantService.registerConsultant(userId, displayName))
                .rejects.toThrow('User is already registered as a consultant');
        });

        it('should handle database insertion errors', async () => {
            const userId = 'user-123';
            const displayName = 'John Doe';
            const dbError = new Error('Unique constraint violation');

            mockDb.run.mockImplementation(function(query, params, callback) {
                callback.call({ changes: 0 }, dbError);
            });

            await expect(consultantService.registerConsultant(userId, displayName))
                .rejects.toThrow('Unique constraint violation');
        });
    });

    describe('getLinkedOrganizations()', () => {
        it('should retrieve organizations linked to a consultant', async () => {
            const consultantId = 'consultant-123';
            const mockLinks = [
                {
                    id: 'link-1',
                    organization_id: 'org-1',
                    consultant_id: consultantId,
                    permissions: '{"read": true, "write": false}',
                    created_at: '2024-01-01T00:00:00Z'
                }
            ];

            const mockOrg = {
                id: 'org-1',
                name: 'Test Organization',
                status: 'active'
            };

            let callCount = 0;
            mockDb.all.mockImplementation((query, params, callback) => {
                callCount++;
                if (callCount === 1) {
                    // First call: get links
                    callback(null, mockLinks);
                } else {
                    // Second call: get organization details
                    callback(null, [mockOrg]);
                }
            });

            const result = await consultantService.getLinkedOrganizations(consultantId);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('org-1');
            expect(result[0].name).toBe('Test Organization');
        });

        it('should return empty array when consultant has no links', async () => {
            const consultantId = 'consultant-no-links';

            mockDb.all.mockResolvedValue($2);

            const result = await consultantService.getLinkedOrganizations(consultantId);

            expect(result).toEqual([]);
        });

        it('should handle database errors', async () => {
            const consultantId = 'consultant-123';
            const dbError = new Error('Query failed');

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(dbError, null);
            });

            await expect(consultantService.getLinkedOrganizations(consultantId))
                .rejects.toThrow('Query failed');
        });
    });

    describe('verifyAccess()', () => {
        it('should return true when consultant has access to organization', async () => {
            const consultantId = 'consultant-123';
            const organizationId = 'org-456';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { id: 'link-1', permissions: '{"read": true}' });
            });

            const result = await consultantService.verifyAccess(consultantId, organizationId);

            expect(result).toBe(true);
            expect(mockDb.get).toHaveBeenCalledWith(
                expect.stringContaining('SELECT cl.* FROM consultant_links cl'),
                [consultantId, organizationId],
                expect.any(Function)
            );
        });

        it('should return false when consultant has no access', async () => {
            const consultantId = 'consultant-123';
            const organizationId = 'org-no-access';

            mockDb.get.mockResolvedValue($2);

            const result = await consultantService.verifyAccess(consultantId, organizationId);

            expect(result).toBe(false);
        });
    });

    describe('createInvite()', () => {
        it('should create a trial organization invite', async () => {
            const params = {
                consultantId: 'consultant-123',
                type: consultantService.INVITE_TYPES.TRIAL_ORG,
                targetOrganizationId: 'org-456'
            };

            mockDb.run.mockImplementation(function(query, params, callback) {
                callback.call({ lastID: 'invite-789', changes: 1 }, null);
            });

            const result = await consultantService.createInvite(params);

            expect(mockUuid).toHaveBeenCalled();
            expect(result.id).toBe('invite-789');
            expect(result.type).toBe('TRIAL_ORG');
            expect(result.invite_code).toBe('test-uuid-123');
            expect(result.expires_at).toBeDefined();
        });

        it('should create a trial user invite', async () => {
            const params = {
                consultantId: 'consultant-123',
                type: consultantService.INVITE_TYPES.TRIAL_USER,
                targetUserEmail: 'user@example.com'
            };

            mockDb.run.mockImplementation(function(query, params, callback) {
                callback.call({ lastID: 'invite-999', changes: 1 }, null);
            });

            const result = await consultantService.createInvite(params);

            expect(result.type).toBe('TRIAL_USER');
            expect(result.target_user_email).toBe('user@example.com');
        });

        it('should validate required parameters', async () => {
            const invalidParams = {
                consultantId: 'consultant-123',
                type: 'INVALID_TYPE'
            };

            await expect(consultantService.createInvite(invalidParams))
                .rejects.toThrow('Invalid invite type');
        });
    });

    describe('validateInvite()', () => {
        it('should validate active invite code', async () => {
            const inviteCode = 'valid-code-123';
            const mockInvite = {
                id: 'invite-456',
                invite_code: inviteCode,
                type: 'TRIAL_ORG',
                status: 'active',
                expires_at: new Date(Date.now() + 86400000).toISOString() // Future date
            };

            mockDb.get.mockResolvedValue($2);

            const result = await consultantService.validateInvite(inviteCode);

            expect(result).toEqual(mockInvite);
        });

        it('should reject expired invite', async () => {
            const inviteCode = 'expired-code';
            const mockInvite = {
                id: 'invite-456',
                invite_code: inviteCode,
                expires_at: new Date(Date.now() - 86400000).toISOString() // Past date
            };

            mockDb.get.mockResolvedValue($2);

            await expect(consultantService.validateInvite(inviteCode))
                .rejects.toThrow('Invite has expired');
        });

        it('should reject used invite', async () => {
            const inviteCode = 'used-code';
            const mockInvite = {
                id: 'invite-456',
                invite_code: inviteCode,
                status: 'used'
            };

            mockDb.get.mockResolvedValue($2);

            await expect(consultantService.validateInvite(inviteCode))
                .rejects.toThrow('Invite has already been used');
        });

        it('should return null for non-existent invite', async () => {
            const inviteCode = 'non-existent';

            mockDb.get.mockResolvedValue($2);

            const result = await consultantService.validateInvite(inviteCode);

            expect(result).toBeNull();
        });
    });

    describe('acceptInvite()', () => {
        it('should successfully accept a trial organization invite', async () => {
            const inviteCode = 'trial-org-code';
            const userId = 'user-123';
            const targetOrgId = 'org-456';

            const mockInvite = {
                id: 'invite-789',
                type: 'TRIAL_ORG',
                consultant_id: 'consultant-111',
                target_organization_id: targetOrgId,
                status: 'active'
            };

            let callCount = 0;
            mockDb.get.mockImplementation((query, params, callback) => {
                callCount++;
                if (callCount === 1) {
                    // First call: validate invite
                    callback(null, mockInvite);
                }
            });

            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await consultantService.acceptInvite(inviteCode, userId, targetOrgId);

            expect(result.success).toBe(true);
            expect(result.invite.type).toBe('TRIAL_ORG');
            expect(result.organizationId).toBe(targetOrgId);
        });

        it('should handle invalid invite codes', async () => {
            const inviteCode = 'invalid-code';
            const userId = 'user-123';

            mockDb.get.mockResolvedValue($2);

            await expect(consultantService.acceptInvite(inviteCode, userId))
                .rejects.toThrow('Invalid invite code');
        });

        it('should create organization link for accepted invite', async () => {
            const inviteCode = 'org-invite-code';
            const userId = 'user-123';
            const mockInvite = {
                id: 'invite-999',
                type: 'ORG_ADD_CONSULTANT',
                consultant_id: 'consultant-111',
                target_organization_id: 'org-456'
            };

            mockDb.get.mockResolvedValue($2);

            let runCallCount = 0;
            mockDb.run.mockResolvedValue({ changes: 1 });

            await consultantService.acceptInvite(inviteCode, userId);

            expect(runCallCount).toBeGreaterThan(1); // Multiple DB operations
        });
    });

    describe('ensureLink()', () => {
        it('should create new link if it does not exist', async () => {
            const consultantId = 'consultant-123';
            const organizationId = 'org-456';
            const createdByUserId = 'user-789';
            const permissions = { read: true, write: false };

            // Mock that link doesn't exist
            mockDb.get.mockResolvedValue($2);

            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await consultantService.ensureLink(
                consultantId,
                organizationId,
                createdByUserId,
                permissions
            );

            expect(result.created).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO consultant_links'),
                expect.arrayContaining([consultantId, organizationId, createdByUserId]),
                expect.any(Function)
            );
        });

        it('should return existing link if it already exists', async () => {
            const consultantId = 'consultant-123';
            const organizationId = 'org-456';
            const createdByUserId = 'user-789';

            const existingLink = {
                id: 'link-999',
                consultant_id: consultantId,
                organization_id: organizationId
            };

            mockDb.get.mockResolvedValue($2);

            const result = await consultantService.ensureLink(
                consultantId,
                organizationId,
                createdByUserId
            );

            expect(result.created).toBe(false);
            expect(result.link).toEqual(existingLink);
            expect(mockDb.run).not.toHaveBeenCalled();
        });
    });

    describe('revokeLink()', () => {
        it('should successfully revoke consultant link', async () => {
            const linkId = 'link-123';

            mockDb.run.mockResolvedValue({ changes: 1 });

            const result = await consultantService.revokeLink(linkId);

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM consultant_links WHERE id = ?'),
                [linkId],
                expect.any(Function)
            );
        });

        it('should handle non-existent links gracefully', async () => {
            const linkId = 'non-existent-link';

            mockDb.run.mockImplementation(function(query, params, callback) {
                callback.call({ changes: 0 }, null);
            });

            const result = await consultantService.revokeLink(linkId);

            expect(result).toBe(false);
        });
    });

    describe('getConsultantInvites()', () => {
        it('should retrieve invites created by consultant', async () => {
            const consultantId = 'consultant-123';
            const mockInvites = [
                {
                    id: 'invite-1',
                    type: 'TRIAL_ORG',
                    status: 'active',
                    created_at: '2024-01-01T00:00:00Z'
                },
                {
                    id: 'invite-2',
                    type: 'TRIAL_USER',
                    status: 'used',
                    created_at: '2024-01-02T00:00:00Z'
                }
            ];

            mockDb.all.mockResolvedValue($2);

            const result = await consultantService.getConsultantInvites(consultantId);

            expect(result).toHaveLength(2);
            expect(result[0].type).toBe('TRIAL_ORG');
            expect(result[1].status).toBe('used');
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM consultant_invites'),
                [consultantId],
                expect.any(Function)
            );
        });

        it('should return empty array when consultant has no invites', async () => {
            const consultantId = 'consultant-no-invites';

            mockDb.all.mockResolvedValue($2);

            const result = await consultantService.getConsultantInvites(consultantId);

            expect(result).toEqual([]);
        });
    });

    describe('INVITE_TYPES', () => {
        it('should export correct invite type constants', () => {
            expect(consultantService.INVITE_TYPES.TRIAL_ORG).toBe('TRIAL_ORG');
            expect(consultantService.INVITE_TYPES.TRIAL_USER).toBe('TRIAL_USER');
            expect(consultantService.INVITE_TYPES.ORG_ADD_CONSULTANT).toBe('ORG_ADD_CONSULTANT');
        });
    });
});
