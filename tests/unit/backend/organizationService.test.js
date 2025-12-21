/**
 * Organization Service Tests
 * 
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests organization creation, member management, and multi-tenant isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);

describe('OrganizationService', () => {
    let mockDb;
    let OrganizationService;

    beforeEach(() => {
        mockDb = createMockDb();
        
        vi.mock('../../../server/database', () => ({
            default: mockDb
        }));

        OrganizationService = require('../../../server/services/organizationService.js');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createOrganization()', () => {
        it('should create organization with owner', async () => {
            const userId = testUsers.user.id;
            const name = 'New Organization';

            let callCount = 0;
            mockDb.serialize.mockImplementation((callback) => {
                callback();
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                callCount++;
                if (query.includes('BEGIN TRANSACTION')) {
                    callback.call({ changes: 0 }, null);
                } else if (query.includes('INSERT INTO organizations')) {
                    expect(params).toContain(name);
                    expect(params).toContain(userId);
                    callback.call({ changes: 1 }, null);
                } else if (query.includes('INSERT INTO organization_members')) {
                    expect(params).toContain('OWNER');
                    expect(params).toContain(userId);
                    callback.call({ changes: 1 }, null);
                } else if (query.includes('COMMIT')) {
                    callback.call({ changes: 0 }, null);
                } else {
                    callback.call({ changes: 1 }, null);
                }
            });

            const result = await OrganizationService.createOrganization({
                userId,
                name
            });

            expect(result.id).toBeDefined();
            expect(result.name).toBe(name);
            expect(result.role).toBe('OWNER');
        });

        it('should rollback on error', async () => {
            const userId = testUsers.user.id;
            const name = 'New Organization';

            mockDb.serialize.mockImplementation((callback) => {
                callback();
            });

            let callCount = 0;
            mockDb.run.mockImplementation((query, params, callback) => {
                callCount++;
                if (query.includes('BEGIN TRANSACTION')) {
                    callback.call({ changes: 0 }, null);
                } else if (query.includes('INSERT INTO organizations')) {
                    callback(new Error('DB Error'));
                } else if (query.includes('ROLLBACK')) {
                    callback.call({ changes: 0 }, null);
                } else {
                    callback.call({ changes: 1 }, null);
                }
            });

            await expect(
                OrganizationService.createOrganization({ userId, name })
            ).rejects.toThrow('DB Error');
        });

        it('should include attribution data when provided', async () => {
            const userId = testUsers.user.id;
            const name = 'New Organization';
            const attribution = { type: 'partner', id: 'partner-123' };

            mockDb.serialize.mockImplementation((callback) => {
                callback();
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                if (query.includes('INSERT INTO organizations')) {
                    expect(params).toContain(JSON.stringify(attribution));
                }
                callback.call({ changes: 1 }, null);
            });

            await OrganizationService.createOrganization({
                userId,
                name,
                attribution
            });
        });
    });

    describe('getOrganization()', () => {
        it('should return organization details', async () => {
            const orgId = testOrganizations.org1.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    id: orgId,
                    name: 'Test Org',
                    status: 'active',
                    billing_status: 'TRIAL',
                    token_balance: 1000
                });
            });

            const org = await OrganizationService.getOrganization(orgId);

            expect(org.id).toBe(orgId);
            expect(org.name).toBe('Test Org');
            expect(org.token_balance).toBe(1000);
        });

        it('should throw error when organization not found', async () => {
            const orgId = 'non-existent';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            await expect(
                OrganizationService.getOrganization(orgId)
            ).rejects.toThrow('Organization not found');
        });
    });

    describe('addMember()', () => {
        it('should add member to organization', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = testUsers.user.id;
            const role = OrganizationService.ROLES.MEMBER;

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await OrganizationService.addMember({
                organizationId: orgId,
                userId,
                role
            });

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO organization_members'),
                expect.arrayContaining([orgId, userId, role]),
                expect.any(Function)
            );
        });

        it('should handle duplicate member gracefully', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = testUsers.user.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                const error = new Error('UNIQUE constraint failed');
                error.code = 'SQLITE_CONSTRAINT';
                callback(error);
            });

            await expect(
                OrganizationService.addMember({
                    organizationId: orgId,
                    userId,
                    role: OrganizationService.ROLES.MEMBER
                })
            ).rejects.toThrow();
        });
    });

    describe('removeMember()', () => {
        it('should remove member from organization', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = testUsers.user.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await OrganizationService.removeMember(orgId, userId);

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM organization_members'),
                expect.arrayContaining([orgId, userId]),
                expect.any(Function)
            );
        });
    });

    describe('getMembers()', () => {
        it('should return organization members', async () => {
            const orgId = testOrganizations.org1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    {
                        user_id: testUsers.admin.id,
                        role: 'ADMIN',
                        status: 'ACTIVE'
                    },
                    {
                        user_id: testUsers.user.id,
                        role: 'MEMBER',
                        status: 'ACTIVE'
                    }
                ]);
            });

            const members = await OrganizationService.getMembers(orgId);

            expect(members).toHaveLength(2);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.arrayContaining([orgId]),
                expect.any(Function)
            );
        });

        it('should only return members for specified organization', async () => {
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                // Verify query filters by organization_id
                expect(params).toContain(org1Id);
                expect(params).not.toContain(org2Id);
                callback(null, []);
            });

            await OrganizationService.getMembers(org1Id);
        });
    });

    describe('updateMemberRole()', () => {
        it('should update member role', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = testUsers.user.id;
            const newRole = OrganizationService.ROLES.ADMIN;

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await OrganizationService.updateMemberRole(orgId, userId, newRole);

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE organization_members SET role'),
                expect.arrayContaining([newRole, orgId, userId]),
                expect.any(Function)
            );
        });
    });

    describe('getMemberRole()', () => {
        it('should return member role', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = testUsers.user.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    role: OrganizationService.ROLES.ADMIN
                });
            });

            const role = await OrganizationService.getMemberRole(orgId, userId);

            expect(role).toBe(OrganizationService.ROLES.ADMIN);
        });

        it('should return null when member not found', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = testUsers.user.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const role = await OrganizationService.getMemberRole(orgId, userId);

            expect(role).toBeNull();
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should only access members for specified organization', async () => {
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                expect(params).toContain(org1Id);
                expect(params).not.toContain(org2Id);
                callback(null, []);
            });

            await OrganizationService.getMembers(org1Id);
        });

        it('should prevent cross-organization member access', async () => {
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;
            const userId = testUsers.user.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                // Verify query filters by both organization_id and user_id
                expect(params).toContain(org1Id);
                expect(params).toContain(userId);
                expect(params).not.toContain(org2Id);
                callback.call({ changes: 1 }, null);
            });

            await OrganizationService.removeMember(org1Id, userId);
        });
    });
});

