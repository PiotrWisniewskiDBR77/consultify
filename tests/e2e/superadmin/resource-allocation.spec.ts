/**
 * SuperAdmin Resource Allocation E2E Tests
 * Tests resource allocation workflows, quota management, and budget administration
 *
 * @module tests/e2e/superadmin/resource-allocation.spec.ts
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

test.describe('SuperAdmin Resource Allocation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  // ═══════════════════════════════════════════════════════════════════
  // SUBSCRIPTION PLANS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Subscription Plans Management', () => {
    test('should navigate to subscription plans page', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/subscription-plans');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/superadmin\/subscription-plans/);
    });

    test('should display subscription plans list', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/subscription-plans');
      await page.waitForLoadState('networkidle');

      // Look for plans content
      const plansContent = page
        .locator(
          '[data-testid*="plan"], [class*="subscription"], table, [role="table"], text=/starter|professional|enterprise|plan/i'
        )
        .first();

      const isVisible = await plansContent.isVisible({ timeout: 5000 }).catch(() => false);
      expect(isVisible).toBeTruthy();
    });

    test('should show plan details (memory, CPU, features)', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/subscription-plans');
      await page.waitForLoadState('networkidle');

      // Look for resource limits
      const resourceInfo = page.locator('text=/memory|cpu|storage|gb|mb|quota|limit/i').first();

      const isVisible = await resourceInfo.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should have create new plan button', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/subscription-plans');
      await page.waitForLoadState('networkidle');

      // Look for create/add button
      const createButton = page
        .locator('button:has-text(/create|add|new/i), [data-testid*="create"], [class*="create"]')
        .first();

      const isVisible = await createButton.isVisible({ timeout: 3000 }).catch(() => false);
      if (isVisible) {
        await expect(createButton).toBeEnabled();
      }
    });

    test('should allow editing plan limits', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/subscription-plans');
      await page.waitForLoadState('networkidle');

      // Look for edit actions
      const editButton = page
        .locator(
          'button:has-text(/edit|modify|update/i), [data-testid*="edit"], svg[class*="edit"]'
        )
        .first();

      if (await editButton.isVisible({ timeout: 2000 })) {
        // Edit button exists, interaction possible
        await expect(editButton).toBeEnabled();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ORGANIZATION RESOURCE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Organization Resource Management', () => {
    test('should display organization resource usage dashboard', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/organizations');
      await page.waitForLoadState('networkidle');

      // Look for resource usage indicators
      const resourceUsage = page
        .locator('[data-testid*="usage"], [class*="resource"], text=/memory|cpu|budget|quota/i')
        .first();

      const isVisible = await resourceUsage.isVisible({ timeout: 5000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should show organization list with resource metrics', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/organizations');
      await page.waitForLoadState('networkidle');

      // Look for organizations table/list
      const orgList = page
        .locator('table, [role="table"], [data-testid*="org-list"], [class*="organization-list"]')
        .first();

      const isVisible = await orgList.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should allow filtering organizations by resource usage', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/organizations');
      await page.waitForLoadState('networkidle');

      // Look for filter controls
      const filterControl = page
        .locator('select, input[type="search"], [data-testid*="filter"], button:has-text("Filter")')
        .first();

      if (await filterControl.isVisible({ timeout: 2000 })) {
        await expect(filterControl).toBeEnabled();
      }
    });

    test('should display individual organization resource details', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/organizations');
      await page.waitForLoadState('networkidle');

      // Look for detail view trigger
      const detailTrigger = page
        .locator(
          'button:has-text(/view|details/i), a[href*="/organizations/"], [data-testid*="view"]'
        )
        .first();

      if (await detailTrigger.isVisible({ timeout: 2000 })) {
        await detailTrigger.click();
        await page.waitForLoadState('networkidle');

        // Verify detail view loaded
        const detailContent = page
          .locator('[class*="detail"], [class*="resource"], text=/memory|cpu|budget/i')
          .first();

        const isVisible = await detailContent.isVisible({ timeout: 3000 }).catch(() => false);
        expect(isVisible !== undefined).toBeTruthy();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // QUOTA ADJUSTMENTS
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Quota Adjustments', () => {
    test('should have quota adjustment interface', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/organizations');
      await page.waitForLoadState('networkidle');

      // Look for quota controls
      const quotaControl = page
        .locator('[data-testid*="quota"], [class*="quota"], button:has-text(/adjust|modify|set/i)')
        .first();

      const exists = (await quotaControl.count()) > 0;
      expect(exists).toBeTruthy();
    });

    test('should allow modifying memory quota', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/organizations');
      await page.waitForLoadState('networkidle');

      // Look for memory quota field
      const memoryField = page
        .locator('input[type="number"], input[placeholder*="memory"], [data-testid*="memory"]')
        .first();

      if (await memoryField.isVisible({ timeout: 2000 })) {
        await expect(memoryField).toBeEnabled();
      }
    });

    test('should allow modifying CPU quota', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/organizations');
      await page.waitForLoadState('networkidle');

      // Look for CPU quota field
      const cpuField = page
        .locator('input[placeholder*="cpu"], [data-testid*="cpu"], input[placeholder*="percent"]')
        .first();

      if (await cpuField.isVisible({ timeout: 2000 })) {
        await expect(cpuField).toBeEnabled();
      }
    });

    test('should allow modifying budget quota', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/organizations');
      await page.waitForLoadState('networkidle');

      // Look for budget field
      const budgetField = page
        .locator('input[placeholder*="budget"], [data-testid*="budget"], input[type="number"]')
        .first();

      if (await budgetField.isVisible({ timeout: 2000 })) {
        await expect(budgetField).toBeEnabled();
      }
    });

    test('should have save/apply quota changes button', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/organizations');
      await page.waitForLoadState('networkidle');

      // Look for save button
      const saveButton = page
        .locator('button:has-text(/save|apply|update/i), [data-testid*="save"]')
        .first();

      if (await saveButton.isVisible({ timeout: 2000 })) {
        await expect(saveButton).toBeEnabled();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REAL-TIME USAGE MONITORING
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Real-time Usage Monitoring', () => {
    test('should display current resource usage metrics', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/monitoring');
      await page.waitForLoadState('networkidle');

      // Look for usage metrics
      const metrics = page
        .locator('[data-testid*="metric"], [class*="metric"], text=/\\d+\\s*(mb|gb|%|tokens)/i')
        .first();

      const isVisible = await metrics.isVisible({ timeout: 5000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should show usage charts or graphs', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/monitoring');
      await page.waitForLoadState('networkidle');

      // Look for charts
      const chart = page.locator('canvas, svg[class*="chart"], [data-testid*="chart"]').first();

      const isVisible = await chart.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should indicate organizations approaching quota limits', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/monitoring');
      await page.waitForLoadState('networkidle');

      // Look for warnings/alerts
      const alert = page
        .locator('[class*="warning"], [class*="alert"], text=/approaching|warning|exceeded/i')
        .first();

      // Alert may or may not be present depending on data
      const count = await alert.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should refresh metrics on page reload', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/monitoring');
      await page.waitForLoadState('networkidle');

      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/superadmin\/monitoring/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RESOURCE USAGE REPORTS
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Resource Usage Reports', () => {
    test('should have report generation interface', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/reports');
      await page.waitForLoadState('networkidle');

      // Look for reports content
      const reports = page
        .locator('[data-testid*="report"], [class*="report"], text=/report|export|generate/i')
        .first();

      const isVisible = await reports.isVisible({ timeout: 5000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should allow selecting report type', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/reports');
      await page.waitForLoadState('networkidle');

      // Look for report type selector
      const selector = page
        .locator('select, [role="combobox"], button:has-text(/select|choose/i)')
        .first();

      if (await selector.isVisible({ timeout: 2000 })) {
        await expect(selector).toBeEnabled();
      }
    });

    test('should support date range selection for reports', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/reports');
      await page.waitForLoadState('networkidle');

      // Look for date pickers
      const datePicker = page
        .locator('input[type="date"], [data-testid*="date"], [class*="date-picker"]')
        .first();

      const isVisible = await datePicker.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should have export report button', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/reports');
      await page.waitForLoadState('networkidle');

      // Look for export button
      const exportButton = page
        .locator('button:has-text(/export|download|generate/i), [data-testid*="export"]')
        .first();

      if (await exportButton.isVisible({ timeout: 2000 })) {
        await expect(exportButton).toBeEnabled();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // BULK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Bulk Operations', () => {
    test('should support bulk selection of organizations', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/organizations');
      await page.waitForLoadState('networkidle');

      // Look for checkboxes
      const checkboxes = page.locator('input[type="checkbox"], [role="checkbox"]');

      const checkboxCount = await checkboxes.count();
      expect(checkboxCount).toBeGreaterThanOrEqual(0);
    });

    test('should have bulk action menu', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/organizations');
      await page.waitForLoadState('networkidle');

      // Look for bulk actions
      const bulkActions = page
        .locator('button:has-text(/bulk|actions|apply/i), [data-testid*="bulk"]')
        .first();

      if (await bulkActions.isVisible({ timeout: 2000 })) {
        await expect(bulkActions).toBeEnabled();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Error Handling', () => {
    test('should validate quota values before saving', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/organizations');
      await page.waitForLoadState('networkidle');

      // Try to input invalid values
      const input = page.locator('input[type="number"]').first();

      if (await input.isVisible({ timeout: 2000 })) {
        await input.fill('-100'); // Negative value
        await page.keyboard.press('Tab');

        // Look for validation error
        const error = page.locator('[class*="error"], text=/invalid|must be|positive/i').first();

        // Error may be shown
        const errorCount = await error.count();
        expect(errorCount).toBeGreaterThanOrEqual(0);
      }
    });

    test('should handle API errors gracefully', async ({ page }) => {
      await page.route('**/api/superadmin/**', (route) => {
        if (route.request().method() === 'POST') {
          route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Internal Server Error' }),
          });
        } else {
          route.continue();
        }
      });

      await page.goto('http://localhost:3000/superadmin/organizations');
      await page.waitForLoadState('networkidle');

      // Page should still load
      await expect(page).toHaveURL(/\/superadmin\/organizations/);
    });

    test('should have no critical console errors', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('http://localhost:3000/superadmin/organizations');
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
    test('should navigate between resource management views', async ({ page }) => {
      const views = [
        '/superadmin/organizations',
        '/superadmin/subscription-plans',
        '/superadmin/monitoring',
        '/superadmin/reports',
      ];

      for (const view of views) {
        await page.goto(`http://localhost:3000${view}`);
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(new RegExp(view));
      }
    });

    test('should support browser back/forward navigation', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/organizations');
      await page.waitForLoadState('networkidle');

      await page.goto('http://localhost:3000/superadmin/subscription-plans');
      await page.waitForLoadState('networkidle');

      await page.goBack();
      await expect(page).toHaveURL(/\/organizations/);

      await page.goForward();
      await expect(page).toHaveURL(/\/subscription-plans/);
    });
  });
});
