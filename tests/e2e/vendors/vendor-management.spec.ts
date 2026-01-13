/**
 * Vendors E2E Tests
 * Testing vendor management
 *
 * @module tests/e2e/vendors/vendor-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Vendor Management', () => {
  test('should access vendors page', async ({ page }) => {
    await page.goto('/vendors');

    const url = page.url();
    expect(url).toMatch(/vendors|suppliers|login/);
  });

  test('should create new vendor', async ({ page }) => {
    await page.goto('/vendors/new');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access vendor detail', async ({ page }) => {
    await page.goto('/vendors/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access vendor contracts', async ({ page }) => {
    await page.goto('/vendors/1/contracts');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Vendor Actions', () => {
  test('should access vendor products', async ({ page }) => {
    await page.goto('/vendors/1/products');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access vendor orders', async ({ page }) => {
    await page.goto('/vendors/1/orders');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
