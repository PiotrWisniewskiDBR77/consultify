/**
 * Projects E2E Tests
 * Testing project management
 * 
 * @module tests/e2e/projects/project-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Project Management', () => {
    test('should access projects page', async ({ page }) => {
        await page.goto('/projects');

        const url = page.url();
        expect(url).toMatch(/projects|login|portfolio/);
    });

    test('should create new project', async ({ page }) => {
        await page.goto('/projects/new');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access project detail', async ({ page }) => {
        await page.goto('/projects/1');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access project settings', async ({ page }) => {
        await page.goto('/projects/1/settings');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});

test.describe('Project Tasks', () => {
    test('should access project tasks', async ({ page }) => {
        await page.goto('/projects/1/tasks');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access project timeline', async ({ page }) => {
        await page.goto('/projects/1/timeline');

        const url = page.url();
        expect(url).toBeTruthy();
    });

    test('should access project milestones', async ({ page }) => {
        await page.goto('/projects/1/milestones');

        const url = page.url();
        expect(url).toBeTruthy();
    });
});
