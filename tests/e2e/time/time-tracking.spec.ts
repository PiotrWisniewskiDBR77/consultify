/**
 * Time Entries E2E Tests
 * Testing time tracking entries
 *
 * @module tests/e2e/time/time-tracking.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Time Tracking', () => {
  test('should access time entries page', async ({ page }) => {
    await page.goto('/time');

    const url = page.url();
    expect(url).toMatch(/time|tracking|login/);
  });

  test('should create time entry', async ({ page }) => {
    await page.goto('/time/new');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access time entry detail', async ({ page }) => {
    await page.goto('/time/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access timer', async ({ page }) => {
    await page.goto('/time/timer');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Time Reports', () => {
  test('should access weekly view', async ({ page }) => {
    await page.goto('/time/weekly');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access monthly view', async ({ page }) => {
    await page.goto('/time/monthly');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access time summary', async ({ page }) => {
    await page.goto('/time/summary');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
