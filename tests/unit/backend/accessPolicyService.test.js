/**
 * AccessPolicyService Unit Tests
 * 
 * Tests for Demo/Trial/Paid access policy enforcement
 */

const db = require('../../server/database');

// Mock the database before importing AccessPolicyService
jest.mock('../../server/database', () => ({
    get: jest.fn(),
    run: jest.fn(),
    all: jest.fn()
}));

const AccessPolicyService = require('../../server/services/accessPolicyService');

describe('AccessPolicyService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getOrganizationType', () => {
        it('should return org info for valid organization', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'org-123',
                    name: 'Test Org',
                    organization_type: 'TRIAL',
                    trial_started_at: '2024-01-01T00:00:00Z',
                    trial_expires_at: '2024-01-15T00:00:00Z',
                    is_active: 1,
                    plan: 'trial',
                    status: 'active'
                });
            });

            const result = await AccessPolicyService.getOrganizationType('org-123');

            expect(result).toEqual({
                id: 'org-123',
                name: 'Test Org',
                organizationType: 'TRIAL',
                trialStartedAt: '2024-01-01T00:00:00Z',
                trialExpiresAt: '2024-01-15T00:00:00Z',
                isActive: true,
                plan: 'trial',
                status: 'active'
            });
        });

        it('should return null for non-existent organization', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const result = await AccessPolicyService.getOrganizationType('invalid-org');
            expect(result).toBeNull();
        });
    });

    describe('checkTrialStatus', () => {
        it('should return expired=false for PAID orgs', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'org-123',
                    organization_type: 'PAID',
                    is_active: 1
                });
            });

            const result = await AccessPolicyService.checkTrialStatus('org-123');

            expect(result.expired).toBe(false);
            expect(result.daysRemaining).toBe(-1);
            expect(result.warningLevel).toBe('none');
        });

        it('should return expired=true for expired TRIAL orgs', async () => {
            const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'org-123',
                    organization_type: 'TRIAL',
                    trial_expires_at: pastDate,
                    is_active: 1
                });
            });

            const result = await AccessPolicyService.checkTrialStatus('org-123');

            expect(result.expired).toBe(true);
            expect(result.daysRemaining).toBe(0);
            expect(result.warningLevel).toBe('expired');
        });

        it('should return warning level for trials expiring in 5 days', async () => {
            const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'org-123',
                    organization_type: 'TRIAL',
                    trial_expires_at: futureDate,
                    is_active: 1
                });
            });

            const result = await AccessPolicyService.checkTrialStatus('org-123');

            expect(result.expired).toBe(false);
            expect(result.daysRemaining).toBeGreaterThanOrEqual(4);
            expect(result.warningLevel).toBe('warning');
        });
    });

    describe('checkAccess', () => {
        it('should block write actions for DEMO orgs', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('organizations')) {
                    callback(null, {
                        id: 'demo-org',
                        organization_type: 'DEMO',
                        is_active: 1
                    });
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.checkAccess('demo-org', 'create_project');

            expect(result.allowed).toBe(false);
            expect(result.errorCode).toBe('DEMO_READ_ONLY');
        });

        it('should allow write actions for PAID orgs', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('organizations')) {
                    callback(null, {
                        id: 'paid-org',
                        organization_type: 'PAID',
                        is_active: 1
                    });
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.checkAccess('paid-org', 'create_project');

            expect(result.allowed).toBe(true);
        });

        it('should block when project limit is reached', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('organizations')) {
                    callback(null, {
                        id: 'trial-org',
                        organization_type: 'TRIAL',
                        is_active: 1
                    });
                } else if (sql.includes('organization_limits')) {
                    callback(null, {
                        max_projects: 3,
                        max_users: 5,
                        max_ai_calls_per_day: 50
                    });
                } else if (sql.includes('usage_counters')) {
                    callback(null, { ai_calls_count: 0 });
                } else if (sql.includes('COUNT') && sql.includes('projects')) {
                    callback(null, { count: 3 }); // At limit
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.checkAccess('trial-org', 'create_project');

            expect(result.allowed).toBe(false);
            expect(result.errorCode).toBe('PROJECT_LIMIT_REACHED');
        });
    });

    describe('isAIRoleAllowed', () => {
        it('should allow ADVISOR role in trial mode', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    ai_roles_enabled_json: '["ADVISOR"]'
                });
            });

            const result = await AccessPolicyService.isAIRoleAllowed('trial-org', 'ADVISOR');

            expect(result.allowed).toBe(true);
        });

        it('should block EXECUTOR role in trial mode', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    ai_roles_enabled_json: '["ADVISOR"]'
                });
            });

            const result = await AccessPolicyService.isAIRoleAllowed('trial-org', 'EXECUTOR');

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('not available');
        });
    });

    describe('getAIAccessContext', () => {
        it('should return correct context for demo org', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('organizations')) {
                    callback(null, {
                        id: 'demo-org',
                        organization_type: 'DEMO',
                        trial_started_at: new Date().toISOString(),
                        is_active: 1
                    });
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.getAIAccessContext('demo-org');

            expect(result.isDemo).toBe(true);
            expect(result.isTrial).toBe(false);
            expect(result.isPaid).toBe(false);
            expect(result.canExecuteAIActions).toBe(false);
            expect(result.aiResponseBadge).toBe('🎯 Demo AI');
        });
    });
});
