import { test, expect } from '@playwright/test';

test('Level 4: E2E - App Loads', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    // Note: Adjust the expected title based on actual index.html
    await expect(page).toHaveTitle(/Consultify|Vite/i);
});
