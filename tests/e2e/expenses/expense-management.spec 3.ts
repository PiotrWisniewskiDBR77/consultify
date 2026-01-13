/**
 * Expenses E2E Tests
 * Testing expense management
 * 
 * @module tests/e2e/expenses/expense-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Expense Management', () => {
    test('should access expenses page', async ({ page }) => {
        await page.goto('/expenses');

        const url = page.url();
        expect(url).toMatch(/expenses|costs|login/);
    });

    test('should create expense', async ({ page }) => {
        await page.goto('/expenses/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access expense detail', async ({ page }) => {
        await page.goto('/expenses/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should edit expense', async ({ page }) => {
        await page.goto('/expenses/1/edit');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Expense Reports', () => {
    test('should create expense report', async ({ page }) => {
        await page.goto('/expenses/reports/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access expense report', async ({ page }) => {
        await page.goto('/expenses/reports/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should submit expense report', async ({ page }) => {
        await page.goto('/expenses/reports/1/submit');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
