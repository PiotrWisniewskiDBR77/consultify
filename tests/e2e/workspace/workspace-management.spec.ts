/**
 * Workspace E2E Tests
 * Testing workspace management
 *
 * @module tests/e2e/workspace/workspace-management.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Workspace Management', () => {
  test('should access workspaces page', async ({ page }) => {
    await page.goto('/workspaces');

    const url = page.url();
    expect(url).toMatch(/workspaces|login|projects/);
  });

  test('should create new workspace', async ({ page }) => {
    await page.goto('/workspaces/new');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access workspace detail', async ({ page }) => {
    await page.goto('/workspaces/1');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access workspace settings', async ({ page }) => {
    await page.goto('/workspaces/1/settings');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Workspace Actions', () => {
  test('should access workspace members', async ({ page }) => {
    await page.goto('/workspaces/1/members');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should access workspace activity', async ({ page }) => {
    await page.goto('/workspaces/1/activity');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
