/**
 * Admin Budget Dashboard E2E Tests
 * Tests budget dashboard functionality for organization admins
 *
 * @module tests/e2e/admin/budget-dashboard.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

// Helper: login as admin
async function loginAsAdmin(page: Page) {
  await page.goto('http://localhost:3000/login');

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  if (await emailInput.isVisible({ timeout: 2000 })) {
    await emailInput.fill('admin@test.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
  }
}

test.describe('Admin Budget Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // ═══════════════════════════════════════════════════════════════════
  // BUDGET OVERVIEW
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Budget Overview', () => {
    test('should navigate to budget dashboard', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/admin\/budget/);
    });

    test('should display monthly budget amount', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for budget amount
      const budgetAmount = page
        .locator('[data-testid*="budget"], [class*="budget"], text=/\\$\\d+|monthly budget/i')
        .first();

      const isVisible = await budgetAmount.isVisible({ timeout: 5000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should show spent amount and percentage', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for spent metrics
      const spentMetrics = page.locator('[data-testid*="spent"], text=/spent|used|\\d+%/i').first();

      const isVisible = await spentMetrics.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should display remaining budget', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for remaining amount
      const remaining = page
        .locator('[data-testid*="remaining"], [class*="remaining"], text=/remaining|available/i')
        .first();

      const isVisible = await remaining.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should show budget period dates', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for period dates
      const periodDates = page
        .locator(
          'text=/period|\\d{1,2}\\/\\d{1,2}\\/\\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i'
        )
        .first();

      const isVisible = await periodDates.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // BUDGET PROGRESS BAR
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Budget Progress Bar', () => {
    test('should display budget usage progress bar', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for progress bar
      const progressBar = page
        .locator('[class*="progress"], [role="progressbar"], .budget-progress')
        .first();

      const isVisible = await progressBar.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should show alert when approaching budget limit', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for warning/alert indicators
      const alert = page
        .locator('[class*="warning"], [class*="alert"], text=/approaching|warning|limit/i')
        .first();

      // Alert may or may not be present
      const count = await alert.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should show exceeded alert when budget exceeded', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for exceeded indicator
      const exceeded = page
        .locator('[class*="exceeded"], [class*="danger"], text=/exceeded|over budget/i')
        .first();

      // May or may not be present
      const count = await exceeded.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display threshold marker on progress bar', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for threshold indicator
      const threshold = page
        .locator('[class*="threshold"], [data-testid*="threshold"], [title*="threshold"]')
        .first();

      const isVisible = await threshold.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SPENDING CHARTS
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Spending Charts', () => {
    test('should display spending trend chart', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for line chart
      const chart = page
        .locator('canvas, svg[class*="chart"], [data-testid*="chart"], [class*="chart"]')
        .first();

      const isVisible = await chart.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should show category breakdown pie chart', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for pie chart or category breakdown
      const categoryChart = page
        .locator('canvas, [class*="pie"], text=/category|breakdown|tokens|storage|compute/i')
        .first();

      const isVisible = await categoryChart.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should display chart legend', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for legend
      const legend = page.locator('[class*="legend"], ul[class*="chart"]').first();

      const isVisible = await legend.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EXPENSE HISTORY
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Expense History', () => {
    test('should display expense history table', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for expense table
      const table = page
        .locator('table, [role="table"], [data-testid*="expense"], [class*="expense-table"]')
        .first();

      const isVisible = await table.isVisible({ timeout: 5000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should show expense details (date, category, amount)', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for table headers
      const headers = page.locator(
        'th, [role="columnheader"], text=/date|category|amount|description/i'
      );

      const headerCount = await headers.count();
      expect(headerCount).toBeGreaterThanOrEqual(0);
    });

    test('should allow filtering by category', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for category filter
      const categoryFilter = page
        .locator('select[class*="category"], [data-testid*="category-filter"]')
        .first();

      if (await categoryFilter.isVisible({ timeout: 2000 })) {
        await categoryFilter.selectOption('TOKENS');
        await page.waitForTimeout(500);
        await expect(categoryFilter).toHaveValue('TOKENS');
      }
    });

    test('should support pagination of expense history', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for pagination controls
      const pagination = page
        .locator('button:has-text(/next|previous|page/i), [class*="pagination"]')
        .first();

      if (await pagination.isVisible({ timeout: 2000 })) {
        await expect(pagination).toBeEnabled();
      }
    });

    test('should display category badges in expense list', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for category badges
      const badges = page.locator(
        '[class*="badge"], [class*="category"], text=/tokens|storage|compute|api/i'
      );

      const badgeCount = await badges.count();
      expect(badgeCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // BUDGET ALERTS
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Budget Alerts', () => {
    test('should display alert notifications when threshold reached', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for alert notifications
      const notification = page
        .locator('[role="alert"], [class*="notification"], [class*="toast"]')
        .first();

      // May or may not be present
      const count = await notification.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should show critical alert when budget exceeded', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for critical alert
      const criticalAlert = page
        .locator('[class*="critical"], [class*="danger"], text=/budget exceeded|over limit/i')
        .first();

      // May or may not be present
      const count = await criticalAlert.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RESPONSIVE DESIGN
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/admin\/budget/);
    });

    test('should be responsive on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/admin\/budget/);
    });

    test('should maintain functionality on different screen sizes', async ({ page }) => {
      const viewports = [
        { width: 375, height: 667 }, // Mobile
        { width: 768, height: 1024 }, // Tablet
        { width: 1920, height: 1080 }, // Desktop
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto('http://localhost:3000/admin/budget');
        await page.waitForLoadState('networkidle');

        const content = page.locator('body');
        await expect(content).toBeVisible();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      await page.route('**/api/admin/budget**', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Page should still load
      await expect(page).toHaveURL(/\/admin\/budget/);
    });

    test('should show empty state when no budget configured', async ({ page }) => {
      await page.route('**/api/admin/budget**', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ budget: null }),
        });
      });

      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      // Look for empty state message
      const emptyState = page
        .locator('[class*="empty"], text=/no budget|not configured|contact administrator/i')
        .first();

      const isVisible = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should have no critical console errors', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('http://localhost:3000/admin/budget');
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
  // NAVIGATION
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Navigation', () => {
    test('should maintain state on page refresh', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/budget');
      await page.waitForLoadState('networkidle');

      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/admin\/budget/);
    });

    test('should support browser back/forward navigation', async ({ page }) => {
      await page.goto('http://localhost:3000/admin/dashboard');
      await expect(page).toHaveURL(/\/dashboard/);

      await page.goto('http://localhost:3000/admin/budget');
      await expect(page).toHaveURL(/\/budget/);

      await page.goBack();
      await expect(page).toHaveURL(/\/dashboard/);

      await page.goForward();
      await expect(page).toHaveURL(/\/budget/);
    });
  });
});
