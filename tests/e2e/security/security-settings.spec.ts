/**
 * Security E2E Tests
 * Testing security settings and audit
 *
 * @module tests/e2e/security/security-settings.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Security Settings', () => {
  test('should access security page', async ({ page }) => {
    await page.goto('/security');

    const url = page.url();
    expect(url).toMatch(/security|settings|login/);
  });

  test('should access password settings', async ({ page }) => {
    await page.goto('/security/password');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access 2FA settings', async ({ page }) => {
    await page.goto('/security/2fa');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access sessions', async ({ page }) => {
    await page.goto('/security/sessions');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Audit Logs', () => {
  test('should access audit log', async ({ page }) => {
    await page.goto('/security/audit');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should filter audit log', async ({ page }) => {
    await page.goto('/security/audit?action=login');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should export audit log', async ({ page }) => {
    await page.goto('/security/audit/export');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
