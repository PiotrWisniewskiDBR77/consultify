/**
 * Visual Regression Tests
 * Uses Playwright for screenshot comparison
 */

import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('should match dashboard screenshot', async ({ page }) => {
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      threshold: 0.2, // 20% pixel difference allowed
    });
  });

  test('should match login page screenshot', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await expect(page).toHaveScreenshot('login.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('should match settings page screenshot', async ({ page }) => {
    await page.goto('http://localhost:3000/settings');
    await expect(page).toHaveScreenshot('settings.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });
});










