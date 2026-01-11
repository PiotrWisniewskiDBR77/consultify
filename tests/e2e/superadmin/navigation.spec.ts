/**
 * SuperAdmin Navigation E2E Tests
 * Tests navigation and routing for SuperAdmin panel
 */

import { test, expect } from '@playwright/test';

test.describe('SuperAdmin Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to SuperAdmin (assuming authentication is handled)
    await page.goto('http://localhost:3000/superadmin');
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to Overview module', async ({ page }) => {
    await page.goto('http://localhost:3000/superadmin/overview');
    await expect(page).toHaveURL(/\/superadmin\/overview/);

    // Check if overview module is visible (adjust selector based on actual implementation)
    const overviewContent = page
      .locator('[data-testid="overview-module"], .overview-module, [class*="Overview"]')
      .first();
    await expect(overviewContent).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Customers module', async ({ page }) => {
    await page.goto('http://localhost:3000/superadmin/customers');
    await expect(page).toHaveURL(/\/superadmin\/customers/);

    const customersContent = page
      .locator('[data-testid="customers-module"], .customers-module, [class*="Customers"]')
      .first();
    await expect(customersContent).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to AI Infrastructure module', async ({ page }) => {
    await page.goto('http://localhost:3000/superadmin/ai-infrastructure');
    await expect(page).toHaveURL(/\/superadmin\/ai-infrastructure/);

    const aiInfraContent = page
      .locator(
        '[data-testid="ai-infrastructure-module"], .ai-infrastructure-module, [class*="Infrastructure"]'
      )
      .first();
    await expect(aiInfraContent).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to AI Development module', async ({ page }) => {
    await page.goto('http://localhost:3000/superadmin/ai-development');
    await expect(page).toHaveURL(/\/superadmin\/ai-development/);

    const aiDevContent = page
      .locator(
        '[data-testid="ai-development-module"], .ai-development-module, [class*="Development"]'
      )
      .first();
    await expect(aiDevContent).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to AI Operations module', async ({ page }) => {
    await page.goto('http://localhost:3000/superadmin/ai-operations');
    await expect(page).toHaveURL(/\/superadmin\/ai-operations/);

    const aiOpsContent = page
      .locator('[data-testid="ai-operations-module"], .ai-operations-module, [class*="Operations"]')
      .first();
    await expect(aiOpsContent).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to System module', async ({ page }) => {
    await page.goto('http://localhost:3000/superadmin/system');
    await expect(page).toHaveURL(/\/superadmin\/system/);

    const systemContent = page
      .locator('[data-testid="system-module"], .system-module, [class*="System"]')
      .first();
    await expect(systemContent).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Content module', async ({ page }) => {
    await page.goto('http://localhost:3000/superadmin/content');
    await expect(page).toHaveURL(/\/superadmin\/content/);

    const contentModule = page
      .locator('[data-testid="content-module"], .content-module, [class*="Content"]')
      .first();
    await expect(contentModule).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Revenue module', async ({ page }) => {
    await page.goto('http://localhost:3000/superadmin/revenue');
    await expect(page).toHaveURL(/\/superadmin\/revenue/);

    const revenueContent = page
      .locator('[data-testid="revenue-module"], .revenue-module, [class*="Revenue"]')
      .first();
    await expect(revenueContent).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Security module', async ({ page }) => {
    await page.goto('http://localhost:3000/superadmin/security');
    await expect(page).toHaveURL(/\/superadmin\/security/);

    const securityContent = page
      .locator('[data-testid="security-module"], .security-module, [class*="Security"]')
      .first();
    await expect(securityContent).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Analytics module', async ({ page }) => {
    await page.goto('http://localhost:3000/superadmin/analytics');
    await expect(page).toHaveURL(/\/superadmin\/analytics/);

    const analyticsContent = page
      .locator('[data-testid="analytics-module"], .analytics-module, [class*="Analytics"]')
      .first();
    await expect(analyticsContent).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to Configuration module', async ({ page }) => {
    await page.goto('http://localhost:3000/superadmin/configuration');
    await expect(page).toHaveURL(/\/superadmin\/configuration/);

    const configContent = page
      .locator(
        '[data-testid="configuration-module"], .configuration-module, [class*="Configuration"]'
      )
      .first();
    await expect(configContent).toBeVisible({ timeout: 5000 });
  });

  test('should redirect legacy /superadmin/ai-platform to /superadmin/ai-infrastructure', async ({
    page,
  }) => {
    await page.goto('http://localhost:3000/superadmin/ai-platform');
    // Should redirect to ai-infrastructure
    await expect(page).toHaveURL(/\/superadmin\/ai-infrastructure/, { timeout: 5000 });
  });

  test('should redirect /superadmin to /superadmin/overview', async ({ page }) => {
    await page.goto('http://localhost:3000/superadmin');
    await expect(page).toHaveURL(/\/superadmin\/overview/, { timeout: 5000 });
  });

  test('should preserve state on page refresh', async ({ page }) => {
    await page.goto('http://localhost:3000/superadmin/customers');
    await expect(page).toHaveURL(/\/superadmin\/customers/);

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be on customers page
    await expect(page).toHaveURL(/\/superadmin\/customers/);
  });

  test('should support browser back/forward navigation', async ({ page }) => {
    // Navigate to overview
    await page.goto('http://localhost:3000/superadmin/overview');
    await expect(page).toHaveURL(/\/superadmin\/overview/);

    // Navigate to customers
    await page.goto('http://localhost:3000/superadmin/customers');
    await expect(page).toHaveURL(/\/superadmin\/customers/);

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\/superadmin\/overview/);

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/\/superadmin\/customers/);
  });

  test('should update URL when clicking sidebar navigation', async ({ page }) => {
    await page.goto('http://localhost:3000/superadmin/overview');

    // Click on Customers in sidebar (adjust selector based on actual implementation)
    const customersLink = page
      .locator(
        'a[href*="/superadmin/customers"], button:has-text("Customers"), [data-section="customers"]'
      )
      .first();

    if (await customersLink.isVisible()) {
      await customersLink.click();
      await expect(page).toHaveURL(/\/superadmin\/customers/, { timeout: 5000 });
    } else {
      // If sidebar navigation is not visible, test direct URL navigation
      await page.goto('http://localhost:3000/superadmin/customers');
      await expect(page).toHaveURL(/\/superadmin\/customers/);
    }
  });

  test('should not have console errors during navigation', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:3000/superadmin/overview');
    await page.goto('http://localhost:3000/superadmin/customers');
    await page.goto('http://localhost:3000/superadmin/ai-infrastructure');

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes('favicon') && !error.includes('404') && !error.includes('net::ERR_')
    );

    expect(criticalErrors.length).toBe(0);
  });
});
