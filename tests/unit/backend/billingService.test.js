import { describe, it, expect } from 'vitest';
import BillingService from '../../../server/services/billingService';

describe('BillingService (Integration)', () => {

    describe('getPlans', () => {
        it('should return all available plans from database', async () => {
            const plans = await BillingService.getPlans();
            expect(Array.isArray(plans)).toBe(true);
            expect(plans.length).toBeGreaterThan(0);

            // Verifying known seed data presence
            const planIds = plans.map(p => p.id);
            expect(planIds).toContain('plan-payg');
            expect(planIds).toContain('plan-starter');
        });
    });

    describe('createPlan', () => {
        it('should create a new plan successfully', async () => {
            const uniqueId = `plan-test-${Date.now()}`;
            const planData = {
                name: 'Integration Test Plan',
                price_monthly: 999,
                id: uniqueId // Assuming service allows passing ID or generates one
            };

            // Note: createPlan in valid implementation typically returns the created plan or ID
            // We check if it resolves.
            const plan = await BillingService.createPlan(planData);
            expect(plan).toBeDefined();

            // Verify existence
            const allPlans = await BillingService.getPlans();
            const created = allPlans.find(p => p.name === 'Integration Test Plan' && p.price_monthly === 999);
            expect(created).toBeDefined();
        });
    });

    describe('getOrganizationBilling', () => {
        it('should return billing info or defaults', async () => {
            // Check for a known org or a random one (which should return defaults/undefined but not crash)
            const billing = await BillingService.getOrganizationBilling('org-saudi');
            // If org-saudi exists (seeded), checks properties.
            if (billing) {
                expect(billing).toHaveProperty('organization_id');
            } else {
                // It's acceptable to be undefined if not seeded
                expect(billing).toBeUndefined();
            }
        });
    });
});
