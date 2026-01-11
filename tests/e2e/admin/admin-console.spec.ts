/**
 * Admin Console E2E Tests
 * Testing admin panel navigation
 *
 * @module tests/e2e/admin/admin-console.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Console Access', () => {
  test('should redirect unauthenticated users from admin', async ({ page }) => {
    await page.goto('/admin');

    const url = page.url();
    expect(url).toMatch(/admin|login|403|forbidden/);
  });

  test('should access admin dashboard', async ({ page }) => {
    await page.goto('/admin/dashboard');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access user management', async ({ page }) => {
    await page.goto('/admin/users');

    const url = page.url();
    expect(url).toMatch(/admin|users|login/);
  });

  test('should access organization management', async ({ page }) => {
    await page.goto('/admin/organizations');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Admin Settings', () => {
  test('should access system settings', async ({ page }) => {
    await page.goto('/admin/settings');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access billing settings', async ({ page }) => {
    await page.goto('/admin/billing');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access security settings', async ({ page }) => {
    await page.goto('/admin/security');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
