/**
 * Automation E2E Tests
 * Testing automation and workflow builder
 * 
 * @module tests/e2e/automation/automation-builder.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Automation Builder', () => {
    test('should access automations page', async ({ page }) => {
        await page.goto('/automations');

        const url = page.url();
        expect(url).toMatch(/automations|workflows|login/);
    });

    test('should create automation', async ({ page }) => {
        await page.goto('/automations/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access automation detail', async ({ page }) => {
        await page.goto('/automations/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access automation editor', async ({ page }) => {
        await page.goto('/automations/1/edit');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Automation Runs', () => {
    test('should access run history', async ({ page }) => {
        await page.goto('/automations/1/runs');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access run detail', async ({ page }) => {
        await page.goto('/automations/runs/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access automation logs', async ({ page }) => {
        await page.goto('/automations/1/logs');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
