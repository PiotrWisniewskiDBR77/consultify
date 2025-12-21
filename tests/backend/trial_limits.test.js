const AccessPolicyService = require('../../server/services/accessPolicyService');
const db = require('../../server/database');

jest.mock('../../server/db');

describe('Trial Mode Limits Verification', () => {
    const mockOrgId = 'trial-org-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Initiative Limits (Max 5)', () => {
        test('Should ALLOW creating 5th initiative', async () => {
            // Mock org type as TRIAL
            db.get.mockImplementation((sql, params) => {
                if (sql.includes('SELECT type')) return Promise.resolve({ type: 'TRIAL' });
                if (sql.includes('SELECT count(*)')) return Promise.resolve({ count: 4 }); // 4 existing
                if (sql.includes('SELECT * FROM organization_limits')) return Promise.resolve(null); // Use defaults
                return Promise.resolve(null);
            });

            const result = await AccessPolicyService.checkAccess(mockOrgId, 'create_initiative');
            expect(result).toBe(true);
        });

        test('Should BLOCK creating 6th initiative', async () => {
            // Mock org type as TRIAL
            db.get.mockImplementation((sql, params) => {
                if (sql.includes('SELECT type')) return Promise.resolve({ type: 'TRIAL' });
                if (sql.includes('SELECT count(*)')) return Promise.resolve({ count: 5 }); // 5 existing
                if (sql.includes('SELECT * FROM organization_limits')) return Promise.resolve(null); // Use defaults
                return Promise.resolve(null);
            });

            const result = await AccessPolicyService.checkAccess(mockOrgId, 'create_initiative');
            expect(result).toBe(false);
        });
    });

    describe('User Invite Limits (Max 4 total, 3 invites)', () => {
        test('Should ALLOW inviting 3rd user (total 4)', async () => {
            // Mock org type as TRIAL
            db.get.mockImplementation((sql, params) => {
                if (sql.includes('SELECT type')) return Promise.resolve({ type: 'TRIAL' });
                if (sql.includes('SELECT count(*)')) return Promise.resolve({ count: 3 }); // owner + 2 invites = 3
                if (sql.includes('SELECT * FROM organization_limits')) return Promise.resolve(null);
                return Promise.resolve(null);
            });

            const result = await AccessPolicyService.checkAccess(mockOrgId, 'invite_user');
            expect(result).toBe(true);
        });

        test('Should BLOCK inviting 4th user (total 5)', async () => {
            // Mock org type as TRIAL
            db.get.mockImplementation((sql, params) => {
                if (sql.includes('SELECT type')) return Promise.resolve({ type: 'TRIAL' });
                if (sql.includes('SELECT count(*)')) return Promise.resolve({ count: 4 }); // owner + 3 invites = 4
                if (sql.includes('SELECT * FROM organization_limits')) return Promise.resolve(null);
                return Promise.resolve(null);
            });

            const result = await AccessPolicyService.checkAccess(mockOrgId, 'invite_user');
            expect(result).toBe(false);
        });
    });

    describe('AI Token Limits (Max 10000)', () => {
        test('Should ALLOW AI call if within limit', async () => {
            // Mock org type as TRIAL + usage
            db.get.mockImplementation((sql, params) => {
                if (sql.includes('SELECT type')) return Promise.resolve({ type: 'TRIAL', trial_tokens_used: 5000 });
                if (sql.includes('SELECT * FROM organization_limits')) return Promise.resolve(null);
                return Promise.resolve(null);
            });

            const result = await AccessPolicyService.checkAccess(mockOrgId, 'ai_call');
            expect(result).toBe(true);
        });

        test('Should BLOCK AI call if limit exceeded', async () => {
            // Mock org type as TRIAL + usage
            db.get.mockImplementation((sql, params) => {
                if (sql.includes('SELECT type')) return Promise.resolve({ type: 'TRIAL', trial_tokens_used: 10001 });
                if (sql.includes('SELECT * FROM organization_limits')) return Promise.resolve(null);
                return Promise.resolve(null);
            });

            const result = await AccessPolicyService.checkAccess(mockOrgId, 'ai_call');
            expect(result).toBe(false);
        });
    });
});
