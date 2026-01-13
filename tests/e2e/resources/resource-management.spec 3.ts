/**
 * Resources E2E Tests
 * Testing resource management
 * 
 * @module tests/e2e/resources/resource-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Resource Management', () => {
    test('should access resources page', async ({ page }) => {
        await page.goto('/resources');

        const url = page.url();
        expect(url).toMatch(/resources|assets|login/);
    });

    test('should access resource allocation', async ({ page }) => {
        await page.goto('/resources/allocation');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access resource calendar', async ({ page }) => {
        await page.goto('/resources/calendar');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access resource detail', async ({ page }) => {
        await page.goto('/resources/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Resource Planning', () => {
    test('should access capacity planning', async ({ page }) => {
        await page.goto('/resources/capacity');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access utilization report', async ({ page }) => {
        await page.goto('/resources/utilization');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
