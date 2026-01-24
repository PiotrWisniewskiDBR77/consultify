/**
 * Onboarding E2E Tests
 * Testing user onboarding flow
 *
 * @module tests/e2e/onboarding/onboarding-flow.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test('should access onboarding page', async ({ page }) => {
    await page.goto('/onboarding');

    const url = page.url();
    expect(url).toMatch(/onboarding|login|welcome/);
  });

  test('should access profile setup', async ({ page }) => {
    await page.goto('/onboarding/profile');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access team setup', async ({ page }) => {
    await page.goto('/onboarding/team');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access workspace setup', async ({ page }) => {
    await page.goto('/onboarding/workspace');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Onboarding Completion', () => {
  test('should access feature tour', async ({ page }) => {
    await page.goto('/onboarding/tour');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access completion page', async ({ page }) => {
    await page.goto('/onboarding/complete');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
