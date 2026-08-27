/**
 * E2E Tests for SuperAdmin IAM Module
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

test.describe('SuperAdmin IAM Module', () => {
    test.beforeEach(async ({ page }) => {
        // Login as superadmin
        await page.goto(`${BASE_URL}/login`);
        await page.fill('input[name="email"]', (process.env.TEST_USER_EMAIL || 'test@localhost'));
        await page.fill('input[name="password"]', (process.env.TEST_USER_PASSWORD || 'testpassword123'));
        await page.click('button[type="submit"]');
        await page.waitForURL(`${BASE_URL}/**`);
    });

    test.describe('Navigation', () => {
        test('should navigate to IAM module from sidebar', async ({ page }) => {
            await page.goto(`${BASE_URL}/superadmin`);
            await page.click('[data-testid="sidebar-iam"]');
            await expect(page.locator('h1')).toContainText('Identity & Access Management');
        });

        test('should display all IAM tabs', async ({ page }) => {
            await page.goto(`${BASE_URL}/superadmin/iam`);
            await expect(page.locator('[data-testid="tab-admin-sessions"]')).toBeVisible();
            await expect(page.locator('[data-testid="tab-admin-audit"]')).toBeVisible();
            await expect(page.locator('[data-testid="tab-permissions"]')).toBeVisible();
            await expect(page.locator('[data-testid="tab-approval-workflows"]')).toBeVisible();
        });
    });

    test.describe('Admin Sessions', () => {
        test('should display sessions table', async ({ page }) => {
            await page.goto(`${BASE_URL}/superadmin/iam`);
            await page.click('[data-testid="tab-admin-sessions"]');
            await expect(page.locator('table')).toBeVisible();
        });

        test('should show session details', async ({ page }) => {
            await page.goto(`${BASE_URL}/superadmin/iam`);
            await page.click('[data-testid="tab-admin-sessions"]');
            
            // Check for expected columns
            await expect(page.locator('th:has-text("Admin ID")')).toBeVisible();
            await expect(page.locator('th:has-text("IP Address")')).toBeVisible();
            await expect(page.locator('th:has-text("MFA Verified")')).toBeVisible();
            await expect(page.locator('th:has-text("Status")')).toBeVisible();
        });

        test('should revoke single session', async ({ page }) => {
            await page.goto(`${BASE_URL}/superadmin/iam`);
            await page.click('[data-testid="tab-admin-sessions"]');
            
            // Find and click revoke button
            const revokeButton = page.locator('button:has-text("Revoke")').first();
            if (await revokeButton.isVisible()) {
                await revokeButton.click();
                // Confirm dialog
                await page.click('button:has-text("Confirm")');
                await expect(page.locator('.toast-success')).toBeVisible();
            }
        });

        test('should show revoke all sessions confirmation', async ({ page }) => {
            await page.goto(`${BASE_URL}/superadmin/iam`);
            await page.click('[data-testid="tab-admin-sessions"]');
            
            await page.click('button:has-text("Revoke All Active Sessions")');
            await expect(page.locator('.alert-dialog-content')).toBeVisible();
            await expect(page.locator('.alert-dialog-description')).toContainText('ALL active admin sessions');
        });
    });

    test.describe('Admin Audit Logs', () => {
        test('should display audit logs table', async ({ page }) => {
            await page.goto(`${BASE_URL}/superadmin/iam`);
            await page.click('[data-testid="tab-admin-audit"]');
            await expect(page.locator('table')).toBeVisible();
        });

        test('should filter audit logs by action type', async ({ page }) => {
            await page.goto(`${BASE_URL}/superadmin/iam`);
            await page.click('[data-testid="tab-admin-audit"]');
            
            await page.selectOption('[data-testid="filter-action-type"]', 'login');
            await page.waitForLoadState('networkidle');
            // Verify filter applied
        });

        test('should filter audit logs by date range', async ({ page }) => {
            await page.goto(`${BASE_URL}/superadmin/iam`);
            await page.click('[data-testid="tab-admin-audit"]');
            
            await page.fill('[data-testid="filter-date-from"]', '2025-01-01');
            await page.fill('[data-testid="filter-date-to"]', '2025-01-31');
            await page.waitForLoadState('networkidle');
        });
    });

    test.describe('Permissions Matrix', () => {
        test('should display permissions matrix', async ({ page }) => {
            await page.goto(`${BASE_URL}/superadmin/iam`);
            await page.click('[data-testid="tab-permissions"]');
            await expect(page.locator('.permissions-matrix')).toBeVisible();
        });

        test('should toggle permission for role', async ({ page }) => {
            await page.goto(`${BASE_URL}/superadmin/iam`);
            await page.click('[data-testid="tab-permissions"]');
            
            const checkbox = page.locator('.permission-checkbox').first();
            if (await checkbox.isVisible()) {
                await checkbox.click();
                await expect(page.locator('.toast-success')).toBeVisible();
            }
        });

        test('should create new permission', async ({ page }) => {
            await page.goto(`${BASE_URL}/superadmin/iam`);
            await page.click('[data-testid="tab-permissions"]');
            await page.click('button:has-text("Add Permission")');
            
            await page.fill('input[name="key"]', 'test:new:permission');
            await page.fill('input[name="description"]', 'Test permission');
            await page.selectOption('select[name="category"]', 'general');
            await page.click('button:has-text("Create")');
            
            await expect(page.locator('.toast-success')).toBeVisible();
        });
    });

    test.describe('Approval Workflows', () => {
        test('should display workflows list', async ({ page }) => {
            await page.goto(`${BASE_URL}/superadmin/iam`);
            await page.click('[data-testid="tab-approval-workflows"]');
            await expect(page.locator('.workflows-list')).toBeVisible();
        });

        test('should create new workflow', async ({ page }) => {
            await page.goto(`${BASE_URL}/superadmin/iam`);
            await page.click('[data-testid="tab-approval-workflows"]');
            await page.click('button:has-text("Create Workflow")');
            
            await page.fill('input[name="name"]', 'Test Workflow');
            await page.fill('textarea[name="description"]', 'Test description');
            await page.selectOption('select[name="resourceType"]', 'organization');
            await page.click('button:has-text("Save")');
            
            await expect(page.locator('.toast-success')).toBeVisible();
        });

        test('should view pending approval requests', async ({ page }) => {
            await page.goto(`${BASE_URL}/superadmin/iam`);
            await page.click('[data-testid="tab-approval-workflows"]');
            await page.click('[data-testid="tab-pending-requests"]');
            
            await expect(page.locator('.approval-requests-table')).toBeVisible();
        });
    });

    test.describe('Security & Access Control', () => {
        test('should require superadmin role', async ({ page, context }) => {
            // Clear auth
            await context.clearCookies();
            
            // Try to access IAM module without auth
            const response = await page.goto(`${BASE_URL}/api/superadmin/admin/sessions`);
            expect(response?.status()).toBe(401);
        });

        test('should reject non-superadmin users', async ({ page }) => {
            // Login as regular user
            await page.goto(`${BASE_URL}/login`);
            await page.fill('input[name="email"]', 'user@test.com');
            await page.fill('input[name="password"]', 'password123');
            await page.click('button[type="submit"]');
            
            // Try to access IAM module
            await page.goto(`${BASE_URL}/superadmin/iam`);
            await expect(page.locator('.access-denied')).toBeVisible();
        });
    });
});













