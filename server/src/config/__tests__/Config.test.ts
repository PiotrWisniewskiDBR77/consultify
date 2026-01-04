import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks
vi.mock('zod', async () => {
    const actual = await vi.importActual('zod');
    return { ...actual };
});

describe('Config Centralization', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('should load default MOCK_BILLING as false', async () => {
        process.env.MOCK_BILLING = undefined;
        // Re-import to trigger loadConfig
        const { config } = await import('../Config.js');
        expect(config.MOCK_BILLING).toBe(false);
    });

    it('should parse MOCK_BILLING=true from env', async () => {
        process.env.MOCK_BILLING = 'true';
        const { config } = await import('../Config.js');
        expect(config.MOCK_BILLING).toBe(true);
    });

    it('should throw in PRODUCTION if keys missing and NOT mocked', async () => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'a_very_long_secure_secret_for_production_testing_purposes'; // Satisfy JWT req
        process.env.STRIPE_SECRET_KEY = '';
        process.env.MOCK_BILLING = '';

        await expect(import('../Config.js')).rejects.toThrow(/STRIPE_SECRET_KEY is required in production/);
    });

    it('should PASS in PRODUCTION if keys missing BUT MOCK_BILLING=true', async () => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'a_very_long_secure_secret_for_production_testing_purposes';
        process.env.STRIPE_SECRET_KEY = '';
        process.env.MOCK_BILLING = 'true';

        const { config } = await import('../Config.js');
        expect(config.MOCK_BILLING).toBe(true);
    });
});
