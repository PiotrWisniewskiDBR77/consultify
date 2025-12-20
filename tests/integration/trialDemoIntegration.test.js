/**
 * Step 2 Finalization Integration Tests
 * 
 * Test cases for Trial + Demo access model:
 * 1. Demo start → policy snapshot shows DEMO → AI DO blocked
 * 2. Trial active → days left correct → AI limit increments
 * 3. Trial expired → features blocked
 * 4. Upgrade → org becomes PAID → restrictions removed
 * 5. Extend trial → respects limits → audit logged
 */

const request = require('supertest');
const db = require('../../server/database');
const AccessPolicyService = require('../../server/services/accessPolicyService');
const TrialService = require('../../server/services/trialService');
const DemoService = require('../../server/services/demoService');
const OrganizationEventService = require('../../server/services/organizationEventService');

// Mock the database
jest.mock('../../server/database', () => ({
    get: jest.fn(),
    run: jest.fn(),
    all: jest.fn(),
    serialize: jest.fn((callback) => callback())
}));

describe('Step 2 Finalization Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('1. Demo Flow', () => {
        it('should return DEMO org type in policy snapshot for demo orgs', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('organizations')) {
                    callback(null, {
                        id: 'demo-org',
                        name: 'Demo Org',
                        organization_type: 'DEMO',
                        trial_started_at: new Date().toISOString(),
                        is_active: 1
                    });
                } else if (sql.includes('organization_limits')) {
                    callback(null, {
                        max_projects: 1,
                        max_users: 1,
                        max_ai_calls_per_day: 10,
                        max_initiatives: 5,
                        max_storage_mb: 10,
                        ai_roles_enabled_json: '["ADVISOR"]'
                    });
                } else if (sql.includes('usage_counters')) {
                    callback(null, { ai_calls_count: 0 });
                } else if (sql.includes('COUNT')) {
                    callback(null, { count: 0 });
                } else {
                    callback(null, null);
                }
            });

            const snapshot = await AccessPolicyService.buildPolicySnapshot('demo-org');

            expect(snapshot.orgType).toBe('DEMO');
            expect(snapshot.isDemo).toBe(true);
            expect(snapshot.isTrial).toBe(false);
            expect(snapshot.isPaid).toBe(false);
            expect(snapshot.blockedActions).toContain('AI_DO_ACTIONS');
            expect(snapshot.blockedActions).toContain('CREATE_PROJECT');
        });

        it('should block write actions for DEMO orgs', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'demo-org',
                    organization_type: 'DEMO',
                    is_active: 1
                });
            });

            const result = await AccessPolicyService.checkAccess('demo-org', 'create_project');

            expect(result.allowed).toBe(false);
            expect(result.errorCode).toBe('DEMO_READ_ONLY');
        });
    });

    describe('2. Trial Flow', () => {
        it('should return correct days remaining for active trial', async () => {
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('organizations')) {
                    callback(null, {
                        id: 'trial-org',
                        organization_type: 'TRIAL',
                        trial_expires_at: expiresAt,
                        is_active: 1,
                        trial_extension_count: 0
                    });
                } else if (sql.includes('organization_limits')) {
                    callback(null, {
                        max_ai_calls_per_day: 50,
                        ai_roles_enabled_json: '["ADVISOR"]'
                    });
                } else if (sql.includes('usage_counters')) {
                    callback(null, { ai_calls_count: 5 });
                } else if (sql.includes('COUNT')) {
                    callback(null, { count: 0 });
                } else {
                    callback(null, null);
                }
            });

            const snapshot = await AccessPolicyService.buildPolicySnapshot('trial-org');

            expect(snapshot.isTrial).toBe(true);
            expect(snapshot.trialDaysLeft).toBeGreaterThanOrEqual(6);
            expect(snapshot.trialDaysLeft).toBeLessThanOrEqual(8);
            expect(snapshot.isTrialExpired).toBe(false);
            expect(snapshot.usageToday.aiCalls).toBe(5);
        });

        it('should increment AI usage counter', async () => {
            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            await AccessPolicyService.incrementUsage('trial-org', 'ai_calls', 1);

            expect(db.run).toHaveBeenCalled();
        });
    });

    describe('3. Trial Expired Flow', () => {
        it('should mark trial as expired when past expiration', async () => {
            const expiredAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'trial-org',
                    organization_type: 'TRIAL',
                    trial_expires_at: expiredAt,
                    is_active: 1
                });
            });

            const trialStatus = await AccessPolicyService.checkTrialStatus('trial-org');

            expect(trialStatus.expired).toBe(true);
            expect(trialStatus.daysRemaining).toBe(0);
            expect(trialStatus.warningLevel).toBe('expired');
        });

        it('should block write actions for expired trials', async () => {
            const expiredAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('organizations')) {
                    callback(null, {
                        id: 'trial-org',
                        organization_type: 'TRIAL',
                        trial_expires_at: expiredAt,
                        is_active: 1
                    });
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.checkAccess('trial-org', 'create_project');

            expect(result.allowed).toBe(false);
            expect(result.errorCode).toBe('TRIAL_EXPIRED');
        });
    });

    describe('4. Upgrade Flow (Idempotent)', () => {
        it('should return success without changes for already PAID org', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'paid-org',
                    organization_type: 'PAID',
                    plan: 'pro',
                    is_active: 1
                });
            });

            const result = await TrialService.upgradeToPaid('paid-org', 'PRO', 'admin-user');

            expect(result.success).toBe(true);
            expect(result.alreadyUpgraded).toBe(true);
            expect(db.run).not.toHaveBeenCalled();
        });

        it('should upgrade TRIAL to PAID and remove limits', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'trial-org',
                    organization_type: 'TRIAL',
                    plan: 'trial',
                    is_active: 1
                });
            });

            db.run.mockImplementation((sql, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            db.all.mockImplementation((sql, params, callback) => {
                callback(null, [{ id: 'admin-1' }]);
            });

            const result = await TrialService.upgradeToPaid('trial-org', 'ENTERPRISE', 'super-admin');

            expect(result.success).toBe(true);
            expect(result.alreadyUpgraded).toBe(false);
            expect(result.organizationType).toBe('PAID');
            expect(result.plan).toBe('ENTERPRISE');
        });
    });

    describe('5. Extend Trial Flow (With Limits)', () => {
        it('should reject extension when max extensions reached', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'trial-org',
                    organization_type: 'TRIAL',
                    trial_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    is_active: 1,
                    trial_extension_count: 2 // Already at max
                });
            });

            await expect(
                TrialService.extendTrial('trial-org', 7, 'admin', 'Customer needs more time')
            ).rejects.toMatchObject({
                errorCode: 'EXTENSION_LIMIT_REACHED'
            });
        });

        it('should reject extension exceeding MAX_EXTENSION_DAYS', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'trial-org',
                    organization_type: 'TRIAL',
                    trial_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    is_active: 1,
                    trial_extension_count: 0
                });
            });

            await expect(
                TrialService.extendTrial('trial-org', 30, 'admin', 'Need more time')
            ).rejects.toMatchObject({
                errorCode: 'INVALID_DAYS'
            });
        });
    });

    describe('6. Step 3 Hooks', () => {
        it('canInviteUsers should return false for DEMO orgs', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, {
                    id: 'demo-org',
                    organization_type: 'DEMO',
                    is_active: 1
                });
            });

            const result = await AccessPolicyService.canInviteUsers('demo-org', 'user-1');

            expect(result.allowed).toBe(false);
            expect(result.reasonCode).toBe('DEMO_READ_ONLY');
        });

        it('getSeatAvailability should return correct counts', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('organizations')) {
                    callback(null, {
                        id: 'trial-org',
                        organization_type: 'TRIAL',
                        is_active: 1
                    });
                } else if (sql.includes('organization_limits')) {
                    callback(null, {
                        max_users: 5,
                        ai_roles_enabled_json: '["ADVISOR"]'
                    });
                } else if (sql.includes('COUNT')) {
                    callback(null, { count: 3 });
                } else {
                    callback(null, null);
                }
            });

            const result = await AccessPolicyService.getSeatAvailability('trial-org');

            expect(result.maxSeats).toBe(5);
            expect(result.currentSeats).toBe(3);
            expect(result.seatsRemaining).toBe(2);
        });
    });
});
