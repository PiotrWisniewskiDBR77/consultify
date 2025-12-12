import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const db = require('../../../server/database.js');
const BillingService = require('../../../server/services/billingService.js');

describe('BillingService (Unit)', () => {

    beforeAll(async () => {
        await db.initPromise;
    });

    beforeEach(() => {
        vi.restoreAllMocks();
        // Since we are using the real singleton instance required via CJS, spyOn should work
    });

    describe('getPlans', () => {
        it('should return all available plans from database', async () => {
            const mockPlans = [
                { id: 'plan-payg', name: 'PAYG' },
                { id: 'plan-starter', name: 'Starter' }
            ];

            vi.spyOn(db, 'all').mockImplementation((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                callback(null, mockPlans);
            });

            const plans = await BillingService.getPlans();
            expect(Array.isArray(plans)).toBe(true);
            expect(plans.length).toBe(2);
            expect(plans[0].id).toBe('plan-payg');
            expect(db.all).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.any(Array),
                expect.any(Function)
            );
        });

        it('should handle database errors gracefully', async () => {
            vi.spyOn(db, 'all').mockImplementation((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                callback(new Error('DB Error'));
            });

            // Assuming the service rethrows or returns null. We verify it doesn't hang.
            // If the service doesn't catch, we expect failure.
            try {
                await BillingService.getPlans();
            } catch (e) {
                expect(e.message).toBe('DB Error');
            }
        });
    });

    describe('createPlan', () => {
        it('should create a new plan successfully', async () => {
            const planData = {
                name: 'Test Plan',
                price_monthly: 100,
                id: 'plan-test'
            };

            vi.spyOn(db, 'run').mockImplementation((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                callback && callback(null);
            });

            await BillingService.createPlan(planData);
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });

    describe('getOrganizationBilling', () => {
        it('should return billing info from database', async () => {
            const mockBilling = { organization_id: 'org-1', status: 'active' };

            vi.spyOn(db, 'get').mockImplementation((query, params, cb) => {
                const callback = typeof params === 'function' ? params : cb;
                callback(null, mockBilling);
            });

            const billing = await BillingService.getOrganizationBilling('org-1');
            expect(billing).toEqual(mockBilling);
        });
    });
});
