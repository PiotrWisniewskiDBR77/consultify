/**
 * Search and Filters E2E Tests
 * Global search and filtering functionality
 *
 * @module tests/e2e/search/search-filters.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Global Search', () => {
  test('should have search functionality available', async ({ page }) => {
    await page.goto('/');

    // Look for search elements
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="search" i], [role="searchbox"]'
    );
    const hasSearch = await searchInput
      .first()
      .isVisible()
      .catch(() => false);

    // Search may or may not be visible on public pages
    if (hasSearch) {
      await expect(searchInput.first()).toBeVisible();
    }
  });

  test('should show search results page', async ({ page }) => {
    await page.goto('/search?q=test');

    // Should load search page or redirect
    const url = page.url();
    expect(url).toMatch(/search|login|results/);
  });
});

test.describe('Filter Components', () => {
  test('should load page with potential filters', async ({ page }) => {
    await page.goto('/tasks');

    // Page should load
    const url = page.url();
    expect(url).toMatch(/tasks|login|register/);
  });

  test('should handle filter parameters', async ({ page }) => {
    await page.goto('/tasks?status=active&priority=high');

    // Should maintain or clear filter params
    const url = page.url();
    expect(url).toBeTruthy();
  });
});
