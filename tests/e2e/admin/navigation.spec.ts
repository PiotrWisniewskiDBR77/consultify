/**
 * Admin Panel Navigation E2E Tests
 * Tests navigation between all 8 Admin modules in sidebar
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Panel Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Admin panel (assuming authentication is handled)
    await page.goto('http://localhost:3000/admin');
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Wait for sidebar to be visible
    await page.waitForSelector('[data-testid="admin-sidebar"], nav, aside', { timeout: 5000 });
  });

  const adminModules = [
    {
      name: 'Overview',
      route: '/admin/overview',
      selector: '[data-testid="overview-module"], .overview-module, [class*="Overview"]',
    },
    {
      name: 'Organization',
      route: '/admin/organization',
      selector:
        '[data-testid="organization-module"], .organization-module, [class*="Organization"]',
    },
    {
      name: 'Team',
      route: '/admin/team',
      selector: '[data-testid="team-module"], .team-module, [class*="Team"]',
    },
    {
      name: 'Workspace',
      route: '/admin/workspace',
      selector: '[data-testid="workspace-module"], .workspace-module, [class*="Workspace"]',
    },
    {
      name: 'AI',
      route: '/admin/ai',
      selector: '[data-testid="ai-module"], .ai-module, [class*="AI"]',
    },
    {
      name: 'Billing',
      route: '/admin/billing',
      selector: '[data-testid="billing-module"], .billing-module, [class*="Billing"]',
    },
    {
      name: 'Security',
      route: '/admin/security',
      selector: '[data-testid="security-module"], .security-module, [class*="Security"]',
    },
    {
      name: 'Feedback',
      route: '/admin/feedback',
      selector: '[data-testid="feedback-module"], .feedback-module, [class*="Feedback"]',
    },
  ];

  // Test navigation to each module via sidebar click
  for (const module of adminModules) {
    test(`should navigate to ${module.name} module via sidebar`, async ({ page }) => {
      // Find sidebar button for this module
      const sidebarButton = page
        .locator(
          `button:has-text("${module.name}"), a:has-text("${module.name}"), [aria-label*="${module.name}"]`
        )
        .first();

      // Click sidebar button
      await sidebarButton.click({ timeout: 5000 });

      // Wait for navigation
      await page.waitForURL(new RegExp(module.route.replace(/\//g, '\\/')), { timeout: 10000 });

      // Verify URL
      await expect(page).toHaveURL(new RegExp(module.route.replace(/\//g, '\\/')));

      // Verify module content is visible
      const moduleContent = page.locator(module.selector).first();
      await expect(moduleContent).toBeVisible({ timeout: 5000 });
    });
  }

  // Test direct URL navigation (deep linking)
  for (const module of adminModules) {
    test(`should load ${module.name} module via direct URL`, async ({ page }) => {
      await page.goto(`http://localhost:3000${module.route}`);
      await page.waitForLoadState('networkidle');

      // Verify URL
      await expect(page).toHaveURL(new RegExp(module.route.replace(/\//g, '\\/')));

      // Verify module content is visible
      const moduleContent = page.locator(module.selector).first();
      await expect(moduleContent).toBeVisible({ timeout: 5000 });
    });
  }

  // Test navigation between modules sequentially
  test('should navigate through all modules sequentially', async ({ page }) => {
    for (let i = 0; i < adminModules.length; i++) {
      const module = adminModules[i];

      // Navigate to module
      await page.goto(`http://localhost:3000${module.route}`);
      await page.waitForLoadState('networkidle');

      // Verify URL
      await expect(page).toHaveURL(new RegExp(module.route.replace(/\//g, '\\/')));

      // Verify module content
      const moduleContent = page.locator(module.selector).first();
      await expect(moduleContent).toBeVisible({ timeout: 5000 });
    }
  });

  // Test browser back/forward navigation
  test('should handle browser back/forward navigation', async ({ page }) => {
    // Navigate to first module
    await page.goto(`http://localhost:3000${adminModules[0].route}`);
    await page.waitForLoadState('networkidle');

    // Navigate to second module
    await page.goto(`http://localhost:3000${adminModules[1].route}`);
    await page.waitForLoadState('networkidle');

    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Verify we're back at first module
    await expect(page).toHaveURL(new RegExp(adminModules[0].route.replace(/\//g, '\\/')));

    // Go forward
    await page.goForward();
    await page.waitForLoadState('networkidle');

    // Verify we're at second module
    await expect(page).toHaveURL(new RegExp(adminModules[1].route.replace(/\//g, '\\/')));
  });

  // Test URL synchronization with sidebar clicks
  test('should synchronize URL when clicking sidebar buttons', async ({ page }) => {
    // Start at Overview
    await page.goto('http://localhost:3000/admin/overview');
    await page.waitForLoadState('networkidle');

    // Click Team button in sidebar
    const teamButton = page
      .locator('button:has-text("Team"), a:has-text("Team"), [aria-label*="Team"]')
      .first();
    await teamButton.click({ timeout: 5000 });

    // Wait for navigation
    await page.waitForURL(/\/admin\/team/, { timeout: 10000 });

    // Verify URL changed
    await expect(page).toHaveURL(/\/admin\/team/);
  });
});
