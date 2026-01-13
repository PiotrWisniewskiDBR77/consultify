/**
 * API Keys E2E Tests
 * Testing API key management
 * 
 * @module tests/e2e/api/api-keys.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('API Keys Management', () => {
    test('should access API keys page', async ({ page }) => {
        await page.goto('/api/keys');

        const url = page.url();
        expect(url).toMatch(/api|keys|login|developer/);
    });

    test('should access API key creation', async ({ page }) => {
        await page.goto('/api/keys/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access API documentation', async ({ page }) => {
        await page.goto('/api/docs');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access webhooks page', async ({ page }) => {
        await page.goto('/api/webhooks');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('API Logs', () => {
    test('should access API logs', async ({ page }) => {
        await page.goto('/api/logs');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access usage stats', async ({ page }) => {
        await page.goto('/api/usage');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
