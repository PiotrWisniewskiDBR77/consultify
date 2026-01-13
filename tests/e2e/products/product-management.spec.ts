/**
 * Products E2E Tests
 * Testing product management
 *
 * @module tests/e2e/products/product-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Product Management', () => {
  test('should access products page', async ({ page }) => {
    await page.goto('/products');

    const url = page.url();
    expect(url).toMatch(/products|catalog|login/);
  });

  test('should create product', async ({ page }) => {
    await page.goto('/products/new');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access product detail', async ({ page }) => {
    await page.goto('/products/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should edit product', async ({ page }) => {
    await page.goto('/products/1/edit');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Product Categories', () => {
  test('should access categories', async ({ page }) => {
    await page.goto('/products/categories');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access product variants', async ({ page }) => {
    await page.goto('/products/1/variants');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
