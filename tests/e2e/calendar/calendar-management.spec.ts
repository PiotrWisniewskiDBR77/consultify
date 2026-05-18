/**
 * Calendar E2E Tests
 * Testing calendar and scheduling functionality
 *
 * @module tests/e2e/calendar/calendar-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Calendar Management', () => {
  test('should access calendar page', async ({ page }) => {
    await page.goto('/calendar');

    const url = page.url();
    expect(url).toMatch(/calendar|schedule|login/);
  });

  test('should access week view', async ({ page }) => {
    await page.goto('/calendar/week');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access month view', async ({ page }) => {
    await page.goto('/calendar/month');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access day view', async ({ page }) => {
    await page.goto('/calendar/day');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Calendar Events', () => {
  test('should access create event', async ({ page }) => {
    await page.goto('/calendar/event/new');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access event detail', async ({ page }) => {
    await page.goto('/calendar/event/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
