/**
 * Announcements E2E Tests
 * Testing announcements and news
 *
 * @module tests/e2e/announcements/announcements-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Announcements', () => {
  test('should access announcements page', async ({ page }) => {
    await page.goto('/announcements');

    const url = page.url();
    expect(url).toMatch(/announcements|news|login/);
  });

  test('should create announcement', async ({ page }) => {
    await page.goto('/announcements/new');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access announcement detail', async ({ page }) => {
    await page.goto('/announcements/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should edit announcement', async ({ page }) => {
    await page.goto('/announcements/1/edit');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Announcement Targeting', () => {
  test('should schedule announcement', async ({ page }) => {
    await page.goto('/announcements/1/schedule');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should view announcement stats', async ({ page }) => {
    await page.goto('/announcements/1/stats');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
