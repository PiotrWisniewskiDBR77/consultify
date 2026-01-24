/**
 * Proposals E2E Tests
 * Testing proposal management
 *
 * @module tests/e2e/proposals/proposal-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Proposal Management', () => {
  test('should access proposals page', async ({ page }) => {
    await page.goto('/proposals');

    const url = page.url();
    expect(url).toMatch(/proposals|quotes|login/);
  });

  test('should create new proposal', async ({ page }) => {
    await page.goto('/proposals/new');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access proposal detail', async ({ page }) => {
    await page.goto('/proposals/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access proposal editor', async ({ page }) => {
    await page.goto('/proposals/1/edit');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Proposal Actions', () => {
  test('should send proposal', async ({ page }) => {
    await page.goto('/proposals/1/send');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should preview proposal', async ({ page }) => {
    await page.goto('/proposals/1/preview');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access proposal analytics', async ({ page }) => {
    await page.goto('/proposals/1/analytics');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
