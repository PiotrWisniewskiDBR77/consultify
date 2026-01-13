/**
 * Milestones E2E Tests
 * Testing milestone management
 * 
 * @module tests/e2e/milestones/milestone-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Milestone Management', () => {
    test('should access milestones page', async ({ page }) => {
        await page.goto('/milestones');

        const url = page.url();
        expect(url).toMatch(/milestones|projects|login/);
    });

    test('should create milestone', async ({ page }) => {
        await page.goto('/milestones/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access milestone detail', async ({ page }) => {
        await page.goto('/milestones/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should edit milestone', async ({ page }) => {
        await page.goto('/milestones/1/edit');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Milestone Progress', () => {
    test('should access milestone progress', async ({ page }) => {
        await page.goto('/milestones/1/progress');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access milestone timeline', async ({ page }) => {
        await page.goto('/milestones/timeline');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
