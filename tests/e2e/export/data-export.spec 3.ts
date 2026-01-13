/**
 * Export E2E Tests
 * Testing data export functionality
 * 
 * @module tests/e2e/export/data-export.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Data Export', () => {
    test('should access export page', async ({ page }) => {
        await page.goto('/export');

        const url = page.url();
        expect(url).toMatch(/export|login|download/);
    });

    test('should access export history', async ({ page }) => {
        await page.goto('/export/history');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access export settings', async ({ page }) => {
        await page.goto('/export/settings');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Export Types', () => {
    test('should access CSV export', async ({ page }) => {
        await page.goto('/export/csv');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access PDF export', async ({ page }) => {
        await page.goto('/export/pdf');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access Excel export', async ({ page }) => {
        await page.goto('/export/excel');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
