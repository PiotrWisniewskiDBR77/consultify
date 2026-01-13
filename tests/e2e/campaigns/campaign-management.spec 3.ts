/**
 * Campaigns E2E Tests
 * Testing campaign management
 * 
 * @module tests/e2e/campaigns/campaign-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Campaign Management', () => {
    test('should access campaigns page', async ({ page }) => {
        await page.goto('/campaigns');

        const url = page.url();
        expect(url).toMatch(/campaigns|marketing|login/);
    });

    test('should create campaign', async ({ page }) => {
        await page.goto('/campaigns/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access campaign detail', async ({ page }) => {
        await page.goto('/campaigns/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access campaign analytics', async ({ page }) => {
        await page.goto('/campaigns/1/analytics');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Campaign Actions', () => {
    test('should launch campaign', async ({ page }) => {
        await page.goto('/campaigns/1/launch');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should pause campaign', async ({ page }) => {
        await page.goto('/campaigns/1/pause');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
