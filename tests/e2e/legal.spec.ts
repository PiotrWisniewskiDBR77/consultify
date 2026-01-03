import { test, expect } from '@playwright/test';

test.describe('Legal Compliance Flow', () => {
    test('should display legal documents', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', 'admin@dbr77.com');
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');

        await page.goto('/legal');

        await expect(page.locator('text=Terms of Service')).toBeVisible();
        await expect(page.locator('text=Privacy Policy')).toBeVisible();
        await expect(page.locator('text=Data Processing Agreement')).toBeVisible();
    });

    test('should handle GDPR compliance', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', 'admin@dbr77.com');
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');

        await page.goto('/settings');
        await page.click('text=Privacy');

        await expect(page.locator('text=GDPR Compliance')).toBeVisible();
        await expect(page.locator('button:has-text("Download My Data")')).toBeVisible();
        await expect(page.locator('button:has-text("Delete My Account")')).toBeVisible();
    });

    test('should track consent management', async ({ page }) => {
        await page.goto('/');
        await page.click('text=Log In');
        await page.fill('input[type="email"]', 'admin@dbr77.com');
        await page.fill('input[type="password"]', '123456');
        await page.click('button[type="submit"]');

        await page.goto('/settings');
        await page.click('text=Privacy');
        await page.click('text=Consent Preferences');

        // Marketing consent
        await page.check('input[name="marketingConsent"]');
        await page.click('button:has-text("Save Preferences")');

        await expect(page.locator('text=Preferences saved')).toBeVisible();
    });
});







