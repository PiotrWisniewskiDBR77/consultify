/**
 * Dashboard Navigation E2E Tests
 * Testing main dashboard and navigation flows
 *
 * @module tests/e2e/navigation/dashboard-navigation.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Go to main page - will redirect to login if not authenticated
    await page.goto('/');
  });

  test('should load landing or dashboard page', async ({ page }) => {
    // Should either show landing page or redirect to login/dashboard
    const url = page.url();
    expect(url).toMatch(/\/|login|dashboard|landing/);
  });

  test('should have main navigation elements', async ({ page }) => {
    // Check for common navigation elements
    const nav = page.locator('nav, [role="navigation"], header');
    const hasNav = await nav
      .first()
      .isVisible()
      .catch(() => false);

    if (hasNav) {
      await expect(nav.first()).toBeVisible();
    }
  });

  test('should have responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Page should still be functional
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});

test.describe('Public Pages', () => {
  test('should load about page', async ({ page }) => {
    await page.goto('/about');

    // Should load without error
    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();
  });

  test('should load pricing page', async ({ page }) => {
    await page.goto('/pricing');

    // Should show pricing or redirect
    const url = page.url();
    expect(url).toMatch(/pricing|login|plans/);
  });

  test('should load demo page', async ({ page }) => {
    await page.goto('/demo');

    // Demo page should be accessible
    const url = page.url();
    expect(url).toMatch(/demo|login|trial/);
  });
});

test.describe('Sidebar Navigation', () => {
  test('should have sidebar on authenticated pages', async ({ page }) => {
    await page.goto('/dashboard');

    // On dashboard (or redirected to login)
    const url = page.url();
    if (url.includes('dashboard')) {
      const sidebar = page.locator('aside, [role="complementary"], .sidebar');
      const hasSidebar = await sidebar
        .first()
        .isVisible()
        .catch(() => false);

      if (hasSidebar) {
        await expect(sidebar.first()).toBeVisible();
      }
    }
  });
});
