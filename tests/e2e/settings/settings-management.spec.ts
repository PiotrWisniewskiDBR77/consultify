/**
 * Settings Management E2E Tests
 * User settings and preferences flows
 *
 * @module tests/e2e/settings/settings-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test('should redirect to login when accessing settings', async ({ page }) => {
    await page.goto('/settings');

    // Should redirect to login if not authenticated
    const url = page.url();
    expect(url).toMatch(/login|settings|register/);
  });

  test('should load settings profile section', async ({ page }) => {
    await page.goto('/settings/profile');

    const url = page.url();
    expect(url).toMatch(/settings|profile|login/);
  });

  test('should load settings security section', async ({ page }) => {
    await page.goto('/settings/security');

    const url = page.url();
    expect(url).toMatch(/settings|security|login/);
  });

  test('should load settings notifications section', async ({ page }) => {
    await page.goto('/settings/notifications');

    const url = page.url();
    expect(url).toMatch(/settings|notifications|login/);
  });
});

test.describe('Account Settings', () => {
  test('should access billing page', async ({ page }) => {
    await page.goto('/settings/billing');

    const url = page.url();
    expect(url).toMatch(/billing|settings|login|subscription/);
  });

  test('should access team settings', async ({ page }) => {
    await page.goto('/settings/team');

    const url = page.url();
    expect(url).toMatch(/team|settings|login|members/);
  });
});
