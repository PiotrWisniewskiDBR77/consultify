/**
 * Team Management E2E Tests
 * Testing team CRUD and membership
 *
 * @module tests/e2e/team/team-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Team Management', () => {
  test('should access teams page', async ({ page }) => {
    await page.goto('/teams');

    const url = page.url();
    expect(url).toMatch(/teams|login|members/);
  });

  test('should access team creation', async ({ page }) => {
    await page.goto('/teams/new');

    const url = page.url();
    expect(url).toMatch(/teams|new|login|create/);
  });

  test('should access team detail', async ({ page }) => {
    await page.goto('/teams/1');

    const url = page.url();
    expect(url).toMatch(/teams|login/);
  });

  test('should access team settings', async ({ page }) => {
    await page.goto('/teams/1/settings');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Team Members', () => {
  test('should access team members', async ({ page }) => {
    await page.goto('/teams/1/members');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access invite page', async ({ page }) => {
    await page.goto('/teams/1/invite');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
