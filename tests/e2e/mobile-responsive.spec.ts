import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'parallel' });

test.describe('Mobile Responsiveness', () => {
  // iPhone 12 Pro Viewport
  test.use({ viewport: { width: 390, height: 844 } });

  test('should preserve canonical landing navigation on mobile devices (iPhone 12 Pro)', async ({
    page,
  }) => {
    await page.goto('/');

    const hamburger = page.getByTestId('landing-mobile-menu-trigger');
    await expect(hamburger).toBeVisible();

    await hamburger.click();
    const mobilePanel = page.getByTestId('landing-mobile-menu-panel');
    await expect(mobilePanel).toBeVisible();

    await expect(mobilePanel.getByRole('button', { name: 'Home' })).toBeVisible();
    await expect(mobilePanel.getByRole('button', { name: 'Pricing' })).toBeVisible();
    await expect(mobilePanel.getByRole('button', { name: 'Become Partner' })).toBeVisible();
    await expect(mobilePanel.getByRole('button', { name: 'Log in' })).toBeVisible();

    await mobilePanel.getByRole('button', { name: 'Pricing' }).click();
    await page.waitForURL(/\/pricing$/);
  });
});

test.describe('Mobile Viewport (Pixel 5)', () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test('should prevent horizontal scroll on main views', async ({ page }) => {
    await page.goto('/');

    // Evaluation of scroll width vs client width
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);

    // Allow small tolerance for scrollbars
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
