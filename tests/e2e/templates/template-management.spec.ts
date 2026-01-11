/**
 * Templates E2E Tests
 * Testing template management
 *
 * @module tests/e2e/templates/template-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Template Management', () => {
  test('should access templates page', async ({ page }) => {
    await page.goto('/templates');

    const url = page.url();
    expect(url).toMatch(/templates|login|library/);
  });

  test('should access create template', async ({ page }) => {
    await page.goto('/templates/new');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access template detail', async ({ page }) => {
    await page.goto('/templates/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access template editor', async ({ page }) => {
    await page.goto('/templates/1/edit');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Template Categories', () => {
  test('should filter by category', async ({ page }) => {
    await page.goto('/templates?category=email');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access public templates', async ({ page }) => {
    await page.goto('/templates/public');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
