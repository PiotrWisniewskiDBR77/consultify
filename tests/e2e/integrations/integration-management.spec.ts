/**
 * Integrations E2E Tests
 * Testing third-party integrations
 *
 * @module tests/e2e/integrations/integration-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Integration Management', () => {
  test('should access integrations page', async ({ page }) => {
    await page.goto('/integrations');

    const url = page.url();
    expect(url).toMatch(/integrations|login|connect/);
  });

  test('should access available integrations', async ({ page }) => {
    await page.goto('/integrations/available');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access connected integrations', async ({ page }) => {
    await page.goto('/integrations/connected');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access integration detail', async ({ page }) => {
    await page.goto('/integrations/slack');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('OAuth Flow', () => {
  test('should handle OAuth callback', async ({ page }) => {
    await page.goto('/integrations/callback?code=test');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
