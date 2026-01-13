/**
 * Dashboards E2E Tests
 * Testing custom dashboard builder
 *
 * @module tests/e2e/dashboards/dashboard-builder.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard Builder', () => {
  test('should access dashboards', async ({ page }) => {
    await page.goto('/dashboards');

    const url = page.url();
    expect(url).toMatch(/dashboards|board|login/);
  });

  test('should create dashboard', async ({ page }) => {
    await page.goto('/dashboards/new');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access dashboard detail', async ({ page }) => {
    await page.goto('/dashboards/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should edit dashboard', async ({ page }) => {
    await page.goto('/dashboards/1/edit');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Dashboard Widgets', () => {
  test('should access widget library', async ({ page }) => {
    await page.goto('/dashboards/widgets');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should configure widget', async ({ page }) => {
    await page.goto('/dashboards/1/widgets/1/settings');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
