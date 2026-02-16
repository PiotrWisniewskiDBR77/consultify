/**
 * E2E Tests - Resource Management Flows
 * End-to-end user flows for resource allocation management
 */

import { test, expect } from '@playwright/test';

test.describe('Resource Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login as SuperAdmin
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'superadmin@test.com');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('SuperAdmin: Create new subscription plan flow', async ({ page }) => {
    // Navigate to subscription plans
    await page.goto('/superadmin/subscription-plans');
    await expect(page.locator('h1')).toContainText('Subscription Plans Management');

    // Click create button
    await page.click('text=+ Create New Plan');

    // Wait for modal
    await expect(page.locator('.modal-content')).toBeVisible();
    await expect(page.locator('h2')).toContainText('Create New Plan');

    // Fill form
    await page.fill('input[placeholder*="Professional"]', 'E2E Test Plan');
    await page.fill('input[placeholder="29.99"]', '49.99');
    await page.fill('input:has-text("Memory Limit")', '2048');
    await page.fill('input:has-text("CPU Quota")', '40');
    await page.fill('input:has-text("Token Limit")', '200000');
    await page.fill('input:has-text("Storage Limit")', '20');
    await page.fill('input:has-text("Max Concurrent AI Jobs")', '10');

    // Submit form
    await page.click('button:has-text("Create Plan")');

    // Verify success toast
    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page.locator('.toast-success')).toContainText('Plan created successfully');

    // Verify plan appears in table
    await expect(page.locator('td:has-text("E2E Test Plan")')).toBeVisible();
  });

  test('SuperAdmin: Update organization budget flow', async ({ page }) => {
    // Navigate to resource management
    await page.goto('/superadmin/resource-management');

    // Select organization
    await page.selectOption('select.org-selector', { index: 1 }); // Select first org

    // Wait for data to load
    await expect(page.locator('.resource-card')).toBeVisible();

    // Click update budget
    await page.click('button:has-text("Update Budget")');

    // Wait for modal
    await expect(page.locator('.modal-content')).toBeVisible();

    // Update budget
    await page.fill('input[label*="Monthly Budget"]', '2000');
    await page.fill('input[label*="Alert Threshold"]', '0.75');

    // Submit
    await page.click('button:has-text("Update")');

    // Verify success toast
    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page.locator('.toast-success')).toContainText('Budget updated successfully');
  });

  test('SuperAdmin: Charge for resource change flow', async ({ page }) => {
    await page.goto('/superadmin/resource-management');

    // Select organization
    await page.selectOption('select.org-selector', { index: 1 });
    await expect(page.locator('.resource-card')).toBeVisible();

    // Click charge for change
    await page.click('button:has-text("Charge for Change")');

    // Fill charge form
    await page.selectOption('select[label*="Change Type"]', 'memory_increase');
    await page.fill('input[label*="Old Value"]', '1024');
    await page.fill('input[label*="New Value"]', '2048');
    await page.fill('input[label*="Charge Amount"]', '50');
    await page.fill('textarea[label*="Description"]', 'Memory upgrade to 2GB');

    // Submit
    await page.click('button:has-text("Charge $50.00")');

    // Verify success
    await expect(page.locator('.toast-success')).toBeVisible();
  });

  test('SuperAdmin: Search and filter plans', async ({ page }) => {
    await page.goto('/superadmin/subscription-plans');

    // Search for plan
    await page.fill('input[placeholder*="Search plans"]', 'Pro');

    // Verify filtered results
    await expect(page.locator('td:has-text("Pro")')).toBeVisible();

    // Clear search
    await page.fill('input[placeholder*="Search plans"]', '');

    // Verify all plans visible again
    await expect(page.locator('.plans-table tbody tr')).toHaveCount(3); // Assuming 3 default plans
  });

  test('Admin: View budget dashboard', async ({ page }) => {
    // Logout and login as admin
    await page.goto('/auth/logout');
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');

    // Navigate to budget
    await page.goto('/admin/budget');

    // Verify budget cards visible
    await expect(page.locator('.overview-card')).toHaveCount(3);
    await expect(page.locator('text=Monthly Budget')).toBeVisible();
    await expect(page.locator('text=Spent')).toBeVisible();
    await expect(page.locator('text=Remaining')).toBeVisible();

    // Verify charts render
    await expect(page.locator('canvas')).toHaveCount(2); // Line + Pie charts

    // Verify expense table
    await expect(page.locator('.expenses-table')).toBeVisible();
  });

  test('Admin: Filter expenses by category', async ({ page }) => {
    // Login as admin (abbreviated)
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');

    await page.goto('/admin/budget');

    // Select category filter
    await page.selectOption('select.category-filter', 'TOKENS');

    // Verify table updates
    await expect(page.locator('.category-badge.tokens')).toBeVisible();
  });

  test('Admin: Pagination through expenses', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');

    await page.goto('/admin/budget');

    // Click next page
    await page.click('button:has-text("Next")');

    // Verify page indicator updates
    await expect(page.locator('.page-info')).toContainText('Page 2');

    // Click previous
    await page.click('button:has-text("Previous")');
    await expect(page.locator('.page-info')).toContainText('Page 1');
  });

  test('Authorization: Regular user cannot access SuperAdmin routes', async ({ page }) => {
    // Logout and login as regular user
    await page.goto('/auth/logout');
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'user@test.com');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');

    // Try to access SuperAdmin route
    await page.goto('/superadmin/subscription-plans');

    // Should redirect or show error
    await expect(page).not.toHaveURL('/superadmin/subscription-plans');
    // OR
    await expect(page.locator('text=Access Denied')).toBeVisible();
  });
});
