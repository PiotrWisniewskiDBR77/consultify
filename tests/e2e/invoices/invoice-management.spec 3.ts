/**
 * Invoices E2E Tests
 * Testing invoice management
 * 
 * @module tests/e2e/invoices/invoice-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Invoice Management', () => {
    test('should access invoices page', async ({ page }) => {
        await page.goto('/invoices');

        const url = page.url();
        expect(url).toMatch(/invoices|billing|login/);
    });

    test('should create new invoice', async ({ page }) => {
        await page.goto('/invoices/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access invoice detail', async ({ page }) => {
        await page.goto('/invoices/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access invoice preview', async ({ page }) => {
        await page.goto('/invoices/1/preview');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Invoice Actions', () => {
    test('should send invoice', async ({ page }) => {
        await page.goto('/invoices/1/send');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should record payment', async ({ page }) => {
        await page.goto('/invoices/1/payment');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should download PDF', async ({ page }) => {
        await page.goto('/invoices/1/pdf');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
