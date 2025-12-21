/**
 * Access Policy Service Tests
 * 
 * CRITICAL SECURITY SERVICE - Must have 95%+ coverage
 * Tests multi-tenant isolation, trial limits, and access control.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { 
    createMockDb, 
    createStandardDeps, 
    injectDependencies 
} from '../../helpers/dependencyInjector.js';
import { testOrganizations, testUsers } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);
const AccessPolicyService = require('../../../server/services/accessPolicyService.js');

describe('AccessPolicyService', () => {
    let mockDb;
    let deps;

    beforeEach(() => {
        // Create mock dependencies
        mockDb = createMockDb();
        deps = createStandardDeps({ db: mockDb });

        // Inject dependencies if service supports it
        // Note: accessPolicyService may need refactoring to support DI
        // For now, we'll mock the database module directly
        vi.mock('../../../server/database', () => ({
            default: mockDb
        }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
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
            
            // Mock org type lookup
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('FROM organizations')) {
                    callback(null, {
                        id: orgId,
                        organization_type: 'TRIAL',
                        trial_started_at: '2024-01-01',
                        trial_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        is_active: 1
                    });
                } else if (query.includes('FROM organization_limits')) {
                    callback(null, null); // No custom limits
                } else {
                    callback(null, null);
                }
            });

            // Mock count queries
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('COUNT(*)')) {
                    callback(null, { count: 0 });
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.checkAccess(orgId, 'ai_call');
            
            expect(result.allowed).toBe(true);
            expect(result.reason).toBeUndefined();
        });

        it('should deny access for expired trial', async () => {
            const orgId = testOrganizations.org1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('FROM organizations')) {
                    callback(null, {
                        id: orgId,
                        organization_type: 'TRIAL',
                        trial_started_at: '2024-01-01',
                        trial_expires_at: '2024-01-10', // Expired
                        is_active: 1
                    });
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.checkAccess(orgId, 'ai_call');
            
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('TRIAL_EXPIRED');
        });

        it('should deny access when AI limit reached', async () => {
            const orgId = testOrganizations.org1.id;
            
            // Mock org as active trial
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('FROM organizations')) {
                    callback(null, {
                        id: orgId,
                        organization_type: 'TRIAL',
                        trial_started_at: '2024-01-01',
                        trial_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        is_active: 1
                    });
                } else if (query.includes('FROM organization_limits')) {
                    callback(null, {
                        max_ai_calls_per_day: 50,
                        ai_calls_today: 50 // Limit reached
                    });
                } else if (query.includes('COUNT(*)')) {
                    callback(null, { count: 0 });
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.checkAccess(orgId, 'ai_call');
            
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('AI_LIMIT_REACHED');
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

            const result = await AccessPolicyService.checkAccess(orgId, 'create_project');
            
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('DEMO_READ_ONLY');
        });
    });

    describe('getOrganizationLimits', () => {
        it('should return default limits for trial org without custom limits', async () => {
            const orgId = testOrganizations.org1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('FROM organizations')) {
                    callback(null, {
                        id: orgId,
                        organization_type: 'TRIAL'
                    });
                } else if (query.includes('FROM organization_limits')) {
                    callback(null, null); // No custom limits
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.getOrganizationLimits(orgId);
            
            expect(result).toBeDefined();
            expect(result.max_projects).toBe(3); // Default trial limit
            expect(result.max_ai_calls_per_day).toBe(50);
        });

        it('should return custom limits when set', async () => {
            const orgId = testOrganizations.org1.id;
            
            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('FROM organization_limits')) {
                    callback(null, {
                        organization_id: orgId,
                        max_projects: 10,
                        max_ai_calls_per_day: 100
                    });
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.getOrganizationLimits(orgId);
            
            expect(result.max_projects).toBe(10);
            expect(result.max_ai_calls_per_day).toBe(100);
        });
    });

    describe('Multi-Tenant Isolation', () => {
        it('should only return limits for specified organization', async () => {
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;
            
            let callCount = 0;
            mockDb.get.mockImplementation((query, params, callback) => {
                // Verify that queries filter by organization_id
                expect(params).toContain(org1Id);
                expect(params).not.toContain(org2Id);
                
                if (query.includes('FROM organizations')) {
                    callback(null, {
                        id: org1Id,
                        organization_type: 'TRIAL'
                    });
                } else {
                    callback(null, null);
                }
            });

            await AccessPolicyService.getOrganizationLimits(org1Id);
            
            // Verify query was called with correct org ID
            expect(mockDb.get).toHaveBeenCalled();
        });
    });
});
