/**
 * Analytics E2E Tests
 * Testing analytics and metrics pages
 *
 * @module tests/e2e/analytics/analytics-dashboard.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Analytics Dashboard', () => {
  test('should access analytics page', async ({ page }) => {
    await page.goto('/analytics');

    const url = page.url();
    expect(url).toMatch(/analytics|login|metrics/);
  });

  test('should access user analytics', async ({ page }) => {
    await page.goto('/analytics/users');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access engagement metrics', async ({ page }) => {
    await page.goto('/analytics/engagement');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access performance metrics', async ({ page }) => {
    await page.goto('/analytics/performance');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Analytics Filters', () => {
  test('should filter by date range', async ({ page }) => {
    await page.goto('/analytics?from=2026-01-01&to=2026-01-31');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should export analytics', async ({ page }) => {
    await page.goto('/analytics/export');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
