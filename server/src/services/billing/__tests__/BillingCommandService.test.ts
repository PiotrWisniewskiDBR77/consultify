import { describe, it, expect, vi } from 'vitest';
import { BillingCommandService } from '../BillingCommandService.js';

const createDeps = () => ({
    db: { run: vi.fn() },
    uuidv4: () => 'uuid',
    stripe: null
} as any);

const createQueryService = () => ({
    getOrganizationBilling: vi.fn().mockResolvedValue(null),
    getSeatPricing: vi.fn().mockResolvedValue({ seats_included: 0, seat_price_monthly: 10, max_seats: 10 }),
    getPlanById: vi.fn().mockResolvedValue({ id: 'plan-1', name: 'Plan', price_monthly: 100 }),
    getPaymentMethods: vi.fn().mockResolvedValue([])
});

const createEventService = () => ({
    emitEvent: vi.fn()
});

describe('BillingCommandService', () => {
    it('creates a plan', async () => {
        const deps = createDeps();
        const service = new BillingCommandService(() => deps, createQueryService() as any, createEventService() as any);

        const plan = await service.createPlan({ name: 'Pro', price_monthly: 200 });

        expect(plan).toEqual(expect.objectContaining({ name: 'Pro', price_monthly: 200 }));
        expect(deps.db.run).toHaveBeenCalled();
    });

    it('upserts organization billing and emits event', async () => {
        const deps = createDeps();
        const queryService = createQueryService();
        const eventService = createEventService();
        const service = new BillingCommandService(() => deps, queryService as any, eventService as any);

        await service.upsertOrgBilling('org-1', { subscription_plan_id: 'plan-1' });

        expect(deps.db.run).toHaveBeenCalled();
        expect(eventService.emitEvent).toHaveBeenCalledWith('billing.org.updated', expect.any(Object));
    });
});
