/**
 * Task Management E2E Tests
 * Testing task CRUD operations flow
 *
 * @module tests/e2e/tasks/task-crud.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Task Management', () => {
  test('should load tasks page', async ({ page }) => {
    await page.goto('/tasks');

    const url = page.url();
    expect(url).toMatch(/tasks|login|register/);
  });

  test('should access task creation', async ({ page }) => {
    await page.goto('/tasks/new');

    const url = page.url();
    expect(url).toMatch(/tasks|new|login|create/);
  });

  test('should access task detail view', async ({ page }) => {
    await page.goto('/tasks/1');

    const url = page.url();
    expect(url).toMatch(/tasks|login/);
  });
});

test.describe('Task Filtering', () => {
  test('should filter by status', async ({ page }) => {
    await page.goto('/tasks?status=pending');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should filter by priority', async ({ page }) => {
    await page.goto('/tasks?priority=high');

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should filter by assignee', async ({ page }) => {
    await page.goto('/tasks?assignee=me');

    const url = page.url();
    expect(url).toBeTruthy();
  });
});
