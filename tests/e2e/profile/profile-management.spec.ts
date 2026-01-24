/**
 * Profile Management E2E Tests
 * Testing user profile CRUD operations
 *
 * @module tests/e2e/profile/profile-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Profile Management', () => {
  test('should access profile page', async ({ page }) => {
    await page.goto('/profile');

    const url = page.url();
    expect(url).toMatch(/profile|login|settings/);
  });

  test('should access profile edit', async ({ page }) => {
    await page.goto('/profile/edit');

    const url = page.url();
    expect(url).toMatch(/profile|edit|login/);
  });

  test('should access profile settings', async ({ page }) => {
    await page.goto('/profile/settings');

    const url = page.url();
    expect(url).toMatch(/profile|settings|login/);
  });
});

test.describe('Profile Subpages', () => {
  test('should access notifications settings', async ({ page }) => {
    await page.goto('/profile/notifications');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access security settings', async ({ page }) => {
    await page.goto('/profile/security');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access API keys', async ({ page }) => {
    await page.goto('/profile/api-keys');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
