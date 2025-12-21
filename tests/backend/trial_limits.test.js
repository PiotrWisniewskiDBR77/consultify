import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import db from '../../server/database';
import AccessPolicyService from '../../server/services/accessPolicyService';

describe('Trial Mode Limits Verification', () => {
    const mockOrgId = 'trial-org-123';

    let getSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        // Spy on the real DB instance methods
        // We assume db is a sqlite3 Database instance
        getSpy = vi.spyOn(db, 'get');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initiative Limits (Max 5)', () => {
        test('Should ALLOW creating 5th initiative', async () => {
            getSpy.mockImplementation((sql, params, callback) => {
                let row = null;
                if (sql.includes('FROM organizations WHERE id')) {
                    row = {
                        id: mockOrgId,
                        organization_type: 'TRIAL',
                        is_active: 1,
                        trial_expires_at: new Date(Date.now() + 86400000).toISOString()
                    };
                } else if (sql.includes('FROM initiatives WHERE organization_id')) {
                    row = { count: 4 }; // 4 existing
                } else if (sql.includes('FROM organization_limits')) {
                    row = null;
                } else if (sql.includes('FROM usage_counters')) {
                    row = null;
                } else if (sql.includes('trial_tokens_used')) {
                    row = { trial_tokens_used: 0 };
                }
                callback(null, row);
            });

            const result = await AccessPolicyService.checkAccess(mockOrgId, 'create_initiative');
            expect(result.allowed).toBe(true);
        });

        test('Should BLOCK creating 6th initiative', async () => {
            getSpy.mockImplementation((sql, params, callback) => {
                let row = null;
                if (sql.includes('FROM organizations WHERE id')) {
                    row = {
                        id: mockOrgId,
                        organization_type: 'TRIAL',
                        is_active: 1,
                        trial_expires_at: new Date(Date.now() + 86400000).toISOString()
                    };
                } else if (sql.includes('FROM initiatives WHERE organization_id')) {
                    row = { count: 5 }; // 5 existing
                } else if (sql.includes('FROM organization_limits')) {
                    row = null;
                } else if (sql.includes('FROM usage_counters')) {
                    row = null;
                } else if (sql.includes('trial_tokens_used')) {
                    row = { trial_tokens_used: 0 };
                }
                callback(null, row);
            });

            const result = await AccessPolicyService.checkAccess(mockOrgId, 'create_initiative');
            expect(result.allowed).toBe(false);
            expect(result.errorCode).toBe('INITIATIVE_LIMIT_REACHED');
        });
    });

    describe('User Invite Limits (Max 4 total, 3 invites)', () => {
        test('Should ALLOW inviting 3rd user', async () => {
            getSpy.mockImplementation((sql, params, callback) => {
                let row = null;
                if (sql.includes('FROM organizations WHERE id')) {
                    row = {
                        id: mockOrgId,
                        organization_type: 'TRIAL',
                        is_active: 1,
                        trial_expires_at: new Date(Date.now() + 86400000).toISOString()
                    };
                } else if (sql.includes('FROM users WHERE organization_id')) {
                    row = { count: 3 }; // owner + 2 invites = 3
                } else if (sql.includes('FROM organization_limits')) {
                    row = null;
                } else if (sql.includes('FROM usage_counters')) {
                    row = null;
                } else if (sql.includes('trial_tokens_used')) {
                    row = { trial_tokens_used: 0 };
                }
                callback(null, row);
            });

            const result = await AccessPolicyService.checkAccess(mockOrgId, 'invite_user');
            expect(result.allowed).toBe(true);
        });

        test('Should BLOCK inviting 4th user', async () => {
            getSpy.mockImplementation((sql, params, callback) => {
                let row = null;
                if (sql.includes('FROM organizations WHERE id')) {
                    row = {
                        id: mockOrgId,
                        organization_type: 'TRIAL',
                        is_active: 1,
                        trial_expires_at: new Date(Date.now() + 86400000).toISOString()
                    };
                } else if (sql.includes('FROM users WHERE organization_id')) {
                    row = { count: 4 }; // owner + 3 invites = 4
                } else if (sql.includes('FROM organization_limits')) {
                    row = null;
                } else if (sql.includes('FROM usage_counters')) {
                    row = null;
                } else if (sql.includes('trial_tokens_used')) {
                    row = { trial_tokens_used: 0 };
                }
                callback(null, row);
            });

            const result = await AccessPolicyService.checkAccess(mockOrgId, 'invite_user');
            expect(result.allowed).toBe(false);
            expect(result.errorCode).toBe('USER_LIMIT_REACHED');
        });
    });

    describe('AI Token Limits (Max 10000)', () => {
        test('Should ALLOW AI call if within limit', async () => {
            getSpy.mockImplementation((sql, params, callback) => {
                let row = null;
                if (sql.includes('FROM organizations WHERE id')) {
                    if (sql.includes('trial_tokens_used')) {
                        row = { trial_tokens_used: 5000 };
                    } else {
                        row = {
                            id: mockOrgId,
                            organization_type: 'TRIAL',
                            is_active: 1,
                            trial_tokens_used: 5000,
                            trial_expires_at: new Date(Date.now() + 86400000).toISOString()
                        };
                    }
                } else if (sql.includes('FROM organization_limits')) {
                    row = null;
                } else if (sql.includes('FROM usage_counters')) {
                    row = null;
                }
                callback(null, row);
            });

            const result = await AccessPolicyService.checkAccess(mockOrgId, 'ai_call');
            expect(result.allowed).toBe(true);
        });

        test('Should BLOCK AI call if limit exceeded', async () => {
            getSpy.mockImplementation((sql, params, callback) => {
                let row = null;
                if (sql.includes('FROM organizations WHERE id')) {
                    if (sql.includes('trial_tokens_used')) {
                        row = { trial_tokens_used: 10001 };
                    } else {
                        row = {
                            id: mockOrgId,
                            organization_type: 'TRIAL',
                            is_active: 1,
                            trial_tokens_used: 10001,
                            trial_expires_at: new Date(Date.now() + 86400000).toISOString()
                        };
                    }
                } else if (sql.includes('FROM organization_limits')) {
                    row = null;
                } else if (sql.includes('FROM usage_counters')) {
                    row = null;
                }
                callback(null, row);
            });

            const result = await AccessPolicyService.checkAccess(mockOrgId, 'ai_call');
            expect(result.allowed).toBe(false);
            expect(result.errorCode).toBe('AI_TOKEN_BUDGET_EXCEEDED');
        });
    });

});
