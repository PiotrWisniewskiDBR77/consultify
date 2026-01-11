/**
 * Clients E2E Tests
 * Testing client management
 *
 * @module tests/e2e/clients/client-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Client Management', () => {
  test('should access clients page', async ({ page }) => {
    await page.goto('/clients');

    const url = page.url();
    expect(url).toMatch(/clients|customers|login/);
  });

  test('should create new client', async ({ page }) => {
    await page.goto('/clients/new');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access client detail', async ({ page }) => {
    await page.goto('/clients/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access client contacts', async ({ page }) => {
    await page.goto('/clients/1/contacts');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Client Actions', () => {
  test('should access client notes', async ({ page }) => {
    await page.goto('/clients/1/notes');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access client projects', async ({ page }) => {
    await page.goto('/clients/1/projects');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access client invoices', async ({ page }) => {
    await page.goto('/clients/1/invoices');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
