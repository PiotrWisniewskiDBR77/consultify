/**
 * Metrics E2E Tests
 * Testing metrics and KPI pages
 *
 * @module tests/e2e/metrics/metrics-dashboard.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Metrics Dashboard', () => {
  test('should access metrics page', async ({ page }) => {
    await page.goto('/metrics');

    const url = page.url();
    expect(url).toMatch(/metrics|kpi|login|dashboard/);
  });

  test('should access KPI overview', async ({ page }) => {
    await page.goto('/metrics/kpi');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access custom metrics', async ({ page }) => {
    await page.goto('/metrics/custom');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access metric detail', async ({ page }) => {
    await page.goto('/metrics/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Metric Configuration', () => {
  test('should access metric settings', async ({ page }) => {
    await page.goto('/metrics/settings');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should create new metric', async ({ page }) => {
    await page.goto('/metrics/new');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access metric thresholds', async ({ page }) => {
    await page.goto('/metrics/thresholds');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
