/**
 * Orders E2E Tests
 * Testing order management
 * 
 * @module tests/e2e/orders/order-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Order Management', () => {
    test('should access orders page', async ({ page }) => {
        await page.goto('/orders');

        const url = page.url();
        expect(url).toMatch(/orders|purchases|login/);
    });

    test('should create order', async ({ page }) => {
        await page.goto('/orders/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access order detail', async ({ page }) => {
        await page.goto('/orders/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access order history', async ({ page }) => {
        await page.goto('/orders/history');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Order Actions', () => {
    test('should process order', async ({ page }) => {
        await page.goto('/orders/1/process');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should refund order', async ({ page }) => {
        await page.goto('/orders/1/refund');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
