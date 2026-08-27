import { test, expect } from '@playwright/test';

test.describe('Roadmap Management Flow', () => {
    test('should create and manage project roadmap', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        await page.goto('/roadmap');

        // Create new roadmap item
        await page.click('button:has-text("Add Milestone")');
        await page.fill('input[name="title"]', 'Q1 Product Launch');
        await page.fill('input[name="description"]', 'Complete product launch preparation');
        await page.fill('input[name="targetDate"]', '2024-03-31');
        await page.selectOption('select[name="priority"]', 'high');
        await page.click('button:has-text("Create Milestone")');

        await expect(page.locator('text=Q1 Product Launch')).toBeVisible();

        // Add dependencies
        await page.click('text=Q1 Product Launch');
        await page.click('button:has-text("Add Dependency")');
        await page.fill('input[name="dependency"]', 'User Testing Complete');
        await page.click('button:has-text("Add")');

        await expect(page.locator('text=Depends on: User Testing Complete')).toBeVisible();
    });

    test('should display Gantt chart view', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        await page.goto('/roadmap');
        await page.click('button:has-text("Gantt View")');

        await expect(page.locator('.gantt-chart')).toBeVisible();
        await expect(page.locator('.gantt-bar')).toBeVisible();
    });

    test('should track roadmap progress', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        await page.goto('/roadmap');

        const firstMilestone = page.locator('.milestone-item').first();
        if (await firstMilestone.count() > 0) {
            await firstMilestone.click();
            await page.fill('input[name="progress"]', '75');
            await page.click('button:has-text("Update Progress")');

            await expect(page.locator('text=75%')).toBeVisible();
        }
    });
});














