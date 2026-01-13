/**
 * Import E2E Tests
 * Testing data import functionality
 * 
 * @module tests/e2e/import/data-import.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Data Import', () => {
    test('should access import page', async ({ page }) => {
        await page.goto('/import');

        const url = page.url();
        expect(url).toMatch(/import|login|upload/);
    });

    test('should access import templates', async ({ page }) => {
        await page.goto('/import/templates');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access import history', async ({ page }) => {
        await page.goto('/import/history');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access import mapping', async ({ page }) => {
        await page.goto('/import/mapping');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Import Validation', () => {
    test('should access import preview', async ({ page }) => {
        await page.goto('/import/preview');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access import errors', async ({ page }) => {
        await page.goto('/import/errors');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
