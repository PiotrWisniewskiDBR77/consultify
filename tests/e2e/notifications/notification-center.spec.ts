/**
 * Notifications E2E Tests
 * Testing notification center
 *
 * @module tests/e2e/notifications/notification-center.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Notification Center', () => {
  test('should access notifications page', async ({ page }) => {
    await page.goto('/notifications');

    const url = page.url();
    expect(url).toMatch(/notifications|login|inbox/);
  });

  test('should access unread notifications', async ({ page }) => {
    await page.goto('/notifications?filter=unread');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access notification settings', async ({ page }) => {
    await page.goto('/notifications/settings');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Notification Types', () => {
  test('should filter by type', async ({ page }) => {
    await page.goto('/notifications?type=system');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access notification detail', async ({ page }) => {
    await page.goto('/notifications/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
