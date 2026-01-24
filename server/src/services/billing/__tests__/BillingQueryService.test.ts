import { describe, expect, it, vi } from 'vitest';

import { BillingQueryService } from '../BillingQueryService.js';

const createDeps = () =>
  ({
    db: {
      all: vi.fn(),
      get: vi.fn(),
    },
    uuidv4: () => 'uuid',
    stripe: null,
  }) as any;

describe('BillingQueryService', () => {
  it('returns paged plans', async () => {
    const deps = createDeps();
    const plans = [{ id: 'plan-1', name: 'Plan', price_monthly: 100 }];
    deps.db.all.mockResolvedValue(plans);

    const service = new BillingQueryService(() => deps);
    const result = await service.getPlans();

    expect(result).toEqual(plans);
    expect(deps.db.all).toHaveBeenCalledWith(
      'SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY price_monthly DESC',
      []
    );
  });

  it('returns null for unknown plan', async () => {
    const deps = createDeps();
    deps.db.get.mockResolvedValue(null);

    const service = new BillingQueryService(() => deps);
    const result = await service.getPlanById('missing');

    expect(result).toBeNull();
  });
});
