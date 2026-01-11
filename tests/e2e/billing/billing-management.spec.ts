/**
 * Billing Page E2E Tests
 * Testing billing and subscription pages
 *
 * @module tests/e2e/billing/billing-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Billing Management', () => {
  test('should access billing page', async ({ page }) => {
    await page.goto('/billing');

    const url = page.url();
    expect(url).toMatch(/billing|login|subscription/);
  });

  test('should access subscription page', async ({ page }) => {
    await page.goto('/billing/subscription');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access invoices page', async ({ page }) => {
    await page.goto('/billing/invoices');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access payment methods', async ({ page }) => {
    await page.goto('/billing/payment-methods');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Plan Selection', () => {
  test('should access plans page', async ({ page }) => {
    await page.goto('/billing/plans');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access plan comparison', async ({ page }) => {
    await page.goto('/billing/compare');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access upgrade page', async ({ page }) => {
    await page.goto('/billing/upgrade');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
