import { test, expect } from '@playwright/test';

test.describe('Analytics Dashboard Flow', () => {
    test('should display analytics overview', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        await page.goto('/analytics');

        await expect(page.locator('text=Analytics Dashboard')).toBeVisible();
        await expect(page.locator('.metric-cards')).toBeVisible();
        await expect(page.locator('.charts-container')).toBeVisible();
    });

    test('should filter analytics by date range', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        await page.goto('/analytics');

        await page.fill('input[name="startDate"]', '2024-01-01');
        await page.fill('input[name="endDate"]', '2024-12-31');
        await page.click('button:has-text("Apply Filters")');

        await expect(page.locator('text=Data from Jan 1 - Dec 31, 2024')).toBeVisible();
    });

    test('should export analytics reports', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        await page.goto('/analytics');
        await page.click('button:has-text("Export")');
        await page.selectOption('select[name="format"]', 'pdf');
        await page.click('button:has-text("Generate Report")');

        await expect(page.locator('text=Report generated')).toBeVisible();
    });
});














