import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BillingDependencyLoader as BillingDependencyLoaderType } from '../billingDependencyLoader.js';

// Global Mocks (DB)
vi.mock('../../database/Database.js', () => ({
    getDatabase: vi.fn(() => ({ run: vi.fn() })),
}));

describe('BillingDependencyLoader', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('should initialize with null stripe when MOCK_BILLING is true', async () => {
        vi.doMock('../../../config/index.js', () => ({
            config: {
                STRIPE_SECRET_KEY: 'sk_test_fake',
                MOCK_BILLING: true,
            },
        }));

        const { BillingDependencyLoader } = await import('../billingDependencyLoader.js');
        const loader = new BillingDependencyLoader();
        await loader.init();

        expect(loader.deps.stripe).toBeNull();
    });

    it('should initialize Stripe when Key present and MOCK_BILLING false', async () => {
        vi.doMock('../../../config/index.js', () => ({
            config: {
                STRIPE_SECRET_KEY: 'sk_test_fake',
                MOCK_BILLING: false,
            },
        }));

        const { BillingDependencyLoader } = await import('../billingDependencyLoader.js');
        const loader = new BillingDependencyLoader();
        await loader.init();

        expect(loader.deps.stripe).not.toBeNull();
        expect(loader.deps.stripe).toHaveProperty('customers');
    });

    it('should initialize with null stripe when Key MISSING and MOCK_BILLING false (Dev Fallback)', async () => {
        vi.doMock('../../../config/index.js', () => ({
            config: {
                STRIPE_SECRET_KEY: undefined,
                MOCK_BILLING: false,
            },
        }));

        const { BillingDependencyLoader } = await import('../billingDependencyLoader.js');
        const loader = new BillingDependencyLoader();
        await loader.init();

        expect(loader.deps.stripe).toBeNull();
    });
});
