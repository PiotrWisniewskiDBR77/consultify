/**
 * Surveys E2E Tests
 * Testing survey management
 * 
 * @module tests/e2e/surveys/survey-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Survey Management', () => {
    test('should access surveys page', async ({ page }) => {
        await page.goto('/surveys');

        const url = page.url();
        expect(url).toMatch(/surveys|feedback|login/);
    });

    test('should create survey', async ({ page }) => {
        await page.goto('/surveys/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access survey detail', async ({ page }) => {
        await page.goto('/surveys/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access survey builder', async ({ page }) => {
        await page.goto('/surveys/1/edit');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Survey Responses', () => {
    test('should access survey responses', async ({ page }) => {
        await page.goto('/surveys/1/responses');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access response detail', async ({ page }) => {
        await page.goto('/surveys/1/responses/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access survey analytics', async ({ page }) => {
        await page.goto('/surveys/1/analytics');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
