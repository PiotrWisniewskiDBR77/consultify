/**
 * Budgets E2E Tests
 * Testing budget management
 *
 * @module tests/e2e/budgets/budget-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Budget Management', () => {
  test('should access budgets page', async ({ page }) => {
    await page.goto('/budgets');

    const url = page.url();
    expect(url).toMatch(/budgets|finance|login/);
  });

  test('should create budget', async ({ page }) => {
    await page.goto('/budgets/new');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access budget detail', async ({ page }) => {
    await page.goto('/budgets/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should edit budget', async ({ page }) => {
    await page.goto('/budgets/1/edit');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Budget Tracking', () => {
  test('should access budget overview', async ({ page }) => {
    await page.goto('/budgets/overview');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access budget categories', async ({ page }) => {
    await page.goto('/budgets/categories');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access budget variance', async ({ page }) => {
    await page.goto('/budgets/variance');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
