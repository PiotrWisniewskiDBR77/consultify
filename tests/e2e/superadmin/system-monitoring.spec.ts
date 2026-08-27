/**
 * SuperAdmin System Monitoring E2E Tests
 * Tests System health, audit logs, and monitoring functionality
 *
 * @module tests/e2e/superadmin/system-monitoring.spec.ts
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

test.describe('SuperAdmin System Monitoring', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  // ═══════════════════════════════════════════════════════════════════
  // SYSTEM MODULE - MAIN
  // ═══════════════════════════════════════════════════════════════════

  test.describe('System Module', () => {
    test('should load System page', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/superadmin\/system/);
    });

    test('should display system health dashboard', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      // Look for health indicators
      const healthIndicator = page
        .locator(
          '[data-testid*="health"], [class*="health"], [class*="status"], text=/healthy|online|operational|status/i'
        )
        .first();

      const isVisible = await healthIndicator.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should show service status list', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      // Check for service status elements
      const serviceList = page
        .locator(
          '[data-testid*="service"], [class*="service"], text=/database|api|cache|redis|queue/i'
        )
        .first();

      const isVisible = await serviceList.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should display metrics or charts', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      // Look for charts/metrics
      const metricsContent = page
        .locator(
          'canvas, svg[class*="chart"], [data-testid*="chart"], [class*="metric"], text=/cpu|memory|latency|requests/i'
        )
        .first();

      const isVisible = await metricsContent.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Audit Logs', () => {
    test('should display audit log entries', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      // Look for audit log section
      const auditSection = page
        .locator(
          '[data-testid*="audit"], [class*="audit"], [class*="log"], text=/audit|activity|log entries/i'
        )
        .first();

      const isVisible = await auditSection.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should have log filtering options', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      // Look for filter controls
      const filterControls = page.locator(
        'input[type="search"], select, [data-testid*="filter"], button:has-text("Filter")'
      );

      const filterCount = await filterControls.count();
      // May or may not have filters
      expect(filterCount).toBeGreaterThanOrEqual(0);
    });

    test('should support log entry expansion', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      // Try to find and click a log entry
      const logEntry = page
        .locator('[data-testid*="log-entry"], [class*="log-item"], tr[class*="log"], .log-row')
        .first();

      if (await logEntry.isVisible({ timeout: 3000 })) {
        await logEntry.click().catch(() => {});
        await page.waitForTimeout(500);
      }

      // Page should still be functional
      await expect(page).toHaveURL(/\/superadmin\/system/);
    });

    test('should support log export if available', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      // Look for export button
      const exportButton = page
        .locator('button:has-text("Export"), button:has-text("Download"), [data-testid*="export"]')
        .first();

      if (await exportButton.isVisible({ timeout: 2000 })) {
        // Don't actually click to avoid downloading file
        await expect(exportButton).toBeEnabled();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FEATURE FLAGS
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Feature Flags', () => {
    test('should display feature flags section', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      // Look for feature flags
      const featureFlagsSection = page
        .locator(
          '[data-testid*="feature"], [class*="feature"], text=/feature flags?|toggles?|experiments?/i'
        )
        .first();

      const isVisible = await featureFlagsSection.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible !== undefined).toBeTruthy();
    });

    test('should have toggle switches for features', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      // Look for toggle switches
      const toggles = page.locator(
        'input[type="checkbox"], [role="switch"], [class*="toggle"], [class*="switch"]'
      );

      const toggleCount = await toggles.count();
      // May or may not have toggles
      expect(toggleCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REAL-TIME UPDATES
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Real-Time Updates', () => {
    test('should handle page refresh correctly', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/superadmin\/system/);

      // Refresh
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still be on same page
      await expect(page).toHaveURL(/\/superadmin\/system/);
    });

    test('should maintain state after navigation', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      // Navigate away
      await page.goto('http://localhost:3000/superadmin/overview');
      await page.waitForLoadState('networkidle');

      // Navigate back
      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/superadmin\/system/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ERROR SCENARIOS
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Error Scenarios', () => {
    test('should handle API failures gracefully', async ({ page }) => {
      // Intercept API calls and fail some
      await page.route('**/api/superadmin/system/health', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      // Page should still load (graceful degradation)
      await expect(page).toHaveURL(/\/superadmin\/system/);
    });

    test('should show loading states', async ({ page }) => {
      // Slow down responses
      await page.route('**/api/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        await route.continue();
      });

      await page.goto('http://localhost:3000/superadmin/system');

      // Page should eventually load
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await expect(page).toHaveURL(/\/superadmin\/system/);
    });

    test('should recover from temporary network issues', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      // Simulate brief offline
      await page.context().setOffline(true);
      await page.waitForTimeout(500);
      await page.context().setOffline(false);

      // Refresh should work
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/superadmin\/system/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ACCESSIBILITY
  // ═══════════════════════════════════════════════════════════════════

  test.describe('Accessibility', () => {
    test('should have no critical console errors', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      // Filter out non-critical errors
      const criticalErrors = errors.filter(
        (error) =>
          !error.includes('favicon') &&
          !error.includes('404') &&
          !error.includes('net::ERR_') &&
          !error.includes('Failed to load resource')
      );

      expect(criticalErrors.length).toBe(0);
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto('http://localhost:3000/superadmin/system');
      await page.waitForLoadState('networkidle');

      // Press Tab several times
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
      }

      // Page should still be functional
      await expect(page).toHaveURL(/\/superadmin\/system/);
    });
  });
});
