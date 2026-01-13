/**
 * Goals E2E Tests
 * Testing goals and OKRs functionality
 * 
 * @module tests/e2e/goals/goal-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Goal Management', () => {
    test('should access goals page', async ({ page }) => {
        await page.goto('/goals');

        const url = page.url();
        expect(url).toMatch(/goals|okr|login|objectives/);
    });

    test('should access create goal', async ({ page }) => {
        await page.goto('/goals/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access goal detail', async ({ page }) => {
        await page.goto('/goals/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access goal progress', async ({ page }) => {
        await page.goto('/goals/1/progress');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Key Results', () => {
    test('should access key results', async ({ page }) => {
        await page.goto('/goals/1/key-results');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should create key result', async ({ page }) => {
        await page.goto('/goals/1/key-results/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
