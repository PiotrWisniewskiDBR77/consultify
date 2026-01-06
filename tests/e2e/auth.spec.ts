import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test('should login successfully with valid credentials', async ({ page }) => {
        await page.goto('/login');
        
        // Wait for page to load
        await page.waitForLoadState('networkidle');

        // Fill login form
        await page.waitForSelector('input[type="email"]');
        await page.fill('input[type="email"]', 'admin@dbr77.com');
        await page.fill('input[type="password"]', 'Admin123!');

        // Submit
        await page.click('button[type="submit"]');

        // Verify redirection to dashboard or home
        await expect(page.getByRole('heading', { name: /system overview|dashboard/i })).toBeVisible({ timeout: 20000 });
    });

    test('should show error with invalid credentials', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        // Fill login form with bad data
        await page.waitForSelector('input[type="email"]');
        await page.fill('input[type="email"]', 'wrong@example.com');
        await page.fill('input[type="password"]', 'wrongpass');

        // Submit
        await page.click('button[type="submit"]');

        // Perform specific check for error message
        await expect(page.locator('text=User not found, text=Invalid email or password, .error-message').first()).toBeVisible({ timeout: 10000 });
    });

    test('should logout successfully', async ({ page }) => {
        // Login first
        await page.goto('/login');
        await page.waitForLoadState('networkidle');
        
        await page.waitForSelector('input[type="email"]');
        await page.fill('input[type="email"]', 'admin@dbr77.com');
        await page.fill('input[type="password"]', 'Admin123!');
        await page.click('button[type="submit"]');
        await expect(page.getByRole('heading', { name: /system overview|dashboard/i })).toBeVisible({ timeout: 20000 });

        // Perform logout
        const logoutButton = page.locator('button:has-text("Log Out"), button:has-text("Log out"), button[aria-label="Log Out"], .lucide-log-out').first();
        await logoutButton.click();

        // Verify redirection to Welcome
        await expect(page.getByText(/Transformation Path|Log in/i).first()).toBeVisible({ timeout: 10000 });
    });
});
