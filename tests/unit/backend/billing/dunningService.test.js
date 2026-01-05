/**
 * Unit Tests for Dunning Service
 * Tests payment retry logic and subscription recovery
 */

import { jest } from '@jest/globals';

// Mock database
const mockDb = {
    run: jest.fn((sql, params, callback) => {
        if (typeof callback === 'function') {
            callback.call({ lastID: 1, changes: 1 }, null);
        }
    }),
    get: jest.fn((sql, params, callback) => callback(null, null)),
    all: jest.fn((sql, params, callback) => callback(null, []))
};

// Mock database module
jest.unstable_mockModule('../../../../server/src/database/index.js', () => ({
    getDatabase: () => mockDb
}));

// Mock email service
jest.unstable_mockModule('../../../../server/services/emailService.js', () => ({
    default: {
        sendDunningEmail: jest.fn().mockResolvedValue(true)
    }
}));

// Import after mocking
const dunningService = await import('../../../../server/services/dunningService.js');

describe('DunningService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('initializeDunning', () => {
        it('should create new dunning state when none exists', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('dunning_states')) {
                    callback(null, null); // No existing dunning
                } else if (sql.includes('settings')) {
                    callback(null, null);
                }
            });
            mockDb.all.mockImplementation((sql, params, callback) => callback(null, []));
            mockDb.run.mockImplementation((sql, params, callback) => {
                if (typeof callback === 'function') {
                    callback.call({ lastID: 1, changes: 1 }, null);
                }
            });

            const result = await dunningService.initializeDunning('org-1', 'sub_123', 9900);

            expect(result).toHaveProperty('id');
            expect(result.updated).toBeUndefined();
        });

        it('should update existing dunning state', async () => {
            const existingDunning = { id: 'dunning-1', organization_id: 'org-1', status: 'active' };
            
            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('dunning_states')) {
                    callback(null, existingDunning);
                }
            });
            mockDb.all.mockImplementation((sql, params, callback) => callback(null, []));

            const result = await dunningService.initializeDunning('org-1', 'sub_123', 9900);

            expect(result).toHaveProperty('id', 'dunning-1');
            expect(result).toHaveProperty('updated', true);
        });
    });

    describe('getDunningState', () => {
        it('should return active dunning state', async () => {
            const mockDunning = {
                id: 'dunning-1',
                organization_id: 'org-1',
                current_step: 1,
                status: 'active'
            };

            mockDb.get.mockResolvedValue($2);

            const result = await dunningService.getDunningState('org-1');

            expect(result).toEqual(mockDunning);
        });

        it('should return null when no active dunning', async () => {
            mockDb.get.mockResolvedValue($2);

            const result = await dunningService.getDunningState('org-1');

            expect(result).toBeNull();
        });
    });

    describe('advanceDunningStep', () => {
        it('should advance to next step when dunning exists', async () => {
            const mockDunning = {
                id: 'dunning-1',
                organization_id: 'org-1',
                current_step: 0,
                subscription_id: 'sub_123',
                status: 'active'
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('dunning_states')) {
                    callback(null, mockDunning);
                }
            });
            mockDb.all.mockImplementation((sql, params, callback) => callback(null, []));

            const result = await dunningService.advanceDunningStep('org-1');

            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('step', 1);
            expect(result).toHaveProperty('action');
        });

        it('should return error when no active dunning', async () => {
            mockDb.get.mockResolvedValue($2);
            mockDb.all.mockImplementation((sql, params, callback) => callback(null, []));

            const result = await dunningService.advanceDunningStep('org-1');

            expect(result).toHaveProperty('success', false);
            expect(result).toHaveProperty('error', 'No active dunning state');
        });

        it('should suspend subscription when max steps reached', async () => {
            const mockDunning = {
                id: 'dunning-1',
                organization_id: 'org-1',
                current_step: 3, // Last step before suspension
                subscription_id: 'sub_123',
                status: 'active'
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('dunning_states')) {
                    callback(null, mockDunning);
                } else if (sql.includes('organization_billing')) {
                    callback(null, { organization_id: 'org-1' });
                }
            });
            mockDb.all.mockImplementation((sql, params, callback) => callback(null, []));

            const result = await dunningService.advanceDunningStep('org-1');

            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('action', 'suspended');
        });
    });

    describe('resolveDunning', () => {
        it('should resolve existing dunning state', async () => {
            const mockDunning = {
                id: 'dunning-1',
                organization_id: 'org-1',
                status: 'active'
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('dunning_states')) {
                    callback(null, mockDunning);
                } else if (sql.includes('organization_billing')) {
                    callback(null, { status: 'active' });
                }
            });

            const result = await dunningService.resolveDunning('org-1');

            expect(result).toHaveProperty('success', true);
        });

        it('should handle case when no dunning exists', async () => {
            mockDb.get.mockResolvedValue($2);

            const result = await dunningService.resolveDunning('org-1');

            expect(result).toHaveProperty('success', true);
            expect(result).toHaveProperty('message', 'No active dunning to resolve');
        });
    });

    describe('processPendingDunning', () => {
        it('should process pending dunning states', async () => {
            const mockPendingDunning = [
                {
                    id: 'dunning-1',
                    organization_id: 'org-1',
                    subscription_id: 'sub_123',
                    current_step: 0,
                    next_attempt_at: new Date(Date.now() - 1000).toISOString()
                }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                if (sql.includes('dunning_states')) {
                    callback(null, mockPendingDunning);
                } else if (sql.includes('users')) {
                    callback(null, []);
                } else {
                    callback(null, []);
                }
            });

            mockDb.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('organization_billing')) {
                    callback(null, { stripe_subscription_id: 'sub_123' });
                } else if (sql.includes('invoices')) {
                    callback(null, null); // No unpaid invoice - payment fails
                } else if (sql.includes('dunning_states')) {
                    callback(null, mockPendingDunning[0]);
                } else {
                    callback(null, null);
                }
            });

            const result = await dunningService.processPendingDunning();

            expect(result).toHaveProperty('processed');
            expect(result.processed).toBeGreaterThanOrEqual(0);
        });

        it('should return empty results when no pending dunning', async () => {
            mockDb.all.mockResolvedValue($2);

            const result = await dunningService.processPendingDunning();

            expect(result).toEqual({
                processed: 0,
                advanced: 0,
                suspended: 0,
                errors: 0
            });
        });
    });

    describe('getDunningStats', () => {
        it('should return dunning statistics', async () => {
            const mockStats = {
                total: 10,
                active: 3,
                resolved: 5,
                exhausted: 2,
                total_amount_due: 50000
            };

            const mockByStep = [
                { current_step: 0, count: 1 },
                { current_step: 1, count: 1 },
                { current_step: 2, count: 1 }
            ];

            mockDb.get.mockResolvedValue($2);

            mockDb.all.mockResolvedValue($2);

            const result = await dunningService.getDunningStats();

            expect(result).toHaveProperty('total', 10);
            expect(result).toHaveProperty('active', 3);
            expect(result).toHaveProperty('byStep');
            expect(result.byStep).toHaveProperty('step_0', 1);
        });
    });
});

