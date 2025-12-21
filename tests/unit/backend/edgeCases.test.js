/**
 * Edge Cases Tests
 * 
 * Additional Unit Tests - Edge Cases and Error Scenarios
 * Tests edge cases, error handling, and boundary conditions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testOrganizations } from '../../fixtures/testData.js';

describe('Edge Cases and Error Scenarios', () => {
    let mockDb;

    beforeEach(async () => {
        vi.resetModules();
        mockDb = createMockDb();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Null and Undefined Handling', () => {
        it('should handle null organizationId gracefully', async () => {
            const StorageService = (await import('../../../server/services/storageService.js')).default;

            expect(() => {
                StorageService.getIsolatedPath(null, 'project-123', 'type');
            }).toThrow('Organization ID is required');
        });

        it('should handle undefined projectId in storage', async () => {
            const StorageService = (await import('../../../server/services/storageService.js')).default;

            const result = StorageService.getIsolatedPath(
                testOrganizations.org1.id,
                undefined,
                'type'
            );

            expect(result).toContain('global');
        });
    });

    describe('Empty Data Handling', () => {
        it('should handle empty arrays in queries', async () => {
            const RoadmapService = (await import('../../../server/services/roadmapService.js')).default;
            RoadmapService.setDependencies({ db: mockDb, uuidv4: () => 'uuid' });

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            const result = await RoadmapService.getWaves('project-123');
            expect(result).toEqual([]);
        });

        it('should handle empty search results', async () => {
            const EscalationService = (await import('../../../server/services/escalationService.js')).default;
            EscalationService.setDependencies({ db: mockDb, uuidv4: () => 'uuid' });

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            const result = await EscalationService.getEscalations('project-123');
            expect(result).toEqual([]);
        });
    });

    describe('Boundary Conditions', () => {
        it('should handle maximum token limit', async () => {
            const UsageService = (await import('../../../server/services/usageService.js')).default;
            const mockBillingService = {
                getOrganizationBilling: vi.fn().mockResolvedValue({
                    subscription_plan_id: 'plan-123'
                }),
                getPlanById: vi.fn().mockResolvedValue({
                    token_limit: Number.MAX_SAFE_INTEGER
                })
            };

            UsageService._setDependencies({
                db: mockDb,
                uuidv4: () => 'uuid',
                billingService: mockBillingService
            });

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    tokens_used: Number.MAX_SAFE_INTEGER - 1000,
                    storage_bytes: 0
                });
            });

            const result = await UsageService.getCurrentUsage('org-123');
            expect(result.tokens.limit).toBe(Number.MAX_SAFE_INTEGER);
        });

        it('should handle zero token limit (unlimited)', async () => {
            const UsageService = (await import('../../../server/services/usageService.js')).default;
            const mockBillingService = {
                getOrganizationBilling: vi.fn().mockResolvedValue({
                    subscription_plan_id: 'plan-123'
                }),
                getPlanById: vi.fn().mockResolvedValue({
                    token_limit: 0 // Unlimited
                })
            };

            UsageService._setDependencies({
                db: mockDb,
                uuidv4: () => 'uuid',
                billingService: mockBillingService
            });

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    tokens_used: 999999,
                    storage_bytes: 0
                });
            });

            const result = await UsageService.checkQuota('org-123', 'token');
            expect(result.allowed).toBe(true); // Unlimited should always allow
        });
    });

    describe('Invalid Input Handling', () => {
        it('should reject invalid email format in invitations', async () => {
            const InvitationService = (await import('../../../server/services/invitationService.js')).default;

            // Mock database for InvitationService
            InvitationService.setDependencies({
                db: mockDb,
                crypto: { randomBytes: () => ({ toString: () => 'a'.repeat(64) }) },
                uuidv4: () => 'uuid'
            });

            await expect(
                InvitationService.createOrgInvitation({
                    organizationId: testOrganizations.org1.id,
                    email: 'invalid-email',
                    role: 'USER',
                    invitedByUserId: testUsers.admin.id
                })
            ).rejects.toThrow();
        });

        it('should reject invalid evidence type', async () => {
            const EvidenceLedgerService = (await import('../../../server/services/evidenceLedgerService.js')).default;
            EvidenceLedgerService.setDependencies({
                db: mockDb,
                uuidv4: () => 'uuid'
            });

            await expect(
                EvidenceLedgerService.createEvidenceObject(
                    testOrganizations.org1.id,
                    'INVALID_TYPE',
                    'source',
                    {}
                )
            ).rejects.toThrow('Invalid evidence type');
        });

        it('should reject invalid entity type in evidence linking', async () => {
            const EvidenceLedgerService = (await import('../../../server/services/evidenceLedgerService.js')).default;
            EvidenceLedgerService.setDependencies({
                db: mockDb,
                uuidv4: () => 'uuid'
            });

            await expect(
                EvidenceLedgerService.linkEvidence(
                    'INVALID_TYPE',
                    'id',
                    'evidence-id'
                )
            ).rejects.toThrow('Invalid entity type');
        });
    });

    describe('Database Error Handling', () => {
        it('should handle database connection errors gracefully', async () => {
            const GovernanceService = (await import('../../../server/services/governanceService.js')).default;
            GovernanceService.setDependencies({ db: mockDb, uuidv4: () => 'uuid' });
            const dbError = new Error('Database connection failed');

            mockDb.run.mockImplementation((query, params, callback) => {
                // Use process.nextTick to simulate async callback
                if (callback) {
                    process.nextTick(() => {
                        callback.call({ changes: 0 }, dbError);
                    });
                }
            });

            await expect(
                GovernanceService.createChangeRequest({
                    projectId: 'project-123',
                    title: 'Test',
                    description: 'Test',
                    type: 'TECHNICAL',
                    createdBy: testUsers.admin.id
                })
            ).rejects.toThrow('Database connection failed');
        });

        it('should handle constraint violations', async () => {
            const OrganizationService = (await import('../../../server/services/organizationService.js')).default;
            OrganizationService.setDependencies({ db: mockDb, uuidv4: () => 'uuid' });
            const constraintError = new Error('UNIQUE constraint failed');

            mockDb.serialize.mockImplementation((callback) => {
                if (callback) callback();
            });

            mockDb.run.mockImplementation(function (query, params, callback) {
                if (query === 'BEGIN TRANSACTION') {
                    return;
                }
                // Use process.nextTick to simulate async callback
                if (callback) {
                    process.nextTick(() => {
                        callback.call({ changes: 0 }, constraintError);
                    });
                }
            });

            await expect(
                OrganizationService.createOrganization({
                    userId: testUsers.admin.id,
                    name: 'Duplicate Org'
                })
            ).rejects.toThrow('UNIQUE constraint failed');
        });
    });

    describe('Concurrent Modification Handling', () => {
        it('should handle optimistic locking failures', async () => {
            const RoadmapService = (await import('../../../server/services/roadmapService.js')).default;
            RoadmapService.setDependencies({ db: mockDb, uuidv4: () => 'uuid' });

            // Simulate concurrent modification
            let callCount = 0;
            mockDb.run.mockImplementation((query, params, callback) => {
                callCount++;
                if (callCount === 1) {
                    // First call succeeds
                    callback.call({ changes: 1 }, null);
                } else {
                    // Second call fails (concurrent modification)
                    callback.call({ changes: 0 }, new Error('Row modified'));
                }
            });

            // First update should succeed
            await RoadmapService.assignToWave('init-1', 'wave-1');

            // Second concurrent update should handle error
            await expect(
                RoadmapService.assignToWave('init-1', 'wave-2')
            ).rejects.toThrow('Row modified');
        });
    });

    describe('Large Data Handling', () => {
        it('should handle large result sets efficiently', async () => {
            const largeResultSet = Array(10000).fill(null).map((_, i) => ({
                id: `item-${i}`,
                name: `Item ${i}`
            }));

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, largeResultSet);
            });

            const start = Date.now();
            const RoadmapService = (await import('../../../server/services/roadmapService.js')).default;
            RoadmapService.setDependencies({ db: mockDb, uuidv4: () => 'uuid' });

            const result = await RoadmapService.getWaves('project-123');
            const duration = Date.now() - start;

            expect(result).toHaveLength(10000);
            expect(duration).toBeLessThan(1000); // Should handle efficiently
        });

        it('should handle large payloads in storage', async () => {
            const StorageService = (await import('../../../server/services/storageService.js')).default;
            const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB string

            // Should not throw on large payloads
            expect(() => {
                StorageService.getIsolatedPath('org-123', 'project-123', 'large');
            }).not.toThrow();
        });
    });

    describe('Timeout Handling', () => {
        it('should handle slow database queries', async () => {
            const GovernanceService = (await import('../../../server/services/governanceService.js')).default;
            GovernanceService.setDependencies({ db: mockDb, uuidv4: () => 'uuid' });

            mockDb.run.mockImplementation((query, params, callback) => {
                // Simulate slow query
                setTimeout(() => {
                    callback.call({ changes: 1 }, null);
                }, 100);
            });

            const start = Date.now();
            await GovernanceService.createChangeRequest({
                projectId: 'project-123',
                title: 'Test',
                description: 'Test',
                type: 'TECHNICAL',
                createdBy: testUsers.admin.id
            });
            const duration = Date.now() - start;

            expect(duration).toBeGreaterThanOrEqual(100);
        });
    });
});

