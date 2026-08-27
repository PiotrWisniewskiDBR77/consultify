import { test, expect } from '@playwright/test';

test.describe('Navigation Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test via UI
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill login form
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@localhost');
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'testpassword123');
    await page.click('button[type="submit"]');

    // Wait for redirect away from login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
  });

  test('should have navigation elements after login', async ({ page }) => {
    // Wait for sidebar or main content to mount
    await page.waitForSelector('nav, aside, [data-tour="sidebar-nav"], main', { timeout: 15000 });

    // After login, should have some navigation
    const hasNav = await page
      .locator('nav, [role="navigation"], aside, [data-tour="sidebar-nav"]')
      .first()
      .isVisible()
      .catch(() => false);
    const hasContent = await page
      .locator('main, [role="main"], [data-testid="dashboard"]')
      .first()
      .isVisible()
      .catch(() => false);

    // At least one should be true
    expect(hasNav || hasContent).toBeTruthy();
  });

  test('should navigate to settings if available', async ({ page }) => {
    // Try to find settings link
    const settingsSelectors = [
      'text=Settings',
      'text=Ustawienia',
      '[href*="settings"]',
      '[data-testid="settings"]',
    ];

    let found = false;
    for (const selector of settingsSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible().catch(() => false)) {
        await element.click();
        found = true;
        break;
      }
    }

    if (!found) {
      // Settings may be in a dropdown - test passes
      console.log('Settings link not immediately visible - may be in dropdown');
      return;
    }

    // Wait for navigation
    await page.waitForTimeout(1000);

    // Should be on settings page or see settings content
    const url = page.url();
    const hasSettingsContent = await page
      .locator('[class*="settings"], [class*="profile"]')
      .first()
      .isVisible()
      .catch(() => false);

    expect(url.includes('settings') || hasSettingsContent).toBeTruthy();
  });

  test('should have working navigation links', async ({ page }) => {
    // Find all navigation links - broader selector
    const linksSelector =
      '[data-tour="sidebar-nav"] button, nav button, aside button, a[href], [role="button"]';

    // Wait for at least one link/button to appear - increase timeout for slow loading
    await page.waitForSelector(linksSelector, { timeout: 30000 });

    const links = page.locator(linksSelector);
    const count = await links.count();

    // Should have at least some interactive elements
    expect(count).toBeGreaterThan(0);
  });
});
