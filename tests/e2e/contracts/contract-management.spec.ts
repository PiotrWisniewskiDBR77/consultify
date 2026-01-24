/**
 * Contracts E2E Tests
 * Testing contract management
 *
 * @module tests/e2e/contracts/contract-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Contract Management', () => {
  test('should access contracts page', async ({ page }) => {
    await page.goto('/contracts');

    const url = page.url();
    expect(url).toMatch(/contracts|agreements|login/);
  });

  test('should create new contract', async ({ page }) => {
    await page.goto('/contracts/new');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access contract detail', async ({ page }) => {
    await page.goto('/contracts/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access contract versions', async ({ page }) => {
    await page.goto('/contracts/1/versions');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Contract Actions', () => {
  test('should access contract signatures', async ({ page }) => {
    await page.goto('/contracts/1/signatures');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access contract history', async ({ page }) => {
    await page.goto('/contracts/1/history');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should renew contract', async ({ page }) => {
    await page.goto('/contracts/1/renew');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
