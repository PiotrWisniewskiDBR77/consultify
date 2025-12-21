/**
 * Access Policy Service Tests
 * 
 * CRITICAL SECURITY SERVICE - Must have 95%+ coverage
 * Tests multi-tenant isolation, trial limits, and access control.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testOrganizations, testUsers } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);

describe('AccessPolicyService', () => {
    let AccessPolicyService;
    let mockDb;

    beforeEach(async () => {
        vi.resetModules();
        
        // Create fresh mock
        mockDb = createMockDb();
        
        // Mock the database module before importing service
        vi.doMock('../../../server/database', () => ({
            default: mockDb
        }));
        
        // Import service after mocking
        AccessPolicyService = require('../../../server/services/accessPolicyService.js');
        
        // Inject mock dependencies
        AccessPolicyService.setDependencies({ db: mockDb });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.doUnmock('../../../server/database');
    });

    describe('getOrganizationType', () => {
        it('should return organization type for valid org', async () => {
            const orgId = testOrganizations.org1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('FROM organizations')) {
                    callback(null, {
                        id: orgId,
                        name: 'Test Org',
                        organization_type: 'TRIAL',
                        trial_started_at: '2024-01-01',
                        trial_expires_at: '2024-01-15',
                        is_active: 1,
                        plan: 'trial',
                        status: 'active'
                    });
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.getOrganizationType(orgId);
            
            expect(result).toBeDefined();
            expect(result.id).toBe(orgId);
            expect(result.organizationType).toBe('TRIAL');
            expect(result.isActive).toBe(true);
        });

        it('should return null for non-existent org', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const result = await AccessPolicyService.getOrganizationType('non-existent');
            
            expect(result).toBeNull();
        });

        it('should handle database errors', async () => {
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'), null);
            });

            await expect(
                AccessPolicyService.getOrganizationType('org-123')
            ).rejects.toThrow('DB Error');
        });
    });

    describe('checkAccess', () => {
        it('should allow access for active trial org', async () => {
            const orgId = testOrganizations.org1.id;
            const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('FROM organizations')) {
                    callback(null, {
                        id: orgId,
                        organization_type: 'TRIAL',
                        trial_expires_at: futureDate,
                        is_active: 1
                    });
                } else if (query.includes('COUNT(*)')) {
                    callback(null, { count: 5 }); // Under AI limit
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.checkAccess(orgId, 'ai_call');
            
            expect(result.allowed).toBe(true);
        });

        it('should deny access for expired trial', async () => {
            const orgId = testOrganizations.org1.id;
            const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('FROM organizations')) {
                    callback(null, {
                        id: orgId,
                        organization_type: 'TRIAL',
                        trial_expires_at: pastDate,
                        is_active: 1
                    });
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.checkAccess(orgId, 'ai_call');
            
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('expired');
        });

        it('should deny access when AI limit reached', async () => {
            const orgId = testOrganizations.org1.id;
            const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('FROM organizations')) {
                    callback(null, {
                        id: orgId,
                        organization_type: 'TRIAL',
                        trial_expires_at: futureDate,
                        is_active: 1,
                        trial_tokens_used: 10000 // Max tokens reached
                    });
                } else if (query.includes('organization_limits')) {
                    callback(null, {
                        max_ai_calls_per_day: 50,
                        max_total_tokens: 10000
                    });
                } else if (query.includes('COUNT(*)')) {
                    callback(null, { count: 100 }); // Over limit
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.checkAccess(orgId, 'ai_call');
            
            expect(result.allowed).toBe(false);
        });

        it('should deny access for demo mode mutations', async () => {
            const orgId = testOrganizations.org1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('FROM organizations')) {
                    callback(null, {
                        id: orgId,
                        organization_type: 'DEMO',
                        is_active: 1
                    });
                } else {
                    callback(null, null);
                }
            });

            // Use 'write' action which is a valid write action for DEMO check
            const result = await AccessPolicyService.checkAccess(orgId, 'write');
            
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Demo');
        });
    });

    describe('getOrganizationLimits', () => {
        it('should return default limits for trial org without custom limits', async () => {
            const orgId = testOrganizations.org1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('organization_limits')) {
                    callback(null, null); // No custom limits
                } else if (query.includes('FROM organizations')) {
                    callback(null, {
                        id: orgId,
                        organization_type: 'TRIAL'
                    });
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.getOrganizationLimits(orgId);
            
            expect(result).toBeDefined();
            expect(result.maxProjects).toBeDefined();
            expect(result.maxUsers).toBeDefined();
        });

        it('should return custom limits when set', async () => {
            const orgId = testOrganizations.org1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('organization_limits')) {
                    callback(null, {
                        max_projects: 10,
                        max_users: 20,
                        max_ai_calls_per_day: 500,
                        ai_roles_enabled_json: '["ADVISOR"]'
                    });
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.getOrganizationLimits(orgId);
            
            expect(result.maxProjects).toBe(10);
            expect(result.maxUsers).toBe(20);
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should only return limits for specified organization', async () => {
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;
            
            const capturedOrgIds = new Set();
            mockDb.get.mockImplementation((query, params, callback) => {
                if (params && params[0]) {
                    capturedOrgIds.add(params[0]);
                }
                // Return null to trigger default limits path
                callback(null, null);
            });

            await AccessPolicyService.getOrganizationType(org1Id);
            await AccessPolicyService.getOrganizationType(org2Id);

            // Verify both org IDs were queried independently
            expect(capturedOrgIds.has(org1Id)).toBe(true);
            expect(capturedOrgIds.has(org2Id)).toBe(true);
        });

        it('should not leak data between organizations', async () => {
            const org1Id = testOrganizations.org1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                // Verify query always includes org filter
                expect(query).toContain('?');
                expect(params[0]).toBe(org1Id);
                callback(null, null);
            });

            await AccessPolicyService.getOrganizationType(org1Id);
        });
    });
});
