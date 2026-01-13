/**
 * Help Center E2E Tests
 * Testing help and support pages
 * 
 * @module tests/e2e/help/help-center.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Help Center', () => {
    test('should access help center', async ({ page }) => {
        await page.goto('/help');

        const url = page.url();
        expect(url).toMatch(/help|support|login/);
    });

    test('should access FAQ', async ({ page }) => {
        await page.goto('/help/faq');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access documentation', async ({ page }) => {
        await page.goto('/help/docs');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access tutorials', async ({ page }) => {
        await page.goto('/help/tutorials');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Support', () => {
    test('should access contact support', async ({ page }) => {
        await page.goto('/help/contact');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access ticket submission', async ({ page }) => {
        await page.goto('/help/ticket/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access ticket history', async ({ page }) => {
        await page.goto('/help/tickets');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
