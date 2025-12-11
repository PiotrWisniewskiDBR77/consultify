import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test('should login successfully with valid credentials', async ({ page }) => {
        await page.goto('/');

        // Click "Log In" on Welcome Page
        await page.click('text=Log In');

        // Fill login form
        await page.fill('input[type="email"]', 'admin@dbr77.com');
        await page.fill('input[type="password"]', '123456');

        // Submit
        await page.click('button[type="submit"]');

        // Verify redirection to dashboard or home
        // Super Admin sees "System Overview" header
        await expect(page.locator('h1:has-text("System Overview")')).toBeVisible();
    });

    test('should show error with invalid credentials', async ({ page }) => {
        await page.goto('/');

        // Click "Log In" on Welcome Page
        await page.click('text=Log In');

        // Fill login form with bad data
        await page.fill('input[type="email"]', 'wrong@example.com');
        await page.fill('input[type="password"]', 'wrongpass');

        // Submit
        await page.click('button[type="submit"]');

        // Perform specific check for error message
        // Backend returns "User not found" for non-existent email
        await expect(page.locator('text=User not found')).toBeVisible();
    });

    test('should logout successfully', async ({ page }) => {
        // Login first
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', 'admin@dbr77.com');
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');
        await expect(page.locator('h1:has-text("System Overview")')).toBeVisible();

        // Perform logout
        await page.click('button:has-text("Log Out"), button[aria-label="Log Out"], .lucide-log-out');

        // Verify redirection to Welcome (Text: "Choose Your Transformation Path")
        await expect(page.locator('text=Transformation Path')).toBeVisible();
    });
});
