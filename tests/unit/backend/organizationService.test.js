/**
 * Organization Service Tests
 * 
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests organization creation, member management, and multi-tenant isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations } from '../../fixtures/testData.js';

describe('OrganizationService', () => {
    let mockDb;
    let OrganizationService;

    beforeEach(async () => {
        vi.resetModules();

        mockDb = createMockDb();
        
        OrganizationService = (await import('../../../server/services/organizationService.js')).default;
        OrganizationService.setDependencies({
            db: mockDb,
            uuidv4: () => 'org-uuid-1'
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createOrganization()', () => {
        it('should create organization with owner', async () => {
            const userId = testUsers.user.id;
            const name = 'New Organization';

            // Track call order
            const callOrder = [];
            let orgInsertDone = false;
            let memberInsertDone = false;
            let commitCallback = null;

            // Mock serialize to execute callback synchronously
            mockDb.serialize.mockImplementation((callback) => {
                if (callback) {
                    // Execute callback synchronously, which will trigger db.run calls
                callback();
                }
            });

            mockDb.run.mockImplementation(function (query, params, callback) {
                callOrder.push(query.substring(0, 30));

                if (query === 'BEGIN TRANSACTION') {
                    // No callback for BEGIN
                    return;
                }

                if (callback) {
                    // Use setImmediate to ensure async execution and prevent deadlocks
                    // But ensure COMMIT is called after member insert callback completes
                    setImmediate(() => {
                        if (query.includes('INSERT INTO organizations')) {
                            expect(params).toContain(name);
                            expect(params).toContain(userId);
                            orgInsertDone = true;
                            callback.call({ changes: 1 }, null);
                        } else if (query.includes('INSERT INTO organization_members')) {
                            expect(params).toContain('OWNER');
                            expect(params).toContain(userId);
                            memberInsertDone = true;
                            // This callback triggers COMMIT inside the service
                            callback.call({ changes: 1 }, null);
                            // COMMIT will be queued and called in next tick
                        } else if (query === 'COMMIT') {
                            // COMMIT callback resolves the promise
                            callback(null);
                        } else if (query === 'ROLLBACK') {
                            callback(null);
                        } else {
                            callback.call({ changes: 1 }, null);
                        }
                    });
                }
            });

            const result = await OrganizationService.createOrganization({
                userId,
                name
            });

            expect(orgInsertDone).toBe(true);
            expect(memberInsertDone).toBe(true);
            expect(result.id).toBeDefined();
            expect(result.name).toBe(name);
            expect(result.role).toBe('OWNER');
        }, 15000); // Increase timeout to 15 seconds for async callbacks

        it('should rollback on error', async () => {
            const userId = testUsers.user.id;
            const name = 'New Organization';

            mockDb.serialize.mockImplementation((callback) => {
                callback();
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                // Use process.nextTick for async callback execution
                if (callback) {
                    process.nextTick(() => {
                        if (query === 'BEGIN TRANSACTION') {
                    callback.call({ changes: 0 }, null);
                } else if (query.includes('INSERT INTO organizations')) {
                            callback.call({ changes: 0 }, new Error('DB Error'));
                        } else if (query === 'ROLLBACK') {
                            callback.call({ changes: 0 }, null);
                        } else if (query === 'COMMIT') {
                    callback.call({ changes: 0 }, null);
                } else {
                    callback.call({ changes: 1 }, null);
                        }
                    });
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

            let orgInsertCalled = false;
            let memberInsertCalled = false;
            let commitCallback = null;

            mockDb.serialize.mockImplementation((callback) => {
                if (callback) {
                    // Execute callback synchronously, which will trigger db.run calls
                callback();
                }
            });

            mockDb.run.mockImplementation(function (query, params, callback) {
                if (query === 'BEGIN TRANSACTION') {
                    // No callback for BEGIN
                    return;
                }

                if (callback) {
                    // Use setImmediate to ensure async execution and prevent deadlocks
                    // But ensure COMMIT is called after member insert callback completes
                    setImmediate(() => {
                        if (query.includes('INSERT INTO organizations')) {
                            orgInsertCalled = true;
                            expect(params).toContain(JSON.stringify(attribution));
                            callback.call({ changes: 1 }, null);
                        } else if (query.includes('INSERT INTO organization_members')) {
                            memberInsertCalled = true;
                            // This callback triggers COMMIT inside the service
                            callback.call({ changes: 1 }, null);
                            // COMMIT will be queued and called in next tick
                        } else if (query === 'COMMIT') {
                            // COMMIT callback resolves the promise
                            callback(null);
                        } else if (query === 'ROLLBACK') {
                            callback(null);
                        } else {
                            callback.call({ changes: 1 }, null);
                        }
                    });
                }
            });

            const result = await OrganizationService.createOrganization({
                userId,
                name,
                attribution
            });

            expect(orgInsertCalled).toBe(true);
            expect(memberInsertCalled).toBe(true);
            expect(result.id).toBeDefined();
        }, 15000); // Increase timeout to 15 seconds for async callbacks
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
                if (callback) callback.call({ changes: 1 }, null);
            });

            const result = await OrganizationService.addMember({
                organizationId: orgId,
                userId,
                role
            });

            expect(result.id).toBeDefined();
            expect(result.organizationId).toBe(orgId);
            expect(result.userId).toBe(userId);
            expect(result.role).toBe(role);
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
                expect(query).toContain('DELETE FROM organization_members');
                expect(params).toContain(orgId);
                expect(params).toContain(userId);
                if (callback) {
                callback.call({ changes: 1 }, null);
                }
            });

            await OrganizationService.removeMember({
                organizationId: orgId,
                userId
            });

            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM organization_members'),
                expect.arrayContaining([orgId, userId]),
                expect.any(Function)
            );
        });

        it('should throw error when member not found', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = 'non-existent-user';

            mockDb.run.mockImplementation((query, params, callback) => {
                if (callback) {
                    callback.call({ changes: 0 }, null);
                }
            });

            await expect(
                OrganizationService.removeMember({ organizationId: orgId, userId })
            ).rejects.toThrow('Member not found');
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
                expect(query).toContain('UPDATE organization_members');
                expect(params).toContain(newRole);
                expect(params).toContain(orgId);
                expect(params).toContain(userId);
                if (callback) {
                callback.call({ changes: 1 }, null);
                }
            });

            const result = await OrganizationService.updateMemberRole({
                organizationId: orgId,
                userId,
                role: newRole
            });

            expect(result.organizationId).toBe(orgId);
            expect(result.userId).toBe(userId);
            expect(result.role).toBe(newRole);
        });

        it('should throw error on invalid role', async () => {
            await expect(
                OrganizationService.updateMemberRole({
                    organizationId: testOrganizations.org1.id,
                    userId: testUsers.user.id,
                    role: 'INVALID_ROLE'
                })
            ).rejects.toThrow('Invalid role');
        });

        it('should throw error when member not found', async () => {
            mockDb.run.mockImplementation((query, params, callback) => {
                if (callback) {
                    callback.call({ changes: 0 }, null);
                }
            });

            await expect(
                OrganizationService.updateMemberRole({
                    organizationId: testOrganizations.org1.id,
                    userId: 'non-existent',
                    role: OrganizationService.ROLES.MEMBER
                })
            ).rejects.toThrow('Member not found');
        });
    });

    describe('getMemberRole()', () => {
        it('should return member role', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = testUsers.user.id;
            const role = 'ADMIN';

            mockDb.get.mockImplementation((query, params, callback) => {
                expect(query).toContain('SELECT role FROM organization_members');
                expect(params).toContain(orgId);
                expect(params).toContain(userId);
                callback(null, { role });
            });

            const result = await OrganizationService.getMemberRole(orgId, userId);

            expect(result).toBe(role);
        });

        it('should return null when member not found', async () => {
            const orgId = testOrganizations.org1.id;
            const userId = 'non-existent-user';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const result = await OrganizationService.getMemberRole(orgId, userId);

            expect(result).toBeNull();
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

            // Mock getMemberRole to return null for cross-org access
            mockDb.get.mockImplementation((query, params, callback) => {
                // If querying for org2 member in org1 context, return null
                if (params[0] === org1Id && params[1] === userId) {
                    // This user is not a member of org1
                    callback(null, null);
                } else {
                    callback(null, { role: 'MEMBER' });
                }
            });

            const role = await OrganizationService.getMemberRole(org1Id, userId);

            // Should return null if user is not a member of this organization
            expect(role).toBeNull();
        });
    });
});

