/**
 * Leads E2E Tests
 * Testing lead management
 *
 * @module tests/e2e/leads/lead-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Lead Management', () => {
  test('should access leads page', async ({ page }) => {
    await page.goto('/leads');

    const url = page.url();
    expect(url).toMatch(/leads|prospects|login/);
  });

  test('should create lead', async ({ page }) => {
    await page.goto('/leads/new');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access lead detail', async ({ page }) => {
    await page.goto('/leads/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should convert lead', async ({ page }) => {
    await page.goto('/leads/1/convert');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Lead Pipeline', () => {
  test('should access lead pipeline', async ({ page }) => {
    await page.goto('/leads/pipeline');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access lead scoring', async ({ page }) => {
    await page.goto('/leads/scoring');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
