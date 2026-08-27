import { test, expect } from '@playwright/test';

test.describe('Trial Management Flow', () => {
    test('should display trial status', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        await expect(page.locator('text=Trial Period')).toBeVisible();
        await expect(page.locator('.trial-banner')).toBeVisible();
        await expect(page.locator('text=days remaining')).toBeVisible();
    });

    test('should show upgrade prompts', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        // Trigger upgrade prompt by trying premium feature
        await page.goto('/advanced-analytics');
        await expect(page.locator('text=Upgrade to Premium')).toBeVisible();
        await expect(page.locator('button:has-text("Upgrade Now")')).toBeVisible();
    });

    test('should handle trial expiration', async ({ page }) => {
        // Simulate expired trial
        await page.addInitScript(() => {
            localStorage.setItem('trialExpired', 'true');
        });

        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[type="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');

        await expect(page.locator('text=Trial Expired')).toBeVisible();
        await expect(page.locator('button:has-text("Upgrade to Continue")')).toBeVisible();
    });
});














