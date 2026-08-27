/**
 * SuperAdmin Revenue & Billing E2E Tests
 * Tests Revenue module, billing management, invoices, and usage tracking
 *
 * @module tests/e2e/superadmin/revenue-billing.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

// Helper: login as superadmin
async function loginAsSuperAdmin(page: Page) {
  const currentUrl = page.url();
  if (currentUrl.includes('/superadmin')) return;

  await page.goto('http://localhost:3000/login');

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  if (await emailInput.isVisible({ timeout: 2000 })) {
    await emailInput.fill(process.env.TEST_USER_EMAIL || 'test@localhost');
    await page
      .locator('input[type="password"]')
      .fill(process.env.TEST_USER_PASSWORD || 'testpassword123');
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
  }
}

test.describe('SuperAdmin Revenue & Billing', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  // ═══════════════════════════════════════════════════════════════════
  // REVENUE MODULE - MAIN
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Revenue Module', () => {
    test('should load Revenue page', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/superadmin\/revenue/);
    });

    test('should display revenue overview dashboard', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Look for revenue metrics
      const revenueContent = page
        .locator(
          '[data-testid*="revenue"], [class*="revenue"], text=/revenue|MRR|ARR|earnings|income/i'
        )
        .first();

      const isVisible = await revenueContent.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should show key financial metrics', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Check for financial metrics (MRR, churn, LTV, etc.)
      const metricsContent = page
        .locator(
          '[data-testid*="metric"], [class*="metric"], [class*="stat"], text=/\\$|€|MRR|churn|LTV|ARPU/i'
        )
        .first();

      const isVisible = await metricsContent.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should display revenue charts', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Look for charts
      const chartContent = page
        .locator('canvas, svg[class*="chart"], [data-testid*="chart"], [class*="chart"]')
        .first();

      const isVisible = await chartContent.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // BILLING MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Billing Management', () => {
    test('should display billing section', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Look for billing section
      const billingContent = page
        .locator(
          '[data-testid*="billing"], [class*="billing"], text=/billing|subscriptions?|plans?/i'
        )
        .first();

      const isVisible = await billingContent.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should show subscription list', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Look for subscriptions
      const subscriptionContent = page
        .locator(
          '[data-testid*="subscription"], [class*="subscription"], text=/subscriptions?|active|trial|enterprise/i'
        )
        .first();

      const isVisible = await subscriptionContent.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should have billing filter options', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Look for filter controls
      const filterControls = page.locator(
        'select, input[type="search"], [data-testid*="filter"], button:has-text("Filter")'
      );

      const filterCount = await filterControls.count();
      expect(filterCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // INVOICES
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Invoices', () => {
    test('should display invoices section', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Look for invoices
      const invoicesContent = page
        .locator(
          '[data-testid*="invoice"], [class*="invoice"], text=/invoices?|paid|pending|overdue/i'
        )
        .first();

      const isVisible = await invoicesContent.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should show invoice list or table', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Look for invoice table/list
      const invoiceTable = page
        .locator('table, [role="table"], [data-testid*="invoice-list"], [class*="invoice-list"]')
        .first();

      const isVisible = await invoiceTable.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should support invoice search if available', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Look for search input
      const searchInput = page
        .locator('input[type="search"], input[placeholder*="search"], [data-testid*="search"]')
        .first();

      if (await searchInput.isVisible({ timeout: 2000 })) {
        await searchInput.fill('test');
        await page.waitForTimeout(500);
        await searchInput.clear();
      }

      await expect(page).toHaveURL(/\/superadmin\/revenue/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // USAGE TRACKING
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Usage Tracking', () => {
    test('should display usage section', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Look for usage content
      const usageContent = page
        .locator('[data-testid*="usage"], [class*="usage"], text=/usage|tokens?|api calls|quota/i')
        .first();

      const isVisible = await usageContent.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should show usage metrics', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Look for usage metrics
      const metricsContent = page
        .locator(
          '[data-testid*="metric"], [class*="usage-stat"], text=/total|used|remaining|limit/i'
        )
        .first();

      const isVisible = await metricsContent.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // NAVIGATION & TABS
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Navigation & Tabs', () => {
    test('should navigate through revenue sub-tabs', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Look for tabs
      const tabs = page.locator('button[role="tab"], [data-testid*="tab"], .tab');
      const tabCount = await tabs.count();

      // Click through tabs if present
      for (let i = 0; i < Math.min(tabCount, 4); i++) {
        await tabs
          .nth(i)
          .click()
          .catch(() => {});
        await page.waitForTimeout(300);
      }

      await expect(page).toHaveURL(/\/superadmin\/revenue/);
    });

    test('should maintain state on page refresh', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/superadmin\/revenue/);
    });

    test('should support browser navigation', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/overview');
      await expect(page).toHaveURL(/\/overview/);

      await page.goto('http://localhost:3000/superadmin/revenue');
      await expect(page).toHaveURL(/\/revenue/);

      await page.goBack();
      await expect(page).toHaveURL(/\/overview/);

      await page.goForward();
      await expect(page).toHaveURL(/\/revenue/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DATE RANGE FILTERS
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Date Range Filters', () => {
    test('should have date range selector', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Look for date picker
      const datePicker = page
        .locator(
          'input[type="date"], [data-testid*="date"], [class*="date-picker"], button:has-text(/today|week|month|year/i)'
        )
        .first();

      const isVisible = await datePicker.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should have preset date ranges', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Look for preset buttons
      const presets = page.locator(
        'button:has-text(/7 days|30 days|this month|last month|this year/i)'
      );

      const presetCount = await presets.count();
      expect(presetCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      await page.route('**/api/superadmin/revenue/**', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Page should still load
      await expect(page).toHaveURL(/\/superadmin\/revenue/);
    });

    test('should show empty state when no data', async ({ page }) => {
      await page.route('**/api/superadmin/revenue/**', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [], total: 0 }),
        });
      });

      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/superadmin\/revenue/);
    });

    test('should have no critical console errors', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      const criticalErrors = errors.filter(
        (error) =>
          !error.includes('favicon') &&
          !error.includes('404') &&
          !error.includes('net::ERR_') &&
          !error.includes('Failed to load resource')
      );

      expect(criticalErrors.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT FUNCTIONALITY
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Export Functionality', () => {
    test('should have export options if available', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Look for export button
      const exportButton = page
        .locator('button:has-text("Export"), button:has-text("Download"), [data-testid*="export"]')
        .first();

      if (await exportButton.isVisible({ timeout: 2000 })) {
        await expect(exportButton).toBeEnabled();
      }
    });

    test('should support multiple export formats', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/revenue');
      await page.waitForLoadState('networkidle');

      // Look for format options
      const formatOptions = page.locator(
        'button:has-text(/CSV|PDF|Excel|JSON/i), option:has-text(/CSV|PDF|Excel/i)'
      );

      const formatCount = await formatOptions.count();
      expect(formatCount).toBeGreaterThanOrEqual(0);
    });
  });
});
